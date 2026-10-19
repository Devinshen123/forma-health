// Original Forma geometric mark. This script only needs the repository's existing sharp.
import sharp from 'sharp';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
const root = resolve(import.meta.dirname,'../ios/Forma/Assets.xcassets');
mkdirSync(root,{recursive:true});
const json = (path,data)=>writeFileSync(path,JSON.stringify(data,null,2)+'\n');
json(join(root,'Contents.json'),{info:{author:'xcode',version:1}});
for (const [name,rgb] of [['AccentColor',['0.32','0.46','0.06']],['LaunchBackground',['0.969','0.973','0.980']]]) {
  mkdirSync(join(root,`${name}.colorset`),{recursive:true});
  json(join(root,`${name}.colorset/Contents.json`),{colors:[{idiom:'universal',color:{'color-space':'srgb',components:{red:rgb[0],green:rgb[1],blue:rgb[2],alpha:'1.000'}}}],info:{author:'xcode',version:1}});
}
const icon = join(root,'AppIcon.appiconset'); mkdirSync(icon,{recursive:true});
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><path fill="#c5f467" d="M0 0h1024v1024H0z"/><path fill="#171b20" d="M280 250h464v120H410v130h282v120H410v154H280z"/></svg>');
const images=[];
for (const [size,scale] of [[20,2],[20,3],[29,2],[29,3],[40,2],[40,3],[60,2],[60,3],[1024,1]]) {
  const filename=`icon-${size}@${scale}x.png`;
  await sharp(svg).resize(size*scale,size*scale).flatten({background:'#c5f467'}).png().toFile(join(icon,filename));
  images.push({filename,idiom:size===1024?'ios-marketing':'iphone',size:`${size}x${size}`,scale:`${scale}x`});
}
json(join(icon,'Contents.json'),{images,info:{author:'xcode',version:1}});
console.log('Forma original app icons and colors generated');
