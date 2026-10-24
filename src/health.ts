/** Health imports remain separate from user-authored meals, sleep and training facts. */
export const HEALTH_PROVIDERS = ['whoop', 'oura', 'google-health', 'apple-health'] as const;
export type HealthProvider = typeof HEALTH_PROVIDERS[number];
export type HealthKind = 'steps' | 'active_energy' | 'total_energy' | 'heart_rate' | 'resting_heart_rate' | 'hrv_rmssd' | 'hrv_sdnn' | 'sleep' | 'workout' | 'recovery' | 'readiness' | 'weight' | 'oxygen_saturation';
export interface HealthRecord {
  id: string;
  kind: HealthKind;
  startTime: string;
  endTime: string;
  value: number | null;
  unit: string;
  source: { sourceId: string; sourceName: string; deviceId?: string };
  metadata: Record<string, string | number | boolean | null>;
}
export interface ImportedHealthRecord extends HealthRecord { provider: HealthProvider; importedAt: string }
export interface HealthConnection {
  provider: HealthProvider;
  configured: boolean;
  status: 'not_configured' | 'disconnected' | 'connected' | 'reauthorize' | 'needs_iphone';
  reason: string | null;
  scopes: string[];
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  recordCount: number;
  /** Invalidates previews/in-flight imports after disconnect or deletion. */
  syncRevision: number;
  callbackUrl: string | null;
  applicationUrl: string;
}
export interface HealthConnectionsResponse { connections: HealthConnection[] }
export interface HealthRecordsResponse { records: ImportedHealthRecord[]; nextCursor: string | null }
export interface HealthSyncResponse { imported: number; deleted: number; connection: HealthConnection }
export interface AppleHealthImport {
  consent: true;
  expectedRevision: number;
  records: HealthRecord[];
  deletedIds: string[];
}
