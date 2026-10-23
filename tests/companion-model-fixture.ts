import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Decode the actual shipped skinned geometry in Node without a browser image decoder.
export async function companionGeometryFixture(dex: number) {
  const bytes=await readFile(`public/companions/models/${dex}.glb`),length=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.subarray(20,20+length).toString());
  delete json.images;delete json.textures;delete json.materials;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const text=Buffer.from(JSON.stringify(json)),padding=(4-text.length%4)%4,header=Buffer.from(bytes.subarray(0,20));
  header.writeUInt32LE(28+text.length+padding+bytes.subarray(28+length).length,8);header.writeUInt32LE(text.length+padding,12);
  const packed=Buffer.concat([header,text,Buffer.alloc(padding,32),bytes.subarray(20+length)]);
  return new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.length),'');
}
