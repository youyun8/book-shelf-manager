/**
 * Guards the project's single most important invariant.
 *
 * D1 has no row level security, so cross-user isolation is enforced entirely in
 * application code. This script parses the repository layer and fails the build
 * unless:
 *
 *   1. every exported repository function takes `userId: string` first;
 *   2. every select / update / delete statement carries a `.where(...)` that
 *      references `userId`;
 *   3. every insert supplies `userId` in its values;
 *   4. nothing under app/ or components/ imports the db client or drizzle
 *      directly -- all access goes through db/repositories/.
 *
 * Run with `npm run check:isolation` (also part of `npm run lint`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const REPOSITORY_DIR = join(ROOT, "db", "repositories");
const UI_DIRS = [join(ROOT, "app"), join(ROOT, "components")];

const DB_METHODS = new Set(["select", "insert", "update", "delete"]);
const FORBIDDEN_UI_IMPORTS = [/^@\/db\/client$/, /^drizzle-orm(\/|$)/, /^@\/db\/schema$/];

type Failure = { file: string; line: number; message: string };

const failures: Failure[] = [];

function fail(sourceFile: ts.SourceFile, node: ts.Node, message: string): void {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  failures.push({ file: relative(ROOT, sourceFile.fileName), line: line + 1, message });
}

function walkFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function forEachDescendant(node: ts.Node, visit: (n: ts.Node) => void): void {
  node.forEachChild((child) => {
    visit(child);
    forEachDescendant(child, visit);
  });
}

/** True when `userId` is read anywhere inside the subtree. */
function referencesUserId(node: ts.Node): boolean {
  if (ts.isIdentifier(node) && node.text === "userId") return true;
  let found = false;
  forEachDescendant(node, (child) => {
    if (!found && ts.isIdentifier(child) && child.text === "userId") found = true;
  });
  return found;
}

/** Given `db.select()`, climbs to the outermost node of the fluent chain. */
function chainRoot(node: ts.Node): ts.Node {
  let current: ts.Node = node;
  while (
    current.parent &&
    (ts.isPropertyAccessExpression(current.parent) ||
      (ts.isCallExpression(current.parent) && current.parent.expression === current) ||
      ts.isAwaitExpression(current.parent))
  ) {
    current = current.parent;
  }
  return current;
}

function findMethodCalls(node: ts.Node, method: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const check = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === method
    ) {
      calls.push(n);
    }
  };
  check(node);
  forEachDescendant(node, check);
  return calls;
}

function isDbCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "db" &&
    DB_METHODS.has(node.expression.name.text)
  );
}

function checkStatementScoping(sourceFile: ts.SourceFile): void {
  forEachDescendant(sourceFile, (node) => {
    if (!isDbCall(node)) return;
    const method = (node.expression as ts.PropertyAccessExpression).name.text;
    const root = chainRoot(node);

    if (method === "insert") {
      const values = findMethodCalls(root, "values");
      if (values.length === 0) {
        fail(sourceFile, node, "db.insert(...) has no .values(...)");
        return;
      }
      if (!values.some((call) => call.arguments.some(referencesUserId))) {
        fail(sourceFile, node, "db.insert(...).values(...) does not set userId");
      }
      return;
    }

    const wheres = findMethodCalls(root, "where");
    if (wheres.length === 0) {
      fail(sourceFile, node, `db.${method}(...) has no .where(...) clause`);
      return;
    }
    for (const where of wheres) {
      if (!where.arguments.some(referencesUserId)) {
        fail(sourceFile, node, `db.${method}(...).where(...) is not scoped by userId`);
      }
    }
  });
}

function firstParameterIsUserId(
  sourceFile: ts.SourceFile,
  name: string,
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  node: ts.Node,
): void {
  const first = parameters[0];
  if (!first || !ts.isIdentifier(first.name) || first.name.text !== "userId") {
    fail(sourceFile, node, `exported function "${name}" must take userId as its first parameter`);
    return;
  }
  const type = first.type ? first.type.getText(sourceFile) : "";
  if (type !== "string") {
    fail(
      sourceFile,
      node,
      `exported function "${name}" must type userId as string (got "${type}")`,
    );
  }
}

function checkExportedSignatures(sourceFile: ts.SourceFile): void {
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      firstParameterIsUserId(sourceFile, statement.name.text, statement.parameters, statement);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        const init = decl.initializer;
        if (!init) continue;
        if (
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
          ts.isIdentifier(decl.name)
        ) {
          firstParameterIsUserId(sourceFile, decl.name.text, init.parameters, decl);
        }
      }
    }
  }
}

function checkUiImports(): void {
  for (const dir of UI_DIRS) {
    for (const file of walkFiles(dir)) {
      const sourceFile = parse(file);
      for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const specifier = statement.moduleSpecifier.text;
        if (FORBIDDEN_UI_IMPORTS.some((pattern) => pattern.test(specifier))) {
          fail(
            sourceFile,
            statement,
            `app/ and components/ must not import "${specifier}" directly; go through db/repositories/`,
          );
        }
      }
    }
  }
}

const repositoryFiles = walkFiles(REPOSITORY_DIR).filter((f) => !f.endsWith(".test.ts"));

if (repositoryFiles.length === 0) {
  console.error(`✗ no repository files found under ${relative(ROOT, REPOSITORY_DIR)}`);
  process.exit(1);
}

for (const file of repositoryFiles) {
  const sourceFile = parse(file);
  checkExportedSignatures(sourceFile);
  checkStatementScoping(sourceFile);
}

checkUiImports();

if (failures.length > 0) {
  console.error("✗ user isolation check failed:\n");
  for (const { file, line, message } of failures) {
    console.error(`  ${file}:${line}  ${message}`);
  }
  console.error(`\n${failures.length} problem(s) found.`);
  process.exit(1);
}

console.log(
  `✓ user isolation check passed (${repositoryFiles.length} repository file(s), ${UI_DIRS.length} UI dir(s))`,
);
