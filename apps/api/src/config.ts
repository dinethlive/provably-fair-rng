/**
 * API configuration — loads from env with sensible defaults for local dev.
 *
 * Production note (GAPS.md §B7): API keys MUST be rotated at least every 90
 * days. The TENANT_API_KEYS env is a JSON map `{ "<tenantId>": "<key>" }` and
 * intended only for local/dev. Production deployments should integrate with
 * a secrets manager (AWS Secrets Manager / GCP Secret Manager / Vault).
 */

export interface Config {
  readonly port: number;
  readonly host: string;
  readonly tenantApiKeys: ReadonlyMap<string, string>;
  readonly regulatorApiKey: string;
  readonly logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

function parseTenantKeys(raw: string | undefined): Map<string, string> {
  if (!raw) {
    return new Map<string, string>([
      ['demo-tenant', 'demo-tenant-key-CHANGE-ME-IN-PRODUCTION'],
    ]);
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch (err) {
    throw new Error(`TENANT_API_KEYS env is not valid JSON: ${(err as Error).message}`);
  }
}

export function loadConfig(): Config {
  const portRaw = process.env['PORT'] ?? '3000';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT env invalid: ${portRaw}`);
  }
  return {
    port,
    host: process.env['HOST'] ?? '0.0.0.0',
    tenantApiKeys: parseTenantKeys(process.env['TENANT_API_KEYS']),
    regulatorApiKey:
      process.env['REGULATOR_API_KEY'] ?? 'regulator-key-CHANGE-ME-IN-PRODUCTION',
    logLevel: (process.env['LOG_LEVEL'] as Config['logLevel']) ?? 'info',
  };
}
