import JSZip from 'jszip';
import type { Project } from '../data/datasetTypes';

const combine = (data: import('@tensorflow/tfjs').io.WeightData) => Array.isArray(data) ? new Blob(data).arrayBuffer() : Promise.resolve(data);
const toBase64 = async (b: import('@tensorflow/tfjs').io.WeightData) => {
  let s = '';
  new Uint8Array(await combine(b)).forEach(x => s += String.fromCharCode(x));
  return btoa(s)
};

export async function exportProject(p: Project) {
  if (!p.modelArtifacts) throw new Error('Train the model before exporting.');
  const a = p.modelArtifacts;
  const weightName = 'model.weights.bin';
  const modelJson = {
    modelTopology: a.modelTopology,
    format: a.format ?? 'layers-model',
    generatedBy: a.generatedBy,
    convertedBy: a.convertedBy,
    weightsManifest: [{paths: [weightName], weights: a.weightSpecs ?? []}]
  };
  const meta = {
    schemaVersion: '1.0',
    appName: 'LocalLab',
    appVersion: p.appVersion,
    id: p.id,
    name: p.name,
    datasetName: p.dataset.name,
    createdAt: p.createdAt,
    exportedAt: new Date().toISOString(),
    task: p.task,
    modelConfig: p.modelConfig,
    features: p.dataset.columns.filter(c => p.featureNames.includes(c.name)),
    label: p.dataset.columns.find(c => c.name === p.targetName),
    metrics: p.metrics,
    evaluation: p.evaluation ?? null, ...p.preprocessing
  };
  const zip = new JSZip();
  zip.file('model.json', JSON.stringify(modelJson, null, 2));
  zip.file(weightName, await combine(a.weightData!));
  zip.file('modelRun.json', JSON.stringify(meta, null, 2));
  zip.file('README.md', `# ${p.name}\n\nBrowser-trained ${p.task.replaceAll('_', ' ')} model for **${p.dataset.name}**.\n\nFeatures: ${p.featureNames.join(', ')}\n\nTarget: ${p.targetName}\n\nThis model was trained locally in a browser. Validate it carefully before production use.`);
  zip.file('examples.csv', [p.featureNames.join(','), ...p.dataset.rows.slice(0, 5).map(r => p.featureNames.map(n => JSON.stringify(r[n] ?? '')).join(','))].join('\n'));
  const blob = await zip.generateAsync({type: 'blob'});
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = `${p.name.replace(/\W+/g, '-').toLowerCase()}-model.zip`;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const artifactsToJson = async (a: import('@tensorflow/tfjs').io.ModelArtifacts) => ({
  ...a,
  weightData: a.weightData ? await toBase64(a.weightData) : undefined
});
