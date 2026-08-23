/**
 * Display and export formatting.
 *
 * Timestamps are rendered in Asia/Taipei regardless of where the worker runs,
 * so a CSV exported from an edge node in Frankfurt reads the same as one
 * exported in Taipei.
 */
export const TAIPEI_TIME_ZONE = "Asia/Taipei";

const DATE_TIME_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parts(date: Date): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { type, value } of DATE_TIME_PARTS.formatToParts(date)) {
    result[type] = value;
  }
  return result;
}

/** `YYYY-MM-DD HH:mm` in Taipei time. */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const p = parts(date);
  // Intl renders midnight as "24" in some ICU builds; normalise it.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}`;
}

/** `YYYY-MM-DD` in Taipei time. */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Filename stamp: `YYYYMMDD-HHmm` in Taipei time. */
export function formatFileStamp(date: Date): string {
  const p = parts(date);
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}${p.month}${p.day}-${hour}${p.minute}`;
}

/** Joins list values the same way the CSV export does. */
export function joinList(values: readonly string[] | null | undefined): string {
  return (values ?? []).filter(Boolean).join("; ");
}

/** Author line for the UI: shortened once it gets unwieldy. */
export function formatAuthors(authors: readonly string[] | null | undefined): string {
  const list = (authors ?? []).filter(Boolean);
  if (list.length === 0) return "作者未知";
  if (list.length <= 2) return list.join("、");
  return `${list[0]} 等 ${list.length} 人`;
}
