import type { CatalogExercise, Exercise, SetLog, Workout } from '../types';
import { civilDay, kilograms, normalizedExerciseName } from './domain';

export type ImportFormat = 'strong' | 'hevy' | 'fitnotes' | 'forma';
export interface ImportOptions { timezone: string; weightUnit: 'kg' | 'lb'; existing: Workout[]; catalog: CatalogExercise[] }
export interface ImportPreview { workouts: Workout[]; issues: string[]; duplicates: number }
const MAX_BYTES = 5 * 1024 * 1024, MAX_ROWS = 20000;
function invalid(message: string): never { throw new Error(message); }
const uuid = () => crypto.randomUUID();
const keysOnly = (value: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('字段不受支持 / Unsupported field');
};
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid('需要对象 / Expected an object');
const textField = (value: unknown, max = 160, allowEmpty = false): string => {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value) || (!allowEmpty && /[\r\n\t]/.test(value))) invalid('文字值无效 / Invalid text value');
  return value.trim();
};
const numeric = (value: string, min = 0, max = 100000, integer = false): number | null => {
  if (!value.trim()) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) invalid('数值格式无效 / Invalid number');
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) invalid('数值超出范围 / Number out of range');
  return number;
};
const jsonNumber = (value: unknown, min: number, max: number, integer = false, nullable = false): number | null => {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid('数值无效 / Invalid numeric value');
  return value;
};

