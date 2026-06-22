import { Link } from 'react-router-dom';
import { Card, TopBar } from '../components/layout/AppShell';

const samples = [['Iris flowers', 'Three flower species', 'iris'], ['Titanic survival', 'Passenger survival', 'titanic'], ['Home values', 'Price regression', 'housing'], ['Health outcome', 'Binary classification', 'diabetes'], ['Weekly demand', 'Demand regression', 'sales']];

export function LandingPage() {
  return <><TopBar />
    <main className="landing">
      <section className="hero">
        <div><span className="eyebrow">MACHINE LEARNING, MADE TANGIBLE</span><h1>Turn a spreadsheet into a model—<em>right
          here.</em></h1><p>Choose what you want to predict. LocalLab handles preparation, training, and evaluation
          entirely in your browser.</p>
          <div className="actions"><Link className="btn primary" to="/new-dataset">Create new model <b>→</b></Link><Link
            className="btn ghost" to="/model/import">Import a model</Link></div>
          <p className="quiet">◉ Your data stays on this device. No uploads. No accounts.</p></div>
        <div className="hero-visual">
          <div className="node n1">CSV</div>
          <div className="flow" />
          <div className="model-cube">LOCAL<br /><b>MODEL</b></div>
          <div className="flow" />
          <div className="node n2">↗</div>
        </div>
      </section>
      <section className="how"><span className="eyebrow">THE SHORT VERSION</span>
        <div className="steps">
          <article><b>01</b><h3>Bring your data</h3><p>Drop in a CSV or explore one of our built-in datasets.</p>
          </article>
          <article><b>02</b><h3>Choose the question</h3><p>Pick a target and the useful signals. We recommend sensible
            defaults.</p></article>
          <article><b>03</b><h3>Train & explore</h3><p>Watch learning happen, inspect honest metrics, then make
            predictions.</p></article>
        </div>
      </section>
      <section className="samples">
        <div><span className="eyebrow">TRY IT WITH REAL DATA</span><h2>Start with a sample</h2></div>
        <div className="sample-grid">{samples.map(([name, desc, key]) => <Link key={key}
                                                                               to={`/new-dataset?sample=${key}`}><Card><span
          className={`sample-icon ${key}`}>{key === 'iris' ? '✣' : key === 'titanic' ? '◫' : key === 'housing' ? '⌂' : key === 'diabetes' ? '♥' : '▥'}</span>
          <h3>{name}</h3><p>{desc}</p><b>Open dataset →</b></Card></Link>)}</div>
      </section>
    </main>
    <footer>LocalLab <span>Built for curious minds · Runs locally</span></footer>
  </>
}
