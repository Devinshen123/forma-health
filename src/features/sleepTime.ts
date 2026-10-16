type LocalTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type SleepTimeResolution =
  | { status: "valid"; instant: string }
  | { status: "invalid" | "gap" | "ambiguous" };

export const toSleepTimeInput = (instant: string) => {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(date.getFullYear()).padStart(4, "0") +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
};

const wallTime = (parts: LocalTimeParts) => {
  const date = new Date(0);
  // setUTCFullYear also handles years 0–99 without Date.UTC's 1900 adjustment.
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  return date;
};

const localParts = (date: Date): LocalTimeParts => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  hour: date.getHours(),
  minute: date.getMinutes(),
  second: date.getSeconds(),
  millisecond: date.getMilliseconds(),
});

const matches = (date: Date, parts: LocalTimeParts) => {
  const actual = localParts(date);
  return Object.entries(parts).every(
    ([key, value]) => actual[key as keyof LocalTimeParts] === value,
  );
};

/** Resolve a datetime-local value in the device time zone without guessing a fold. */
export const resolveSleepTime = (
  input: string,
  originalInstant?: string,
): SleepTimeResolution => {
  // The form displays minutes. Keeping the original instant preserves both the
  // second occurrence of a repeated time and seconds/milliseconds hidden by it.
  if (
    originalInstant &&
    Number.isFinite(Date.parse(originalInstant)) &&
    input === toSleepTimeInput(originalInstant)
  ) {
    return { status: "valid", instant: originalInstant };
  }

  const fields = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    input,
  );
  if (!fields) return { status: "invalid" };
  const parts: LocalTimeParts = {
    year: Number(fields[1]),
    month: Number(fields[2]),
    day: Number(fields[3]),
    hour: Number(fields[4]),
    minute: Number(fields[5]),
    second: Number(fields[6] ?? 0),
    millisecond: Number((fields[7] ?? "").padEnd(3, "0")),
  };
  const wall = wallTime(parts);
  if (
    wall.getUTCFullYear() !== parts.year ||
    wall.getUTCMonth() + 1 !== parts.month ||
    wall.getUTCDate() !== parts.day ||
    wall.getUTCHours() !== parts.hour ||
    wall.getUTCMinutes() !== parts.minute ||
    wall.getUTCSeconds() !== parts.second
  ) {
    return { status: "invalid" };
  }

  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) return { status: "invalid" };
  if (!matches(parsed, parts)) return { status: "gap" };

  // Collect offsets on both sides of nearby transitions, including half-hour
  // folds. Calculate offsets from wall-clock fields to retain historical second
  // offsets as well. Every matching alternative makes the input ambiguous.
  const offsets = new Set<number>();
  const hour = 3600000;
  for (let delta = -48; delta <= 48; delta += 1) {
    const sample = new Date(parsed.getTime() + delta * hour);
    offsets.add(wallTime(localParts(sample)).getTime() - sample.getTime());
  }
  for (const offset of offsets) {
    const candidate = new Date(wall.getTime() - offset);
    if (candidate.getTime() !== parsed.getTime() && matches(candidate, parts)) {
      return { status: "ambiguous" };
    }
  }
  return { status: "valid", instant: parsed.toISOString() };
};
