import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as tf from "@tensorflow/tfjs";
import { AppShell, Card, ErrorPanel } from "../components/layout/AppShell";
import { getProject, saveProject } from "../storage/projectRepository";
import type { ModelConfig, Project, TaskType } from "../data/datasetTypes";
import {
  fitPreprocessing,
  transformRows,
  transformTargets,
} from "../preprocessing/buildFeatureMatrix";
import { splitIndices } from "../ml/splitDataset";
import { selectBackend } from "../ml/backend";
import {
  captureArtifacts,
  type TrainingControl,
  trainModel,
} from "../ml/trainModel";
import { evaluateModel } from "../ml/evaluateModel";
import { exportProject } from "../storage/exportModel";
import { useProjectStore } from "../state/projectStore";
import { FieldCorrelationStep } from "../components/correlation/FieldCorrelationStep";
import { analyzeOffThread } from "../analysis/analyzeOffThread";

const presets = {
  fast: {
    maxEpochs: 50,
    hiddenLayers: 1,
    unitsPerLayer: 32,
    batchSize: 32,
    earlyStoppingPatience: 5,
  },
  balanced: {
    maxEpochs: 150,
    hiddenLayers: 1,
    unitsPerLayer: 64,
    batchSize: 16,
    earlyStoppingPatience: 10,
  },
  thorough: {
    maxEpochs: 300,
    hiddenLayers: 2,
    unitsPerLayer: 128,
    batchSize: 16,
    earlyStoppingPatience: 20,
  },
};

function inferTask(p: Project, target: string): TaskType {
  const c = p.dataset.columns.find((x) => x.name === target)!;
  if (c.uniqueValues === 2) return "binary_classification";
  if (c.selectedType === "number" && c.uniqueValues > 15) return "regression";
  return "multiclass_classification";
}

