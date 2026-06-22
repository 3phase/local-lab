import type { ColumnProfile, TaskType } from "../data/datasetTypes";
import {
  anovaFScore,
  correlationRatio,
  cramersV,
  pearsonCorrelation,
  pointBiserialCorrelation,
  spearmanCorrelation
} from "./correlation";
import { leakageWarnings } from "./leakageDetection";
import type { FieldRelationship, RelationshipStrength, SuggestedAction } from "./correlationTypes";

const strength = (
  score: number | null
): RelationshipStrength | "not_analyzed" =>
  score == null
    ? "not_analyzed"
    : score < 0.1
      ? "very_weak"
      : score < 0.3
        ? "weak"
        : score < 0.5
          ? "moderate"
          : score < 0.7
            ? "strong"
            : "very_strong";
const action = (
  value: RelationshipStrength | "not_analyzed"
): SuggestedAction =>
  value === "not_analyzed" || value === "very_weak"
    ? "probably_ignore"
    : value === "weak"
      ? "weak_signal"
      : "recommended";
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const groupedMeans = (groups: unknown[], values: unknown[]) => {
  const map = new Map<string, number[]>();
  groups.forEach((group, index) => {
    const value = Number(values[index]);
    if (group == null || !Number.isFinite(value)) return;
    const key = String(group);
    map.set(key, [...(map.get(key) ?? []), value]);
  });
  return Object.fromEntries(
    [...map]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([key, items]) => [key, mean(items)])
  );
};
const topCombinations = (fields: unknown[], targets: unknown[]) => {
  const counts = new Map<string, number>();
  fields.forEach((field, index) => {
    if (field == null || targets[index] == null) return;
    const key = `${String(field)} → ${String(targets[index])}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([combination, count]) => ({combination, count}));
};

export function recommendedFieldNames(relationships: FieldRelationship[]) {
  return relationships
    .filter((r) => r.suggestedAction === "recommended")
    .map((r) => r.fieldName);
}

export function analyzeRelationships(
  rows: Record<string, unknown>[],
  columns: ColumnProfile[],
  targetName: string,
  taskType: TaskType
): FieldRelationship[] {
  const target = columns.find((c) => c.name === targetName);
  if (!target) return [];
  const targetValues = rows.map((r) => r[targetName]);
  const results = columns
    .filter((c) => c.name !== targetName)
    .map((field) => {
      const fieldValues = rows.map((r) => r[field.name]);
      const treatAsCategory =
        field.inferredType === "category" ||
        field.inferredType === "boolean" ||
        (field.inferredType === "text" && field.uniqueValues <= 20);
      const base: FieldRelationship = {
        fieldName: field.name,
        fieldType: field.inferredType,
        targetName,
        targetType: target.inferredType,
        taskType,
        method: "not_analyzed",
        rawScore: null,
        normalizedScore: null,
        strength: "not_analyzed",
        direction: "not_applicable",
        missingPercentage: rows.length
          ? (field.missingCount / rows.length) * 100
          : 0,
        uniqueValues: field.uniqueValues,
        suggestedAction: "probably_ignore",
        warnings: []
      };
      if (field.inferredType === "date") {
        base.suggestedAction = "review_manually";
        base.warnings.push("Date feature extraction is not enabled.");
        return base;
      }
      if (field.inferredType === "text" && !treatAsCategory) {
        base.warnings.push("Free text is not analyzed in this version.");
        return base;
      }
      if (treatAsCategory && field.uniqueValues > 100) {
        base.warnings.push(
          "High-cardinality categorical field was not analyzed."
        );
        base.suggestedAction = "review_manually";
        return base;
      }
      let raw = 0,
        normalized = 0,
        details: Record<string, unknown> = {};
      if (field.inferredType === "number" && taskType === "regression") {
        raw = pearsonCorrelation(fieldValues, targetValues);
        normalized = Math.abs(raw);
        base.method = "pearson";
        base.direction =
          Math.abs(raw) < 0.1 ? "none" : raw > 0 ? "positive" : "negative";
        details = {
          absolutePearson: Math.abs(raw),
          spearman: spearmanCorrelation(fieldValues, targetValues)
        };
      } else if (
        field.inferredType === "number" &&
        taskType === "binary_classification"
      ) {
        raw = pointBiserialCorrelation(fieldValues, targetValues);
        normalized = Math.abs(raw);
        base.method = "point_biserial";
        base.direction =
          Math.abs(raw) < 0.1 ? "none" : raw > 0 ? "positive" : "negative";
        const labels = [
          ...new Set(targetValues.filter((v) => v != null).map(String))
        ].sort();
        details = {
          classMeans: groupedMeans(targetValues, fieldValues),
          higherValuesAssociatedWith: raw >= 0 ? labels[1] : labels[0]
        };
      } else if (
        field.inferredType === "number" &&
        taskType === "multiclass_classification"
      ) {
        raw = anovaFScore(fieldValues, targetValues);
        base.method = "anova_f_score";
        base.direction = "not_applicable";
        details = {classMeans: groupedMeans(targetValues, fieldValues)};
      } else if (treatAsCategory && taskType === "regression") {
        raw = correlationRatio(fieldValues, targetValues);
        normalized = raw;
        base.method = "correlation_ratio";
        base.direction = "not_applicable";
        details = {categoryMeans: groupedMeans(fieldValues, targetValues)};
      } else if (treatAsCategory) {
        raw = cramersV(fieldValues, targetValues);
        normalized = raw;
        base.method = "cramers_v";
        base.direction = "not_applicable";
        details = {
          topCombinations: topCombinations(fieldValues, targetValues),
          targetRateByCategory:
            taskType === "binary_classification"
              ? groupedMeans(
                fieldValues,
                targetValues.map((v) =>
                  Number(
                    String(v) ===
                    [
                      ...new Set(
                        targetValues.filter((x) => x != null).map(String)
                      )
                    ].sort()[1]
                  )
                )
              )
              : undefined
        };
      }
      base.rawScore = Number.isFinite(raw) ? raw : 0;
      base.normalizedScore =
        base.method === "anova_f_score"
          ? null
          : Math.max(0, Math.min(1, normalized));
      base.details = details;
      return base;
    });
  const anova = results
    .filter((r) => r.method === "anova_f_score")
    .sort((a, b) => (b.rawScore ?? 0) - (a.rawScore ?? 0));
  anova.forEach(
    (r, index) =>
      (r.normalizedScore =
        anova.length === 1
          ? Math.min(1, (r.rawScore ?? 0) / ((r.rawScore ?? 0) + 10))
          : (anova.length - index) / anova.length)
  );
  for (const relationship of results) {
    relationship.strength = strength(relationship.normalizedScore);
    relationship.suggestedAction =
      relationship.suggestedAction === "review_manually"
        ? "review_manually"
        : action(relationship.strength);
    const warnings = leakageWarnings(
      relationship.fieldName,
      targetName,
      relationship,
      rows.map((r) => r[relationship.fieldName]),
      targetValues
    );
    relationship.warnings.push(...warnings);
    if (warnings.length) relationship.suggestedAction = "possible_leakage";
  }
  return results.sort(
    (a, b) =>
      (b.normalizedScore ?? -1) - (a.normalizedScore ?? -1) ||
      a.fieldName.localeCompare(b.fieldName)
  );
}
