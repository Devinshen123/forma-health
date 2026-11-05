import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, viewDateWindow, viewTimeZone } from '../src/types';

test('QA independent: half-hour and extreme zones select civil day at UTC year rollover', () => {
  const now = new Date('2027-01-01T00:15:00Z');
  for (const [zone, expected] of [['Pacific/Kiritimati','2027-01-01'],['Pacific/Pago_Pago','2026-12-31'],['Asia/Kathmandu','2027-01-01'],['America/St_Johns','2026-12-31']]) {
    assert.equal(localDate(now, zone), expected);
    assert.match(localDate(now, zone), /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  }
  for (const invalid of [null, undefined, '', ' UTC ', 'Mars/Base']) {
    assert.equal(localDate(now, viewTimeZone(invalid, 'Asia/Kathmandu')), '2027-01-01');
    assert.equal(viewTimeZone(invalid, 'bad-zone'), 'UTC');
  }
  assert.equal(viewTimeZone('Pacific/Kiritimati', 'bad-zone'), 'Pacific/Kiritimati');
});

test('QA independent: 7/14 windows exhaust DST, leap day and calendar rollovers', () => {
  const instants = ['2026-03-08T06:59:59Z','2026-03-08T07:00:00Z','2026-11-01T05:59:59Z','2026-11-01T06:00:00Z','2028-02-29T23:59:59Z','2028-03-01T00:00:00Z','2027-01-01T00:00:00Z'];
  for (const zone of ['America/New_York','Australia/Lord_Howe','Pacific/Kiritimati','Pacific/Pago_Pago','UTC']) {
    for (const instant of instants) for (const count of [7,14] as const) {
      const now = new Date(instant);
      const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
      const window = viewDateWindow(zone,count,now);
      assert.equal(window.today,parts);
      assert.equal(window.dates.length,count);
      assert.equal(window.dates.at(-1),parts);
      const epoch = Date.parse(parts+'T00:00:00Z');
      assert.deepEqual(window.dates,Array.from({length:count},(_,i)=>new Date(epoch-(count-1-i)*86400000).toISOString().substring(0,10)));
      assert.equal(now.toISOString(),instant.replace('Z','.000Z'));
    }
  }
});

test('QA independent: helper captures only one current clock instant', () => {
  const NativeDate = Date;
  let reads = 0;
  class AdvancingDate extends NativeDate {
    constructor(value?: string | number) {
      if (value === undefined) { super(reads++ === 0 ? '2026-12-31T23:59:59.999Z' : '2027-01-01T00:00:00Z'); }
      else super(value);
    }
  }
  try {
    globalThis.Date = AdvancingDate as DateConstructor;
    const result = viewDateWindow('UTC',14);
    assert.equal(reads,1);
    assert.equal(result.today,'2026-12-31');
    assert.equal(result.dates[0],'2026-12-18');
    assert.equal(result.dates.at(-1),result.today);
  } finally { globalThis.Date = NativeDate; }
});

