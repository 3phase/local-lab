export type SelectedType =
  | "number"
  | "boolean"
  | "category"
  | "text"
  | "date"
  | "ignore";
export type ColumnProfile = {
  name: string;
  inferredType: Exclude<SelectedType, "ignore"> | "unknown";
  selectedType: SelectedType;
  role: "feature" | "target" | "ignored";
  uniqueValues: number;
  missingCount: number;
  presencePercentage: number;
  exampleValues: unknown[];
  typePercentages: Record<string, number>;
  warning?: string;
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    standardDeviation: number;
  };
  categoricalStats?: {
    topValues: { value: string; count: number; percentage: number }[];
  };
};
export type Dataset = {
  id: string;
  name: string;
  source: "upload" | "sample" | "import";
  createdAt: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  rows: Record<string, unknown>[];
  rawRows?: Record<string, string>[];
  fileSize?: number;
};
export type TaskType =
  | "regression"
  | "binary_classification"
  | "multiclass_classification";
export type ModelConfig = {
  optimizer: "adagrad" | "adam" | "sgd" | "rmsprop";
  learningRate: number;
  hiddenLayers: number;
  unitsPerLayer: number;
  batchSize: number;
  batchNorm: boolean;
  maxEpochs: number;
  regularization: number;
  earlyStopping: boolean;
  earlyStoppingPatience: number;
  validationSplit: number;
  seed: number;
};
export type MetricPoint = {
  epoch: number;
  loss: number;
  valLoss?: number;
  metric?: number;
  valMetric?: number;
};
export type EvaluationResult = {
  metrics: Record<string, number>;
  examples: Array<{
    actual: string | number;
    predicted: string | number;
    confidence?: number;
    error?: number;
    correct?: boolean;
  }>;
  confusionMatrix?: number[][];
  labels?: string[];
};
export type Project = {
  id: string;
  name: string;
  appVersion: string;
  createdAt: string;
  updatedAt: string;
  dataset: Dataset;
  targetName: string;
  featureNames: string[];
  task: TaskType;
  modelConfig: ModelConfig;
  status:
    | "idle"
    | "preparing"
    | "training"
    | "stopping"
    | "stopped"
    | "completed"
    | "failed";
  metrics: MetricPoint[];
  relationships?: import("../analysis/correlationTypes").FieldRelationship[];
  evaluation?: EvaluationResult;
  preprocessing?: import("../preprocessing/buildFeatureMatrix").PreprocessingState;
  modelArtifacts?: import("@tensorflow/tfjs").io.ModelArtifacts;
};
export const defaultConfig: ModelConfig = {
  optimizer: "adagrad",
  learningRate: 0.04,
  hiddenLayers: 1,
  unitsPerLayer: 64,
  batchSize: 16,
  batchNorm: true,
  maxEpochs: 150,
  regularization: 0.001,
  earlyStopping: true,
  earlyStoppingPatience: 10,
  validationSplit: 0.2,
  seed: 42
};
