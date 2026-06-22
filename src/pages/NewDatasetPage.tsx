import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, Card, ErrorPanel } from '../components/layout/AppShell';
import { parseCsvOffThread } from '../data/parseCsvOffThread';
import type { Dataset } from '../data/datasetTypes';
import { defaultConfig } from '../data/datasetTypes';
import { id } from '../utils/ids';
import { saveProject } from '../storage/projectRepository';

const sampleNames: Record<string, string> = {
  iris: 'Iris flowers',
  titanic: 'Titanic survival',
  housing: 'Home values',
  diabetes: 'Health outcome',
  sales: 'Weekly demand'
};

export function NewDatasetPage() {
  const [params] = useSearchParams(), nav = useNavigate(), input = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false), [progress, setProgress] = useState({
    value: 0,
    label: ''
  });
  const load = async (source: File | string, name?: string) => {
    setBusy(true);
    setError('');
    setProgress({value: 2, label: 'Starting'});
    try {
      setDataset(await parseCsvOffThread(source, typeof source === 'string' ? 'sample' : 'upload', name, (value, label) => setProgress({
        value,
        label
      })));
      setProgress({value: 100, label: 'Ready'})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  };
  useEffect(() => {
    const sample = params.get('sample');
    if (sample && sampleNames[sample]) fetch(`/samples/${sample}.csv`).then(r => {
      if (!r.ok) throw Error('Sample unavailable');
      return r.text()
    }).then(t => load(t, sampleNames[sample])).catch(e => setError(e.message))
  }, []);
  const next = async () => {
    if (!dataset) return;
    const now = new Date().toISOString();
    const p = {
      id: id(),
      name: `${dataset.name} model`,
      appVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      dataset,
      targetName: '',
      featureNames: [],
      task: 'regression' as const,
      modelConfig: defaultConfig,
      status: 'idle' as const,
      metrics: []
    };
    await saveProject(p);
    nav(`/project/${p.id}`)
  };
  return <AppShell
    aside={<div className="tip"><span>LOCAL BY DESIGN</span><h3>Your file never leaves this tab.</h3><p>Parsing,
      profiling, and training all happen on your device.</p></div>}>
    <div className="page-head"><span className="eyebrow">NEW PROJECT · STEP 1 OF 4</span><h1>Let’s meet your data.</h1>
      <p>Upload a tidy CSV: one row per example, one column per attribute.</p></div>
    {error && <ErrorPanel error={error} />}<Card>
    <div className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={e => {
      e.preventDefault();
      setDrag(true)
    }} onDragLeave={() => setDrag(false)} onDrop={e => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) load(f)
    }}>
      <div className="upload-icon">⇧</div>
      <h2>{busy ? progress.label || 'Reading your data…' : 'Drop a CSV here'}</h2><p>UTF-8 files up to 100 MB work
      best</p>{busy ? <div className="parse-progress"><i style={{width: `${progress.value}%`}} /></div> :
      <button className="btn primary" onClick={() => input.current?.click()}>Choose a file</button>}<input ref={input}
                                                                                                           hidden
                                                                                                           type="file"
                                                                                                           accept=".csv,text/csv"
                                                                                                           onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
    </div>
  </Card>{dataset && <>
      <div className="summary-row">
          <Card><b>{dataset.rowCount.toLocaleString()}</b><span>Rows</span></Card><Card><b>{dataset.columnCount}</b><span>Columns</span></Card><Card><b>{dataset.columns.reduce((s, c) => s + c.missingCount, 0)}</b><span>Missing cells</span></Card><Card><b>{dataset.name}</b><span>Dataset</span></Card>
      </div>
      <Card>
          <div className="card-title">
              <div><span className="eyebrow">DATA PREVIEW</span><h2>First {Math.min(100, dataset.rowCount)} rows</h2>
              </div>
              <button className="btn primary" onClick={next}>Set up model →</button>
          </div>
          <div className="table-wrap">
              <table>
                  <thead>
                  <tr>{dataset.columns.map(c => <th key={c.name}>{c.name}<small>{c.inferredType}</small></th>)}</tr>
                  </thead>
                  <tbody>{dataset.rows.slice(0, 100).map((r, i) => <tr key={i}>{dataset.columns.map(c => <td
                    key={c.name}>{r[c.name] == null ? <i>missing</i> : String(r[c.name])}</td>)}</tr>)}</tbody>
              </table>
          </div>
      </Card></>}</AppShell>
}
