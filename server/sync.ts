import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AppState, SyncChange, SyncCollection, SyncMutation, SyncSnapshot } from '../src/types';
import { dateSchema, idSchema } from './validation-primitives';

const collections = ['meals', 'workouts', 'sleeps', 'reports', 'planVersions', 'suggestions', 'routines', 'schedules', 'activeWorkouts', 'profile', 'currentPlanId', 'completedActions'] as const;
export const arrayCollections = collections.filter(collection => !['profile', 'currentPlanId', 'completedActions'].includes(collection)) as Exclude<SyncCollection, 'profile' | 'currentPlanId' | 'completedActions'>[];
const changeSchema = z.object({
  collection: z.enum(collections), id: z.string().min(1).max(100),
  baseVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  kind: z.enum(['upsert', 'delete']), value: z.unknown().optional(),
}).strict().superRefine((change, ctx) => {
  const validId = change.collection === 'profile' || change.collection === 'currentPlanId'
    ? change.id === change.collection
    : change.collection === 'completedActions' ? dateSchema.safeParse(change.id).success : idSchema.safeParse(change.id).success;
  if (!validId) ctx.addIssue({ code: 'custom', path: ['id'], message: 'Invalid entity identifier' });
  if (change.kind === 'upsert' ? change.value === undefined : change.value !== undefined)
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'An upsert requires a value; a delete cannot carry a value' });
  if (change.kind === 'upsert' && arrayCollections.includes(change.collection as typeof arrayCollections[number])) {
    const value = change.value;
    if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { id?: unknown }).id !== change.id)
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'The record ID must match the changed entity' });
  }
});
export const syncMutationSchema = z.object({ mutationId: idSchema, changes: z.array(changeSchema).min(1).max(1000) }).strict().superRefine((mutation, ctx) => {
  const keys = mutation.changes.map(entityKey);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['changes'], message: 'A batch can touch each entity only once' });
});
export const entityKey = (change: Pick<SyncChange, 'collection' | 'id'>) => `${change.collection}:${change.id}`;

/** Canonical JSON makes harmless object-key ordering irrelevant; array ordering is meaningful. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ':' + canonicalJson(item)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export const mutationHash = (mutation: SyncMutation) => createHash('sha256').update(canonicalJson(mutation)).digest('hex');
export function normalizedState(state: AppState): AppState {
  return { ...state, routines: state.routines ?? [], schedules: state.schedules ?? [], activeWorkouts: state.activeWorkouts ?? [] };
}
export function entityValues(state: AppState): Map<string, unknown> {
  const values = new Map<string, unknown>();
  values.set('profile:profile', state.profile);
  values.set('currentPlanId:currentPlanId', state.currentPlanId);
  for (const collection of arrayCollections)
    for (const entity of state[collection] ?? []) values.set(`${collection}:${entity.id}`, entity);
  for (const [date, actions] of Object.entries(state.completedActions)) values.set(`completedActions:${date}`, actions);
  return values;
}
export function changedEntityKeys(previous: AppState, next: AppState): string[] {
  const before = entityValues(previous), after = entityValues(next);
  return [...new Set([...before.keys(), ...after.keys()])].filter(key => canonicalJson(before.get(key)) !== canonicalJson(after.get(key)));
}
export function applySyncChanges(previous: AppState, changes: SyncChange[]): AppState {
  const next = structuredClone(normalizedState(previous));
  for (const change of changes) {
    if (change.collection === 'profile') next.profile = (change.kind === 'delete' ? null : change.value) as AppState['profile'];
    else if (change.collection === 'currentPlanId') next.currentPlanId = (change.kind === 'delete' ? null : change.value) as AppState['currentPlanId'];
    else if (change.collection === 'completedActions') {
      if (change.kind === 'delete') delete next.completedActions[change.id];
      else next.completedActions[change.id] = change.value as string[];
    } else {
      const collection = change.collection;
      const records = next[collection] ?? [];
      const index = records.findIndex(record => record.id === change.id);
      if (change.kind === 'delete') { if (index >= 0) records.splice(index, 1); }
      else if (index < 0) records.push(change.value as never);
      else records[index] = change.value as never;
      // Arrays are heterogeneous across collections but each was checked against its schema later.
      (next[collection] as unknown) = records;
    }
  }
  return next;
}
export class SyncConflict extends Error {
  constructor(public snapshot: SyncSnapshot, public conflicts: string[], message = 'Some records changed on another device. Review before saving.') {
    super(message);
  }
}
