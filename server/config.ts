/** Runtime configuration from the environment. Fails fast; never logs values. */
export interface SmtpConfig { host: string; port: number; secure: boolean; user: string; pass: string; from: string; to: string }
export interface Config {
  host: string; port: number; publicOrigin: string; allowedOrigins: string[]; trustProxy: boolean; smtp: SmtpConfig;
  deliveryTimeoutMs: number; rateLimit: { max: number; windowMs: number }; duplicateWindowMs: number;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

export const ONE_ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const publicOrigin = new URL(required(env, 'PUBLIC_ORIGIN')).origin;
  const to = required(env, 'SMTP_TO');
  if (!ONE_ADDRESS.test(to)) throw new Error('SMTP_TO must be exactly one address');
  return {
    host: env.HOST?.trim() || '127.0.0.1', port: Number(env.PORT ?? 3010), publicOrigin,
    allowedOrigins: [publicOrigin, ...(env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => new URL(s).origin)],
    trustProxy: env.TRUST_PROXY === 'true',
    smtp: { host: required(env, 'SMTP_HOST'), port: Number(env.SMTP_PORT ?? 587), secure: env.SMTP_SECURE === 'true', user: required(env, 'SMTP_USER'), pass: required(env, 'SMTP_PASS'), from: required(env, 'SMTP_FROM'), to },
    deliveryTimeoutMs: Number(env.DELIVERY_TIMEOUT_MS ?? 15_000),
    rateLimit: { max: Number(env.RATE_LIMIT_MAX ?? 5), windowMs: Number(env.RATE_LIMIT_WINDOW_MS ?? 10 * 60_000) },
    duplicateWindowMs: Number(env.DUPLICATE_WINDOW_MS ?? 10 * 60_000),
  };
}
