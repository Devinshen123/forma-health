// Reproducible text-only import. No upstream image URL or media is retained.
import { writeFileSync, mkdirSync } from 'node:fs';
const commit = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const root = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${commit}`;
const license = await fetch(`${root}/LICENSE.md`).then(r => { if (!r.ok) throw Error('License unavailable'); return r.text(); });
if (!license.includes('public domain') || !license.includes('commercial')) throw Error('Unexpected license');
const raw = await fetch(`${root}/dist/exercises.json`).then(r => { if (!r.ok) throw Error('Catalog unavailable'); return r.json(); });
if (raw.length !== 876 || new Set(raw.map(x => x.id)).size !== 876) throw Error('Catalog integrity mismatch');
const data = raw.map(({id,name,primaryMuscles,secondaryMuscles,equipment,category,level,instructions}) => ({id,name,primaryMuscles,secondaryMuscles,equipment,category,level,instructions}));
mkdirSync('src/catalog', {recursive:true});
writeFileSync('src/catalog/exercises.json', JSON.stringify(data));
mkdirSync('public/licenses', {recursive:true});
writeFileSync('public/licenses/free-exercise-db-Unlicense.txt', license);
console.log(`Imported ${data.length} text records, commit ${commit}; excluded every image field.`);
