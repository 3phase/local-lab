import * as tf from '@tensorflow/tfjs';
import type { ModelConfig, TaskType } from '../data/datasetTypes';

export function buildModel(inputSize: number, task: TaskType, classCount: number, c: ModelConfig) {
  const model = tf.sequential();
  for (let i = 0; i < c.hiddenLayers; i++) {
    model.add(tf.layers.dense({
      inputShape: i === 0 ? [inputSize] : undefined,
      units: c.unitsPerLayer,
      kernelRegularizer: tf.regularizers.l1l2({l1: c.regularization, l2: c.regularization})
    }));
    if (c.batchNorm) model.add(tf.layers.batchNormalization());
    model.add(tf.layers.activation({activation: 'relu6'}))
  }
  model.add(tf.layers.dense({
    units: task === 'multiclass_classification' ? classCount : 1,
    activation: task === 'binary_classification' ? 'sigmoid' : task === 'multiclass_classification' ? 'softmax' : 'linear'
  }));
  const optimizer = ({
    adam: tf.train.adam,
    adagrad: tf.train.adagrad,
    sgd: tf.train.sgd,
    rmsprop: tf.train.rmsprop
  }[c.optimizer])(c.learningRate);
  model.compile({
    optimizer,
    loss: task === 'regression' ? 'meanSquaredError' : task === 'binary_classification' ? 'binaryCrossentropy' : 'categoricalCrossentropy',
    metrics: task === 'regression' ? ['mae'] : ['accuracy']
  });
  return model
}
