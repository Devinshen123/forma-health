// Local authoring tool: portraits rendered from the same packaged GLB as the live app.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/components/companion-scene.ts'], bundle: true, format: 'esm', write: false });
const ids = ['sprout','bunny','otter','cloud','bear','seal'];
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Forma 3D portrait studio</title><style>body{margin:20px;background:#f7f6f1;font:16px system-ui}canvas{display:block;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/20px 20px}select{font:inherit;margin:10px}a{margin:15px}</style><label>角色<select aria-label="角色">${ids.map(id=>`<option value="${id}">${id}</option>`).join('')}</select></label><label>等级<select aria-label="等级"><option>1</option><option>3</option><option>5</option></select></label><span id="status" role="status">绘制中</span><canvas width="640" height="640" aria-label="透明伙伴肖像"></canvas><a id="export">导出 PNG</a><script type="module">
import {T,createCompanionModel,fitCompanionCamera} from '/scene.js';
const ids=${JSON.stringify(ids)},params=new URLSearchParams(location.search),id=params.get('character')||'sprout',level=Number(params.get('level')||1);
if(!ids.includes(id)||![1,3,5].includes(level))throw Error('Unknown form');
const selects=document.querySelectorAll('select');selects[0].value=id;selects[1].value=String(level);
for(const select of selects)select.onchange=()=>location.search='?character='+selects[0].value+'&level='+selects[1].value;
try {
const canvas=document.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(640,640);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,30),model=await createCompanionModel(id,null,level);
model.root.rotation.y=-.16;scene.add(model.root);scene.add(new T.HemisphereLight('#fff7ef','#e4d9cf',2));
const key=new T.DirectionalLight('#fff2e3',2.5);key.position.set(-3,6,5);scene.add(key);
const fill=new T.DirectionalLight('#eef0ff',1.4);fill.position.set(3,3,-3);scene.add(fill);
fitCompanionCamera(camera,model.root,1);renderer.render(scene,camera);canvas.dataset.form=model.dex;canvas.dataset.ready='true';
document.querySelector('#status').textContent='已绘制 '+id+' '+model.dex;
const link=document.querySelector('#export');link.href=canvas.toDataURL('image/png');link.download=model.dex+'.png';
} catch(error){document.querySelector('#status').textContent='绘制失败 '+error.message;}
</script></html>`;
const server = createServer(async (req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/scene.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(outputFiles[0].contents);}
  else if(/^\/companions\/(?:models\/(?:1|2|3|7|8|9|25|26|39|40|143|446|133|136)\.glb|draco\/draco_(?:decoder\.wasm|wasm_wrapper\.js))$/.test(path)) {
    try {const bytes=await readFile('public'+path);res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'model/gltf-binary'});res.end(bytes);} catch {res.writeHead(404);res.end();}
  } else if(path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);}
  else {res.writeHead(404);res.end();}
});
server.listen(5191,'127.0.0.1',()=>console.log('Portrait studio: http://127.0.0.1:5191/'));
