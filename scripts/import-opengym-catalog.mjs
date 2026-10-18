import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'src/catalog/opengym-manifest.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
const asJson = value => JSON.stringify(value) + '\n';

if (process.argv.includes('--check')) {
  const manifest = json(manifestPath);
  let checked = 0;
  for (const file of manifest.files) {
    const target = resolve(root, 'public', file.path);
    if (!target.startsWith(resolve(root, 'public') + '/') && !target.startsWith(resolve(root, 'public') + '\\')) throw Error('Asset path escapes public');
    if (!existsSync(target) || statSync(target).size !== file.bytes || sha256(readFileSync(target)) !== file.sha256) throw Error(`Missing or changed authorized asset: ${file.path}. Rerun the importer with your licensed source.`);
    checked++;
  }
  if (manifest.primaryCount !== 5632 || manifest.videoCount !== 5632) throw Error('Unexpected catalogue count');
  console.log(`Verified ${manifest.primaryCount} exercises, ${manifest.videoCount} videos and ${checked} media/content files against SHA-256.`);
} else {
  const sourceArg = process.argv[2];
  if (!sourceArg) throw Error('Usage: node scripts/import-opengym-catalog.mjs <authorized-openGym-directory> | --check. Requires separate rights for exercise text and Gym visual media.');
  const source = resolve(sourceArg), catalogue = join(source, 'catalogue');
  const entries = readdirSync(join(catalogue, 'exercises')).filter(name => /^\d{4,5}\.json$/.test(name)).sort().map(name => json(join(catalogue, 'exercises', name)));
  const primary = entries.filter(item => !item.variantOf);
  if (primary.length !== 5632 || new Set(primary.map(item => item.id)).size !== 5632) throw Error('Expected the 5,632 primary exercises; variants are not independent entries.');
  const translations = json(join(catalogue, 'i18n/zh.json'));
  const muscles = { abs: 'abdominals', pectorals: 'chest', delts: 'shoulders', quads: 'quadriceps', 'upper back': 'middle back', spine: 'lower back', 'levator scapulae': 'neck', deltoids: 'shoulders', 'rear deltoids': 'shoulders', 'latissimus dorsi': 'lats', trapezius: 'traps', 'lower abs': 'abdominals', 'upper chest': 'chest', 'inner thighs': 'adductors' };
  const equipment = { 'body weight': 'body only', band: 'bands', 'resistance band': 'bands', kettlebell: 'kettlebells', 'ez barbell': 'e-z curl bar', 'stability ball': 'exercise ball', 'olympic barbell': 'barbell', roller: 'foam roll' };
  const mapMuscle = muscle => muscles[muscle] ?? muscle;
  const buckets = Array.from({ length: 64 }, () => ({ schemaVersion: 1, exercises: {} }));
  const index = [], files = [], stagedMedia = [];
  let translatedSteps = 0;
  // Validate every source before writing any generated catalogue or media.
  for (const item of primary) {
    if (!/^\d{4,5}$/.test(item.id) || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.instructions) || !item.instructions.length || item.instructions.some(step => typeof step !== 'string' || !step.trim())) throw Error(`Invalid exercise ${item.id}`);
    const zh = translations[item.id];
    if (!zh || typeof zh.name !== 'string' || !zh.name.trim()) throw Error(`Missing Chinese name: ${item.id}`);
    const content = { id: item.id, description: item.description ?? '', instructions: item.instructions };
    if (typeof zh.description === 'string' && zh.description.trim()) content.descriptionZh = zh.description;
    if (Array.isArray(zh.instructions) && zh.instructions.length && zh.instructions.every(step => typeof step === 'string' && step.trim())) { content.instructionsZh = zh.instructions; translatedSteps++; }
    buckets[Number(item.id) % 64].exercises[item.id] = content;
    index.push({ sourceId: item.id, name: item.name, nameZh: zh.name, primaryMuscles: item.target === 'cardiovascular system' ? [] : [mapMuscle(item.target)], secondaryMuscles: [...new Set((item.secondaryMuscles ?? []).map(mapMuscle))], equipment: equipment[item.equipment] ?? item.equipment ?? null, category: item.category === 'olympic' ? 'olympic weightlifting' : item.category });
    for (const [kind, extension] of [['clip', 'mp4'], ['still', 'webp']]) {
      const input = join(catalogue, 'media', kind, `${item.id}.${extension}`), bytes = readFileSync(input);
      if (extension === 'mp4' ? bytes.toString('ascii', 4, 8) !== 'ftyp' : bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error(`Invalid ${extension} signature: ${item.id}`);
      const path = `exercise-media/opengym/${kind}/${item.id}.${extension}`;
      files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
      stagedMedia.push({ input, output: join(root, 'public', path) });
    }
  }
  const sourceCommit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  for (const { input, output } of stagedMedia) { mkdirSync(dirname(output), { recursive: true }); copyFileSync(input, output); }
  for (let bucket = 0; bucket < buckets.length; bucket++) {
    const path = `exercise-content/opengym/${bucket}.json`, content = asJson(buckets[bucket]);
    write(join(root, 'public', path), content);
    files.push({ path, bytes: Buffer.byteLength(content), sha256: sha256(content) });
  }
  write(join(root, 'src/catalog/opengym.json'), asJson(index));
  const manifest = { schemaVersion: 1, source: 'openGym', sourceCommit, primaryCount: primary.length, excludedVariantCount: entries.length - primary.length, videoCount: stagedMedia.length / 2, chineseNameCount: index.length, chineseInstructionCount: translatedSteps, files };
  write(manifestPath, asJson(manifest));
  copyFileSync(join(source, 'NOTICE.md'), join(root, 'public/licenses/opengym-NOTICE.txt'));
  copyFileSync(join(source, 'LICENSE'), join(root, 'public/licenses/opengym-AGPL-3.0.txt'));
  console.log(`Imported ${primary.length} primary exercises with ${stagedMedia.length / 2} local videos, ${translatedSteps} Chinese instruction sets and 64 lazy content buckets. Existing Forma IDs and source files were not modified.`);
}
