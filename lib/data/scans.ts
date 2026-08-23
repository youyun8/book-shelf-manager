/**
 * Server-side scan access. See lib/data/books.ts for the rationale.
 */
import * as repo from "@/db/repositories/scans";

import { bindDb } from "./bind";

export type { CreateScanInput, Scan } from "@/db/repositories/scans";

export const createScan = bindDb(repo.createScan);
export const getScan = bindDb(repo.getScan);
export const listScans = bindDb(repo.listScans);
export const markScanProcessing = bindDb(repo.markScanProcessing);
export const markScanDone = bindDb(repo.markScanDone);
export const markScanFailed = bindDb(repo.markScanFailed);
export const deleteScan = bindDb(repo.deleteScan);
export const deleteAllScans = bindDb(repo.deleteAllScans);
