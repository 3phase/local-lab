import type { LayersModel } from "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";
import type { MetricPoint, ModelConfig, TaskType } from "../data/datasetTypes";
import { buildModel } from "./buildModel";

export type TrainingControl = {
  requested: boolean;
  request?: () => void;
};

export async function trainModel(
  xTrain: number[][],
  yTrain: number[],
  xVal: number[][],
  yVal: number[],
  task: TaskType,
  classCount: number,
  config: ModelConfig,
  onEpoch: (metrics: MetricPoint) => void,
  control: TrainingControl
) {
  const model = buildModel(xTrain[0].length, task, classCount, config);
  control.request = () => {
    control.requested = true;
    model.stopTraining = true;
  };
  const xs = tf.tensor2d(xTrain);
  const xv = tf.tensor2d(xVal);
  const ys =
    task === "multiclass_classification"
      ? tf.oneHot(tf.tensor1d(yTrain, "int32"), classCount)
      : tf.tensor2d(yTrain, [yTrain.length, 1]);
  const yv =
    task === "multiclass_classification"
      ? tf.oneHot(tf.tensor1d(yVal, "int32"), classCount)
      : tf.tensor2d(yVal, [yVal.length, 1]);
  
  let bestValidationLoss = Number.POSITIVE_INFINITY;
  let epochsWithoutImprovement = 0;
  const liveCallback: tf.CustomCallbackArgs = {
    onEpochEnd: async (epoch, logs = {}) => {
      const validationLoss = Number(logs.val_loss);
      onEpoch({
        epoch: epoch + 1,
        loss: Number(logs.loss),
        valLoss: validationLoss,
        metric: Number(logs.mae ?? logs.acc ?? logs.accuracy),
        valMetric: Number(logs.val_mae ?? logs.val_acc ?? logs.val_accuracy)
      });
      
      if (config.earlyStopping && Number.isFinite(validationLoss)) {
        if (validationLoss < bestValidationLoss - 1e-7) {
          bestValidationLoss = validationLoss;
          epochsWithoutImprovement = 0;
        } else {
          epochsWithoutImprovement += 1;
          if (epochsWithoutImprovement >= config.earlyStoppingPatience) {
            model.stopTraining = true;
          }
        }
      }
      if (control.requested) model.stopTraining = true;
      await tf.nextFrame();
    }
  };
  
  try {
    await model.fit(xs, ys, {
      epochs: config.maxEpochs,
      batchSize: config.batchSize,
      validationData: [xv, yv],
      shuffle: true,
      callbacks: liveCallback
    });
    return model;
  } finally {
    control.request = undefined;
    tf.dispose([xs, xv, ys, yv]);
  }
}

const weightBytes = (data: tf.io.WeightData | undefined) =>
  Array.isArray(data)
    ? data.reduce((total, buffer) => total + buffer.byteLength, 0)
    : (data?.byteLength ?? 0);

export async function captureArtifacts(model: LayersModel) {
  let output: tf.io.ModelArtifacts | undefined;
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      output = artifacts;
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
          modelTopologyBytes: JSON.stringify(artifacts.modelTopology).length,
          weightSpecsBytes: JSON.stringify(artifacts.weightSpecs).length,
          weightDataBytes: weightBytes(artifacts.weightData)
        }
      };
    })
  );
  return output!;
}
