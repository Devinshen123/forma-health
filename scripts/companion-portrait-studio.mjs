// Local authoring tool: render portraits from the exact runtime geometry, without remote assets.
import { createServer } from 'node:http';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/components/companion-scene.ts'], bundle: true, format: 'esm', write: false });
const ids = ['sprout','bunny','otter','cloud','bear','seal'];
const names = ['妙蛙种子','皮卡丘','杰尼龟','胖丁','卡比兽','伊布'];
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Forma 3D portrait studio</title><style>body{margin:20px;background:#f7f6f1;font:16px system-ui}canvas{display:block;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/20px 20px}select{font:inherit;margin:10px}a{margin:15px}</style><label>角色<select aria-label="角色">${ids.map((id,i)=>`<option value="${id}">${names[i]}</option>`).join('')}</select></label><span id="status" role="status">绘制中</span><canvas width="640" height="640" aria-label="透明伙伴肖像"></canvas><a id="export">导出 PNG</a><script type="module">
import {T,createCompanionModel,fitCompanionCamera} from '/scene.js';
const ids=${JSON.stringify(ids)},id=new URLSearchParams(location.search).get('character')||'sprout';
if(!ids.includes(id))throw Error('Unknown character');
const select=document.querySelector('select');select.value=id;select.onchange=()=>location.search='?character='+select.value;
const canvas=document.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(640,640);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,30),model=createCompanionModel(id,null,1);
model.root.rotation.y=-.16;scene.add(model.root);scene.add(new T.HemisphereLight('#fff7ef','#e4d9cf',2));
const key=new T.DirectionalLight('#fff2e3',2.5);key.position.set(-3,6,5);scene.add(key);
const fill=new T.DirectionalLight('#eef0ff',1.4);fill.position.set(3,3,-3);scene.add(fill);
fitCompanionCamera(camera,model.root,1);renderer.render(scene,camera);canvas.dataset.character=id;canvas.dataset.ready='true';
document.querySelector('#status').textContent='已绘制 '+id;
const link=document.querySelector('#export');link.href=canvas.toDataURL('image/png');link.download=id+'.png';
</script></html>`;
const server = createServer((req,res)=>{if(req.url==='/scene.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(outputFiles[0].contents);}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);}});
server.listen(5191,'127.0.0.1',()=>console.log('Portrait studio: http://127.0.0.1:5191/'));
