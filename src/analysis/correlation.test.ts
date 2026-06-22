import { describe, expect, it } from "vitest";
import {
  anovaFScore,
  correlationRatio,
  cramersV,
  pearsonCorrelation,
  pointBiserialCorrelation,
  spearmanCorrelation
} from "./correlation";
import { leakageWarnings } from "./leakageDetection";
import { analyzeRelationships, recommendedFieldNames } from "./relationshipScoring";
import { profileColumns } from "../data/profileColumns";
import type { FieldRelationship } from "./correlationTypes";

describe("relationship statistics", () => {
  it("computes Pearson direction and ignores missing or invalid pairs", () => {
    expect(
      pearsonCorrelation([1, 2, null, 3, "bad", 4], [2, 4, 8, 6, 9, 8])
    ).toBeCloseTo(1);
    expect(pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });
  it("computes Spearman correlation with ties", () =>
    expect(spearmanCorrelation([1, 2, 2, 4], [10, 20, 20, 40])).toBeCloseTo(1));
  it("returns zero for constant and all-missing numeric columns", () => {
    expect(pearsonCorrelation([2, 2, 2], [1, 2, 3])).toBe(0);
    expect(pearsonCorrelation([null, null], [1, 2])).toBe(0);
  });
  it("computes point-biserial correlation", () =>
    expect(
      pointBiserialCorrelation([1, 2, 8, 9], ["no", "no", "yes", "yes"])
    ).toBeGreaterThan(0.9));
  it("handles a one-class point-biserial target", () =>
    expect(pointBiserialCorrelation([1, 2, 3], ["yes", "yes", "yes"])).toBe(0));
  it("computes Cramér's V", () =>
    expect(cramersV(["a", "a", "b", "b"], ["x", "x", "y", "y"])).toBeCloseTo(
      1
    ));
  it("computes correlation ratio", () =>
    expect(correlationRatio(["a", "a", "b", "b"], [1, 1, 9, 9])).toBeCloseTo(
      1
    ));
  it("computes ANOVA F-score", () =>
    expect(
      anovaFScore([1, 2, 10, 11, 20, 21], ["a", "a", "b", "b", "c", "c"])
    ).toBeGreaterThan(100));
});

describe("leakage and relationship scoring", () => {
  const base: FieldRelationship = {
    fieldName: "result",
    fieldType: "number",
    targetName: "outcome",
    targetType: "number",
    taskType: "regression",
    method: "pearson",
    rawScore: 1,
    normalizedScore: 1,
    strength: "very_strong",
    direction: "positive",
    missingPercentage: 0,
    uniqueValues: 3,
    suggestedAction: "recommended",
    warnings: []
  };
  it("detects suspicious names and near-perfect target relationships", () => {
    const warnings = leakageWarnings(
      "final_outcome",
      "outcome",
      base,
      [1, 2, 3],
      [1, 2, 3]
    );
    expect(warnings.join(" ")).toMatch(/similar|outcome/i);
    expect(warnings.join(" ")).toMatch(/same values|perfect/i);
  });
  it("scores every non-target field and auto-selects only safe recommendations", () => {
    const rows = [
      {x: 1, noise: 7, answer_copy: 10, target: 10},
      {x: 2, noise: 7, answer_copy: 20, target: 20},
      {x: 3, noise: 7, answer_copy: 30, target: 30},
      {x: 4, noise: 7, answer_copy: 40, target: 40}
    ];
    const relationships = analyzeRelationships(
      rows,
      profileColumns(rows),
      "target",
      "regression"
    );
    expect(relationships).toHaveLength(3);
    expect(
      relationships.find((r) => r.fieldName === "answer_copy")?.suggestedAction
    ).toBe("possible_leakage");
    expect(recommendedFieldNames(relationships)).not.toContain("answer_copy");
    expect(
      relationships.find((r) => r.fieldName === "noise")?.normalizedScore
    ).toBe(0);
  });
  it("marks high-cardinality text as not analyzed", () => {
    const rows = Array.from({length: 120}, (_, i) => ({
      comment: `unique sentence ${i}`,
      target: i % 2
    }));
    const result = analyzeRelationships(
      rows,
      profileColumns(rows),
      "target",
      "binary_classification"
    )[0];
    expect(result.method).toBe("not_analyzed");
    expect(result.suggestedAction).toBe("probably_ignore");
  });
  it("handles tiny datasets deterministically", () => {
    const rows = [
      {category: "a", target: 1},
      {category: "b", target: 2},
      {category: null, target: 3}
    ];
    const first = analyzeRelationships(
      rows,
      profileColumns(rows),
      "target",
      "regression"
    );
    expect(
      analyzeRelationships(rows, profileColumns(rows), "target", "regression")
    ).toEqual(first);
  });
});
