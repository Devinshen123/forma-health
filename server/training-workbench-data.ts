import { z } from 'zod';
import sharp from 'sharp';

export const WORKBENCH_JSON_BYTES = 8 * 1024 * 1024;
export const WORKBENCH_MEDIA_QUOTA = 200 * 1024 * 1024;
export const WORKBENCH_MEDIA_BYTES = 40 * 1024 * 1024;
export const workbenchHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const workbenchMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'] as const;
export type WorkbenchMediaMime = typeof workbenchMediaTypes[number];
export interface WorkbenchState { [key: string]: unknown }
export interface WorkbenchWarning { id: string; code: string }
export interface WorkbenchSnapshot { state: WorkbenchState | null; rev: number; wid?: string; warnings: WorkbenchWarning[] }
export interface WorkbenchWrite { state: WorkbenchState; stamped: boolean; baseRev?: number; baseWid?: string }
export interface WorkbenchReceipt { ok: true; ts: number | null; rev: number; wid: string; warnings: WorkbenchWarning[] }
export interface WorkbenchMedia { owner_id: string; hash: string; mime: WorkbenchMediaMime; size: number; created_at: string }

export class WorkbenchError extends Error {
  constructor(public status: number, message: string, public code = 'workbench-invalid') { super(message); }
}
export class WorkbenchConflict extends WorkbenchError {
  constructor(public snapshot: WorkbenchSnapshot, code = 'conflict') { super(409, 'conflict', code); }
}

const dimensions = { hash: workbenchHashSchema, mime: z.enum(workbenchMediaTypes), size: z.number().int().positive().max(WORKBENCH_MEDIA_BYTES), width: z.number().int().min(1).max(16384), height: z.number().int().min(1).max(16384) };
const posterSchema = z.object({ ...dimensions, size: z.number().int().positive().max(2 * 1024 * 1024), mime: z.enum(['image/webp', 'image/jpeg']) }).strict();
const mediaSchema = z.object({
  ...dimensions, kind: z.enum(['image', 'gif', 'video']),
  dur: z.number().min(0).max(3600).optional(),
  codec: z.enum(['avc1', 'hvc1', 'av01', 'vp09', 'vp8', 'vp9', 'other']).optional(),
  poster: posterSchema.optional(), at: z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine(ref => ref.kind === (ref.mime === 'image/gif' ? 'gif' : ref.mime.startsWith('video/') ? 'video' : 'image'))
  .refine(ref => ref.size <= workbenchMediaLimit(ref.mime));

/** The vendor document is private storage, not an extension of Forma's public state schema. */
export function parseWorkbenchWrite(input: unknown): WorkbenchWrite {
  let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 200000 || depth > 20) throw new WorkbenchError(413, 'Training data exceeds the supported size');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new WorkbenchError(400, 'Invalid training data');
      return;
    }
    if (typeof value === 'string') {
      if (value.length > 65536 || value.includes('\0')) throw new WorkbenchError(400, 'Invalid training data');
      return;
    }
    if (!value || typeof value !== 'object') throw new WorkbenchError(400, 'Invalid training data');
    if (Array.isArray(value)) {
      if (value.length > 10000) throw new WorkbenchError(413, 'Training data exceeds the supported size');
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new WorkbenchError(400, 'Invalid training data');
    const entries = Object.entries(value);
    if (entries.length > 10000) throw new WorkbenchError(413, 'Training data exceeds the supported size');
    for (const [key, child] of entries) {
      if (key.length > 256 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new WorkbenchError(400, 'Invalid training data');
      visit(child, depth + 1);
    }
  };
  visit(input, 0);
  if (Buffer.byteLength(JSON.stringify(input)) > WORKBENCH_JSON_BYTES) throw new WorkbenchError(413, 'Training data exceeds the supported size');
  const parsed = z.object({ state: z.record(z.string(), z.unknown()), stamped: z.boolean().default(true), baseRev: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1).optional(), baseWid: z.string().regex(/^[a-f0-9]{16}$/).optional() }).strict().parse(input);
  if (!Array.isArray(parsed.state.workouts) || !Array.isArray(parsed.state.routines)) throw new WorkbenchError(400, 'A complete training document is required');
  for (const collection of ['workouts', 'routines', 'bodyweight', 'measurements', 'customEx', 'equipProfiles', 'customMeasurements']) {
    if (parsed.state[collection] !== undefined && !Array.isArray(parsed.state[collection])) throw new WorkbenchError(400, 'Invalid training collection');
  }
  for (const record of Array.isArray(parsed.state.customEx) ? parsed.state.customEx : []) {
    if (record && typeof record === 'object' && !Array.isArray(record) && (record as WorkbenchState).media != null) mediaSchema.parse((record as WorkbenchState).media);
  }
  for (const record of Array.isArray(parsed.state.workouts) ? parsed.state.workouts : []) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new WorkbenchError(400, 'Invalid workout record');
    const media = (record as WorkbenchState).media;
    if (media !== undefined) z.array(mediaSchema).max(6).parse(media);
  }
  const state = { ...parsed.state };
  // The vendor protocol keeps an active workout on the device. Revision lineage is server-owned.
  for (const key of ['active', '_rev', '_wid', '_wids']) delete state[key];
  return { ...parsed, state };
}

