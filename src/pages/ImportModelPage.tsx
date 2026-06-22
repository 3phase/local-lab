import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, Card, ErrorPanel } from '../components/layout/AppShell';
import { importZip } from '../storage/importModel';
import { saveProject } from '../storage/projectRepository';

export function ImportModelPage() {
  const input = useRef<HTMLInputElement>(null),
    nav = useNavigate(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = async (f: File) => {
    setBusy(true);
    setError('');
    try {
      const p = await importZip(f);
      await saveProject(p);
      nav(`/model/local/${p.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  };
  return <AppShell
    aside={<div className="tip"><span>PORTABLE BY DEFAULT</span><h3>Your model can travel.</h3><p>LocalLab exports
      standard TensorFlow.js artifacts plus reusable preprocessing metadata.</p></div>}>
    <div className="page-head"><span className="eyebrow">IMPORT MODEL</span><h1>Bring a model back to life.</h1>
      <p>Select a LocalLab export. It will be validated and stored only in this browser.</p></div>
    {error && <ErrorPanel error={error} />}<Card>
    <div className="dropzone" onDrop={e => {
      e.preventDefault();
      e.dataTransfer.files[0] && load(e.dataTransfer.files[0])
    }} onDragOver={e => e.preventDefault()}>
      <div className="upload-icon">↧</div>
      <h2>{busy ? 'Checking model artifacts…' : 'Drop a LocalLab .zip here'}</h2><p>Expected: model.json,
      model.weights.bin, and modelRun.json</p>
      <button className="btn primary" onClick={() => input.current?.click()}>Choose export</button>
      <input hidden ref={input} type="file" accept=".zip"
             onChange={e => e.target.files?.[0] && load(e.target.files[0])} /></div>
  </Card></AppShell>
}
