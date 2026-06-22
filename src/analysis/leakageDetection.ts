import type { FieldRelationship } from "./correlationTypes";

const suspicious = [
  "result",
  "outcome",
  "label",
  "target",
  "score",
  "final",
  "won",
  "winner",
  "price_paid",
  "booked",
  "converted"
];
const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const distance = (a: string, b: string) => {
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = old;
    }
  }
  return row[b.length];
};

export function leakageWarnings(
  fieldName: string,
  targetName: string,
  relationship: FieldRelationship,
  fieldValues: unknown[],
  targetValues: unknown[]
) {
  const warnings: string[] = [];
  const f = clean(fieldName),
    t = clean(targetName);
  if (
    f.includes(t) ||
    t.includes(f) ||
    distance(f, t) / Math.max(1, f.length, t.length) <= 0.25
  )
    warnings.push("Field name is very similar to the target name.");
  if (suspicious.some((word) => fieldName.toLowerCase().includes(word)))
    warnings.push(
      "Field name contains a term commonly associated with outcomes."
    );
  const comparable = fieldValues
    .map((v, i) => [v, targetValues[i]])
    .filter(([a, b]) => a != null && b != null);
  if (
    comparable.length &&
    comparable.every(([a, b]) => String(a) === String(b))
  )
    warnings.push("Field contains the same values as the target.");
  if (
    relationship.method !== "anova_f_score" &&
    (relationship.normalizedScore ?? 0) >= 0.98
  )
    warnings.push("Near-perfect relationship may reveal the answer directly.");
  if (
    /(^id$|_id$|^id_|identifier)/i.test(fieldName) &&
    (relationship.normalizedScore ?? 0) >= 0.7
  )
    warnings.push("Identifier-like field has suspiciously strong signal.");
  return warnings;
}