/** RFC 4180 quoting, including escaped quotes and embedded newlines. No row recovery. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, endedQuote = false;
  const pushField = () => { row.push(field); field = ''; endedQuote = false; };
  const pushRow = () => {
    pushField();
    if (row.some(cell => cell !== '')) rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) invalid('最多 20,000 行 / Maximum 20,000 rows');
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; endedQuote = true; }
      } else field += character;
    } else if (character === '"') {
      if (field || endedQuote) invalid('CSV 引号位置无效 / Invalid CSV quote');
      quoted = true;
    } else if (character === delimiter) pushField();
    else if (character === '\r' || character === '\n') { pushRow(); if (character === '\r' && text[i + 1] === '\n') i++; }
    else {
      if (endedQuote) invalid('CSV 引号后有额外内容 / Unexpected text after CSV quote');
      field += character;
    }
  }
  if (quoted) invalid('CSV 引号未闭合 / Unterminated CSV quote');
  if (field || row.length || endedQuote) pushRow();
  return rows;
}

interface Timestamp { date: string; iso: string; milliseconds: number }
const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function timestampReader(timezone: string) {
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { return invalid('时区无效 / Invalid timezone'); }
  const offsetsByDay = new Map<string, Set<number>>();
  const parts = (milliseconds: number) => {
    const formatted = formatter.formatToParts(milliseconds);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(formatted.find(part => part.type === type)?.value);
    return [get('year'), get('month'), get('day'), get('hour'), get('minute'), get('second')];
  };
  return (input: string): Timestamp => {
    let value = input.trim(), dateOnly = false;
    // Hevy English exports may use "14 Oct 2026, 18:30". Locale-dependent dates are otherwise rejected.
    const english = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (english) {
      const month = months[english[2].toLowerCase()];
      if (!month) invalid('月份无效 / Invalid month');
      value = `${english[3]}-${String(month).padStart(2, '0')}-${english[1].padStart(2, '0')}T${english[4].padStart(2, '0')}:${english[5]}:${english[6] ?? '00'}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { dateOnly = true; value += 'T12:00:00'; }
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);
    if (!match || civilDay(match[1]) === null) invalid('日期无效；请使用 ISO 或英文月份 / Invalid date; use ISO or English month');
    const hour = Number(match[2]), minute = Number(match[3]), second = Number(match[4] ?? 0), millis = Number((match[5] ?? '').padEnd(3, '0'));
    if (hour > 23 || minute > 59 || second > 59) invalid('时间无效 / Invalid time');
    const [year, month, day] = match[1].split('-').map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute, second, millis);
    const offset = match[6];
    let instant: number;
    if (offset) {
      let minutes = 0;
      if (offset !== 'Z') {
        const [oh, om] = offset.slice(1).replace(':', '').match(/.{2}/g)!.map(Number);
        if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) invalid('UTC 偏移无效 / Invalid UTC offset');
        minutes = (offset[0] === '+' ? 1 : -1) * (oh * 60 + om);
      }
      instant = wall - minutes * 60000;
    } else {
      const cacheKey = match[1];
      let offsets = offsetsByDay.get(cacheKey);
      if (!offsets) {
        offsets = new Set<number>();
        // Sample both sides of DST and international date-line transitions.
        for (let delta = -36; delta <= 36; delta += 3) {
          const sample = wall + delta * 3600000;
          const [sy, sm, sd, sh, sn, ss] = parts(sample);
          offsets.add(Date.UTC(sy, sm - 1, sd, sh, sn, ss) - Math.floor(sample / 1000) * 1000);
        }
        offsetsByDay.set(cacheKey, offsets);
      }
      const matches = [...offsets].map(offsetMs => wall - offsetMs).filter(candidate => {
        const actual = parts(candidate);
        return actual.every((part, index) => part === [year, month, day, hour, minute, second][index]);
      });
      if (matches.length !== 1) invalid(matches.length ? '夏令时存在两个时间；请补充 UTC 偏移 / Ambiguous DST time; supply UTC offset' : '当地时间不存在；请修正时间 / Local time does not exist');
      instant = matches[0];
    }
    const local = parts(instant);
    const date = dateOnly ? match[1] : `${local[0]}-${String(local[1]).padStart(2, '0')}-${String(local[2]).padStart(2, '0')}`;
    return { date, iso: new Date(instant).toISOString(), milliseconds: instant };
  };
}

function durationSeconds(value: string, numberIsSeconds = true): number | null {
  if (!value.trim()) return null;
  const clean = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(clean)) return numeric(clean, 0, 2592000)! * (numberIsSeconds ? 1 : 60);
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(clean);
  if (clock) {
    if (Number(clock[2]) > 59 || Number(clock[3]) > 59) invalid('时长无效 / Invalid duration');
    return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  }
  const human = /^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?(?:(\d+(?:\.\d+)?)\s*s\s*)?$/i.exec(clean);
  if (human && human.slice(1).some(Boolean)) return Number(human[1] ?? 0) * 3600 + Number(human[2] ?? 0) * 60 + Number(human[3] ?? 0);
  return invalid('时长格式无效 / Invalid duration format');
}
function catalogMatch(name: string, catalog: CatalogExercise[]) {
  const key = normalizedExerciseName(name);
  const matches = catalog.filter(exercise => normalizedExerciseName(exercise.name) === key || (exercise.nameZh && normalizedExerciseName(exercise.nameZh) === key));
  return matches.length === 1 ? matches[0] : undefined;
}

/** IDs and import metadata are deliberately excluded. Stable across repeated previews. */
export function workoutFingerprint(workout: Workout): string {
  const canonical = JSON.stringify([workout.date, normalizedExerciseName(workout.name), workout.duration, workout.rpe, workout.notes, workout.exercises.map(exercise => [normalizedExerciseName(exercise.name), exercise.sets, exercise.reps, exercise.weight, exercise.supersetGroup ?? null, (exercise.setLogs ?? []).map(set => [set.kind, set.reps, set.weight, set.durationSeconds, set.distanceMeters, set.rpe, set.rir, set.completed, set.dropParentId ? exercise.setLogs?.findIndex(parent => parent.id === set.dropParentId) : null])])]);
  // Two independent 64-bit FNV streams: deterministic deduplication, not authentication.
  const mask = (1n << 64n) - 1n;
  let first = 14695981039346656037n, second = 7809847782465536322n;
  for (const byte of new TextEncoder().encode(canonical)) { first = ((first ^ BigInt(byte)) * 1099511628211n) & mask; second = ((second ^ BigInt(byte)) * 14029467366897019727n) & mask; }
  return `training-v1:${first.toString(16).padStart(16, '0')}${second.toString(16).padStart(16, '0')}`;
}

