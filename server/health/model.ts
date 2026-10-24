import { z } from 'zod';
import type { HealthKind, HealthProvider, HealthRecord } from '../../src/health';

export type CloudProvider = Exclude<HealthProvider, 'apple-health'>;
export const cloudProviders = ['whoop', 'oura', 'google-health'] as const;
export const providerSchema = z.enum(['whoop', 'oura', 'google-health', 'apple-health']);
export const cloudProviderSchema = z.enum(cloudProviders);
export class HealthError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value));
export const recordIdSchema = text(256);
const units: Record<HealthKind, { unit: string; min: number; max: number }> = {
  steps: { unit: 'count', min: 0, max: 1000000 },
  active_energy: { unit: 'kcal', min: 0, max: 1000000 },
  total_energy: { unit: 'kcal', min: 0, max: 1000000 },
  heart_rate: { unit: 'bpm', min: 1, max: 300 }, resting_heart_rate: { unit: 'bpm', min: 1, max: 300 },
  hrv_rmssd: { unit: 'ms', min: 0, max: 10000 }, hrv_sdnn: { unit: 'ms', min: 0, max: 10000 },
  sleep: { unit: 'min', min: 0, max: 10080 }, workout: { unit: 'min', min: 0, max: 10080 },
  recovery: { unit: 'score', min: 0, max: 100 }, readiness: { unit: 'score', min: 0, max: 100 },
  weight: { unit: 'kg', min: 0.1, max: 1000 }, oxygen_saturation: { unit: 'percent', min: 0, max: 100 },
};
const metadata = z.record(z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/), z.union([text(500), z.number().min(-1e9).max(1e9), z.boolean(), z.null()]))
  .refine(value => Object.keys(value).length <= 20);
export const healthRecordSchema = z.object({
  id: recordIdSchema, kind: z.enum(Object.keys(units) as [HealthKind, ...HealthKind[]]),
  startTime: z.iso.datetime({ offset: true }), endTime: z.iso.datetime({ offset: true }),
  value: z.number().nullable(), unit: text(24),
  source: z.object({ sourceId: text(160), sourceName: text(160), deviceId: text(160).optional() }).strict(), metadata,
}).strict().superRefine((record, context) => {
  const spec = units[record.kind], start = Date.parse(record.startTime), end = Date.parse(record.endTime);
  if (record.unit !== spec.unit || record.value !== null && (record.value < spec.min || record.value > spec.max))
    context.addIssue({ code: 'custom', message: 'Invalid metric or unit' });
  if (record.kind === 'steps' && record.value !== null && !Number.isSafeInteger(record.value)) context.addIssue({ code: 'custom', message: 'Steps must be a whole count' });
  if (start > end || end - start > 14 * 86400000 || start < Date.UTC(1990, 0, 1) || end > Date.UTC(2100, 0, 1))
    context.addIssue({ code: 'custom', message: 'Invalid record interval' });
  if ((record.kind === 'sleep' || record.kind === 'workout') && record.value !== null && record.value > (end - start) / 60000 + 1)
    context.addIssue({ code: 'custom', message: 'Duration exceeds record interval' });
});
export const appleImportSchema = z.object({
  consent: z.literal(true), expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), records: z.array(healthRecordSchema).max(500), deletedIds: z.array(recordIdSchema).max(500),
}).strict().superRefine((value, context) => {
  const ids = value.records.map(record => record.id);
  if (value.records.length + value.deletedIds.length > 500 || new Set(ids).size !== ids.length ||
      new Set(value.deletedIds).size !== value.deletedIds.length || value.deletedIds.some(id => ids.includes(id)))
    context.addIssue({ code: 'custom', message: 'Invalid import batch' });
});
export const emptyBodySchema = z.object({}).strict();

export interface HealthConfig {
  tokenKey?: string;
  publicBaseUrl?: string;
  providers?: Partial<Record<CloudProvider, { clientId: string; clientSecret: string }>>;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPages?: number;
}
const secret = z.string().min(1).max(4096).refine(value => !/[\x00-\x20\x7f]/.test(value));
export function resolveHealthConfig(overrides?: HealthConfig) {
  const config: HealthConfig = overrides ?? {
    tokenKey: process.env.FORMA_HEALTH_TOKEN_KEY,
    publicBaseUrl: process.env.FORMA_HEALTH_PUBLIC_BASE_URL,
    providers: Object.fromEntries(cloudProviders.map(provider => {
      const prefix = provider === 'google-health' ? 'GOOGLE' : provider.toUpperCase();
      return [provider, { clientId: process.env[`FORMA_HEALTH_${prefix}_CLIENT_ID`] ?? '', clientSecret: process.env[`FORMA_HEALTH_${prefix}_CLIENT_SECRET`] ?? '' }];
    })),
  };
  let key: Buffer | null = null, baseUrl: string | null = null;
  try {
    const bytes = Buffer.from(config.tokenKey ?? '', 'base64');
    if (bytes.length === 32 && bytes.toString('base64') === config.tokenKey) key = bytes;
    const url = new URL(config.publicBaseUrl || 'http://127.0.0.1:3001');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    baseUrl = url.origin;
  } catch { /* Missing or malformed credentials disable cloud integrations, never the app. */ }
  const settings = z.object({ timeoutMs: z.number().int().min(10).max(30000), pollIntervalMs: z.number().int().min(0).max(86400000), maxPages: z.number().int().min(1).max(50) })
    .safeParse({ timeoutMs: config.timeoutMs ?? 10000, pollIntervalMs: config.pollIntervalMs ?? 15 * 60000, maxPages: config.maxPages ?? 20 });
  const providers: Partial<Record<CloudProvider, { clientId: string; clientSecret: string }>> = {};
  for (const provider of cloudProviders) {
    const parsed = z.object({ clientId: secret, clientSecret: secret }).strict().safeParse(config.providers?.[provider]);
    if (parsed.success && key && baseUrl && settings.success) providers[provider] = parsed.data;
  }
  return { key, baseUrl, providers, ...(settings.success ? settings.data : { timeoutMs: 10000, pollIntervalMs: 0, maxPages: 20 }) };
}

export const definitions = {
  whoop: {
    authorization: 'https://api.prod.whoop.com/oauth/oauth2/auth', token: 'https://api.prod.whoop.com/oauth/oauth2/token',
    scopes: ['read:sleep', 'read:recovery', 'read:cycles', 'read:workout', 'offline'], application: 'https://developer-dashboard.whoop.com/',
  },
  oura: {
    authorization: 'https://cloud.ouraring.com/oauth/authorize', token: 'https://api.ouraring.com/oauth/token',
    scopes: ['daily', 'heartrate', 'workout'], application: 'https://developer.ouraring.com/',
  },
  'google-health': {
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly', 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly', 'https://www.googleapis.com/auth/googlehealth.sleep.readonly'],
    application: 'https://console.cloud.google.com/apis/library/health.googleapis.com',
  },
} as const;

export function validateRecords(records: HealthRecord[]): HealthRecord[] {
  if (records.length > 10000) throw new HealthError('HEALTH_RESPONSE_LIMIT', 502);
  const parsed = z.array(healthRecordSchema).safeParse(records);
  if (!parsed.success) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return parsed.data;
}
