import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
    return;
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-(--color-border-subtle) bg-(--color-bg-base)/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 group min-w-0"
            onClick={() => setMenuOpen(false)}
          >
            <ShieldGlyph />
            <div className="min-w-0">
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.2em] text-(--color-text-tertiary)">
                Provably Fair
              </div>
              <div className="text-sm sm:text-base font-semibold text-(--color-text-primary) truncate">
                Verifier
              </div>
            </div>
          </NavLink>

          {/* Desktop nav, ≥md only */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/verify">Verify</NavItem>
            <NavItem to="/simulate">Simulate</NavItem>
            <NavItem to="/history">History</NavItem>
            <NavItem to="/api">API</NavItem>
            <NavItem to="/compliance">Compliance</NavItem>
            <NavItem to="/architecture">How it works</NavItem>
          </nav>

          {/* Mobile burger button, &lt;md only */}
          <button
            type="button"
            className="md:hidden inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-(--color-border-subtle) bg-(--color-bg-elevated) text-(--color-text-primary) transition active:scale-95 hover:bg-(--color-bg-elevated)/70"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>
        <CommitmentBanner />

        {/* Mobile menu, slides down under header */}
        <div
          id="mobile-menu"
          className={[
            'md:hidden overflow-hidden border-t border-(--color-border-subtle) bg-(--color-bg-raised)/96 backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-out',
            menuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0',
          ].join(' ')}
          aria-hidden={!menuOpen}
        >
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-3 py-4">
            <MobileNavItem to="/verify" hint="Verify a recorded round">
              Verify
            </MobileNavItem>
            <MobileNavItem to="/simulate" hint="Generate deterministic sequences">
              Simulate
            </MobileNavItem>
            <MobileNavItem to="/history" hint="Session round-by-round log">
              History
            </MobileNavItem>
            <MobileNavItem to="/api" hint="Endpoints, auth, examples">
              API reference
            </MobileNavItem>
            <MobileNavItem to="/compliance" hint="Regulatory mapping">
              Compliance
            </MobileNavItem>
            <MobileNavItem to="/architecture" hint="The cryptographic primitives">
              How it works
            </MobileNavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-(--color-border-subtle) py-5 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 text-xs text-(--color-text-tertiary) sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="leading-relaxed">
            HMAC-SHA256 · Client-side computation · No data sent to any server.
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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

function MobileNavItem({
  to,
  children,
  hint,
}: {
  to: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'flex min-h-[52px] items-center justify-between gap-4 rounded-md px-4 py-3 text-base font-medium transition',
          isActive
            ? 'bg-(--color-accent)/8 text-(--color-accent) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]'
            : 'text-(--color-text-primary) active:bg-(--color-bg-elevated)/80 hover:bg-(--color-bg-elevated)/60',
        ].join(' ')
      }
    >
      <span className="flex flex-col">
        <span>{children}</span>
        {hint ? (
          <span className="text-xs font-normal text-(--color-text-tertiary)">{hint}</span>
        ) : null}
      </span>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </NavLink>
  );
}

function ShieldGlyph() {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--color-accent)/30 bg-(--color-accent)/8 text-(--color-accent) shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] transition group-hover:border-(--color-accent)/50">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 L20 6 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V6 Z" />
        <path d="M9 12 L11 14 L15 10" />
      </svg>
    </div>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  // Three lines that morph into an X. The middle bar fades; outer bars rotate
  // into the diagonals. CSS-only, matches the rectilinear/technical feel of
  // the rest of the UI.
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <line
        x1="4"
        y1="7"
        x2="20"
        y2="7"
        className={[
          'origin-center transition-transform duration-300',
          open ? 'translate-y-[5px] rotate-45' : '',
        ].join(' ')}
      />
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        className={[
          'origin-center transition-opacity duration-200',
          open ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      />
      <line
        x1="4"
        y1="17"
        x2="20"
        y2="17"
        className={[
          'origin-center transition-transform duration-300',
          open ? '-translate-y-[5px] -rotate-45' : '',
        ].join(' ')}
      />
    </svg>
  );
}

function CommitmentBanner() {
  // Per PRD Ch.5: commitment must be visible at all times. Compact on phones
  // (the explanatory text wraps); full sentence on tablets and up.
  return (
    <div className="border-t border-(--color-border-subtle) bg-(--color-bg-raised)/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-xs sm:flex-nowrap sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--color-accent)/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-(--color-accent)">
          <span className="size-1.5 rounded-full bg-(--color-accent)" /> Commitment
        </span>
        <span className="text-(--color-text-secondary)">
          The active Server Seed is bound by{' '}
          <span className="font-mono text-(--color-text-primary)">SHA-256(serverSeed)</span> before
          any round. Reveal is independently verifiable here.
        </span>
      </div>
    </div>
  );
}
