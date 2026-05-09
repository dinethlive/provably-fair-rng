import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-(--color-border-subtle) bg-(--color-bg-base)/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="flex items-center gap-3 group">
            <ShieldGlyph />
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-(--color-text-tertiary)">
                Provably Fair
              </div>
              <div className="text-base font-semibold text-(--color-text-primary)">
                Verifier
              </div>
            </div>
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavItem to="/verify">Verify</NavItem>
            <NavItem to="/simulate">Simulate</NavItem>
            <NavItem to="/history">History</NavItem>
            <NavItem to="/api">API</NavItem>
            <NavItem to="/compliance">Compliance</NavItem>
            <NavItem to="/architecture">How it works</NavItem>
          </nav>
        </div>
        <CommitmentBanner />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-(--color-border-subtle) py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 text-xs text-(--color-text-tertiary)">
          <div>
            HMAC-SHA256 · Client-side computation · No data sent to any server.
          </div>
          <div className="flex items-center gap-4">
            <NavLink to="/api" className="hover:text-(--color-text-secondary)">
              API reference
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/compliance" className="hover:text-(--color-text-secondary)">
              Compliance
            </NavLink>
            <span aria-hidden>·</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-1.5 text-sm font-medium transition',
          isActive
            ? 'bg-(--color-bg-elevated) text-(--color-text-primary)'
            : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated)/60',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

function ShieldGlyph() {
  return (
    <div className="grid size-9 place-items-center rounded-lg border border-(--color-accent)/30 bg-(--color-accent)/8 text-(--color-accent) shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] transition group-hover:border-(--color-accent)/50">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 L20 6 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V6 Z" />
        <path d="M9 12 L11 14 L15 10" />
      </svg>
    </div>
  );
}

function CommitmentBanner() {
  // Per PRD Ch.5: commitment must be visible at all times. In a live game integration
  // this banner would render the active hash commitment fetched from the operator.
  // In the standalone verifier, it explains the role of the commitment.
  return (
    <div className="border-t border-(--color-border-subtle) bg-(--color-bg-raised)/60">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent)/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-(--color-accent)">
          <span className="size-1.5 rounded-full bg-(--color-accent)" /> Commitment
        </span>
        <span className="text-(--color-text-secondary)">
          The active Server Seed is bound by{' '}
          <span className="font-mono text-(--color-text-primary)">SHA-256(serverSeed)</span> before any round.
          Reveal is independently verifiable here.
        </span>
      </div>
    </div>
  );
}
