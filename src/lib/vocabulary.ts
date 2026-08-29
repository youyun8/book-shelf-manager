/**
 * The controlled vocabularies the source spreadsheet keeps on its lookup sheet
 * (`工作表1`). They are listed in the order people think of them — best to
 * worst for a condition, first to last for a stage — so a sort or a filter list
 * can follow that order instead of the alphabet.
 */
export const STATUS_VALUES = [
  '收藏',
  '待售',
  '待共讀',
  '共讀中',
  '絕版待售',
  '絕版待交換',
] as const;
export const WEAR_VALUES = ['近新', '9新', '8新', '7新', '5-6新'] as const;
export const CONDITION_VALUES = ['無', '點斑', '微斑', '其他(嚴重斑/有破等)'] as const;
export const READING_MODE_VALUES = ['幼兒啟蒙', '親子共讀', '低中年級'] as const;

/**
 * Where a value sits in a known vocabulary. Exact matches win; a value that
 * only contains a known word (`其他(嚴重斑/有破等)`) still ranks with it, and
 * anything unknown ranks after the whole list rather than being dropped.
 */
export function rankOf(values: readonly string[], value: string): number {
  const exact = values.indexOf(value);
  if (exact !== -1) return exact;
  const partial = values.findIndex((known) => value.includes(known));
  return partial === -1 ? values.length : partial;
}

/** True when the text reads as a 狀態 rather than a 書況. */
export function looksLikeStatus(value: string): boolean {
  return value !== '' && rankOf(STATUS_VALUES, value) < STATUS_VALUES.length;
}
