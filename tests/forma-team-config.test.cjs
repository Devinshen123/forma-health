// Real CLI behavior in isolated synthetic repositories; no models, installs or user data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const source = path.resolve(__dirname,'..');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function fixture(t) {
 const parent=path.resolve(os.tmpdir());
 const root=fs.mkdtempSync(path.join(parent,'forma-team-config-'));
 t.after(()=>{const target=path.resolve(root);assert.ok(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('forma-team-config-'));fs.rmSync(target,{recursive:true,force:true});});
 const write=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof s==='string'?s:JSON.stringify(s));};
 const run=(script,...args)=>spawnSync(process.execPath,[path.join(root,script),...args],{cwd:root,encoding:'utf8',timeout:20000,windowsHide:true});
 write('scripts/forma-skills.cjs',fs.readFileSync(path.join(source,'scripts/forma-skills.cjs'),'utf8'));
 const body='name: fixture\nSYNTHETIC_SKILL_BODY\n';
 const skill={name:'superpowers:fixture',directory:'fixture skill',hashMode:'lf',status:'synthetic explicit reader',when:'test',knownMissing:[],resources:[{path:'SKILL.md',sha256:hash(body)}]};
 const registry={skills:[skill]};
 write('docs/collaboration/skills/registry.json',registry);
 write('docs/collaboration/team-config.json',{roles:[{id:'lead',number:'01',skills:[skill.name]}]});
 write('fixture skill/SKILL.md',body);
 return {root,write,run,body,registry,skill};
}
test('namespaced CLI reads pinned LF content from CRLF and LF files',t=>{
 const f=fixture(t);f.write('fixture skill/SKILL.md',f.body.replaceAll('\n','\r\n'));
 let r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/SYNTHETIC_SKILL_BODY/);
 f.write('fixture skill/SKILL.md',f.body);r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,0,r.stderr);
});
test('changed content fails closed before displaying the skill body',t=>{
 const f=fixture(t);f.write('fixture skill/SKILL.md',f.body+'CHANGED_INSTRUCTIONS\n');
 const r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,1);assert.doesNotMatch(r.stdout,/SYNTHETIC_SKILL_BODY|CHANGED_INSTRUCTIONS/);assert.match(r.stderr,/content not loaded/);
});
test('missing referenced resources prevent skill content loading',t=>{
 const f=fixture(t);f.skill.resources.push({path:'references/missing.md',sha256:hash('missing')});f.write('docs/collaboration/skills/registry.json',f.registry);
 const r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/missing/);
});
test('legacy raw-byte hashes still reject newline changes',t=>{
 const f=fixture(t);delete f.skill.hashMode;f.write('docs/collaboration/skills/registry.json',f.registry);f.write('fixture skill/SKILL.md',f.body.replaceAll('\n','\r\n'));
 const r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,1);assert.equal(r.stdout,'');
});
test('per-host absolute directory mapping overrides an unavailable source path',t=>{
 const f=fixture(t);f.skill.directory='unavailable-on-this-host';f.write('docs/collaboration/skills/registry.json',f.registry);
 f.write('.forma-local/skills-paths.json',{[f.skill.name]:path.join(f.root,'fixture skill')});
 const r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/SYNTHETIC_SKILL_BODY/);
 const list=f.run('scripts/forma-skills.cjs','list','lead');assert.equal(list.status,0,list.stderr);assert.equal(JSON.parse(list.stdout)[0].available,true);
});
test('unknown skill and invalid host override names are rejected',t=>{
 const f=fixture(t);let r=f.run('scripts/forma-skills.cjs','read','superpowers:unknown');assert.equal(r.status,1);assert.match(r.stderr,/Unregistered skill/);
 f.write('.forma-local/skills-paths.json',{'unknown':path.join(f.root,'fixture skill')});r=f.run('scripts/forma-skills.cjs','list');assert.equal(r.status,1);assert.match(r.stderr,/registered names/);
});
test('unsupported hash mode does not display skill instructions',t=>{
 const f=fixture(t);f.skill.hashMode='unknown';f.write('docs/collaboration/skills/registry.json',f.registry);
 const r=f.run('scripts/forma-skills.cjs','read',f.skill.name);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Unsupported skill hash mode/);
});
test('generator keeps seven identities and produces deterministic relative first/resume prompts',t=>{
 const f=fixture(t);const team=JSON.parse(fs.readFileSync(path.join(source,'docs/collaboration/team-config.json'),'utf8'));
 f.write('docs/collaboration/team-config.json',team);
 for(const p of ['AGENTS.md','FORMA.md','docs/collaboration/TASKS.md','docs/collaboration/TEAM-ROSTER.md','docs/collaboration/SKILLS-MATRIX.md','docs/collaboration/skills/SUPERPOWERS.md'])f.write(p,'Synthetic public fixture\n');
 for(const r of team.roles){f.write(r.md,`# ${r.number}｜Synthetic \`${r.id}\`\n`);f.write(r.current,'synthetic');f.write(r.status,'synthetic');for(const name of ['PROFILE.md','MEMORY.md','HANDOFF.md'])f.write(r.memory+'/'+name,'synthetic');}
 f.write('scripts/prepare-forma-chat-prompts.cjs',fs.readFileSync(path.join(source,'scripts/prepare-forma-chat-prompts.cjs'),'utf8'));
 let r=f.run('scripts/prepare-forma-chat-prompts.cjs');assert.equal(r.status,0,r.stderr);const summary=JSON.parse(r.stdout);assert.equal(summary.roles,7);assert.equal(summary.employeesStarted,0);assert.equal(summary.conversationsCreated,0);
 const snapshot=new Map();
 for(const role of team.roles)for(const mode of ['launch','resume']){const p=`docs/collaboration/agent-prompts/${mode}/${role.slug}.prompt.md`;const text=fs.readFileSync(path.join(f.root,p),'utf8');snapshot.set(p,text);assert.ok(text.includes(role.md));assert.ok(!text.includes(f.root));assert.ok(text.includes('Mac使用实际checkout'));assert.ok(text.includes(mode==='launch'?'模式：首次接手ONBOARD-'+role.number:'模式：已有身份日常接续'));}
 r=f.run('scripts/prepare-forma-chat-prompts.cjs');assert.equal(r.status,0,r.stderr);for(const [p,expected] of snapshot)assert.equal(fs.readFileSync(path.join(f.root,p),'utf8'),expected);
});