export function ProjectPage() {
  const { projectId } = useParams(),
    nav = useNavigate();
  const { project: p, setProject, setModel, model } = useProjectStore();
  const [error, setError] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [backend, setBackend] = useState("not initialized"),
    [preset, setPreset] = useState<keyof typeof presets>("balanced"),
    [analysisLoading, setAnalysisLoading] = useState(false),
    trainingControl = useRef<TrainingControl>({ requested: false });
  useEffect(() => {
    if (projectId)
      getProject(projectId).then(async (x) => {
        if (!x) return setError("This local project could not be found.");
        setProject(x);
        if (x.modelArtifacts)
          try {
            setModel(
              await tf.loadLayersModel(tf.io.fromMemory(x.modelArtifacts)),
            );
          } catch {}
        if (x.targetName && x.dataset.rows.length && !x.relationships) {
          setAnalysisLoading(true);
          try {
            const relationships = await analyzeOffThread(
              x.dataset.rows,
              x.dataset.columns,
              x.targetName,
              x.task,
            );
            const analyzed = {...x, relationships};
            setProject(analyzed);
            await saveProject(analyzed);
          } catch (analysisError) {
            setError(
              analysisError instanceof Error
                ? analysisError.message
                : String(analysisError),
            );
          } finally {
            setAnalysisLoading(false);
          }
        }
      });
  }, [projectId]);
  const target = p?.dataset.columns.find((c) => c.name === p.targetName),
    features =
      p?.dataset.columns.filter((c) => p.featureNames.includes(c.name)) ?? [];
  const setTarget = async (name: string) => {
    if (!p) return;
    const task = inferTask(p, name);
    const recommended = p.dataset.columns
      .filter(
        (c) =>
          c.name !== name &&
          c.selectedType !== "ignore" &&
          c.selectedType !== "date" &&
          c.missingCount <= p.dataset.rowCount * 0.5,
      )
      .map((c) => c.name);
    const next = {
      ...p,
      targetName: name,
      task,
      featureNames: recommended,
      relationships: undefined,
      status: "idle" as const,
    };
    setProject(next);
    setAnalysisLoading(true);
    await saveProject(next);

    try {
      const relationships = await analyzeOffThread(
        p.dataset.rows,
        p.dataset.columns,
        name,
        task,
      );
      const current = useProjectStore.getState().project;
      if (current?.targetName === name) {
        const analyzed = { ...current, relationships };
        setProject(analyzed);
        await saveProject(analyzed);
      }
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : String(analysisError),
      );
    } finally {
      setAnalysisLoading(false);
    }
  };
  const patch = (x: Partial<Project>) => {
    if (!p) return;
    const next = { ...p, ...x };
    setProject(next);
    saveProject(next);
  };
  const setTask = async (task: TaskType) => {
    if (!p?.targetName) return;
    patch({ task, relationships: undefined });
    setAnalysisLoading(true);
    try {
      const relationships = await analyzeOffThread(
        p.dataset.rows,
        p.dataset.columns,
        p.targetName,
        task,
      );
      const current = useProjectStore.getState().project;
      if (current?.targetName === p.targetName && current.task === task) {
        const analyzed = { ...current, relationships };
        setProject(analyzed);
        await saveProject(analyzed);
      }
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : String(analysisError),
      );
    } finally {
      setAnalysisLoading(false);
    }
  };
  const config = (x: Partial<ModelConfig>) =>
    patch({ modelConfig: { ...p!.modelConfig, ...x } });
  const stopTrainingNow = () => {
    trainingControl.current.requested = true;
    trainingControl.current.request?.();
    const current = useProjectStore.getState().project;
    if (current) setProject({ ...current, status: "stopping" });
  };
  const train = async () => {
    if (!p || !target || !features.length)
      return setError("Choose a target and at least one feature first.");
    setError("");
    trainingControl.current.requested = false;
    try {
      patch({ status: "preparing", metrics: [] });
      setBackend(await selectBackend());
      const valid = p.dataset.rows.filter(
        (r) =>
          r[p.targetName] != null &&
          (p.task !== "regression" || Number.isFinite(Number(r[p.targetName]))),
      );
      if (valid.length < 4)
        throw Error("At least four rows with a valid target are needed.");
      const prep = fitPreprocessing(valid, features, target, p.task);
      const x = transformRows(valid, features, prep),
        y = transformTargets(valid, p.targetName, p.task, prep);
      const split = splitIndices(
        y,
        p.modelConfig.validationSplit,
        p.modelConfig.seed,
        p.task !== "regression",
      );
      const take = <T,>(a: T[], ids: number[]) => ids.map((i) => a[i]);
      patch({ status: "training", preprocessing: prep });
      const m = await trainModel(
        take(x, split.train),
        take(y, split.train),
        take(x, split.validation),
        take(y, split.validation),
        p.task,
        prep.labelEncoder?.labels.length ?? 1,
        p.modelConfig,
        (point) =>
          setProject({
            ...useProjectStore.getState().project!,
            metrics: [...useProjectStore.getState().project!.metrics, point],
          }),
        trainingControl.current,
      );
      setModel(m);
      const evaluation = await evaluateModel(
        m,
        take(x, split.validation),
        take(y, split.validation),
        p.task,
        prep.labelEncoder,
      );
      const artifacts = await captureArtifacts(m);
      const done = {
        ...useProjectStore.getState().project!,
        status: (trainingControl.current.requested
          ? "stopped"
          : "completed") as Project["status"],
        evaluation,
        modelArtifacts: artifacts,
        preprocessing: prep,
      };
      setProject(done);
      await saveProject(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      patch({ status: "failed" });
    }
  };
  if (!p)
    return (
      <AppShell>
        <div className="loading">Opening local project…</div>
        {error && <ErrorPanel error={error} />}
      </AppShell>
    );
  const latest = p.metrics.at(-1);
  const epochProgress = Math.min(
    100,
    Math.round(((latest?.epoch ?? 0) / p.modelConfig.maxEpochs) * 100),
  );
  const trainingProgress = p.status === "completed" ? 100 : epochProgress;
  return (
    <AppShell
      aside={
        <div className="project-aside">
          <span className="eyebrow">PROJECT PATH</span>
          {[
            "Dataset",
            "Target",
            "Field correlation",
            "Features",
            "Configure",
            "Train",
            "Evaluate",
            "Predict",
            "Export",
          ].map((s, i) => (
            <div
              className={`aside-step ${i === 0 || (target && i < 2) || (p.relationships?.length && i < 4) || (p.status === "completed" && i < 9) ? "done" : ""}`}
              key={s}
            >
              <b>{i + 1}</b>
              {s}
            </div>
          ))}
          <div className="tip">
            <h3>Metrics are clues, not guarantees.</h3>
            <p>
              Validate your model on fresh, representative data before relying
              on it.
            </p>
          </div>
        </div>
      }
    >
      <div className="page-head compact">
        <span className="eyebrow">{p.dataset.name} · LOCAL PROJECT</span>
        <h1>{p.name}</h1>
        <p>
          {p.dataset.rowCount.toLocaleString()} rows · {p.dataset.columnCount}{" "}
          columns
        </p>
      </div>
      {error && <ErrorPanel error={error} />}
      <Card>
        <div className="card-title">
          <div>
            <span className="eyebrow">QUESTION</span>
            <h2>What should the model predict?</h2>
          </div>
          {target && (
            <span className="task-pill">{p.task.replaceAll("_", " ")}</span>
          )}
        </div>
        <div className="target-grid">
          {p.dataset.columns.map((c) => (
            <button
              key={c.name}
              className={`column-choice ${p.targetName === c.name ? "selected" : ""}`}
              onClick={() => setTarget(c.name)}
            >
              <span>{c.name}</span>
              <small>
                {c.inferredType} · {c.uniqueValues} unique
              </small>
              {c.warning && <i>!</i>}
            </button>
          ))}
        </div>
        {target && (
          <div className="task-row">
            <label>
              Task type
              <select
                value={p.task}
                onChange={(e) => setTask(e.target.value as TaskType)}
              >
                <option value="regression">Regression</option>
                <option value="binary_classification">
                  Binary classification
                </option>
                <option value="multiclass_classification">
                  Multiclass classification
                </option>
              </select>
            </label>
            <p>
              LocalLab inferred this from the target’s type and number of unique
              values.
            </p>
          </div>
        )}
      </Card>
      {target && (
        <FieldCorrelationStep
          relationships={p.relationships ?? []}
          loading={analysisLoading}
          onUseRecommended={() =>
            patch({
              featureNames: (p.relationships ?? [])
                .filter((item) => item.suggestedAction === "recommended")
                .map((item) => item.fieldName),
            })
          }
          onIgnoreWeak={() =>
            patch({
              featureNames: p.featureNames.filter((name) => {
                const relationship = p.relationships?.find(
                  (item) => item.fieldName === name,
                );
                return (
                  relationship?.suggestedAction !== "weak_signal" &&
                  relationship?.suggestedAction !== "probably_ignore"
                );
              }),
            })
          }
          onContinue={() =>
            document
              .getElementById("feature-selection")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      )}
      {target && (
        <div id="feature-selection">
          <Card>
            <div className="card-title">
              <div>
                <span className="eyebrow">SIGNALS</span>
                <h2>Choose input features</h2>
              </div>
              <div>
                <button
                  className="text-btn"
                  onClick={() =>
                    patch({
                      featureNames: p.dataset.columns
                        .filter(
                          (c) =>
                            c.name !== p.targetName &&
                            c.selectedType !== "ignore" &&
                            c.selectedType !== "date",
                        )
                        .map((c) => c.name),
                    })
                  }
                >
                  Recommended
                </button>
                <button
                  className="text-btn"
                  onClick={() => patch({ featureNames: [] })}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="feature-list">
              {p.dataset.columns
                .filter((c) => c.name !== p.targetName)
                .map((c) => (
                  <label key={c.name}>
                    <input
                      type="checkbox"
                      checked={p.featureNames.includes(c.name)}
                      onChange={(e) =>
                        patch({
                          featureNames: e.target.checked
                            ? [...p.featureNames, c.name]
                            : p.featureNames.filter((x) => x !== c.name),
                        })
                      }
                    />
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.inferredType} ·{" "}
                        {Math.round(100 - c.presencePercentage)}% missing ·{" "}
                        {c.uniqueValues} unique
                      </small>
                    </span>
                    {(c.selectedType === "ignore" || c.warning) && (
                      <em>{c.warning ?? "High cardinality"}</em>
                    )}
                  </label>
                ))}
            </div>
          </Card>
        </div>
      )}
      {target && features.length > 0 && (
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">TRAINING RECIPE</span>
              <h2>How much should it learn?</h2>
            </div>
            <button className="text-btn" onClick={() => setAdvanced(!advanced)}>
              {advanced ? "Basic settings" : "Advanced settings"}
            </button>
          </div>
          <div className="presets">
            {(Object.keys(presets) as (keyof typeof presets)[]).map((k) => (
              <button
                className={preset === k ? "selected" : ""}
                onClick={() => {
                  setPreset(k);
                  config(presets[k]);
                }}
                key={k}
              >
                <b>{k}</b>
                <span>
                  {presets[k].maxEpochs} epochs · {presets[k].unitsPerLayer}{" "}
                  units
                </span>
              </button>
            ))}
          </div>
          {advanced && (
            <div className="config-grid">
              <label>
                Optimizer
                <select
                  value={p.modelConfig.optimizer}
                  onChange={(e) =>
                    config({
                      optimizer: e.target.value as ModelConfig["optimizer"],
                    })
                  }
                >
                  {["adagrad", "adam", "sgd", "rmsprop"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Learning rate
                <input
                  type="number"
                  step=".001"
                  value={p.modelConfig.learningRate}
                  onChange={(e) => config({ learningRate: +e.target.value })}
                />
              </label>
              <label>
                Hidden layers
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={p.modelConfig.hiddenLayers}
                  onChange={(e) => config({ hiddenLayers: +e.target.value })}
                />
              </label>
              <label>
                Units / layer
                <input
                  type="number"
                  min="4"
                  max="512"
                  value={p.modelConfig.unitsPerLayer}
                  onChange={(e) => config({ unitsPerLayer: +e.target.value })}
                />
              </label>
              <label>
                Batch size
                <input
                  type="number"
                  value={p.modelConfig.batchSize}
                  onChange={(e) => config({ batchSize: +e.target.value })}
                />
              </label>
              <label>
                Validation %
                <input
                  type="number"
                  min="10"
                  max="40"
                  value={p.modelConfig.validationSplit * 100}
                  onChange={(e) =>
                    config({ validationSplit: +e.target.value / 100 })
                  }
                />
              </label>
              <label>
                Random seed
                <input
                  type="number"
                  value={p.modelConfig.seed}
                  onChange={(e) => config({ seed: +e.target.value })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={p.modelConfig.batchNorm}
                  onChange={(e) => config({ batchNorm: e.target.checked })}
                />{" "}
                Batch normalization
              </label>
            </div>
          )}
          <div className="train-bar">
            <div>
              <span>{features.length} source features</span>
              <span>
                {p.dataset.rows.filter((r) => r[p.targetName] != null).length}{" "}
                usable rows
              </span>
              <span>Backend: {backend}</span>
            </div>
            {p.status === "training" || p.status === "stopping" ? (
              <button
                className="btn danger"
                onClick={stopTrainingNow}
                disabled={p.status === "stopping"}
              >
                {p.status === "stopping" ? "Stopping…" : "Stop training"}
              </button>
            ) : (
              <button className="btn primary" onClick={train}>
                Train model <b>→</b>
              </button>
            )}
          </div>
        </Card>
      )}
      {(p.status === "preparing" ||
        p.status === "training" ||
        p.status === "stopping" ||
        p.metrics.length > 0) && (
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">LIVE TRAINING</span>
              <h2>
                {p.status === "preparing"
                  ? "Preparing data…"
                  : p.status === "training"
                    ? "Learning in progress…"
                    : p.status === "stopping"
                      ? "Stopping after the current batch…"
                      : p.status === "completed"
                        ? "Training complete"
                        : p.status === "failed"
                          ? "Training failed"
                          : "Training stopped"}
              </h2>
            </div>
            <span className="task-pill">
              Epoch {latest?.epoch ?? 0} / {p.modelConfig.maxEpochs}
            </span>
          </div>
          <div className="training-progress-row">
            <div
              className={`training-progress ${p.status}`}
              role="progressbar"
              aria-label="Training progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={trainingProgress}
            >
              <i style={{ width: `${trainingProgress}%` }} />
            </div>
            <b>{trainingProgress}%</b>
          </div>
          <div className="metric-cards">
            <div>
              <span>Loss</span>
              <b>{latest?.loss.toFixed(4) ?? "—"}</b>
            </div>
            <div>
              <span>Validation loss</span>
              <b>{latest?.valLoss?.toFixed(4) ?? "—"}</b>
            </div>
            <div>
              <span>{p.task === "regression" ? "MAE" : "Accuracy"}</span>
              <b>{latest?.metric?.toFixed(4) ?? "—"}</b>
            </div>
          </div>
          <div className="chart">
            {p.metrics.map((m, i) => (
              <i
                key={i}
                style={{
                  height: `${Math.max(3, 100 - (m.loss / (p.metrics[0].loss || 1)) * 80)}%`,
                }}
                title={`Epoch ${m.epoch}: ${m.loss}`}
              />
            ))}
          </div>
        </Card>
      )}
      {p.evaluation && (
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">VALIDATION RESULTS</span>
              <h2>How the model did</h2>
            </div>
          </div>
          <div className="metric-cards">
            {Object.entries(p.evaluation.metrics).map(([k, v]) => (
              <div key={k}>
                <span>{k.toUpperCase()}</span>
                <b>{v.toFixed(4)}</b>
              </div>
            ))}
          </div>
          {p.evaluation.confusionMatrix && (
            <div className="confusion">
              <h3>Confusion matrix</h3>
              <table>
                <tbody>
                  {p.evaluation.confusionMatrix.map((r, i) => (
                    <tr key={i}>
                      {r.map((n, j) => (
                        <td key={j} className={i === j ? "hit" : ""}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Actual</th>
                  <th>Predicted</th>
                  <th>{p.task === "regression" ? "Error" : "Confidence"}</th>
                </tr>
              </thead>
              <tbody>
                {p.evaluation.examples.slice(0, 12).map((x, i) => (
                  <tr key={i}>
                    <td>{x.actual}</td>
                    <td>
                      {typeof x.predicted === "number"
                        ? x.predicted.toFixed(3)
                        : x.predicted}
                    </td>
                    <td>
                      {x.error?.toFixed(3) ??
                        (x.confidence != null
                          ? `${(x.confidence * 100).toFixed(1)}%`
                          : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button
              className="btn primary"
              onClick={() => nav(`/predict/${p.id}`)}
            >
              Make predictions →
            </button>
            <button className="btn ghost" onClick={() => exportProject(p)}>
              Export model .zip
            </button>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
