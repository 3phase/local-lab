import type { ColumnProfile, TaskType } from "../data/datasetTypes";
import type { FieldRelationship } from "./correlationTypes";

export function analyzeOffThread(
  rows: Record<string, unknown>[],
  columns: ColumnProfile[],
  targetName: string,
  taskType: TaskType
): Promise<FieldRelationship[]> {
  if (typeof Worker === "undefined")
    return import("./relationshipScoring").then((m) =>
      m.analyzeRelationships(rows, columns, targetName, taskType)
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./analysisWorker.ts", import.meta.url), {
      type: "module"
    });
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        relationships?: FieldRelationship[];
        message?: string;
      }>
    ) => {
      worker.terminate();
      event.data.type === "complete"
        ? resolve(event.data.relationships!)
        : reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Relationship analysis failed."));
    };
    worker.postMessage({rows, columns, targetName, taskType});
  });
}
