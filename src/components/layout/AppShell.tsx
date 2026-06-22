import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function TopBar() {
  return <header className="topbar"><Link to="/" className="brand"><span>LL</span> LocalLab</Link>
    <div className="privacy"><i /> Local processing only</div>
  </header>
}

export function AppShell({children, aside}: { children: ReactNode; aside?: ReactNode }) {
  return <><TopBar />
    <div className="shell">
      <main>{children}</main>
      {aside && <aside>{aside}</aside>}</div>
  </>
}

export function Card({children, className = ''}: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function ErrorPanel({error}: { error: string }) {
  return <div className="error"><strong>Something needs attention</strong><span>{error}</span></div>
}
