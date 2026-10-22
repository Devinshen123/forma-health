// Configuration consistency check; no model calls or application behavior assertions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const portable=process.argv.includes('--portable');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=JSON.parse(read('docs/collaboration/team-config.json'));
const result={date:new Date().toISOString(),executor:'01 lead',root,mode:portable?'portable structure (not skill installation validation)':'Windows baseline',checks:[],warnings:[]};
function check(name,fn){try{fn();result.checks.push({name,result:'pass'});}catch(e){result.checks.push({name,result:'fail',error:e.message});}}
check('exact seven identities 00–06',()=>{assert.equal(config.roles.length,7);assert.deepEqual(config.roles.map(r=>r.number),['00','01','02','03','04','05','06']);assert.equal(new Set(config.roles.map(r=>r.id)).size,7);assert.equal(config.taskWriter,'lead');});
check('shared entries and single ownership source',()=>{assert.ok(read('AGENTS.md').includes('FORMA.md'));assert.ok(read('CLAUDE.md').includes('@FORMA.md'));assert.ok(read('FORMA.md').includes('唯一共享项目手册'));assert.ok(read('docs/collaboration/TASKS.md').includes('唯一写入者01'));assert.ok(!read('FORMA.md').includes('| 角色 | 可写路径 |'));});
for(const r of config.roles){
 check(`${r.number} role, entry, memories, status and task`,()=>{
  const content=read(r.md);assert.ok(content.includes(`${r.number}｜`));assert.ok(content.includes('`'+r.id+'`'));assert.ok(content.includes('你'));
  for(const h of ['使命与职责边界','When to invoke','开工读取顺序','实际工作步骤','可写与只读','Skills与使用时机','输入与交付格式','质量标准','依赖、冲突与权限不足','独立记忆与交接'])assert.ok(content.includes('## '+h),h);
  const scenarios=content.split('## When to invoke')[1].split('不应调用')[0].split('\n').filter(l=>l.startsWith('- '));assert.ok(scenarios.length>=2&&scenarios.length<=4);
  assert.ok(read(r.current).includes(r.slug+'.md'));for(const f of ['PROFILE.md','MEMORY.md','HANDOFF.md'])assert.ok(read(r.memory+'/'+f).includes(r.number+'｜'));
  assert.ok(read(r.status).includes(r.number+'｜'));assert.ok(read('docs/collaboration/TASKS.md').includes('ONBOARD-'+r.number));
 });
}
check('only three explicit Claude adapters with valid inherited models',()=>{
 const entries=fs.readdirSync(path.join(root,'.claude/agents')).filter(n=>n.endsWith('.md'));
 assert.deepEqual(entries.sort(),['forma-02-claude-lead.md','forma-04-frontend.md','forma-06-reviewer.md']);
 for(const name of entries){const text=read('.claude/agents/'+name),fm=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);assert.ok(fm);const fields=Object.fromEntries(fm[1].split(/\r?\n/).map(l=>{const i=l.indexOf(':');return[l.slice(0,i),l.slice(i+1).trim()];}));assert.match(fields.name,/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/);assert.equal(fields.model,'inherit');assert.ok(fields.description.startsWith('Use this agent when'));assert.ok(fields.description.includes('Typical triggers'));assert.ok(['cyan','green','red'].includes(fields.color));assert.ok(JSON.parse(fields.tools).includes('Read'));assert.ok(text.includes('本轮')||text.includes('首轮'));}
});
check('retired entry points block new assignments',()=>{for(const id of config.retired)assert.ok(read('docs/collaboration/agent-prompts/current/'+id+'.md').includes('不要以该ID接新任务'));});
check(portable?'assigned skill registry and bundled resources (external skills not certified)':'every assigned skill exists in registry and all stored resources readable',()=>{const registry=JSON.parse(read('docs/collaboration/skills/registry.json'));for(const r of config.roles)for(const s of r.skills)assert.ok(registry.skills.some(x=>x.name===s));for(const s of registry.skills){const dir=path.resolve(root,s.directory);const bundled=s.directory.startsWith('docs/collaboration/skills/vendor/');if(portable&&!bundled){result.warnings.push(s.name+': external installation not validated; run forma-skills.cjs list/read/verify on this host');continue;}for(const file of s.resources)assert.ok(fs.existsSync(path.join(dir,file.path)));if(s.knownMissing.length)result.warnings.push(s.name+': '+s.knownMissing.join(', '));}});
check(portable?'archive report SHA256 and historical baseline retained':'architecture report byte-identical to original, original date/baseline retained',()=>{const b=JSON.parse(read('docs/collaboration/configuration-baseline.json'));const bytes=fs.readFileSync(path.join(root,b.reportDest));if(portable){assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),b.reportSha256);}else{assert.ok(fs.readFileSync(b.reportSource).equals(bytes));}const md=read('docs/architecture/reviews/README.md');assert.ok(md.includes('2026-10-20'));assert.ok(md.includes('ac56b65'));});
check(portable?'checkout-relative rules and ignored local outputs':'C-drive project and ignored local output directories',()=>{if(portable){assert.ok(read('FORMA.md').includes('Mac'));result.warnings.push('Windows projectRoot/plannedCheckout are historical host paths; current root: '+root);}else{assert.equal(root,config.projectRoot);assert.ok(root.startsWith('C:'));assert.ok(fs.statSync(path.join(root,'.forma-local/runtime')).isDirectory());assert.ok(fs.statSync(path.join(root,'.forma-local/deliverables')).isDirectory());}assert.ok(read('.gitignore').includes('.forma-local/'));});
check('architecture candidates and minimum regressions recorded',()=>{const b=read('docs/collaboration/ARCHITECTURE-BACKLOG.md');for(const term of ['400','409','零写入','双标签','跨账户','缺失完整度','日程引用','FoodPhoto','SyncEngine','2026-10-17T06:30:00Z'])assert.ok(b.includes(term),term);});
const target=path.join(root,'.forma-local/runtime/team-validation.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({mode:result.mode,passed:result.checks.filter(c=>c.result==='pass').length,failed:result.checks.filter(c=>c.result==='fail'),warnings:result.warnings,report:target},null,2));
if(result.checks.some(c=>c.result==='fail'))process.exitCode=1;
