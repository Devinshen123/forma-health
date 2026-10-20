// Repackage original image_gen cutouts; no compositing, retouching or alpha removal.
// Usage: node scripts/prepare-companion-art.mjs <JSON map of character IDs to source PNG paths>
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ids = ['sprout', 'bunny', 'otter', 'cloud', 'bear', 'seal'];
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Provide an explicit original-art manifest path.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (Object.keys(manifest).length !== ids.length || ids.some(id => typeof manifest[id] !== 'string')) throw new Error('Expected all six original art paths.');
const target = resolve('public/companions');
await mkdir(target, { recursive: true });
for (const id of ids) {
  const source = await readFile(manifest[id]);
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha || metadata.width !== metadata.height) throw new Error(id + ': expected square transparent original');
  for (const [suffix, size] of [['', 640], ['-thumb', 192]]) {
    const info = await sharp(source).resize(size, size, { fit: 'contain', background: '#00000000' }).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(resolve(target, id + suffix + '.webp'));
    console.log(JSON.stringify({ id, size, bytes: info.size }));
  }
}
