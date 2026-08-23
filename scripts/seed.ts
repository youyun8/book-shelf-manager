/**
 * Seeds the D1 database with two users and twenty books each.
 *
 * Used to exercise the library UI and, importantly, to check that one account
 * cannot see the other's shelf. Runs the generated SQL through
 * `wrangler d1 execute` because D1 bindings only exist inside a worker.
 *
 *   npm run db:seed            # local database
 *   npm run db:seed -- --remote
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DATABASE = "book-shelf-manager";

const remote = process.argv.includes("--remote");

type SeedUser = { key: string; email: string; name: string };

const USERS: SeedUser[] = [
  { key: "alice", email: "alice@example.test", name: "Alice" },
  { key: "bob", email: "bob@example.test", name: "Bob" },
];

const PUBLISHERS = ["遠流", "天下文化", "大塊文化", "時報出版", "商周出版"];
const CATEGORY_SETS = [
  ["文學小說"],
  ["電腦資訊", "程式設計"],
  ["商業理財"],
  ["人文史地", "歷史"],
  ["心理勵志"],
];
const LANGUAGES = ["zh-TW", "zh-TW", "en"];

/** SQLite string literal: single quotes are escaped by doubling them. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function literal(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return quote(value);
}

/** Deterministic id so re-seeding replaces the same rows instead of piling up. */
function seededId(prefix: string, index: number): string {
  return `seed-${prefix}-${String(index).padStart(3, "0")}`;
}

function buildStatements(): string[] {
  const statements: string[] = [];
  const now = Date.now();

  // Start from a clean slate so the script is safe to re-run. Matching on email
  // as well as the seeded id also clears an account created by signing in with
  // one of these addresses during manual testing.
  for (const user of USERS) {
    const id = seededId("user", USERS.indexOf(user));
    const owner = `user_id IN (SELECT id FROM user WHERE id = ${quote(id)} OR email = ${quote(user.email)})`;
    statements.push(`DELETE FROM books WHERE ${owner}`);
    statements.push(`DELETE FROM scans WHERE ${owner}`);
    statements.push(`DELETE FROM session WHERE ${owner}`);
    statements.push(`DELETE FROM account WHERE ${owner}`);
    statements.push(`DELETE FROM user WHERE id = ${quote(id)} OR email = ${quote(user.email)}`);
  }

  USERS.forEach((user, userIndex) => {
    const userId = seededId("user", userIndex);

    statements.push(
      `INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (` +
        [literal(userId), literal(user.name), literal(user.email), 1, now, now].join(", ") +
        `)`,
    );

    for (let i = 0; i < 20; i += 1) {
      const bookId = seededId(`${user.key}-book`, i);
      const purchased = i % 3 === 0;
      const needsReview = i % 7 === 0;
      const hasIsbn = i % 5 !== 0;

      // A stable, valid-looking ISBN-13 that differs per user and per book.
      const isbn13 = hasIsbn ? `978${String(1000000000 + userIndex * 100 + i)}` : null;

      statements.push(
        `INSERT INTO books (` +
          [
            "id",
            "user_id",
            "title",
            "subtitle",
            "authors",
            "publisher",
            "published_date",
            "isbn10",
            "isbn13",
            "page_count",
            "categories",
            "description",
            "language",
            "cover_url",
            "is_purchased",
            "purchased_at",
            "notes",
            "source",
            "confidence",
            "needs_review",
            "created_at",
            "updated_at",
          ].join(", ") +
          `) VALUES (` +
          [
            literal(bookId),
            literal(userId),
            literal(`${user.name} 的藏書 ${String(i + 1).padStart(2, "0")}`),
            i % 4 === 0 ? literal(`副標題 ${i + 1}`) : "NULL",
            literal(JSON.stringify([`${user.name} 作者 ${(i % 6) + 1}`])),
            literal(PUBLISHERS[i % PUBLISHERS.length]),
            literal(`20${String(10 + (i % 15)).padStart(2, "0")}-0${(i % 9) + 1}`),
            "NULL",
            literal(isbn13),
            literal(150 + i * 13),
            literal(JSON.stringify(CATEGORY_SETS[i % CATEGORY_SETS.length])),
            literal(`這是 ${user.name} 書庫中第 ${i + 1} 本書的簡介，用來驗證版面與匯出。`),
            literal(LANGUAGES[i % LANGUAGES.length]),
            "NULL",
            literal(purchased),
            purchased ? literal(now - i * 86_400_000) : "NULL",
            i % 6 === 0 ? literal(`備註 ${i + 1}：想在二手書店找找看。`) : "NULL",
            literal(i % 4 === 0 ? "manual" : "vision"),
            literal(needsReview ? 0.42 : 0.93),
            literal(needsReview),
            // Descending created_at so the default sort is stable and predictable.
            literal(now - i * 60_000),
            literal(now - i * 60_000),
          ].join(", ") +
          `)`,
      );
    }
  });

  return statements;
}

const sql = buildStatements().join(";\n") + ";\n";
const file = join(mkdtempSync(join(tmpdir(), "seed-")), "seed.sql");
writeFileSync(file, sql, "utf8");

const args = [
  "wrangler",
  "d1",
  "execute",
  DATABASE,
  remote ? "--remote" : "--local",
  "--file",
  file,
];
console.log(
  `Seeding ${USERS.length} users x 20 books into the ${remote ? "remote" : "local"} database...`,
);

execFileSync("npx", args, { stdio: "inherit" });

console.log("\nSeeded users:");
for (const [index, user] of USERS.entries()) {
  console.log(`  ${seededId("user", index)}  ${user.email}`);
}
