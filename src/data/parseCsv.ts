import Papa from 'papaparse';
import { id } from '../utils/ids';
import { profileColumns } from './profileColumns';
import type { Dataset } from './datasetTypes';

const missing = new Set(['', 'na', 'n/a', 'null', 'none', 'undefined', '-']);
export const normalizeValue = (v: unknown) => typeof v === 'string' && missing.has(v.trim().toLowerCase()) ? null : typeof v === 'string' ? v.trim() : v;

export async function parseCsv(input: File | string, source: Dataset['source'] = 'upload', name?: string): Promise<Dataset> {
  const text = typeof input === 'string' ? input : await input.text();
  if (!text.trim()) throw new Error('This CSV is empty. Choose a file containing a header and at least one row.');
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: h => h.trim()
  });
  if (result.errors.length && result.data.length === 0) throw new Error(result.errors[0].message);
  const headers = result.meta.fields?.filter(Boolean) ?? [];
  if (!headers.length) throw new Error('No header row was found.');
  const rawRows = result.data.filter(r => Object.values(r).some(v => String(v ?? '').trim()));
  if (!rawRows.length) throw new Error('No data rows were found.');
  const rows = rawRows.map(r => Object.fromEntries(headers.map(h => [h, normalizeValue(r[h])])));
  return {
    id: id(),
    name: name ?? (typeof input === 'string' ? 'Dataset' : input.name.replace(/\.csv$/i, '')),
    source,
    createdAt: new Date().toISOString(),
    rowCount: rows.length,
    columnCount: headers.length,
    columns: profileColumns(rows),
    rows,
    fileSize: typeof input === 'string' ? new Blob([input]).size : input.size
  };
}
