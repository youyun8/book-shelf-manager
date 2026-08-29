import { describe, expect, it } from 'vitest';
import type { FieldKey } from '../types';
import {
  FACET_KEYS,
  FIELD_LABELS,
  FIELD_ORDER,
  SORT_FIELDS,
  TEXT_KEYS,
  fieldIndex,
} from '../types';
import { EXPORT_FIELDS } from './export-xlsx';

/** Every list of fields shown to a reader has to run in the sheet's order. */
function isInFieldOrder(fields: readonly string[]): boolean {
  const positions = fields.map(fieldIndex);
  return positions.every((position, index) => index === 0 || positions[index - 1]! < position);
}

describe('field order', () => {
  it('is the order of the source spreadsheet', () => {
    expect(FIELD_ORDER.slice(0, 8)).toEqual([
      'title',
      'status',
      'channel',
      'price',
      'wear',
      'condition',
      'location',
      'notes',
    ]);
  });

  it('names every field exactly once', () => {
    expect(new Set(FIELD_ORDER).size).toBe(FIELD_ORDER.length);
    expect(Object.keys(FIELD_LABELS).sort()).toEqual([...FIELD_ORDER].sort());
  });

  it('holds the filters, the sort menu and the export to that order', () => {
    expect(isInFieldOrder(FACET_KEYS)).toBe(true);
    expect(isInFieldOrder(SORT_FIELDS)).toBe(true);
    expect(isInFieldOrder(TEXT_KEYS)).toBe(true);
    expect(isInFieldOrder(EXPORT_FIELDS)).toBe(true);
  });

  it('exports every field, so a download can be imported back unchanged', () => {
    expect([...EXPORT_FIELDS].sort()).toEqual([...FIELD_ORDER].sort());
  });

  it('catches a list that has drifted out of order', () => {
    expect(isInFieldOrder(['status', 'title'] satisfies FieldKey[])).toBe(false);
    expect(isInFieldOrder(['title', 'title'] satisfies FieldKey[])).toBe(false);
  });
});
