import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';

import { Card, CardBody, CardHeader } from './ui.tsx';

export function NotFound() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : null;
  const isNotFound = status === 404;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Card>
        <CardHeader
          title={isNotFound ? 'Page not found' : 'Something went wrong'}
          subtitle={
            isNotFound
              ? "The route you tried to open isn't part of this verifier."
              : 'An unexpected error occurred while rendering this page.'
          }
        />
        <CardBody className="space-y-4">
          {!isNotFound && error instanceof Error ? (
            <pre className="overflow-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-3 font-mono text-xs text-(--color-danger)">
              {error.message}
            </pre>
          ) : null}
          <p className="text-sm text-(--color-text-secondary)">
            Go back to the home page, or jump straight into a tool:
          </p>
          <div className="flex flex-wrap gap-2">
            <NavLinkPill to="/">Home</NavLinkPill>
            <NavLinkPill to="/verify">Verify</NavLinkPill>
            <NavLinkPill to="/simulate">Simulate</NavLinkPill>
            <NavLinkPill to="/history">History</NavLinkPill>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function NavLinkPill({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) px-3 py-1.5 text-sm font-medium text-(--color-text-primary) transition hover:bg-(--color-bg-elevated)/80"
    >
      {children}
    </Link>
  );
}
