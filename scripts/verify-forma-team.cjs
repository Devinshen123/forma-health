// Configuration consistency check; no model calls or application behavior assertions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const portable=process.argv.includes('--portable');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=JSON.parse(read('docs/collaboration/team-config.json'));
const result={date:new Date().toISOString(),executor:'01 lead',root,mode:portable?'portable structure (not skill installation validation)':'Windows baseline',checks:[],warnings:[]};
function check(name,fn){try{fn();result.checks.push({name,result:'pass'});}catch(e){result.checks.push({name,result:'fail',error:e.message});}}
check('exact seven identities 00–06',()=>{assert.equal(config.roles.length,7);assert.deepEqual(config.roles.map(r=>r.number),['00','01','02','03','04','05','06']);assert.equal(new Set(config.roles.map(r=>r.id)).size,7);assert.equal(config.taskWriter,'lead');});
check('seven original role IDs and scoped Superpowers adaptation',()=>{
 assert.deepEqual(config.roles.map(r=>r.id),['dot','lead','claude-lead','product','frontend','backend','qa']);
 assert.equal(config.workflow.sourceCommit,'22f0b463e7a5e579904dd6211a520321035526f7');
 assert.equal(config.workflow.sourceVersion,'7.0.2');
 const adaptation=read(config.workflow.adaptation);
 for(const term of ['首次','独立审查','需求符合性','代码质量','原生自动加载','审查通过后','不能自动推送'])assert.ok(adaptation.includes(term),term);
 for(const r of config.roles){assert.ok(r.skills.includes('superpowers:using-superpowers'));assert.ok(r.skills.includes('superpowers:verification-before-completion'));}
});
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
check('first-use and continuing adapters are distinct and checkout-relative',()=>{
 for(const r of config.roles){
  const first=read('docs/collaboration/agent-prompts/launch/'+r.slug+'.prompt.md');
  const resume=read('docs/collaboration/agent-prompts/resume/'+r.slug+'.prompt.md');
  assert.ok(first.includes('模式：首次接手ONBOARD-'+r.number));assert.ok(resume.includes('模式：已有身份日常接续'));
  for(const s of [first,resume]){assert.ok(s.includes(r.md));assert.ok(s.includes('AGENTS.md'));assert.ok(s.includes('SUPERPOWERS.md'));assert.ok(s.includes('Mac使用实际checkout'));assert.ok(!s.includes('C:\\Users\\devin'));}
  const md=read(r.md);assert.ok(md.includes('已有身份接到明确任务'));assert.ok(!md.includes('你只写本人docs/collaboration/memory/'));
  if(r.id==='lead'){assert.ok(md.includes('01仅在TASKS本人精确授权内维护共享契约'));assert.ok(!md.includes('未派发路径、共享契约与他人记忆只读'));}
 }
});
check('registered Superpowers resources include bodies and preserve legacy skills',()=>{
 const registry=JSON.parse(read('docs/collaboration/skills/registry.json'));
 assert.equal(new Set(registry.skills.map(s=>s.name)).size,registry.skills.length);
 for(const name of ['agent-development','team-composition-patterns','find-skills','handoff','improve-codebase-architecture','codebase-design','domain-modeling','frontend-design','security-review','tdd','vercel-react-best-practices','i18n-expert'])assert.ok(registry.skills.some(s=>s.name===name));
 for(const s of registry.skills.filter(s=>s.name.startsWith('superpowers:'))){assert.equal(s.commit,config.workflow.sourceCommit);assert.equal(s.hashMode,'lf');assert.ok(s.resources.some(f=>f.path==='SKILL.md'));assert.ok(s.resources.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));}
});
check('only three explicit Claude adapters with valid inherited models',()=>{
 const entries=fs.readdirSync(path.join(root,'.claude/agents')).filter(n=>n.endsWith('.md'));
 assert.deepEqual(entries.sort(),['forma-02-claude-lead.md','forma-04-frontend.md','forma-06-reviewer.md']);
 for(const name of entries){const text=read('.claude/agents/'+name),fm=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);assert.ok(fm);const fields=Object.fromEntries(fm[1].split(/\r?\n/).map(l=>{const i=l.indexOf(':');return[l.slice(0,i),l.slice(i+1).trim()];}));assert.match(fields.name,/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/);assert.equal(fields.model,'inherit');assert.ok(fields.description.startsWith('Use this agent when'));assert.ok(fields.description.includes('Typical triggers'));assert.ok(['cyan','green','red'].includes(fields.color));assert.ok(JSON.parse(fields.tools).includes('Read'));assert.ok(text.includes('仅首次接手且无执行任务时ONBOARD-'));assert.ok(text.includes('已有身份按最新正式任务执行'));}
});
check('retired entry points block new assignments',()=>{for(const id of config.retired)assert.ok(read('docs/collaboration/agent-prompts/current/'+id+'.md').includes('不要以该ID接新任务'));});
check(portable?'assigned skill registry and bundled resources (external skills not certified)':'every assigned skill exists in registry and all stored resources readable',()=>{
 const registry=JSON.parse(read('docs/collaboration/skills/registry.json'));
 const mappingFile=path.join(root,'.forma-local/skills-paths.json');
 const overrides=fs.existsSync(mappingFile)?JSON.parse(fs.readFileSync(mappingFile,'utf8')):{};
 assert.ok(overrides&&typeof overrides==='object'&&!Array.isArray(overrides),'Invalid host skill mapping');
 for(const [name,dir] of Object.entries(overrides))assert.ok(registry.skills.some(s=>s.name===name)&&typeof dir==='string'&&path.isAbsolute(dir),'Mapping must use registered names and absolute local directories: '+name);
 for(const r of config.roles)for(const s of r.skills)assert.ok(registry.skills.some(x=>x.name===s));
 for(const s of registry.skills){const dir=path.resolve(root,overrides[s.name]||s.directory);const bundled=!overrides[s.name]&&s.directory.startsWith('docs/collaboration/skills/vendor/');if(portable&&!bundled){result.warnings.push(s.name+': external installation not validated; run forma-skills.cjs list/read/verify on this host');continue;}for(const file of s.resources)assert.ok(fs.existsSync(path.join(dir,file.path)),s.name+': missing '+file.path);if(s.knownMissing.length)result.warnings.push(s.name+': '+s.knownMissing.join(', '));}
});
// The original temp path is historical, not a live dependency after migration.
// Both modes verify the frozen archive bytes against the recorded SHA256.
check('archive report SHA256 and historical date/baseline retained',()=>{const b=JSON.parse(read('docs/collaboration/configuration-baseline.json'));const bytes=fs.readFileSync(path.join(root,b.reportDest));assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),b.reportSha256);const md=read('docs/architecture/reviews/README.md');assert.ok(md.includes('2026-10-20'));assert.ok(md.includes('ac56b65'));});
check(portable?'checkout-relative rules and ignored local outputs':'D-drive project and ignored local output directories',()=>{if(portable){assert.ok(read('FORMA.md').includes('Mac'));result.warnings.push('Windows projectRoot/plannedCheckout are host defaults; actual checkout: '+root);}else{assert.ok(/^D:/i.test(config.projectRoot));assert.ok(/^D:/i.test(root));assert.ok(read('AGENTS.md').includes('实际checkout'));}assert.ok(read('.gitignore').includes('.forma-local/'));});
check('architecture candidates and minimum regressions recorded',()=>{const b=read('docs/collaboration/ARCHITECTURE-BACKLOG.md');for(const term of ['400','409','零写入','双标签','跨账户','缺失完整度','日程引用','FoodPhoto','SyncEngine','2026-10-17T06:30:00Z'])assert.ok(b.includes(term),term);});
const target=path.join(root,'.forma-local/runtime/team-validation.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({mode:result.mode,passed:result.checks.filter(c=>c.result==='pass').length,failed:result.checks.filter(c=>c.result==='fail'),warnings:result.warnings,report:target},null,2));
if(result.checks.some(c=>c.result==='fail'))process.exitCode=1;
