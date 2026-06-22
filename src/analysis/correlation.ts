const finite = (value: unknown) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

export function pearsonCorrelation(x: unknown[], y: unknown[]) {
  const pairs = x
    .map((value, index) => [value, y[index]])
    .filter(([a, b]) => finite(a) && finite(b))
    .map(([a, b]) => [Number(a), Number(b)]);
  if (pairs.length < 2) return 0;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length,
    my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let numerator = 0,
    dx = 0,
    dy = 0;
  for (const [a, b] of pairs) {
    numerator += (a - mx) * (b - my);
    dx += (a - mx) ** 2;
    dy += (b - my) ** 2;
  }
  return dx && dy ? numerator / Math.sqrt(dx * dy) : 0;
}

const ranks = (values: number[]) => {
  const sorted = values
    .map((value, index) => ({value, index}))
    .sort((a, b) => a.value - b.value);
  const output = Array(values.length).fill(0);
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    const rank = (i + end - 1) / 2 + 1;
    for (let j = i; j < end; j++) output[sorted[j].index] = rank;
    i = end;
  }
  return output;
};

export function spearmanCorrelation(x: unknown[], y: unknown[]) {
  const pairs = x
    .map((value, index) => [value, y[index]])
    .filter(([a, b]) => finite(a) && finite(b))
    .map(([a, b]) => [Number(a), Number(b)]);
  if (pairs.length < 2) return 0;
  return pearsonCorrelation(
    ranks(pairs.map((p) => p[0])),
    ranks(pairs.map((p) => p[1]))
  );
}

export function pointBiserialCorrelation(
  values: unknown[],
  targets: unknown[]
) {
  const labels = [
    ...new Set(targets.filter((v) => v != null).map(String))
  ].sort();
  if (labels.length !== 2) return 0;
  return pearsonCorrelation(
    values,
    targets.map((v) => (v == null ? null : Number(String(v) === labels[1])))
  );
}

export function anovaFScore(values: unknown[], targets: unknown[]) {
  const groups = new Map<string, number[]>();
  values.forEach((value, index) => {
    const target = targets[index];
    if (!finite(value) || target == null) return;
    const key = String(target);
    groups.set(key, [...(groups.get(key) ?? []), Number(value)]);
  });
  const all = [...groups.values()].flat(),
    k = groups.size;
  if (k < 2 || all.length <= k) return 0;
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  let between = 0,
    within = 0;
  for (const group of groups.values()) {
    const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
    between += group.length * (groupMean - mean) ** 2;
    within += group.reduce((sum, value) => sum + (value - groupMean) ** 2, 0);
  }
  return within
    ? between / (k - 1) / (within / (all.length - k))
    : between
      ? Number.MAX_SAFE_INTEGER
      : 0;
}

export function cramersV(fields: unknown[], targets: unknown[]) {
  const pairs = fields
    .map((value, index) => [value, targets[index]])
    .filter(([a, b]) => a != null && b != null)
    .map(([a, b]) => [String(a), String(b)]);
  if (!pairs.length) return 0;
  const rows = [...new Set(pairs.map((p) => p[0]))],
    cols = [...new Set(pairs.map((p) => p[1]))];
  if (rows.length < 2 || cols.length < 2) return 0;
  const rowTotals = new Map(rows.map((r) => [r, 0])),
    colTotals = new Map(cols.map((c) => [c, 0])),
    cells = new Map<string, number>();
  for (const [r, c] of pairs) {
    rowTotals.set(r, rowTotals.get(r)! + 1);
    colTotals.set(c, colTotals.get(c)! + 1);
    cells.set(`${r}\0${c}`, (cells.get(`${r}\0${c}`) ?? 0) + 1);
  }
  let chi = 0;
  for (const r of rows)
    for (const c of cols) {
      const expected = (rowTotals.get(r)! * colTotals.get(c)!) / pairs.length;
      if (expected)
        chi += ((cells.get(`${r}\0${c}`) ?? 0) - expected) ** 2 / expected;
    }
  return Math.sqrt(
    chi / (pairs.length * Math.min(rows.length - 1, cols.length - 1))
  );
}

export function correlationRatio(categories: unknown[], values: unknown[]) {
  const groups = new Map<string, number[]>();
  categories.forEach((category, index) => {
    if (category == null || !finite(values[index])) return;
    const key = String(category);
    groups.set(key, [...(groups.get(key) ?? []), Number(values[index])]);
  });
  const all = [...groups.values()].flat();
  if (groups.size < 2 || !all.length) return 0;
  const mean = all.reduce((a, b) => a + b, 0) / all.length,
    total = all.reduce((s, v) => s + (v - mean) ** 2, 0);
  let between = 0;
  for (const group of groups.values()) {
    const m = group.reduce((a, b) => a + b, 0) / group.length;
    between += group.length * (m - mean) ** 2;
  }
  return total ? Math.sqrt(between / total) : 0;
}
