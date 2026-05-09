import { useMemo, useState } from 'react';

import { Badge, Card, CardBody, CardHeader, Hash, KeyValue } from '../components/ui.tsx';

const FALLBACK_API_URL = 'http://localhost:3000';

export function ApiDocs() {
  const [apiUrl] = useState(import.meta.env['VITE_API_URL'] ?? FALLBACK_API_URL);
  const specUrl = `${apiUrl}/openapi.json`;
  const iframeSrc = useMemo(
    () => `/api-reference.html?url=${encodeURIComponent(specUrl)}`,
    [specUrl],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">API reference</h1>
          <p className="mt-1 max-w-2xl text-sm text-(--color-text-secondary)">
            Every endpoint, request shape, response shape, and authentication header. The spec is
            machine-readable so you can generate client SDKs in any language with{' '}
            <code className="font-mono text-xs">openapi-generator</code> or auto-import the whole
            surface into Postman.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success">OpenAPI 3.1</Badge>
          <a
            href={specUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) px-3 py-1.5 text-xs font-medium text-(--color-text-primary) hover:bg-(--color-bg-elevated)/80"
          >
            Raw JSON
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </a>
        </div>
      </header>

      <Card>
        <CardHeader title="Authentication" subtitle="Two roles, header-based, TLS in production." />
        <CardBody className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <RoleCard
              role="Tenant (operator)"
              tone="success"
              header="X-API-Key"
              example="demo-tenant-key-CHANGE-ME-IN-PRODUCTION"
              scope="Full access to your own tenant's sessions, rounds, and rotations."
            />
            <RoleCard
              role="Regulator (read-only)"
              tone="info"
              header="X-API-Key"
              example="regulator-key-CHANGE-ME-IN-PRODUCTION"
              scope="Cross-tenant, read-only on /v1/regulator/*. Cannot mutate state."
            />
          </div>
          <div className="rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/60 px-4 py-3 text-xs text-(--color-text-secondary)">
            Production note: rotate keys at least every 90 days. The dev keys above are for local
            testing only.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Quick examples"
          subtitle="Copy-paste curl commands to exercise the API end-to-end."
        />
        <CardBody className="space-y-5">
          <Example
            title="1. Create a player session"
            description="Generates a Server Seed, returns the SHA-256 commitment."
            code={`curl -X POST ${apiUrl}/v1/sessions \\
  -H "X-API-Key: demo-tenant-key-CHANGE-ME-IN-PRODUCTION" \\
  -H "Content-Type: application/json" \\
  -d '{"playerId":"p1","clientSeed":"my-lucky-seed"}'`}
          />
          <Example
            title="2. Place a round"
            description="Determines a dice outcome. Use the sessionId from step 1."
            code={`curl -X POST ${apiUrl}/v1/rounds \\
  -H "X-API-Key: demo-tenant-key-CHANGE-ME-IN-PRODUCTION" \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId":"<id>","gameConfig":{"type":"dice","minRoll":0,"maxRoll":100,"decimals":2}}'`}
          />
          <Example
            title="3. Rotate the seed (reveal the server seed)"
            description="At rotation, the previous Server Seed is revealed. SHA-256 of it must equal the original commitment."
            code={`curl -X POST ${apiUrl}/v1/sessions/<id>/rotate \\
  -H "X-API-Key: demo-tenant-key-CHANGE-ME-IN-PRODUCTION" \\
  -H "Content-Type: application/json" -d '{}'`}
          />
          <Example
            title="4. Regulator pull"
            description="Read-only access to any round across any tenant."
            code={`curl ${apiUrl}/v1/regulator/rounds/<roundId> \\
  -H "X-API-Key: regulator-key-CHANGE-ME-IN-PRODUCTION"`}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Full reference"
          subtitle="Auto-rendered from the OpenAPI spec. Click any endpoint to expand schemas, examples, and try it out."
        />
        <CardBody className="p-0">
          <iframe
            src={iframeSrc}
            title="OpenAPI reference"
            className="h-[80vh] w-full rounded-b-xl border-0 bg-(--color-bg-base)"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Generate a client SDK" />
        <CardBody>
          <p className="text-sm text-(--color-text-secondary)">
            With the spec URL above, generate a strongly-typed client in any of 50+ languages:
          </p>
          <pre className="mt-3 overflow-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-4 font-mono text-xs text-(--color-text-secondary)">
{`# TypeScript
npx @hey-api/openapi-ts -i ${specUrl} -o ./pf-client

# Python
openapi-generator-cli generate -i ${specUrl} -g python -o ./pf-client-py

# PHP
openapi-generator-cli generate -i ${specUrl} -g php -o ./pf-client-php`}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}

function RoleCard(props: {
  role: string;
  tone: 'success' | 'info';
  header: string;
  example: string;
  scope: string;
}) {
  return (
    <div className="rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/60 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">{props.role}</h3>
        <Badge tone={props.tone}>read{props.tone === 'success' ? '/write' : '-only'}</Badge>
      </div>
      <dl className="mt-3 space-y-3">
        <KeyValue
          k="Header"
          v={<code className="font-mono text-xs">{props.header}</code>}
        />
        <div>
          <dt className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">
            Example value (dev)
          </dt>
          <dd className="mt-1">
            <Hash value={props.example} />
          </dd>
        </div>
        <KeyValue k="Scope" v={<span className="text-xs">{props.scope}</span>} />
      </dl>
    </div>
  );
}

function Example(props: { title: string; description: string; code: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-(--color-text-primary)">{props.title}</h3>
      <p className="mt-1 text-sm text-(--color-text-secondary)">{props.description}</p>
      <pre className="mt-2 overflow-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-4 font-mono text-xs leading-relaxed text-(--color-text-secondary)">
        {props.code}
      </pre>
    </div>
  );
}
