import { uid, type Sleep } from "../types";
import { toSleepTimeInput } from "./sleepTime";
import { shiftRecordingDay } from './recordingDates';

export type SleepDraft = {
  id: string;
  existing: boolean;
  start: string;
  end: string;
  quality: string;
  energy: string;
  timezone: string;
  createdAt: string;
  originalStart?: string;
  originalEnd?: string;
};

/** Allocate the identity when the editor opens, before any uncertain save. */
export const createSleepDraft = (timezone: string, sleep?: Sleep, wakeDay?: string): SleepDraft =>
  sleep ? {
    id: sleep.id,
    existing: true,
    start: toSleepTimeInput(sleep.start),
    end: toSleepTimeInput(sleep.end),
    quality: String(sleep.quality),
    energy: String(sleep.energy),
    timezone: sleep.timezone,
    createdAt: sleep.createdAt,
    originalStart: sleep.start,
    originalEnd: sleep.end,
  } : {
    id: uid(),
    existing: false,
    createdAt: new Date().toISOString(),
    start: wakeDay ? shiftRecordingDay(wakeDay, -1) + 'T' : "",
    end: wakeDay ? wakeDay + 'T' : "",
    quality: "",
    energy: "",
    timezone,
  };

export const sleepEntryFromDraft = (draft: SleepDraft, start: string, end: string): Sleep => ({
  id: draft.id,
  date: new Intl.DateTimeFormat("en-CA", {
    timeZone: draft.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(end)),
  start,
  end,
  quality: Number(draft.quality),
  energy: Number(draft.energy),
  source: "manual",
  timezone: draft.timezone,
  createdAt: draft.createdAt,
});

export const sleepOverlaps = (records: Sleep[], id: string, start: string, end: string) =>
  records.some(sleep => sleep.id !== id &&
    Date.parse(start) < Date.parse(sleep.end) && Date.parse(end) > Date.parse(sleep.start));

/** The original "new record" editor may still be open after a lost response.
 * Current records, rather than that editor flag, decide replacement vs append.
 */
export const upsertSleep = (records: Sleep[], sleep: Sleep): Sleep[] =>
  records.some(item => item.id === sleep.id)
    ? records.map(item => item.id === sleep.id ? sleep : item)
    : [...records, sleep];
