import { describe, expect, it } from 'vitest';
import { normalizeValue, parseCsv } from './parseCsv';

describe('CSV parsing', () => {
  it('normalizes missing values and profiles columns', async () => {
    const d = await parseCsv('age,color,target\n10,red,1\nNA,blue,0\n12,red,1');
    expect(d.rowCount).toBe(3);
    expect(d.rows[1].age).toBeNull();
    expect(d.columns.find(c => c.name === 'age')?.inferredType).toBe('number')
  });
  it('rejects empty data', async () => {
    await expect(parseCsv('')).rejects.toThrow('empty')
  });
  it('recognizes missing tokens', () => expect(['', 'NA', 'N/A', 'null', 'None', 'undefined', '-'].map(normalizeValue)).toEqual(Array(7).fill(null)))
})
