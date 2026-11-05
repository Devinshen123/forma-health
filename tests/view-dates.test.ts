import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, viewDateWindow, viewTimeZone } from '../src/types';

const at = (value: string) => new Date(value);
const now = at('2026-10-17T06:30:00.000Z');

test('view day uses valid profile, then browser zone, then UTC', () => {
  assert.equal(localDate(now, viewTimeZone('Asia/Shanghai', 'America/Los_Angeles')), '2026-10-17');
  assert.equal(localDate(now, viewTimeZone('America/Los_Angeles', 'Asia/Shanghai')), '2026-10-16');
  for (const bad of [undefined, null, '', 'Mars/Olympus']) {
    assert.equal(localDate(now, viewTimeZone(bad, 'America/Los_Angeles')), '2026-10-16');
  }
  assert.equal(viewTimeZone('invalid', 'invalid'), 'UTC');
  assert.equal(localDate(now, viewTimeZone(null, 'invalid')), '2026-10-17');
});

test('machine keys are Gregorian ASCII dates and legacy no-zone calls retain host dates', () => {
  assert.match(localDate(now, 'Asia/Shanghai'), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(localDate(now), localDate(now, Intl.DateTimeFormat().resolvedOptions().timeZone));
  assert.equal(localDate(now, 'Pacific/Kiritimati'), '2026-10-17');
  assert.equal(localDate(now, 'Pacific/Pago_Pago'), '2026-10-16');
});

test('7/14-day windows are inclusive and unique with correct month/year/leap boundaries', () => {
  for (const [end, first] of [
    ['2026-10-17', '2026-10-11'], ['2028-03-01', '2028-02-24'],
    ['2027-01-01', '2026-12-26'],
  ]) {
    const result = viewDateWindow('UTC', 7, at(`${end}T23:59:59Z`));
    assert.equal(result.today, end);
    assert.equal(result.dates[0], first);
    assert.equal(result.dates.at(-1), end);
    assert.equal(new Set(result.dates).size, 7);
  }
  const { dates } = viewDateWindow('Asia/Shanghai', 14, now);
  assert.equal(dates[0], '2026-10-04');
  assert.equal(dates.at(-1), '2026-10-17');
  assert.equal(dates.length, 14);
});

test('DST skips and repeated hours preserve calendar windows and midnight changes the end once', () => {
  for (const [instant, today, first] of [
    ['2026-03-08T09:59:59Z', '2026-03-08', '2026-03-02'],
    ['2026-03-08T10:00:00Z', '2026-03-08', '2026-03-02'],
    ['2026-03-09T07:30:00Z', '2026-03-09', '2026-03-03'],
    ['2026-11-01T08:30:00Z', '2026-11-01', '2026-10-26'],
    ['2026-11-01T09:30:00Z', '2026-11-01', '2026-10-26'],
    ['2026-10-17T06:59:59.999Z', '2026-10-16', '2026-10-10'],
    ['2026-10-17T07:00:00Z', '2026-10-17', '2026-10-11'],
  ]) {
    const result = viewDateWindow('America/Los_Angeles', 7, at(instant));
    assert.equal(result.today, today);
    assert.equal(result.dates[0], first);
    assert.equal(result.dates.at(-1), today);
    assert.equal(new Set(result.dates).size, 7);
  }
});
