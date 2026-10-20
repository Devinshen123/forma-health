/** Calendar navigation must not add 24 hours across daylight-saving changes. */
export function shiftRecordingDay(day: string, offset: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(offset)) return day;
  const date = new Date(day + 'T12:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return day;
  date.setUTCDate(date.getUTCDate() + offset);
  if (!Number.isFinite(date.getTime())) return day;
  const result = date.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : day;
}

export function recordingToday(timezone?: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}
