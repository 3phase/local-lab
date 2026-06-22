import type { ColumnProfile } from './datasetTypes';

const bools = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '0', '1']);
const asText = (v: unknown) => String(v).trim();

export function profileColumns(rows: Record<string, unknown>[]): ColumnProfile[] {
  const names = Object.keys(rows[0] ?? {});
  return names.map(name => {
    const values = rows.map(r => r[name]).filter(v => v !== null && v !== undefined && v !== '');
    const total = rows.length;
    const unique = new Set(values.map(asText));
    const nums = values.filter(v => Number.isFinite(Number(v))).length;
    const bs = values.filter(v => bools.has(asText(v).toLowerCase())).length;
    const dates = values.filter(v => !/^[+-]?\d+(\.\d+)?$/.test(asText(v)) && !Number.isNaN(Date.parse(asText(v)))).length;
    let inferredType: ColumnProfile['inferredType'] = 'text';
    if (values.length && bs / values.length >= .9) inferredType = 'boolean'; else if (values.length && nums / values.length >= .9) inferredType = 'number'; else if (values.length && dates / values.length >= .9) inferredType = 'date'; else if (unique.size <= Math.min(50, Math.max(10, total * .1))) inferredType = 'category';
    const missingCount = total - values.length;
    const selectedType = inferredType === 'text' && unique.size > Math.max(50, total * .5) ? 'ignore' : inferredType;
    const counts = new Map<string, number>();
    values.forEach(v => counts.set(asText(v), (counts.get(asText(v)) ?? 0) + 1));
    const p: ColumnProfile = {
      name,
      inferredType,
      selectedType,
      role: selectedType === 'ignore' ? 'ignored' : 'feature',
      uniqueValues: unique.size,
      missingCount,
      presencePercentage: total ? values.length / total * 100 : 0,
      exampleValues: [...unique].slice(0, 5),
      typePercentages: {
        number: values.length ? nums / values.length * 100 : 0,
        boolean: values.length ? bs / values.length * 100 : 0,
        date: values.length ? dates / values.length * 100 : 0
      },
      warning: missingCount / Math.max(1, total) > .5 ? 'More than 50% missing' : undefined
    };
    if (inferredType === 'number') {
      const ns = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
      p.numericStats = {
        min: ns[0],
        max: ns.at(-1)!,
        mean,
        median: ns.length % 2 ? ns[(ns.length - 1) / 2] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2,
        standardDeviation: Math.sqrt(ns.reduce((a, n) => a + (n - mean) ** 2, 0) / ns.length)
      };
    }
    p.categoricalStats = {
      topValues: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => ({
        value,
        count,
        percentage: count / Math.max(1, values.length) * 100
      }))
    };
    return p;
  });
}
