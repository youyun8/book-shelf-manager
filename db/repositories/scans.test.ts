import { beforeEach, describe, expect, it } from "vitest";

import { createTestUser, resetDatabase, testDb } from "@/tests/factories";
import { createBook, listBooksByScan } from "./books";
import {
  createScan,
  deleteAllScans,
  deleteScan,
  getScan,
  listScans,
  markScanDone,
  markScanFailed,
  markScanProcessing,
} from "./scans";

const db = () => testDb();

let userA: string;
let userB: string;

beforeEach(async () => {
  await resetDatabase();
  userA = await createTestUser("alice");
  userB = await createTestUser("bob");
});

describe("cross-user isolation", () => {
  it("cannot read another user's scan", async () => {
    const scan = await createScan(userB, db(), { r2Key: `${userB}/x.jpg` });

    expect(await getScan(userA, db(), scan.id)).toBeNull();
    expect(await getScan(userB, db(), scan.id)).not.toBeNull();
  });

  it("cannot advance another user's scan status", async () => {
    const scan = await createScan(userB, db(), { r2Key: `${userB}/x.jpg` });

    expect(await markScanProcessing(userA, db(), scan.id)).toBeNull();
    expect(await markScanDone(userA, db(), scan.id, { detectedCount: 9 })).toBeNull();
    expect(await markScanFailed(userA, db(), scan.id, { errorMessage: "nope" })).toBeNull();

    const untouched = await getScan(userB, db(), scan.id);
    expect(untouched?.status).toBe("pending");
    expect(untouched?.detectedCount).toBe(0);
  });

  it("cannot delete another user's scan", async () => {
    const scan = await createScan(userB, db(), { r2Key: `${userB}/x.jpg` });

    expect(await deleteScan(userA, db(), scan.id)).toBe(false);
    expect(await deleteAllScans(userA, db())).toBe(0);
    expect(await getScan(userB, db(), scan.id)).not.toBeNull();
  });

  it("lists only the calling user's scans", async () => {
    await createScan(userA, db(), { r2Key: `${userA}/a.jpg` });
    await createScan(userB, db(), { r2Key: `${userB}/b.jpg` });

    expect(await listScans(userA, db())).toHaveLength(1);
    expect(await listScans(userB, db())).toHaveLength(1);
  });

  it("does not expose another user's books through a scan id", async () => {
    const scan = await createScan(userB, db(), { r2Key: `${userB}/b.jpg` });
    await createBook(userB, db(), { title: "B 的書", scanId: scan.id });

    expect(await listBooksByScan(userA, db(), scan.id)).toHaveLength(0);
    expect(await listBooksByScan(userB, db(), scan.id)).toHaveLength(1);
  });
});

describe("status transitions", () => {
  it("moves pending -> processing -> done", async () => {
    const scan = await createScan(userA, db(), { r2Key: `${userA}/a.jpg` });
    expect(scan.status).toBe("pending");

    expect((await markScanProcessing(userA, db(), scan.id))?.status).toBe("processing");

    const done = await markScanDone(userA, db(), scan.id, {
      detectedCount: 3,
      rawResult: '{"books":[]}',
    });
    expect(done?.status).toBe("done");
    expect(done?.detectedCount).toBe(3);
    expect(done?.rawResult).toBe('{"books":[]}');
    expect(done?.errorMessage).toBeNull();
  });

  it("records the raw model output alongside a failure so it can be debugged", async () => {
    const scan = await createScan(userA, db(), { r2Key: `${userA}/a.jpg` });

    const failed = await markScanFailed(userA, db(), scan.id, {
      errorMessage: "模型回傳的內容不是合法 JSON",
      rawResult: "not json at all",
    });

    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("模型回傳的內容不是合法 JSON");
    expect(failed?.rawResult).toBe("not json at all");
  });

  it("clears a previous error when a retry starts", async () => {
    const scan = await createScan(userA, db(), { r2Key: `${userA}/a.jpg` });
    await markScanFailed(userA, db(), scan.id, { errorMessage: "boom" });

    const retried = await markScanProcessing(userA, db(), scan.id);
    expect(retried?.errorMessage).toBeNull();
  });
});

describe("deleting a scan", () => {
  it("keeps the books but detaches them", async () => {
    const scan = await createScan(userA, db(), { r2Key: `${userA}/a.jpg` });
    await createBook(userA, db(), { title: "留下來的書", scanId: scan.id });

    expect(await deleteScan(userA, db(), scan.id)).toBe(true);

    const orphans = await listBooksByScan(userA, db(), scan.id);
    expect(orphans).toHaveLength(0);
  });
});
