// Reproducible, pinned public-asset import. Never reads account data or credentials.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { optimizeCompanionGlb } from './prepare-companion-models.mjs';

const revision = '00d96f7f18894055e7f1db44fa0df6462e5e4c8a';
const upstream = `https://raw.githubusercontent.com/06wj/pokemon/${revision}/`;
const directory = process.argv[2];
if (!directory) throw Error('Provide a public asset cache directory outside the checkout.');
await mkdir(directory, { recursive: true });
await mkdir('src/catalog', { recursive: true });
await mkdir('public/companions/models', { recursive: true });
await mkdir('public/companions/forms', { recursive: true });
async function cached(name, url) {
  const path = `${directory}/${name}`;
  try { return await readFile(path); } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw Error(`${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(path, bytes); return bytes;
    } catch (error) { if (attempt === 2) throw error; }
  }
}
const source = (await cached('pokemon.ts', upstream + 'src/content/pokemon.ts')).toString();
const typesSource = (await cached('pokemonTypes.ts', upstream + 'src/content/pokemonTypes.ts')).toString();
const animationData = JSON.parse(await cached('animatedModels.json', upstream + 'src/content/animatedModels.json'));
const names = [...source.matchAll(/id: '(\d+)',\s*name: '([^']+)'/g)];
const types = JSON.parse(typesSource.match(/pokemonTypes = (\[.*\]) as const/)[1]);
const english = JSON.parse(await cached('english-names.json', 'https://pokeapi.co/api/v2/pokemon?limit=151')).results;
if (names.length !== 151 || types.length !== 151 || english.length !== 151) throw Error('Expected exactly 151 species.');
const catalog = names.map((match, index) => ({
  dex: Number(match[1]), zh: match[2],
  en: ({29:'Nidoran♀',32:'Nidoran♂',83:"Farfetch’d",122:'Mr. Mime'}[index+1] ?? english[index].name.replace(/(^|-)(\w)/g, (_, prefix, letter) => (prefix ? '-' : '') + letter.toUpperCase())),
  types: types[index], animations: animationData[match[1]].animations.map(({ name, label }) => ({ name, label })),
}));
await writeFile('src/catalog/pokemon.json', JSON.stringify(catalog,null,2)+'\n');
const oldManifest = JSON.parse(await readFile('public/companions/model-manifest.json', 'utf8'));
const models = [oldManifest.models.find(model => model.dex === 446)];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < catalog.length) {
    const entry = catalog[cursor++], id = String(entry.dex).padStart(3, '0');
    const sourceUrl = upstream + `public/models/${id}/model.glb`;
    const original = await cached(`animated-${entry.dex}.glb`, sourceUrl);
    const bytes = await optimizeCompanionGlb(original);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const animations = (json.animations ?? []).map(clip => clip.name);
    if (JSON.stringify(animations.toSorted()) !== JSON.stringify(entry.animations.map(clip => clip.name).toSorted())) throw Error(`Animation mismatch ${entry.dex}`);
    await writeFile(`public/companions/models/${entry.dex}.glb`, bytes);
    const icon = await cached(`${entry.dex}-icon.png`, upstream + `public/models/${id}/icon.png`);
    // Existing matching high-resolution renders remain intact; new thumbnails are upstream 3D icons.
    for (const [suffix, size] of [['',640],['-thumb',192]]) {
      const path = `public/companions/forms/${entry.dex}${suffix}.webp`;
      try { await access(path); } catch { await sharp(icon).resize(size,size,{fit:'contain',background:'#00000000'}).webp({quality:92,alphaQuality:100}).toFile(path); }
    }
    models.push({ dex: entry.dex, sourceUrl, sourceRevision: revision, sourceSha256: digest(original), sha256: digest(bytes), bytes: bytes.length, animations });
    console.log(`${id} ${entry.zh}: ${(bytes.length / 1e6).toFixed(2)} MB, ${animations.length} clips`);
  }
}));
models.sort((a,b) => a.dex-b.dex);
await writeFile('src/catalog/pokemon.json', JSON.stringify(catalog,null,2)+'\n');
await writeFile('public/companions/model-manifest.json', JSON.stringify({ ...oldManifest, schemaVersion:2, catalogSpecies:151, sourceAnimationCount:catalog.reduce((n,e)=>n+e.animations.length,0), models },null,2)+'\n');
console.log(`Imported ${catalog.length} real 3D species, ${catalog.reduce((n,e)=>n+e.animations.length,0)} original clips, plus the existing Munchlax.`);
