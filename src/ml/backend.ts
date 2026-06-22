import * as tf from '@tensorflow/tfjs';

export async function selectBackend() {
  for (const backend of ['webgl', 'cpu']) try {
    if (await tf.setBackend(backend)) {
      await tf.ready();
      return backend
    }
  } catch {
  }
  throw new Error('No TensorFlow.js backend is available in this browser.')
}
