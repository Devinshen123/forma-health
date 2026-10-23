// Authoring-only import. Pin upstream revisions; ship local models, never remote runtime URLs.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const animatedRevision = '00d96f7f18894055e7f1db44fa0df6462e5e4c8a';
const staticRevision = '429de1288cea0d43f5b4f56305d2276e94239d65';
const ids = [1,2,3,7,8,9,25,26,39,40,133,136,143,446];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function optimizeCompanionGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw Error('Expected GLB v2');
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const bin = bytes.subarray(28 + jsonLength);
  if (json.buffers.length !== 1 || json.buffers[0].uri || json.images.some(image => image.uri)) throw Error('Models must be self-contained');
  json.animations = (json.animations ?? []).filter(clip => ['idle','happy'].includes(clip.name));
  const accessorSlots = [];
  const slot = (object, key) => { if (object[key] !== undefined) accessorSlots.push([object,key]); };
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    slot(primitive,'indices'); for (const key of Object.keys(primitive.attributes)) slot(primitive.attributes,key);
    for (const target of primitive.targets ?? []) for (const key of Object.keys(target)) slot(target,key);
  }
  for (const skin of json.skins ?? []) slot(skin,'inverseBindMatrices');
  for (const clip of json.animations) for (const sampler of clip.samplers) { slot(sampler,'input'); slot(sampler,'output'); }
  const usedAccessors = [...new Set(accessorSlots.map(([object,key]) => object[key]))].sort((a,b) => a-b);
  for (const [object,key] of accessorSlots) object[key] = usedAccessors.indexOf(object[key]);
  json.accessors = usedAccessors.map(index => json.accessors[index]);
  const viewSlots = [];
  const viewSlot = (object,key) => { if (object[key] !== undefined) viewSlots.push([object,key]); };
  for (const accessor of json.accessors) {
    viewSlot(accessor,'bufferView');
    if (accessor.sparse) { viewSlot(accessor.sparse.indices,'bufferView'); viewSlot(accessor.sparse.values,'bufferView'); }
  }
  for (const image of json.images) viewSlot(image,'bufferView');
  for (const mesh of json.meshes) for (const primitive of mesh.primitives)
    if (primitive.extensions?.KHR_draco_mesh_compression) viewSlot(primitive.extensions.KHR_draco_mesh_compression,'bufferView');
  const usedViews = [...new Set(viewSlots.map(([object,key]) => object[key]))].sort((a,b) => a-b);
  const imageViews = new Map(json.images.map(image => [image.bufferView, image]));
  const chunks = [], views = []; let offset = 0;
  for (const index of usedViews) {
    const view = json.bufferViews[index];
    let data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const image = imageViews.get(index);
    if (image && image.mimeType !== 'image/webp') {
      // Preserve expression alpha and normal maps; cap GPU texture dimensions for phones.
      data = await sharp(data).resize({ width: 512, height: 512, fit:'inside', withoutEnlargement:true }).webp(image.name?.includes('normal') ? {lossless:true} : {quality:92,alphaQuality:100}).toBuffer();
      image.mimeType = 'image/webp';
    }
    const padding = (4-offset%4)%4; if(padding) {chunks.push(Buffer.alloc(padding));offset+=padding;}
    views.push({...view,buffer:0,byteOffset:offset,byteLength:data.length});chunks.push(data);offset+=data.length;
  }
  for (const [object,key] of viewSlots) object[key] = usedViews.indexOf(object[key]);
  json.bufferViews = views;
  for (const texture of json.textures ?? []) if (texture.source !== undefined) {
    texture.extensions = {...texture.extensions, EXT_texture_webp:{source:texture.source}}; delete texture.source;
  }
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []),'EXT_texture_webp'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []),'EXT_texture_webp'])];
  const tail = (4-offset%4)%4; if(tail) chunks.push(Buffer.alloc(tail));
  const binary = Buffer.concat(chunks);json.buffers[0].byteLength=binary.length;
  if (!json.animations.length) delete json.animations;
  const text=Buffer.from(JSON.stringify(json)), textPadding=(4-text.length%4)%4;
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+textPadding+binary.length,8);header.writeUInt32LE(text.length+textPadding,12);header.writeUInt32LE(0x4e4f534a,16);
  const binaryHeader=Buffer.alloc(8);binaryHeader.writeUInt32LE(binary.length);binaryHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,text,Buffer.alloc(textPadding,0x20),binaryHeader,binary]);
}

if (process.argv[1]?.replaceAll('\\','/').endsWith('/prepare-companion-models.mjs')) {
  const inputDirectory=process.argv[2];
  if(!inputDirectory)throw Error('Pass the authoring input directory; no credentials or account data are used.');
  await mkdir('public/companions/models',{recursive:true});
  const models=[];
  for(const dex of ids){
    const animated=dex!==446, revision=animated?animatedRevision:staticRevision;
    const sourceUrl=animated?`https://raw.githubusercontent.com/06wj/pokemon/${revision}/public/models/${String(dex).padStart(3,'0')}/model.glb`:`https://raw.githubusercontent.com/Pokemon-3D-api/assets/${revision}/models/opt/regular/${dex}.glb`;
    const original=await readFile(`${inputDirectory}/${animated?'animated-':''}${dex}.glb`);
    const output=await optimizeCompanionGlb(original);
    await writeFile(`public/companions/models/${dex}.glb`,output);
    models.push({dex,sourceUrl,sourceRevision:revision,sourceSha256:digest(original),sha256:digest(output),bytes:output.length,animations:animated?['idle','happy']:[]});
    console.log(`${dex}: ${(original.length/1e6).toFixed(2)} MB → ${(output.length/1e6).toFixed(2)} MB`);
  }
  await writeFile('public/companions/model-manifest.json',JSON.stringify({schemaVersion:1,rights:'Pokémon character designs and original assets belong to their respective owners, including Nintendo, Creatures and GAME FREAK. Repository software licenses do not replace character/model rights.',models},null,2)+'\n');
}