export function workbenchReferencedHashes(state: WorkbenchState | null): Set<string> {
  const out = new Set<string>();
  const add = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const ref = raw as WorkbenchState;
    if (typeof ref.hash === 'string' && workbenchHashSchema.safeParse(ref.hash).success) out.add(ref.hash);
    const poster = ref.poster;
    if (poster && typeof poster === 'object' && !Array.isArray(poster)) {
      const hash = (poster as WorkbenchState).hash;
      if (typeof hash === 'string' && workbenchHashSchema.safeParse(hash).success) out.add(hash);
    }
  };
  for (const record of Array.isArray(state?.customEx) ? state.customEx : []) if (record && typeof record === 'object') add((record as WorkbenchState).media);
  for (const record of Array.isArray(state?.workouts) ? state.workouts : []) if (record && typeof record === 'object') for (const media of Array.isArray((record as WorkbenchState).media) ? (record as WorkbenchState).media as unknown[] : []) add(media);
  return out;
}

export function workbenchMediaLimit(mime: WorkbenchMediaMime): number {
  return (mime === 'image/gif' ? 8 : mime.startsWith('video/') ? 40 : 2) * 1024 * 1024;
}

export function workbenchMediaMagic(bytes: Buffer, mime: WorkbenchMediaMime): boolean {
  if (mime === 'image/png') return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR';
  if (mime === 'image/jpeg') return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'image/gif') return bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
  if (mime === 'video/webm') return bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp' && (mime === 'video/quicktime' ? bytes.toString('ascii', 8, 12) === 'qt  ' : /^[\x20-\x7e]{4}$/.test(bytes.toString('ascii', 8, 12)));
}

/** Decode bounded images too: a plausible header alone does not make a valid picture. */
export async function validateWorkbenchImage(bytes: Buffer, mime: WorkbenchMediaMime): Promise<boolean> {
  if (!mime.startsWith('image/')) return true;
  try {
    const image = sharp(bytes, { animated: mime === 'image/gif', failOn: 'error', limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    const format = mime.slice('image/'.length), height = metadata.pageHeight ?? metadata.height ?? 0, width = metadata.width ?? 0, pages = metadata.pages ?? 1;
    if (metadata.format !== format || width < 1 || height < 1 || width > 16384 || height > 16384 || pages > 1000 || width * height * pages > 40000000) return false;
    await image.stats();
    return true;
  } catch { return false; }
}

/** Preserve plan versions while deleted personal observations stay deleted. */
export function workbenchPlannerSnapshot(state: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(['routines', 'week', 'dayPlan', 'rotation', 'queue'].filter(key => Object.hasOwn(state, key)).map(key => [key, state[key]]));
}
