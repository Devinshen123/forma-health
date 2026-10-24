/** Official API references checked 2026-10-23:
 * WHOOP v2 https://developer.whoop.com/api/ and /docs/developing/oauth/
 * Oura v2 https://cloud.ouraring.com/v2/docs and /docs/authentication
 * Google Health v4 (distinct from Fit/Health Connect):
 * https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list
 * https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints
 * https://developers.google.com/health/setup and /scopes
 * Google names/scalars follow the official v4 discovery document.
 */
import { z } from 'zod';
import type { HealthKind, HealthRecord } from '../../src/health';
import { HealthError, definitions, validateRecords, type CloudProvider } from './model';
import { digest, type HealthTokens } from './ledger';

type Json = Record<string, any>;
export type HealthRequest = (url: URL | string, init?: RequestInit) => Promise<unknown>;
const object = (value: unknown): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return value as Json;
};
const string = (value: unknown, max = 256): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return value;
};
const identifier = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : string(value);
const time = (value: unknown): string => {
  if (!z.iso.datetime({ offset: true }).safeParse(value).success) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return new Date(value as string).toISOString();
};
const numeric = (value: unknown, int64 = false): number | null => {
  if (value === undefined || value === null) return null;
  const result = int64 && typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return result;
};
const dailyInterval = (value: unknown) => {
  const day = string(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return { start: `${day}T00:00:00.000Z`, end: new Date(Date.parse(day) + 86400000).toISOString() };
};
function record(id: string, kind: HealthKind, start: string, end: string, value: number | null, unit: string, provider: CloudProvider, metadata: HealthRecord['metadata'] = {}, source?: HealthRecord['source']): HealthRecord {
  return { id: id.length > 256 ? digest(id) : id, kind, startTime: start, endTime: end, value, unit,
    source: source ?? { sourceId: provider, sourceName: provider === 'whoop' ? 'WHOOP' : provider === 'oura' ? 'Oura' : 'Google Health' }, metadata };
}
function page(raw: unknown, provider: CloudProvider) {
  const value = object(raw), key = provider === 'whoop' ? 'records' : provider === 'oura' ? 'data' : 'dataPoints';
  const rows = value[key] ?? (provider === 'google-health' ? [] : undefined);
  if (!Array.isArray(rows) || rows.length > 10000) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  const token = value[provider === 'google-health' ? 'nextPageToken' : 'next_token'];
  if (token !== undefined && token !== null && token !== '' && (typeof token !== 'string' || token.length > 2048 || /[\x00-\x1f\x7f]/.test(token))) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  return { rows: rows.map(object), next: token || null as string | null };
}

export function tokenResponse(raw: unknown, provider: CloudProvider, now: number, previous?: HealthTokens): HealthTokens {
  const schema = z.object({ access_token: z.string().min(1).max(8192).regex(/^[\x21-\x7e]+$/), token_type: z.string().refine(value => value.toLowerCase() === 'bearer'),
    expires_in: z.number().int().min(1).max(31536000), refresh_token: z.string().min(1).max(8192).regex(/^[\x21-\x7e]+$/).optional(),
    scope: z.union([z.string().max(8192), z.array(z.string().max(200)).max(30)]).optional() }).passthrough().safeParse(raw);
  if (!schema.success) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
  const result = schema.data;
  const granted = result.scope === undefined ? previous?.scopes ?? [] : typeof result.scope === 'string' ? result.scope.split(/\s+/).filter(Boolean) : result.scope;
  const scopes = [...new Set(granted)]
    .filter(scope => (definitions[provider].scopes as readonly string[]).includes(scope));
  // The documented Oura server-side token shape may omit scope. In that case
  // the service checks actual read access, rather than trusting callback scope.
  if (!scopes.some(scope => scope !== 'offline') && !(provider === 'oura' && result.scope === undefined && !previous)) throw new HealthError('HEALTH_MISSING_SCOPES', 409);
  return { accessToken: result.access_token, refreshToken: result.refresh_token ?? previous?.refreshToken, expiresAt: now + result.expires_in * 1000, scopes, ...(previous?.subjectId ? { subjectId: previous.subjectId } : {}) };
}

export async function fetchHealthRecords(provider: CloudProvider, tokens: HealthTokens, start: string, end: string, request: HealthRequest, maxPages: number): Promise<HealthRecord[]> {
  const records: HealthRecord[] = [];
  let pages = 0;
  async function collection(url: URL, parse: (value: Json) => HealthRecord[]) {
    const seen = new Set<string>();
    while (true) {
      if (++pages > maxPages) throw new HealthError('HEALTH_PAGE_LIMIT', 502);
      const result = page(await request(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } }), provider);
      for (const row of result.rows) {
        records.push(...parse(row));
        if (records.length > 10000) throw new HealthError('HEALTH_RESPONSE_LIMIT', 502);
      }
      if (!result.next) break;
      if (seen.has(result.next)) throw new HealthError('HEALTH_PAGE_LIMIT', 502);
      seen.add(result.next);
      url.searchParams.set(provider === 'whoop' ? 'nextToken' : provider === 'oura' ? 'next_token' : 'pageToken', result.next);
    }
  }
  if (provider === 'whoop') {
    for (const [scope, path] of [['read:cycles', 'cycle'], ['read:recovery', 'recovery'], ['read:sleep', 'activity/sleep'], ['read:workout', 'activity/workout']]) {
      if (!tokens.scopes.includes(scope)) continue;
      const url = new URL(`https://api.prod.whoop.com/developer/v2/${path}`);
      url.searchParams.set('start', start); url.searchParams.set('end', end); url.searchParams.set('limit', '25');
      await collection(url, row => {
        // WHOOP's current physiological cycle can have no end yet. Do not
        // pretend its update timestamp is the end of a completed observation.
        if (path === 'cycle' && row.end === null) return [];
        const id = identifier(row.id ?? row.cycle_id), prefix = `${path.replace('activity/', '')}:${id}`;
        const from = time(row.start ?? row.created_at), to = time(row.end ?? row.updated_at ?? row.created_at);
        const scored = row.score_state === 'SCORED';
        const score = row.score === null || row.score === undefined ? {} : object(row.score);
        if (path === 'recovery') return [
          record(`${prefix}:recovery`, 'recovery', from, from, scored ? numeric(score.recovery_score) : null, 'score', provider, { vendorScore: true, updatedAt: to }),
          record(`${prefix}:rhr`, 'resting_heart_rate', from, from, scored ? numeric(score.resting_heart_rate) : null, 'bpm', provider, { updatedAt: to }),
          record(`${prefix}:hrv`, 'hrv_rmssd', from, from, scored ? numeric(score.hrv_rmssd_milli) : null, 'ms', provider, { updatedAt: to }),
        ];
        if (path === 'activity/sleep') {
          const stages = score.stage_summary === undefined || score.stage_summary === null ? {} : object(score.stage_summary);
          const durations = [stages.total_light_sleep_time_milli, stages.total_slow_wave_sleep_time_milli, stages.total_rem_sleep_time_milli].map(value => numeric(value));
          const duration = !scored || durations.some(value => value === null) ? null : (durations as number[]).reduce((total, value) => total + value, 0) / 60000;
          return [record(prefix, 'sleep', from, to, duration, 'min', provider, { nap: typeof row.nap === 'boolean' ? row.nap : null })];
        }
        if (path === 'activity/workout') return [record(prefix, 'workout', from, to, (Date.parse(to) - Date.parse(from)) / 60000, 'min', provider, {
          sportId: typeof row.sport_id === 'number' ? row.sport_id : null, kilojoule: scored ? numeric(score.kilojoule) : null, averageHeartRate: scored ? numeric(score.average_heart_rate) : null,
        })];
        const energy = scored ? numeric(score.kilojoule) : null;
        return [record(`${prefix}:energy`, 'total_energy', from, to, energy === null ? null : energy / 4.184, 'kcal', provider, { intervalType: 'physiological_cycle' })];
      });
    }
  } else if (provider === 'oura') {
    for (const [scope, path] of [['daily', 'daily_activity'], ['daily', 'sleep'], ['daily', 'daily_readiness'], ['heartrate', 'heartrate'], ['workout', 'workout']]) {
      if (!tokens.scopes.includes(scope)) continue;
      const url = new URL(`https://api.ouraring.com/v2/usercollection/${path}`);
      const timed = path === 'heartrate';
      url.searchParams.set(timed ? 'start_datetime' : 'start_date', timed ? start : start.slice(0, 10));
      url.searchParams.set(timed ? 'end_datetime' : 'end_date', timed ? end : end.slice(0, 10));
      await collection(url, row => {
        if (path === 'heartrate') {
          const at = time(row.timestamp), source = row.source === undefined ? 'unknown' : string(row.source, 100);
          return [record(`heartrate:${digest(at + ':' + source)}`, 'heart_rate', at, at, numeric(row.bpm), 'bpm', provider, { measurementSource: source })];
        }
        const id = identifier(row.id), prefix = `${path}:${id}`;
        if (path === 'daily_activity' || path === 'daily_readiness') {
          const day = dailyInterval(row.day), meta = { day: String(row.day), timeBasis: 'provider_local_day' };
          if (path === 'daily_readiness') return [record(prefix, 'readiness', day.start, day.end, numeric(row.score), 'score', provider, { ...meta, vendorScore: true })];
          return [record(`${prefix}:steps`, 'steps', day.start, day.end, numeric(row.steps), 'count', provider, meta),
            record(`${prefix}:active`, 'active_energy', day.start, day.end, numeric(row.active_calories), 'kcal', provider, meta),
            record(`${prefix}:total`, 'total_energy', day.start, day.end, numeric(row.total_calories), 'kcal', provider, meta)];
        }
        if (path === 'sleep') {
          const from = time(row.bedtime_start), to = time(row.bedtime_end), duration = numeric(row.total_sleep_duration);
          return [record(prefix, 'sleep', from, to, duration === null ? null : duration / 60, 'min', provider),
            record(`${prefix}:hr`, 'heart_rate', from, to, numeric(row.average_heart_rate), 'bpm', provider, { statistic: 'sleep_average' }),
            record(`${prefix}:hrv`, 'hrv_rmssd', from, to, numeric(row.average_hrv), 'ms', provider, { statistic: 'sleep_average' })];
        }
        const from = time(row.start_datetime), to = time(row.end_datetime);
        return [record(prefix, 'workout', from, to, (Date.parse(to) - Date.parse(from)) / 60000, 'min', provider, {
          activity: row.activity === undefined ? null : string(row.activity, 160), calories: numeric(row.calories),
        })];
      });
    }
  } else {
    const prefix = 'https://www.googleapis.com/auth/googlehealth.';
    const streams = [
      ['activity_and_fitness', 'steps', 'steps', 'interval.start_time', 'steps', 'count', 'count'],
      ['activity_and_fitness', 'active-energy-burned', 'activeEnergyBurned', 'interval.start_time', 'active_energy', 'kcal', 'kcal'],
      ['activity_and_fitness', 'exercise', 'exercise', 'interval.civil_start_time', 'workout', '', 'min'],
      ['health_metrics_and_measurements', 'heart-rate', 'heartRate', 'sample_time.physical_time', 'heart_rate', 'beatsPerMinute', 'bpm'],
      ['health_metrics_and_measurements', 'weight', 'weight', 'sample_time.physical_time', 'weight', 'weightGrams', 'kg'],
      ['sleep', 'sleep', 'sleep', 'interval.end_time', 'sleep', '', 'min'],
    ] as const;
    for (const [scope, path, field, filterField, kind, numberField, unit] of streams) {
      if (!tokens.scopes.includes(`${prefix}${scope}.readonly`)) continue;
      const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${path}/dataPoints`);
      const from = filterField.includes('civil') ? start.slice(0, 19) : start, to = filterField.includes('civil') ? end.slice(0, 19) : end;
      url.searchParams.set('filter', `${field}.${filterField} >= "${from}" AND ${field}.${filterField} < "${to}"`);
      url.searchParams.set('pageSize', path === 'sleep' || path === 'exercise' ? '25' : '1000');
      await collection(url, row => {
        const point = object(row[field]), source = row.dataSource === undefined ? {} : object(row.dataSource);
        const interval = point.interval === undefined ? null : object(point.interval), sample = point.sampleTime === undefined ? null : object(point.sampleTime);
        const startTime = time(interval?.startTime ?? sample?.physicalTime), endTime = time(interval?.endTime ?? sample?.physicalTime);
        const device = source.device === undefined ? {} : object(source.device), application = source.application === undefined ? {} : object(source.application);
        const sourceId = digest(JSON.stringify(source)), platform = typeof source.platform === 'string' ? string(source.platform, 160) : 'Google Health';
        const packageName = application.packageName === undefined ? undefined : string(application.packageName, 160);
        const sourceName = device.displayName === undefined ? packageName ?? platform : string(device.displayName, 160);
        const id = typeof row.name === 'string' && row.name ? `google:${digest(row.name)}` : `google:${digest([tokens.subjectId, path, sourceId, startTime, endTime].join(':'))}`;
        let value: number | null;
        if (kind === 'sleep') value = numeric(point.summary === undefined ? undefined : object(point.summary).minutesAsleep, true);
        else if (kind === 'workout') value = (Date.parse(endTime) - Date.parse(startTime)) / 60000;
        else { value = numeric(point[numberField], kind === 'heart_rate' || kind === 'steps'); if (kind === 'weight' && value !== null) value /= 1000; }
        const metadata: HealthRecord['metadata'] = { apiVersion: 'v4', originalPlatform: platform };
        if (packageName) metadata.originalPackageName = packageName;
        if (device.manufacturer !== undefined) metadata.deviceManufacturer = string(device.manufacturer, 160);
        if (device.formFactor !== undefined) metadata.deviceFormFactor = string(device.formFactor, 160);
        if (source.recordingMethod !== undefined) metadata.recordingMethod = string(source.recordingMethod, 160);
        if (kind === 'workout') metadata.activity = point.exerciseType === undefined ? null : string(point.exerciseType, 160);
        return [record(id, kind, startTime, endTime, value, unit, provider, metadata, { sourceId: packageName ?? `google:${sourceId}`, sourceName,
          ...(Object.keys(device).length ? { deviceId: `google:${digest(JSON.stringify(device))}` } : {}) })];
      });
    }
  }
  return validateRecords(records);
}