function finalize(workouts: Workout[], existing: Workout[]): ImportPreview {
  const seen = new Set(existing.flatMap(workout => [workout.importFingerprint, workoutFingerprint(workout)].filter((value): value is string => !!value)));
  const result: Workout[] = [];
  let duplicates = 0;
  for (const workout of workouts) {
    const fingerprint = workoutFingerprint(workout);
    if (seen.has(fingerprint)) { duplicates++; continue; }
    seen.add(fingerprint); result.push({ ...workout, importFingerprint: fingerprint });
  }
  return { workouts: result, issues: [], duplicates };
}

function importForma(text: string, options: ImportOptions): ImportPreview {
  const envelope = object(JSON.parse(text));
  let raw: unknown;
  if (envelope.format === 'forma-export' && envelope.schemaVersion === 1) raw = object(envelope.state).workouts;
  else { keysOnly(envelope, ['workouts']); raw = envelope.workouts; }
  if (!Array.isArray(raw) || raw.length > MAX_ROWS) invalid('训练数组无效 / Invalid workouts array');
  const readTimestamp = timestampReader(options.timezone);
  let count = 0;
  const workouts = raw.map((value): Workout => {
    const entry = object(value);
    keysOnly(entry, ['id', 'date', 'name', 'duration', 'rpe', 'exercises', 'notes', 'createdAt', 'routineId', 'source', 'importFingerprint']);
    const date = textField(entry.date, 10); if (civilDay(date) === null) invalid('日期无效 / Invalid date');
    const createdAt = readTimestamp(textField(entry.createdAt, 50)).iso;
    if (!Array.isArray(entry.exercises) || entry.exercises.length > 100) invalid('动作数组无效 / Invalid exercises array');
    const exercises = entry.exercises.map((value): Exercise => {
      const exercise = object(value);
      keysOnly(exercise, ['id', 'exerciseId', 'name', 'sets', 'reps', 'weight', 'primaryMuscles', 'setLogs', 'supersetGroup', 'restSeconds']);
      const name = textField(exercise.name), identified = (typeof exercise.exerciseId === 'string' ? options.catalog.find(item => item.id === exercise.exerciseId) : undefined) ?? catalogMatch(name, options.catalog);
      const parsed: Exercise = { id: uuid(), name, sets: jsonNumber(exercise.sets, 1, 100, true)!, reps: jsonNumber(exercise.reps, 0, 1000, true)!, weight: jsonNumber(exercise.weight, 0, 2000)!, ...(identified ? { exerciseId: identified.id, primaryMuscles: [...identified.primaryMuscles] } : {}) };
      if (exercise.supersetGroup !== undefined) parsed.supersetGroup = exercise.supersetGroup === null ? null : textField(exercise.supersetGroup, 50);
      if (exercise.restSeconds !== undefined) parsed.restSeconds = jsonNumber(exercise.restSeconds, 0, 7200, true)!;
      if (exercise.setLogs !== undefined) {
        if (!Array.isArray(exercise.setLogs) || exercise.setLogs.length > 100) invalid('逐组数组无效 / Invalid set array');
        const idMap = new Map<string, string>();
        parsed.setLogs = exercise.setLogs.map((value): SetLog => {
          if (++count > MAX_ROWS) invalid('最多 20,000 组 / Maximum 20,000 sets');
          const set = object(value);
          keysOnly(set, ['id', 'kind', 'reps', 'weight', 'durationSeconds', 'distanceMeters', 'rpe', 'rir', 'completed', 'completedAt', 'dropParentId']);
          const originalId = textField(set.id, 100); if (idMap.has(originalId)) invalid('组 ID 重复 / Duplicate set ID');
          const id = uuid();
          if (!['work', 'warmup', 'drop'].includes(String(set.kind)) || typeof set.completed !== 'boolean') invalid('组类型或完成状态无效 / Invalid set type or completion');
          const result: SetLog = { id, kind: set.kind as SetLog['kind'], reps: jsonNumber(set.reps, 0, 1000, true, true), weight: jsonNumber(set.weight, 0, 2000, false, true), durationSeconds: jsonNumber(set.durationSeconds, Number.MIN_VALUE, 86400, false, true), distanceMeters: jsonNumber(set.distanceMeters, 0, 1000000, false, true), rpe: jsonNumber(set.rpe, 1, 10, false, true), rir: jsonNumber(set.rir, 0, 20, false, true), completed: set.completed };
          if (set.completedAt !== undefined) result.completedAt = readTimestamp(textField(set.completedAt, 50)).iso;
          if (!result.completed && result.completedAt) invalid('未完成组不能带完成时间 / Unfinished set cannot claim completion time');
          if (result.completed && !((result.reps !== null && result.reps > 0 && result.weight !== null) || (result.durationSeconds !== null && result.durationSeconds > 0))) invalid('完成组缺少实际次数/重量或时长 / Completed set lacks performed reps/load or duration');
          if (result.kind === 'drop') {
            const parent = idMap.get(textField(set.dropParentId, 100));
            if (!parent) invalid('递减组需要同动作的前置组 / Drop set requires a preceding parent');
            result.dropParentId = parent;
          } else if (set.dropParentId !== undefined) invalid('非递减组不能有 parent / Only drop sets may have a parent');
          idMap.set(originalId, id); return result;
        });
        for (const set of parsed.setLogs) if (set.dropParentId) {
          const parent = parsed.setLogs.find(candidate => candidate.id === set.dropParentId)!;
          if (set.weight !== null && parent.weight !== null && set.weight > parent.weight) invalid('递减组不能增加重量 / Drop set load exceeds parent');
        }
      }
      if (parsed.setLogs === undefined && parsed.reps < 1) invalid('旧摘要需要正次数 / Legacy summary needs positive reps');
      return parsed;
    });
    if (!exercises.length) invalid('训练至少需要一个动作 / Workout requires an exercise');
    return { id: uuid(), date, name: textField(entry.name), duration: jsonNumber(entry.duration, 0, 1440, true)!, rpe: jsonNumber(entry.rpe, 1, 10, false, true), exercises, notes: textField(entry.notes, 10000, true), createdAt, source: 'forma' };
  });
  return finalize(workouts, options.existing);
}

