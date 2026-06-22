import type { ColumnProfile, TaskType } from "../data/datasetTypes";

export type RelationshipStrength =
  | "very_weak"
  | "weak"
  | "moderate"
  | "strong"
  | "very_strong";
export type RelationshipMethod =
  | "pearson"
  | "spearman"
  | "point_biserial"
  | "anova_f_score"
  | "cramers_v"
  | "correlation_ratio"
  | "not_analyzed";
export type SuggestedAction =
  | "recommended"
  | "weak_signal"
  | "probably_ignore"
  | "review_manually"
  | "possible_leakage";

export type FieldRelationship = {
  fieldName: string;
  fieldType: ColumnProfile["inferredType"];
  targetName: string;
  targetType: ColumnProfile["inferredType"];
  taskType: TaskType;
  method: RelationshipMethod;
  rawScore: number | null;
  normalizedScore: number | null;
  strength: RelationshipStrength | "not_analyzed";
  direction: "positive" | "negative" | "none" | "not_applicable";
  missingPercentage: number;
  uniqueValues: number;
  suggestedAction: SuggestedAction;
  warnings: string[];
  details?: Record<string, unknown>;
};
