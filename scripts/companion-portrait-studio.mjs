// Local verification UI. Uses the exact runtime GLB loader, textures and renderer.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints:['src/components/companion-scene.ts'],bundle:true,format:'esm',write:false });
const catalog=JSON.parse(await readFile('src/catalog/pokemon.json','utf8'));
const manifest=JSON.parse(await readFile('public/companions/model-manifest.json','utf8'));
const ids=['sprout','bunny','otter','cloud','bear','seal',...catalog.map(entry=>'pokemon-'+entry.dex)];
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Forma 151 3D 模型校验</title><style>body{margin:20px;background:#f7f6f1;font:16px system-ui}canvas{display:block;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/20px 20px;width:420px;height:420px}select,button{font:inherit;margin:10px;padding:8px}a{margin:15px}table{border-collapse:collapse}td,th{padding:4px 12px;border-bottom:1px solid #ddd}</style><h1>Forma · 151 个实时 3D 模型验证</h1><label>角色<select aria-label="角色">${ids.map(id=>`<option value="${id}">${id}</option>`).join('')}</select></label><label>等级<select aria-label="等级"><option>1</option><option>3</option><option>5</option></select></label><button id="validate">校验全部 151 个模型和 869 段动画</button><p id="status" role="status">绘制中</p><progress max="151" value="0"></progress><canvas width="640" height="640" aria-label="透明伙伴肖像"></canvas><a id="export">导出 PNG</a><table><thead><tr><th>编号</th><th>伙伴</th><th>纹理/骨骼</th><th>原始动画</th><th>状态</th></tr></thead><tbody id="results"></tbody></table><script type="module">
import {T,createCompanionModel,fitCompanionCamera,installCompanionLighting} from '/scene.js';
const ids=${JSON.stringify(ids)},catalog=${JSON.stringify(catalog)},params=new URLSearchParams(location.search),id=params.get('character')||'sprout',level=Number(params.get('level')||1);
if(!ids.includes(id)||![1,3,5].includes(level))throw Error('Unknown form');
const selects=document.querySelectorAll('select');selects[0].value=id;selects[1].value=String(level);
for(const select of selects)select.onchange=()=>location.search='?character='+selects[0].value+'&level='+selects[1].value;
const status=document.querySelector('#status'),canvas=document.querySelector('canvas');
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(640,640);renderer.setClearColor(0,0);const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,30);
const releaseLighting=installCompanionLighting(renderer,scene);let current=null;
function clear(){if(current){scene.remove(current.root);current.dispose();current=null;}renderer.renderLists.dispose();}
async function show(character,level){clear();current=await createCompanionModel(character,null,level);scene.add(current.root);fitCompanionCamera(camera,current.root,1);renderer.render(scene,camera);canvas.dataset.form=current.dex;canvas.dataset.ready='true';const link=document.querySelector('#export');link.href=canvas.toDataURL('image/png');link.download=current.dex+'.png';}
try{await show(id,level);status.textContent='已绘制 '+id+' #'+current.dex;}catch(error){status.textContent='绘制失败 '+error.message;}
document.querySelector('#validate').onclick=async()=>{
 const button=document.querySelector('#validate');button.disabled=true;document.querySelector('#results').replaceChildren();let passed=0,clips=0;
 for(const entry of catalog){
  const row=document.createElement('tr');let state='通过',textures=0,skins=0;
  try{
   await show('pokemon-'+entry.dex,1);
   current.root.traverse(object=>{if(object.isSkinnedMesh)skins++;if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.map)textures++;});
   if(!skins||!textures)throw Error('Missing skeleton or decoded texture');
   if(current.actions.length!==entry.animations.length)throw Error('Animation count mismatch');
   for(const action of current.actions){current.play(action,true);current.update(.02);current.root.rotation.y=.6;renderer.render(scene,camera);if(renderer.getContext().getError())throw Error('WebGL error');clips++;}
   passed++;
  }catch(error){state='失败: '+error.message;}
  for(const value of[entry.dex,entry.zh,textures+' / '+skins,entry.animations.length,state]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}document.querySelector('#results').append(row);
  document.querySelector('progress').value=entry.dex;status.textContent='已校验 '+entry.dex+' / 151 · 通过 '+passed+' · 动画 '+clips;
 }
 clear();await show(id,level);status.dataset.validation=passed===151&&clips===869?'passed':'failed';status.textContent='完成 · '+passed+' / 151 模型通过 · '+clips+' / 869 动画渲染通过';button.disabled=false;
};
addEventListener('pagehide',()=>{clear();releaseLighting();renderer.dispose();renderer.forceContextLoss();},{once:true});
</script></html>`;
const allowed=new Set(manifest.models.map(model=>`/companions/models/${model.dex}.glb`));
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/scene.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(outputFiles[0].contents);}
 else if(allowed.has(path)||/^\/companions\/draco\/draco_(?:decoder\.wasm|wasm_wrapper\.js)$/.test(path)){
  try{const bytes=await readFile('public'+path);res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'model/gltf-binary'});res.end(bytes);}catch{res.writeHead(404);res.end();}
 }else if(path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);}
 else{res.writeHead(404);res.end();}
});
server.listen(5191,'127.0.0.1',()=>console.log('3D verification studio: http://127.0.0.1:5191/'));
