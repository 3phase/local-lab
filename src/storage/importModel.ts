import JSZip from 'jszip';
import { z } from 'zod';
import * as tf from '@tensorflow/tfjs';
import type { Project } from '../data/datasetTypes';
import { id } from '../utils/ids';

const schema = z.object({
  schemaVersion: z.literal('1.0'),
  name: z.string(),
  datasetName: z.string(),
  task: z.enum(['regression', 'binary_classification', 'multiclass_classification']),
  modelConfig: z.any(),
  features: z.array(z.any()),
  label: z.any(),
  metrics: z.array(z.any()),
  evaluation: z.any().nullable(),
  scalers: z.record(z.any()),
  encoders: z.record(z.any()),
  booleanModes: z.record(z.number()).optional(),
  labelEncoder: z.any().nullable(),
  featureVector: z.any()
});

export async function importZip(file: File) {
  const zip = await JSZip.loadAsync(file);
  const modelFile = zip.file('model.json'), weightFile = zip.file('model.weights.bin'),
    runFile = zip.file('modelRun.json');
  if (!modelFile || !weightFile || !runFile) throw new Error('The zip must contain model.json, model.weights.bin, and modelRun.json.');
  const [mj, weightData, metaRaw] = await Promise.all([modelFile.async('string').then(JSON.parse), weightFile.async('arraybuffer'), runFile.async('string').then(JSON.parse)]);
  const meta = schema.parse(metaRaw);
  const artifacts: tf.io.ModelArtifacts = {
    modelTopology: mj.modelTopology,
    format: mj.format,
    generatedBy: mj.generatedBy,
    convertedBy: mj.convertedBy,
    weightSpecs: mj.weightsManifest?.[0]?.weights ?? [],
    weightData
  };
  await tf.loadLayersModel(tf.io.fromMemory(artifacts));
  const now = new Date().toISOString();
  const p: Project = {
    id: id(),
    name: meta.name,
    appVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    dataset: {
      id: id(),
      name: meta.datasetName,
      source: 'import',
      createdAt: now,
      rowCount: 0,
      columnCount: meta.features.length + 1,
      columns: [...meta.features, meta.label],
      rows: []
    },
    targetName: meta.label.name,
    featureNames: meta.features.map((f: any) => f.name),
    task: meta.task,
    modelConfig: meta.modelConfig,
    status: 'completed',
    metrics: meta.metrics,
    evaluation: meta.evaluation ?? undefined,
    preprocessing: {
      scalers: meta.scalers,
      encoders: meta.encoders,
      booleanModes: meta.booleanModes ?? {},
      labelEncoder: meta.labelEncoder,
      featureVector: meta.featureVector
    },
    modelArtifacts: artifacts
  };
  return p
}
