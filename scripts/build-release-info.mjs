import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Public build identity only. No account, environment-file or upload content is read.
let sourceCommit = process.env.FORMA_BUILD_COMMIT || null;
if (!sourceCommit) {
  try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { /* Source archives may have no .git; report unavailable rather than inventing a revision. */ }
}
if (sourceCommit && !/^[a-f0-9]{40}$/i.test(sourceCommit)) throw new Error('FORMA_BUILD_COMMIT must be a complete Git SHA.');
const manifestBytes = readFileSync(resolve('src/catalog/opengym-manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const portraits = readdirSync('public/companions').filter(name => /^[a-z]+\.webp$/.test(name)).map(name => name.slice(0, -5)).sort();
const companionModels = JSON.parse(readFileSync('public/companions/model-manifest.json','utf8')).models;
const pokemonCatalog = JSON.parse(readFileSync('src/catalog/pokemon.json','utf8'));
const info = {
  schemaVersion: 1,
  sourceCommit,
  builtAt: new Date().toISOString(),
  exerciseLibrary: { source: manifest.source, sourceCommit: manifest.sourceCommit, exercises: manifest.primaryCount, videos: manifest.videoCount, files: manifest.files.length, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex') },
  companions: { characters: portraits, catalogSpecies: pokemonCatalog.length, originalAnimationClips: pokemonCatalog.reduce((sum,entry)=>sum+entry.animations.length,0), imageCount: portraits.length * 2, renderMode: 'realtime-webgl', lighting: 'pbr-environment-soft-shadows', interactions: ['pet','walk','sleep','wake','gaze','rotate','zoom','run','attack'], growthMilestones: [1, 3, 5], evolutionForms: companionModels.length, modelBytes: companionModels.reduce((total, model) => total + model.bytes, 0), formImageCount: companionModels.length * 2 },
};
writeFileSync('dist/release-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(`Release identity: ${sourceCommit ?? 'unavailable'}; ${manifest.primaryCount} animated exercises, ${portraits.length} companions.`);
