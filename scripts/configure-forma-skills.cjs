// One-time registry generation. Reuses existing skills; never edits their contents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const rel='docs/collaboration/skills';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const write=(p,t)=>{const target=path.join(root,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,t.endsWith('\n')?t:t+'\n');};
const source='C:/Users/devin/AppData/Local/Temp/forma-team-skills-download/team-composition-patterns';
const dest=path.join(root,rel,'vendor/team-composition-patterns');
const expected={'SKILL.md':'fc9ae1c523630d9ac00c692d17c0a101c0523d85','references/agent-type-selection.md':'05ca6e0fed956757c60b6fc59c67df3d0e5710bd','references/preset-teams.md':'39cbe0053f4eb8fbfd8c289c4e790e1f2ccd4a30'};
for(const [p,hash]of Object.entries(expected)){const b=fs.readFileSync(path.join(source,p));if(blob(b)!==hash)throw Error('Source differs: '+p);const target=path.join(dest,p);if(fs.existsSync(target)&&!fs.readFileSync(target).equals(b))throw Error('Refuse overwrite: '+p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);}
const usages={
 'team-composition-patterns':'拆分有依赖的跨岗位任务、选按需人数与边界；不是安装Agent Teams运行时，不启动全员。',
 'agent-development':'编写/审查员工触发场景、第二人称职责、流程/输出/质量和Claude适配；本机变体上游差异保留。',
 'handoff':'阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。',
 'find-skills':'存在明确能力缺口时查来源/版本/许可，不凭下载数当质量结论；本轮不额外搜索或安装无关技能。',
 'improve-codebase-architecture':'以后正式架构探索任务才执行完整流程；本次只读取要求并转录已存在四候选，不重复启动子代理。',
 'codebase-design':'以后定义模块外部接口、隐藏调用顺序/不变量、deletion test；本次不设计或实施新接口。',
 'domain-modeling':'产品流程和术语有歧义时用场景定义；只有真正改概念才维护词汇，不把技术状态写成产品事实。',
 'frontend-design':'已派发页面任务的视觉/交互选择；Forma现有design-system优先，不另造品牌或字体体系。',
 'vercel-react-best-practices':'前端方案、React交付与独立审查；仅采用适配Vite React的条目，不引入Next.js/RSC。',
 'i18n-expert':'中英字符串、错误、焦点标签、日期/数字格式核对；当前是内联双语，JSON审计脚本不能直接证明完整覆盖，不自动安装i18next。',
 'security-review':'会话/账户隔离/上传/服务端AI与审查；按Express/SQLite适配，不引入Supabase/支付，不自动npm audit fix。',
 'tdd':'后端正式实现时在已确认外部接口按一条失败行为→最小实现逐步验证；使用node:test，不在配置阶段写产品测试。'
};
const definitions=[
 ['agent-development','C:/Users/devin/Desktop/Skills/agent-development','本机Desktop Skills；声明来源anthropics/claude-code/plugins/plugin-dev/skills/agent-development，但正文与当前上游blob不同','0.1.0（本机变体）','未附独立许可；当前anthropics/claude-code根LICENSE.md为Anthropic商业条款，不能假定MIT；仅引用现有本机副本',['scripts/test-agent-trigger.sh']],
 ['team-composition-patterns',`${rel}/vendor/team-composition-patterns`,'wshobson/agents/plugins/agent-teams/skills/team-composition-patterns；三文件Git blob与上游目录核对一致','1.0.2','MIT（已核对上游并附LICENSE）',[]],
 ...['find-skills','handoff','improve-codebase-architecture','codebase-design','domain-modeling','frontend-design','security-review','tdd'].map(n=>[n,`D:/AI-tools/skills/_shared/${n}`,'本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验','未锁定commit；以本清单SHA256快照标识',n==='frontend-design'?'本机LICENSE.txt：Apache License 2.0；未据此宣称上游已核对':'本机未附独立LICENSE；待核验',[]]),
 ['vercel-react-best-practices','.agents/skills/vercel-react-best-practices','skills-lock.json：vercel-labs/agent-skills，skills/react-best-practices/SKILL.md','1.0.0；锁文件computedHash=6b526d013e28073246a36f99b529bc43745d30832ecfa8217b359c34f260ca6b','SKILL声明MIT；本机没有独立LICENSE，待上游复核',[]],
 ['i18n-expert','.agents/skills/i18n-expert','skills-lock.json：daymade/claude-code-skills/i18n-expert','锁文件computedHash=3d059508e0c60ae95c34b83fb8aabc19a6edeb8a778ffa8bdeeacd102fdd1179','本机未附独立LICENSE；待上游复核',[]]
];
function walk(dir,prefix=''){let entries=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const relPath=path.posix.join(prefix,ent.name),full=path.join(dir,ent.name);if(ent.isSymbolicLink())throw Error('Unexpected link: '+full);if(ent.isDirectory())entries.push(...walk(full,relPath));else {const b=fs.readFileSync(full);entries.push({path:relPath,bytes:b.length,sha256:sha(b),gitBlob:blob(b)});}}return entries;}
const skills=definitions.map(([name,directory,source,version,license,knownMissing])=>({name,directory,source,version,license,knownMissing,when:usages[name],status:'可读取；已配置显式读取入口；未验证工具原生加载',resources:walk(path.resolve(root,directory))}));
const registry={date:'2026-10-21',method:'single shared body per registered skill; no user-level links changed; content snapshots only',skills};
write(`${rel}/registry.json`,JSON.stringify(registry,null,2));
const team=JSON.parse(fs.readFileSync(path.join(root,'docs/collaboration/team-config.json'),'utf8'));
const rows=team.roles.flatMap(r=>r.skills.map(n=>{const s=skills.find(x=>x.name===n);return `| ${r.number} ${r.id} | ${s.name} | ${s.source.replaceAll('|','/')} | ${s.version} | ${path.resolve(root,s.directory)} | ${s.when} | scripts/forma-skills.cjs read ${s.name} | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | ${s.knownMissing.length?'可读取（已知缺失实用脚本）':'可读取；显式入口已配置'} |`;}));
write('docs/collaboration/SKILLS-MATRIX.md',`# Forma Skills矩阵\n\n2026-10-21。项目留C盘；复用D盘既有共享库，不迁移全机技能。没有改用户级C→D Junction；没有为每位员工重复下载一套。\.agents与.claude的既有项目技能不覆盖。\n\n## 真实状态定义\n\n- 缺失：要求的技能/资源不存在。已下载：只有文件。可读取：实际能读取。已安装：工具发现入口或显式读取入口已配置；必须说明是哪一种。已验证加载：真实工具会话有读取/触发证据，本轮没有这种原生触发证据。\n- 本轮采用可验证的显式读取：\`node scripts/forma-skills.cjs list <角色ID>\`后\`node scripts/forma-skills.cjs read <技能名>\`。它读取SKILL.md、逐文件核对已登记资源哈希，不执行第三方脚本、不调用模型。真正使用技能时员工还须阅读相关资源正文，文件检查不能冒充模型已经理解。\n- registry.json逐文件记录SHA256/Git blob，固定本机内容快照，不能把内容hash伪称仓库commit。版本未知/许可未知明确保留，不宣称所有条目来源已认证。\n\n| 员工 | 技能 | 来源 | 版本/commit | 真实路径 | 使用时机 | 加载方式 | 验证方式 | 状态 |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## 许可证、资源与限制\n\n${skills.map(s=>`- **${s.name}**：${s.license}。登记${s.resources.length}个资源文件。${s.knownMissing.length?'SKILL引用但本机缺失：'+s.knownMissing.join(', ')+'；禁止声称完整或触发验证通过。':''}`).join('\n')}\n\nagent-development的Desktop与旧Temp同名版本先保留，没有用当前上游版本覆盖；本机SKILL Git blob为f4ea78d89bcee2febcce2285d9d41b3d17df3656，核对时当前上游36830932de4299c639d256b875e1163f3c8580ae；因此标为本机变体。另一个validate-agent.sh的旧example警告逻辑与当前正文不同，Windows本轮不执行其Bash脚本；项目验证器只验证生成配置结构，不谎称官方脚本已运行。\n\nteam-composition完整保留3个源文件与两份references，并另附上游LICENSE；Related Skills中的兄弟技能是可选关联，不表示本次安装了Agent Teams插件。\n\nD盘_shared/frontend-design与D盘顶层frontend-design同名目录并存，选择_shared并记录哈希，不覆盖另一版本。现有HealthKit/SwiftUI技能不分配给活跃员工、不删除；它们不代表Web已实现iOS。\n\nCLI实查Claude Code2.1.293，--agent/--agents/--tools支持已核对；未启动模型会话。Codex CLI不在当前PATH，Codex应用会话仍可显式读取MD；Dot文件连接未知。所有Claude原生触发与跨工具自动派工均未验证。\n\n来源核对URL：\n- https://github.com/wshobson/agents/tree/main/plugins/agent-teams/skills/team-composition-patterns\n- https://github.com/wshobson/agents/blob/main/LICENSE\n- https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/agent-development\n- https://github.com/anthropics/claude-code/blob/main/LICENSE.md\n\n来源/许可缺口由SKILL-PROVENANCE-01跟进；不得因技能例子变更框架、数据库、预算或安全约束。\n`);
console.log(JSON.stringify({skills:skills.length,resources:skills.reduce((n,s)=>n+s.resources.length,0),copiedTeamSourceFiles:3,userConfigChanged:false,knownMissing:skills.filter(s=>s.knownMissing.length).map(s=>({name:s.name,missing:s.knownMissing}))}));
