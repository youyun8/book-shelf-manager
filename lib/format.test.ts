import { describe, expect, it } from "vitest";

import { formatAuthors, formatDate, formatDateTime, formatFileStamp, joinList } from "./format";

describe("Taipei time formatting", () => {
  it("renders UTC instants in Asia/Taipei (UTC+8)", () => {
    // 2024-03-05T01:30Z is 09:30 the same day in Taipei.
    expect(formatDateTime(new Date("2024-03-05T01:30:00Z"))).toBe("2024-03-05 09:30");
  });

  it("rolls over to the next day when the offset crosses midnight", () => {
    // 2024-03-05T20:00Z is 04:00 on the 6th in Taipei.
    expect(formatDateTime(new Date("2024-03-05T20:00:00Z"))).toBe("2024-03-06 04:00");
  });

  it("renders Taipei midnight as 00:00, not 24:00", () => {
    expect(formatDateTime(new Date("2024-03-05T16:00:00Z"))).toBe("2024-03-06 00:00");
  });

  it("formats dates and filename stamps", () => {
    const instant = new Date("2024-12-31T16:05:00Z");
    expect(formatDate(instant)).toBe("2025-01-01");
    expect(formatFileStamp(instant)).toBe("20250101-0005");
  });

  it("returns an empty string for a missing date", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("list formatting", () => {
  it("joins with a semicolon and space, dropping blanks", () => {
    expect(joinList(["王小明", "", "陳大文"])).toBe("王小明; 陳大文");
    expect(joinList([])).toBe("");
    expect(joinList(null)).toBe("");
  });

  it("summarises long author lists for the UI", () => {
    expect(formatAuthors(["王小明"])).toBe("王小明");
    expect(formatAuthors(["王小明", "陳大文"])).toBe("王小明、陳大文");
    expect(formatAuthors(["王小明", "陳大文", "李四"])).toBe("王小明 等 3 人");
    expect(formatAuthors([])).toBe("作者未知");
  });
});
