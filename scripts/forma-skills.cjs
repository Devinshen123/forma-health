// Explicit skill reader: no model calls, installations, user-level config writes, or script execution.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/collaboration/skills/registry.json'), 'utf8'));
const team = JSON.parse(fs.readFileSync(path.join(root, 'docs/collaboration/team-config.json'), 'utf8'));
const [action = 'list', arg] = process.argv.slice(2);
const overridesPath = path.join(root, '.forma-local/skills-paths.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error('Skill path overrides must be an object');
for (const [name, directory] of Object.entries(overrides)) {
  if (!registry.skills.some(s => s.name === name) || typeof directory !== 'string' || !path.isAbsolute(directory)) {
    throw Error('Skill overrides must map registered names to absolute local directories: ' + name);
  }
}
const filePath = p => path.isAbsolute(p) || path.win32.isAbsolute(p) ? p : path.join(root, p);
const directoryFor = skill => filePath(overrides[skill.name] || skill.directory);
const isAvailable = skill => !(process.platform !== 'win32' && path.win32.isAbsolute(directoryFor(skill)) && !path.isAbsolute(directoryFor(skill))) && fs.existsSync(path.join(directoryFor(skill), 'SKILL.md'));
function check(skill, outputContent = false) {
  const directory = directoryFor(skill);
  const available = isAvailable(skill);
  const results = [];
  for (const entry of skill.resources) {
    const target = path.join(directory, entry.path);
    if (!available || !fs.existsSync(target)) { results.push({path:entry.path, result:'missing'}); continue; }
    const bytes = fs.readFileSync(target);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    results.push({path:entry.path, result:actual===entry.sha256?'pass':'changed', sha256:actual});
  }
  if (outputContent) {
    console.log(`SKILL ${skill.name}\nPATH ${directory}\nSTATUS ${available ? skill.status : 'missing on this host; configure .forma-local/skills-paths.json'}\n`);
    if (available) console.log(fs.readFileSync(path.join(directory,'SKILL.md'),'utf8'));
    console.log('\nRESOURCES (read needed files explicitly; scripts are never executed):\n'+JSON.stringify(results,null,2));
    if(skill.knownMissing.length) console.log('KNOWN MISSING: '+skill.knownMissing.join(', '));
  }
  return {name:skill.name,available,resources:results.length,passed:available && results.every(r=>r.result==='pass'),knownMissing:skill.knownMissing,results};
}
if (action === 'list') {
  const role = team.roles.find(r=>r.id===arg || r.number===arg);
  if (arg && !role) throw Error('Unknown role');
  const selected = role ? registry.skills.filter(s=>role.skills.includes(s.name)) : registry.skills;
  console.log(JSON.stringify(selected.map(s=>({name:s.name,path:path.join(directoryFor(s),'SKILL.md'),available:isAvailable(s),status:isAvailable(s)?s.status:'missing on this host; configure .forma-local/skills-paths.json',when:s.when,knownMissing:s.knownMissing})),null,2));
} else if (action === 'read') {
  const skill = registry.skills.find(s=>s.name===arg);
  if (!skill) throw Error('Unregistered skill');
  const result=check(skill,true); if(!result.passed)process.exitCode=1;
} else if (action === 'verify') {
  const results=registry.skills.map(s=>check(s));
  const output={date:new Date().toISOString(),method:'actual file reads and SHA256 comparison, no model invocation',results};
  const target=path.join(root,'.forma-local/runtime/skills-validation.json');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({skills:results.length,readable:results.filter(r=>r.passed).length,resources:results.reduce((n,r)=>n+r.resources,0),knownMissing:results.filter(r=>r.knownMissing.length).map(r=>({name:r.name,missing:r.knownMissing})),report:target},null,2));
  if(results.some(r=>!r.passed))process.exitCode=1;
} else throw Error('Usage: node scripts/forma-skills.cjs list [role] | read <skill> | verify');
