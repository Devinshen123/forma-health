// Pinned MIT source import; public model assets continue to use Forma's existing library.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const revision='00d96f7f18894055e7f1db44fa0df6462e5e4c8a';
const cache=process.argv[2];if(!cache)throw Error('Provide an external public source cache.');
try{await access('vendor/pokemon-island/NOTICE.md');throw Error('Island already imported. Use a clean isolated checkout to avoid overwriting the Forma adapters.');}catch(error){if(error.code!=='ENOENT')throw error;}
const tree=JSON.parse(await readFile(`${cache}/tree.json`,'utf8')).tree;
const selected=tree.filter(file=>file.type==='blob'&&(
 file.path.startsWith('src/')||file.path.startsWith('public/')&&!file.path.startsWith('public/models/')||
 file.path.startsWith('scripts/')&&/\.(mjs|ts)$/.test(file.path)||
 ['package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html','LICENSE','README.md','README.zh-CN.md'].includes(file.path)
));
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<selected.length){const file=selected[cursor++];
  const cached=`${cache}/source/${file.path}`,target=`vendor/pokemon-island/${file.path}`;
  let bytes;try{bytes=await readFile(cached);}catch{
   const response=await fetch(`https://raw.githubusercontent.com/06wj/pokemon/${revision}/${file.path}`);if(!response.ok)throw Error(`${response.status}: ${file.path}`);
   bytes=Buffer.from(await response.arrayBuffer());await mkdir(dirname(cached),{recursive:true});await writeFile(cached,bytes);
  }
  if(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.sha)throw Error(`Source hash mismatch ${file.path}`);
  await mkdir(dirname(target),{recursive:true});await copyFile(cached,target);
 }
}));
await writeFile('vendor/pokemon-island/NOTICE.md',`# Forma companion island\n\nAdapted from https://github.com/06wj/pokemon at ${revision}.\nOriginal software author: 06wj. MIT license retained in LICENSE.\nPokémon characters and assets belong to their respective rights holders; the software license does not grant character rights.\nSee Forma public/licenses/pokemon-models-NOTICE.txt and model-manifest.json.\nEnvironment credits remain in public/environments/CREDITS.md.\n\nLocal changes integrate navigation, selected companion, account-scoped local keepsakes, and Forma-hosted models. No health records or credentials enter this scene.\n`);
console.log(`Imported ${selected.length} pinned source/scene files; no duplicate Pokémon models.`);
