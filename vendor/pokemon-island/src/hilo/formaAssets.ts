import * as Hilo3d from 'hilo3d';
// Reuse the exact same locally packaged models as the Forma companion stage.
// This renderer does not implement EXT_texture_webp, but accepts decoded WebP images.
// Adapt texture indices in memory; geometry, animation, images and binary buffers are unchanged.
export async function loadFormaPokemon(id:string):Promise<Hilo3d.GLTFModel> {
  const dex=Number(id);if(!Number.isInteger(dex)||dex<1||dex>151)throw Error('Unknown companion');
  const src=`/companions/models/${dex}.glb?v=pokedex151-20261023`;
  const response=await fetch(src);if(!response.ok)throw Error(`伙伴模型加载失败：${id}`);
  const bytes=await response.arrayBuffer(),view=new DataView(bytes),length=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  for(const texture of json.textures??[])if(texture.extensions?.EXT_texture_webp){
    texture.source=texture.extensions.EXT_texture_webp.source;delete texture.extensions.EXT_texture_webp;
  }
  for(const key of['extensionsUsed','extensionsRequired'])if(json[key])json[key]=json[key].filter((name:string)=>name!=='EXT_texture_webp');
  const text=new TextEncoder().encode(JSON.stringify(json)),padding=(4-text.length%4)%4;
  const packed=new Uint8Array(20+text.length+padding+bytes.byteLength-20-length),header=new DataView(packed.buffer);
  packed.set(new Uint8Array(bytes,0,20));header.setUint32(8,packed.byteLength,true);header.setUint32(12,text.length+padding,true);
  packed.set(text,20);packed.fill(32,20+text.length,20+text.length+padding);packed.set(new Uint8Array(bytes,20+length),20+text.length+padding);
  return new Hilo3d.GLTFParser(packed.buffer,{src}).parse(new Hilo3d.GLTFLoader());
}
