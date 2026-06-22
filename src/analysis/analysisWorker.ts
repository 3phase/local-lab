/// <reference lib="webworker" />
import type { ColumnProfile, TaskType } from "../data/datasetTypes";
import { analyzeRelationships } from "./relationshipScoring";
self.onmessage = (
  event: MessageEvent<{
    rows: Record<string, unknown>[];
    columns: ColumnProfile[];
    targetName: string;
    taskType: TaskType;
  }>,
) => {
  try {
    self.postMessage({
      type: "complete",
      relationships: analyzeRelationships(
        event.data.rows,
        event.data.columns,
        event.data.targetName,
        event.data.taskType,
      ),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
