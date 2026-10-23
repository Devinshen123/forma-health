import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { COMPANION_CHARACTERS, COMPANION_CHARACTER_DETAILS } from '../src/companion';

const artwork = resolve(import.meta.dirname, '../public/companions');

test('each companion has a distinct bilingual identity and complete transparent WebP portrait and thumbnail', async () => {
  assert.equal(COMPANION_CHARACTERS.length, 6);
  assert.equal(new Set(COMPANION_CHARACTERS).size, 6);
  assert.equal(new Set(COMPANION_CHARACTERS.map(id => COMPANION_CHARACTER_DETAILS[id].zh)).size, 6);
  assert.equal(new Set(COMPANION_CHARACTERS.map(id => COMPANION_CHARACTER_DETAILS[id].en)).size, 6);
  let totalBytes = 0;
  const portraitDigests = new Set<string>();
  for (const id of COMPANION_CHARACTERS) {
    const detail = COMPANION_CHARACTER_DETAILS[id];
    assert.ok(detail.zh.trim() && detail.en.trim() && detail.descriptionZh.trim() && detail.descriptionEn.trim());
    for (const thumbnail of [false, true]) {
      const file = resolve(artwork, id + (thumbnail ? '-thumb' : '') + '.webp');
      const info = await stat(file);
      assert.ok(info.isFile(), `${id} has a packaged ${thumbnail ? 'thumbnail' : 'portrait'}`);
      assert.ok(info.size > 1000, 'artwork must be an actual encoded image rather than an empty placeholder');
      assert.ok(info.size <= (thumbnail ? 80_000 : 600_000), `${id} artwork must fit the mobile asset budget`);
      totalBytes += info.size;
      const image = sharp(file), meta = await image.metadata();
      assert.equal(meta.format, 'webp');
      assert.ok(meta.hasAlpha, `${id} artwork must preserve alpha rather than a baked checkerboard or solid backdrop`);
      assert.equal(meta.width, meta.height, 'consistent square framing is required for the avatar and gallery');
      assert.ok(meta.width && (thumbnail ? meta.width >= 128 && meta.width <= 256 : meta.width >= 512 && meta.width <= 1024));
      const pixels = await image.stats();
      assert.equal(pixels.channels.length, 4);
      assert.equal(pixels.channels[3].min, 0, `${id} artwork must contain fully transparent background pixels`);
      assert.equal(pixels.channels[3].max, 255, `${id} artwork must also contain fully visible character pixels`);
      assert.ok(pixels.channels.slice(0, 3).some(channel => channel.stdev > 5), `${id} must contain visible color detail`);
      if (!thumbnail) portraitDigests.add(createHash('sha256').update(await readFile(file)).digest('hex'));
    }
  }
  assert.equal(portraitDigests.size, 6, 'six character names must not accidentally package copies of one portrait');
  assert.ok(totalBytes < 3_500_000, 'the six portraits and thumbnails must stay below a combined 3.5 MB');
});

test('every evolution has a distinct transparent portrait and phone thumbnail matching its model identity', async () => {
  const { COMPANION_EVOLUTIONS }=await import('../src/companion-growth');
  const hashes=new Set<string>();
  for(const form of [...new Map(Object.values(COMPANION_EVOLUTIONS).flat().map(form=>[form.dex,form])).values()])for(const thumbnail of[false,true]){
    const path=resolve(artwork,'forms',`${form.dex}${thumbnail?'-thumb':''}.webp`),bytes=await readFile(path),meta=await sharp(bytes).metadata();
    assert.equal(meta.width,thumbnail?192:640);assert.equal(meta.height,meta.width);assert.ok(meta.hasAlpha);assert.equal(meta.format,'webp');assert.ok(bytes.length>1000&&bytes.length<100_000);
    const stats=await sharp(bytes).stats();assert.equal(stats.channels[3].min,0);assert.equal(stats.channels[3].max,255);
    if(!thumbnail)hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size,152);
});
