import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { type ScanRow, type ScanStatus, scans } from "@/db/schema";

/**
 * Scan data access.
 *
 * Same rule as books.ts: `userId` is the first parameter of every exported
 * function and every statement is scoped by it. Nothing outside this file may
 * touch the `scans` table.
 */

export type Scan = ScanRow;

export type CreateScanInput = {
  id?: string;
  r2Key: string;
  status?: ScanStatus;
};

export async function createScan(
  userId: string,
  db: Database,
  input: CreateScanInput,
): Promise<Scan> {
  const rows = await db
    .insert(scans)
    .values({
      id: input.id ?? crypto.randomUUID(),
      userId,
      r2Key: input.r2Key,
      status: input.status ?? "pending",
    })
    .returning();
  return rows[0];
}

export async function getScan(userId: string, db: Database, scanId: string): Promise<Scan | null> {
  const rows = await db
    .select()
    .from(scans)
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listScans(userId: string, db: Database, limit = 50): Promise<Scan[]> {
  return db
    .select()
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(desc(scans.createdAt))
    .limit(limit);
}

export async function markScanProcessing(
  userId: string,
  db: Database,
  scanId: string,
): Promise<Scan | null> {
  const rows = await db
    .update(scans)
    .set({ status: "processing", errorMessage: null })
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .returning();
  return rows[0] ?? null;
}

export async function markScanDone(
  userId: string,
  db: Database,
  scanId: string,
  input: { detectedCount: number; rawResult?: string | null },
): Promise<Scan | null> {
  const rows = await db
    .update(scans)
    .set({
      status: "done",
      detectedCount: input.detectedCount,
      rawResult: input.rawResult ?? null,
      errorMessage: null,
    })
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .returning();
  return rows[0] ?? null;
}

export async function markScanFailed(
  userId: string,
  db: Database,
  scanId: string,
  input: { errorMessage: string; rawResult?: string | null },
): Promise<Scan | null> {
  const rows = await db
    .update(scans)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      rawResult: input.rawResult ?? null,
    })
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteScan(userId: string, db: Database, scanId: string): Promise<boolean> {
  const rows = await db
    .delete(scans)
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .returning({ id: scans.id });
  return rows.length > 0;
}

export async function deleteAllScans(userId: string, db: Database): Promise<number> {
  const rows = await db.delete(scans).where(eq(scans.userId, userId)).returning({ id: scans.id });
  return rows.length;
}