const headerSets: Record<Exclude<ImportFormat, 'forma'>, string[]> = {
  strong: ['workout #', 'date', 'workout name', 'duration', 'duration (sec)', 'workout duration', 'exercise name', 'set order', 'weight', 'weight unit', 'weight (kg)', 'weight (lbs)', 'weight (lb)', 'reps', 'rpe', 'distance', 'distance unit', 'distance (meters)', 'seconds', 'notes', 'workout notes', 'set notes'],
  hevy: ['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'weight_lbs', 'reps', 'distance_meters', 'duration_seconds', 'rpe'],
  fitnotes: ['date', 'exercise', 'category', 'weight', 'weight unit', 'weight (kg)', 'weight (lbs)', 'weight (lb)', 'reps', 'distance', 'distance (km)', 'distance (m)', 'distance (miles)', 'time', 'time (s)', 'unit', 'notes', 'comment', 'comments', 'completed'],
};
function importCsv(text: string, format: Exclude<ImportFormat, 'forma'>, options: ImportOptions): ImportPreview {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = parseCsv(text.replace(/^\ufeff/, ''), delimiter);
  if (rows.length < 2) invalid('CSV 没有训练行 / CSV has no workout rows');
  const headers = rows[0].map(cell => cell.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) invalid('CSV 列名重复 / Duplicate CSV headers');
  if (headers.some(header => !headerSets[format].includes(header))) invalid('CSV 列不受支持，请核对所选来源与版本 / Unsupported CSV columns; check source and version');
  const required = format === 'strong' ? ['date', 'workout name', 'exercise name', 'set order'] : format === 'hevy' ? ['title', 'start_time', 'exercise_title', 'set_index', 'set_type'] : ['date', 'exercise'];
  if (required.some(header => !headers.includes(header))) invalid('CSV 缺少必需列 / Missing required CSV headers');
  const readTimestamp = timestampReader(options.timezone);
  const sessions = new Map<string, Workout>();
  const seenRows = new Set<string>();
  const baseNotes = new Map<string, string>();
  const extraNotes = new Map<string, Set<string>>();
  for (let index = 1; index < rows.length; index++) {
    try {
      const cells = rows[index];
      if (cells.length !== headers.length) invalid('列数与表头不一致 / Row width does not match headers');
      const row = Object.fromEntries(headers.map((header, column) => [header, cells[column].trim()]));
      const get = (...names: string[]) => names.map(name => row[name]).find(value => value !== undefined && value !== '') ?? '';
      const start = readTimestamp(get(format === 'hevy' ? 'start_time' : 'date'));
      const name = format === 'fitnotes' ? 'FitNotes' : textField(get(format === 'hevy' ? 'title' : 'workout name'));
      const exerciseName = textField(get(format === 'hevy' ? 'exercise_title' : format === 'strong' ? 'exercise name' : 'exercise'));
      const secondsText = get('duration (sec)', 'duration', 'workout duration');
      if (secondsText && /^\d+(?:\.\d+)?$/.test(secondsText) && !get('duration (sec)')) invalid('数值时长缺少秒单位，请使用 h/m/s / Numeric duration needs a seconds header or h/m/s unit');
      let minutes = secondsText ? durationSeconds(secondsText)! / 60 : 0;
      if (format === 'hevy' && get('end_time')) {
        const end = readTimestamp(get('end_time'));
        if (end.milliseconds <= start.milliseconds) invalid('结束时间必须晚于开始时间 / End must follow start');
        minutes = (end.milliseconds - start.milliseconds) / 60000;
      }
      if (minutes > 1440) invalid('训练时长超出 1440 分钟 / Workout duration exceeds 1440 minutes');
      if (minutes > 0) minutes = Math.max(1, Math.round(minutes)); // Stored workout duration is whole minutes.
      const sessionKey = `${start.iso}|${name}|${get('workout #')}`;
      let workout = sessions.get(sessionKey);
      const notes = textField(get('workout notes', 'description'), 10000, true);
      if (!workout) {
        workout = { id: uuid(), date: start.date, name, duration: minutes, rpe: null, exercises: [], notes, createdAt: start.iso, source: format };
        sessions.set(sessionKey, workout);
        baseNotes.set(sessionKey, notes); extraNotes.set(sessionKey, new Set());
      } else if (workout.duration !== minutes || baseNotes.get(sessionKey) !== notes) invalid('同次训练的时长或备注不一致 / Inconsistent workout duration or notes');
      let exercise = workout.exercises.find(exercise => normalizedExerciseName(exercise.name) === normalizedExerciseName(exerciseName));
      const identified = catalogMatch(exerciseName, options.catalog);
      if (!exercise) {
        exercise = { id: uuid(), name: exerciseName, sets: 0, reps: 0, weight: 0, setLogs: [], ...(identified ? { exerciseId: identified.id, primaryMuscles: [...identified.primaryMuscles] } : {}) };
        workout.exercises.push(exercise);
      }
      const order = get(format === 'hevy' ? 'set_index' : 'set order');
      for (const column of ['notes', 'exercise_notes', 'set notes', 'comment', 'comments']) if (get(column)) {
        extraNotes.get(sessionKey)!.add(`${exerciseName}${column === 'set notes' ? ` #${order}` : ''}: ${textField(get(column), 10000, true)}`);
      }
      if (format === 'strong' && /^rest timer$/i.test(order)) {
        const rest = numeric(get('seconds'), 0, 7200, true); if (rest === null) invalid('休息计时行缺少时长 / Rest timer row lacks duration');
        exercise.restSeconds = rest; continue; // Explicit metadata, never a performed set.
      }
      let kind: SetLog['kind'] = 'work';
      if (format === 'hevy') {
        const type = get('set_type').toLowerCase();
        if (type === 'warmup' || type === 'warm-up') kind = 'warmup';
        else if (type === 'dropset' || type === 'drop' || type === 'drop_set') kind = 'drop';
        else if (type !== 'normal' && type !== 'work' && type !== 'failure') invalid('组类型不受支持 / Unsupported set type');
        if (numeric(order, 0, MAX_ROWS, true) === null) invalid('缺少组顺序 / Missing set index');
      } else if (format === 'strong') {
        if (/^w\d*$/i.test(order) || /^warmup$/i.test(order)) kind = 'warmup';
        else if (/^d\d*$/i.test(order) || /^drop(?:set)?$/i.test(order)) kind = 'drop';
        else if (!/^\d+$/.test(order) && !/^f\d*$/i.test(order)) invalid('组顺序不受支持 / Unsupported set order');
      }
      const rowKey = `${sessionKey}|${normalizedExerciseName(exerciseName)}|${order}`;
      // Indexed sources must not contain conflicting copies of the same set.
      if (format !== 'fitnotes' && seenRows.has(rowKey)) invalid('同一训练中的组顺序重复 / Duplicate set index in workout');
      seenRows.add(rowKey);
      const unit = get('weight unit', 'unit').toLowerCase();
      if (unit && !['kg', 'kgs', 'lb', 'lbs'].includes(unit)) invalid('重量单位不受支持 / Unsupported weight unit');
      const headerKg = headers.includes('weight (kg)') || headers.includes('weight_kg');
      const headerLb = headers.some(header => ['weight (lb)', 'weight (lbs)', 'weight_lbs'].includes(header));
      if (headerKg && headerLb || (headerKg && (unit === 'lb' || unit === 'lbs')) || (headerLb && (unit === 'kg' || unit === 'kgs'))) invalid('重量单位冲突 / Conflicting weight units');
      const weight = numeric(get('weight (kg)', 'weight_kg', 'weight (lbs)', 'weight (lb)', 'weight_lbs', 'weight'), 0, 5000);
      const load = weight === null ? null : kilograms(weight, headerKg ? 'kg' : headerLb ? 'lb' : unit === 'kg' || unit === 'kgs' ? 'kg' : unit === 'lb' || unit === 'lbs' ? 'lb' : options.weightUnit);
      if (load !== null && load > 2000) invalid('重量超出 2000 kg / Load exceeds 2000 kg');
      const reps = numeric(get('reps'), 0, 1000, true), rawDuration = format === 'fitnotes' ? durationSeconds(get('time', 'time (s)')) : numeric(get('seconds', 'duration_seconds'), 0, 86400);
      if (rawDuration !== null && rawDuration > 86400) invalid('单组时长超出范围 / Set duration out of range');
      const duration = rawDuration === 0 ? null : rawDuration;
      const rawDistance = numeric(get('distance_meters', 'distance (meters)', 'distance (km)', 'distance (m)', 'distance (miles)', 'distance'), 0, 1000000);
      let distance = rawDistance;
      if (distance !== null) {
        const distanceUnit = get('distance unit').toLowerCase();
        if (distanceUnit && !['m', 'meters', 'km', 'mi', 'miles'].includes(distanceUnit)) invalid('距离单位不受支持 / Unsupported distance unit');
        if (headers.includes('distance (km)') || distanceUnit === 'km') distance *= 1000;
        else if (headers.includes('distance (miles)') || distanceUnit === 'mi' || distanceUnit === 'miles') distance *= 1609.344;
        else if (distance > 0 && headers.includes('distance') && !distanceUnit) invalid('距离缺少明确单位 / Distance requires explicit unit');
        if (distance > 1000000) invalid('距离超出范围 / Distance out of range');
      }
      const rpe = numeric(get('rpe'), 1, 10), marked = get('completed').toLowerCase();
      if (marked && !['true', 'false', '1', '0', 'yes', 'no'].includes(marked)) invalid('完成标记无效 / Invalid completion marker');
      const completed = marked ? ['true', '1', 'yes'].includes(marked) : ((reps !== null && reps > 0 && load !== null) || (duration !== null && duration > 0));
      if (completed && !((reps !== null && reps > 0 && load !== null) || (duration !== null && duration > 0))) invalid('完成组缺少实际记录 / Completed set lacks performed values');
      const set: SetLog = { id: uuid(), kind, reps, weight: load, durationSeconds: duration, distanceMeters: distance, rpe, rir: null, completed };
      if (kind === 'drop') {
        const parent = exercise.setLogs!.at(-1);
        if (!parent || parent.kind === 'warmup') invalid('递减组需要前置工作组 / Drop set requires preceding work set');
        if (load !== null && parent.weight !== null && load > parent.weight) invalid('递减组不能增加重量 / Drop set load exceeds parent');
        set.dropParentId = parent.id;
      }
      const superset = get('superset_id');
      if (superset) {
        const group = textField(superset, 50);
        if (exercise.supersetGroup && exercise.supersetGroup !== group) invalid('同动作超级组标签不一致 / Inconsistent superset group');
        exercise.supersetGroup = group;
      }
      exercise.setLogs!.push(set);
      if (exercise.setLogs!.length > 100 || workout.exercises.length > 100) invalid('每次训练最多 100 个动作，每动作最多 100 组 / Maximum 100 exercises and 100 sets per exercise');
      exercise.sets = Math.max(1, exercise.setLogs!.length);
      // Legacy aggregate fields are compatibility summaries, never a substitute for nullable logs.
      exercise.reps = reps ?? 0; exercise.weight = load ?? 0;
    } catch (error) { invalid(`第 ${index + 1} 行 / Row ${index + 1}: ${(error as Error).message}`); }
  }
  for (const [key, workout] of sessions) {
    workout.notes = [baseNotes.get(key), ...extraNotes.get(key)!].filter(Boolean).join('\n');
    if (workout.notes.length > 10000) invalid('合并备注超过 10000 字，请缩短后重试 / Combined notes exceed 10000 characters');
  }
  return finalize([...sessions.values()], options.existing);
}

/** Preview only; no persistence, network, account information or provider provenance. */
export function parseTrainingImport(text: string, format: ImportFormat, options: ImportOptions): ImportPreview {
  try {
    if (new TextEncoder().encode(text).byteLength > MAX_BYTES) invalid('文件不能超过 5 MiB / File exceeds 5 MiB');
    if (!['strong', 'hevy', 'fitnotes', 'forma'].includes(format)) invalid('导入来源不受支持 / Unsupported import format');
    if (!['kg', 'lb'].includes(options.weightUnit)) invalid('请选择重量单位 / Choose a weight unit');
    return format === 'forma' ? importForma(text.replace(/^\ufeff/, ''), options) : importCsv(text, format, options);
  } catch (error) {
    // Errors identify structure and row number, without echoing private record values.
    const message = error instanceof SyntaxError ? 'JSON 格式无效 / Invalid JSON' : (error as Error).message;
    return { workouts: [], issues: [message || '导入失败 / Import failed'], duplicates: 0 };
  }
}
