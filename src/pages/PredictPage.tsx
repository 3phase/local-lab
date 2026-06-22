import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import Papa from 'papaparse';
import { AppShell, Card, ErrorPanel } from '../components/layout/AppShell';
import { getProject } from '../storage/projectRepository';
import { useProjectStore } from '../state/projectStore';
import { transformRows } from '../preprocessing/buildFeatureMatrix';
import type { Project } from '../data/datasetTypes';

async function predict(model: tf.LayersModel, p: Project, rows: Record<string, unknown>[]) {
  const features = p.dataset.columns.filter(c => p.featureNames.includes(c.name));
  const x = transformRows(rows, features, p.preprocessing!);
  const t = tf.tensor2d(x);
  const out = model.predict(t) as tf.Tensor;
  const raw = await out.array() as number[][];
  tf.dispose([t, out]);
  return raw.map(r => {
    if (p.task === 'regression') return {prediction: r[0]};
    const probs = p.task === 'binary_classification' ? [1 - r[0], r[0]] : r;
    const idx = probs.indexOf(Math.max(...probs));
    return {
      prediction: p.preprocessing!.labelEncoder!.indexToLabel[idx],
      confidence: probs[idx],
      probabilities: Object.fromEntries(p.preprocessing!.labelEncoder!.labels.map((l, i) => [l, probs[i]]))
    }
  })
}

export function PredictPage() {
  const {projectId} = useParams(), {project, setProject, model, setModel} = useProjectStore();
  const [values, setValues] = useState<Record<string, unknown>>({}), [result, setResult] = useState<any>(), [error, setError] = useState(''),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (project?.id === projectId && model) return;
    getProject(projectId!).then(async p => {
      if (!p || !p.modelArtifacts) throw Error('A trained local model is required.');
      setProject(p);
      setModel(await tf.loadLayersModel(tf.io.fromMemory(p.modelArtifacts)))
    }).catch(e => setError(e.message))
  }, [projectId]);
  if (!project || !model) return <AppShell>
    <div className="loading">Loading model and preprocessing…</div>
    {error && <ErrorPanel error={error} />}</AppShell>;
  const features = project.dataset.columns.filter(c => project.featureNames.includes(c.name));
  const run = async () => {
    setError('');
    try {
      setResult((await predict(model, project, [values]))[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  };
  const batch = async (f: File) => {
    try {
      const parsed = Papa.parse<Record<string, unknown>>(await f.text(), {header: true, skipEmptyLines: true});
      const missing = project.featureNames.filter(n => !(parsed.meta.fields ?? []).includes(n));
      if (missing.length) throw Error(`Missing required columns: ${missing.join(', ')}`);
      const outputs = await predict(model, project, parsed.data);
      const rows = parsed.data.map((r, i) => ({
        ...r,
        locallab_prediction: outputs[i].prediction, ...(outputs[i].confidence != null ? {locallab_confidence: outputs[i].confidence} : {})
      }));
      const blob = new Blob([Papa.unparse(rows)], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'locallab-predictions.csv';
      a.click();
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  };
  return <AppShell
    aside={<div className="tip"><span>INPUT CONTRACT</span><h3>Same preparation, every time.</h3><p>These values pass
      through the exact scalers and encoders learned during training.</p></div>}>
    <div className="page-head compact"><span className="eyebrow">PREDICTION STUDIO</span><h1>{project.name}</h1>
      <p>Predicting <b>{project.targetName}</b> · {project.task.replaceAll('_', ' ')}</p></div>
    {error && <ErrorPanel error={error} />}<Card><span className="eyebrow">ONE ROW</span><h2>Enter feature values</h2>
    <div className="prediction-form">{features.map(f => <label
      key={f.name}>{f.name}<small>{f.selectedType}</small>{f.selectedType === 'category' || f.selectedType === 'text' ?
      <select value={String(values[f.name] ?? '')} onChange={e => setValues({...values, [f.name]: e.target.value})}>
        <option value="">Choose…</option>
        {project.preprocessing!.encoders[f.name]?.labels.filter(x => !x.startsWith('__')).map(x => <option
          key={x}>{x}</option>)}</select> : f.selectedType === 'boolean' ?
        <select value={String(values[f.name] ?? '')} onChange={e => setValues({...values, [f.name]: e.target.value})}>
          <option value="">Choose…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select> : <input type="number" value={String(values[f.name] ?? '')}
                           onChange={e => setValues({...values, [f.name]: e.target.value})}
                           placeholder={f.numericStats ? `Typical: ${f.numericStats.mean.toFixed(2)}` : ''} />}
    </label>)}</div>
    <button className="btn primary" onClick={run}>Run prediction →</button>
    {result && <div className="prediction-result">
        <span>PREDICTION</span><strong>{typeof result.prediction === 'number' ? result.prediction.toFixed(4) : result.prediction}</strong>{result.confidence != null &&
        <p>{(result.confidence * 100).toFixed(1)}% confidence</p>}{result.probabilities &&
        <div>{Object.entries(result.probabilities).map(([k, v]) => <i key={k}><b>{k}</b><span
          style={{width: `${Number(v) * 100}%`}} /><em>{(Number(v) * 100).toFixed(1)}%</em></i>)}</div>}</div>}
  </Card><Card><span className="eyebrow">MANY ROWS</span><h2>Batch prediction</h2><p>Upload a CSV containing
    the {project.featureNames.length} required feature columns. Extra columns are preserved.</p>
    <button className="btn ghost" onClick={() => file.current?.click()}>Choose batch CSV</button>
    <input ref={file} hidden type="file" accept=".csv"
           onChange={e => e.target.files?.[0] && batch(e.target.files[0])} /></Card></AppShell>
}
