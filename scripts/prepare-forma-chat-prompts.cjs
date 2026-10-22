// Prepare user-copyable conversation prompts. Does not create chats or launch agents.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'docs/collaboration';
const team = JSON.parse(fs.readFileSync(path.join(root, base, 'team-config.json'), 'utf8'));
const output = path.join(root, base, 'agent-prompts', 'launch');
fs.mkdirSync(output, { recursive: true });
const details = {
 dot: {
  platform: '现有Dot（羊羊）对话',
  work: '你是用户讨论需求、确定优先级和了解进度的主要入口。你汇总01、02的任务、交付、风险、阻塞和06审查结论；记录已确认方向与待决定事项。工程任务由主管协调，再由01登记唯一任务板。',
  limit: '你不要越过主管冲突派工。仓库、CLI、持续监控或自动提醒没有实测连接就写未接通。不能读取本机文件时，请用户或主管提供具名MD和摘要，不虚构读取，也不把桌面路径当网页可访问地址。',
  focus: '确认需求来源、已确认目标、两主管汇报入口、你实际能访问的文件与工具。'
 },
 lead: {
  platform: '现有Codex主管对话优先；不要同时启动第二名lead写入者',
  work: '你负责总体架构、共享类型、API契约、依赖和最终集成；协调03产品和05后端，接收02的任务与契约请求。正式TASKS与所有权表只有你写，每个任务只有一个owner。',
  limit: '你不能用自检替代06独立审查；不日常代写其他员工记忆。当前已有01会话时，新对话只能只读候选接手，必须明确交接后才能写入。Git权限不足不绕过，也不将原有未提交删除顺便提交。',
  focus: '核对当前lead写入者、唯一任务板、其他员工的接手依赖和配置未提交状态；不因看到架构候选而开工重构。'
 },
 'claude-lead': {
  platform: 'Claude Code独立对话',
  work: '你负责组织04前端交付、落实03体验验收，并安排06独立审查。你也要拆依赖、检查证据、处理阻塞，向Dot及用户汇报；自己的调度文件只引用正式任务ID。',
  limit: '你不写正式TASKS、共享API/类型或依赖。任务、契约或集成变化向01提请求，不重复派发同一任务；不得要求06降低标准。本次不要调用Agent工具生成更多员工。',
  focus: '确认与01的请求方式、04交付输入、06独立候选提交审查要求，以及本人工作目录和调度范围。'
 },
 product: {
  platform: 'Codex独立对话',
  work: '你将用户目标写成流程、范围、优先级建议和可观察验收标准，承担必要需求研究与产品澄清。区分现有能力、目标行为、未知和待用户决定；体验要求交02/04，领域行为交01/05。',
  limit: '你不替用户决定预算、市场、供应商或法律事项；不写产品代码、共享契约或正式TASKS。不要把旧评审建议当已确认产品规则。',
  focus: '确认产品文档可写范围、验收格式、当前Web范围及四架构候选的产品定义依赖；首轮不提前产出新功能规格。'
 },
 frontend: {
  platform: 'Claude Code独立对话',
  work: '你负责页面、交互、样式、手机适配和中英双语，遵循现有设计系统。页面展示事实、收集用户意图和呈现审核结果；覆盖空、加载、错误、键盘焦点和未保存输入。',
  limit: '你不改后端、共享类型/API、sync引擎或营养计算，不在多个页面重复领域规则。保持Vite/React，不能因技能里的例子切换Next.js。只在02协调且01登记的正式任务中实施。',
  focus: '确认实际前端路径、设计系统、03验收输入、共享契约和02协调入口；缺独立checkout则记录开发blocked。'
 },
 backend: {
  platform: 'Codex独立对话',
  work: '你负责API、会话、SQLite存储、私有上传、账户隔离与服务端AI。旧Rules交接完成后，你承担确定性营养计算、换算、缺失值、建议证据、接受/撤销和追加版本。服务端负责权威校验。',
  limit: '共享契约变化先交01；server/rules、src/training和旧owner路径交接未确认前不得修改。保留CAS、稳定mutationId、receipt、原子保存和历史事实；不信任客户端总量，不让AI承担计算或授权。',
  focus: '核对server与storage范围、领域路径交接冻结、01契约依赖、现有node:test测试方式及合成数据验证边界。'
 },
 qa: {
  platform: 'Claude Code独立对话，与实现者分开',
  work: '你独立审查需求符合性、代码、测试、安全和回归。验证包含真实修改的候选SHA，报告证据、严重度、复现、预期/实际及验收方式；你可直接向01、02及Dot报告问题。',
  limit: '只改自己拥有的tests与报告；产品代码缺陷交原负责人修复。不把历史155项测试或他人自检当本人实测，未执行标未验证，不为排期降低标准。首轮没有候选提交时不伪造审查通过。',
  focus: '确认独立会话/checkout、候选SHA要求、测试和报告权限、修复/复验流程；当前只确认身份与条件。'
 }
};
const absolute = rel => path.join(root, ...rel.split('/'));
const files = [];
for (const r of team.roles) {
 const d = details[r.id];
 // Read the canonical employee file before producing a startup adapter.
 const canonical = fs.readFileSync(absolute(r.md), 'utf8');
 if (!canonical.includes(r.number+'｜') || !canonical.includes('`'+r.id+'`')) throw Error('Identity mismatch: '+r.id);
 const required = ['FORMA.md', base+'/TASKS.md', base+'/TEAM-ROSTER.md', r.md, r.current, r.memory+'/PROFILE.md', r.memory+'/MEMORY.md', r.memory+'/HANDOFF.md', r.status, base+'/SKILLS-MATRIX.md'];
 for (const p of required) if (!fs.existsSync(absolute(p))) throw Error('Missing startup file: '+p);
 const prompt = `你是Forma员工${r.number}｜${r.name}，固定角色ID=${r.id}。工具或模型改变不改变你的身份，同一身份同时只允许一个记忆写入者。

项目主目录：${root}
建议对话标题：Forma ${r.number}｜${r.name}
使用位置：${d.platform}。

你的职责：${d.work}
你的边界：${d.limit}

先按以下顺序显式读取文件，文件名只是入口，不表示你已加载：
${required.map((p,i)=>(i+1)+'. '+absolute(p)).join('\n')}
再查看${absolute(base+'/requests')}中发给${r.id}的相关请求。

本轮任务是ONBOARD-${r.number}的只读身份确认阶段，使用最新用户要求：现在建立对话并确认配置，不开始业务开发。${d.focus}
你可以从主目录只读核对新配置，即使它尚未提交；这不等于自己的worktree已经同步。已有本人独立checkout时，先核对其中的规则版本与Git状态，未同步或有冲突就报告blocked，不跨目录复制或覆盖。没有独立checkout时先完成能做的只读检查，工程写入保持blocked；不要自行创建worktree绕过权限。

有本机工具时，只执行只读核对：Get-Location、git status --short --branch、git log -1 --oneline、git worktree list。通过node scripts/forma-skills.cjs list ${r.id}定位技能；相关时再用node scripts/forma-skills.cjs read <技能名>读取SKILL与本次需要的资源。必须在实际项目目录执行，不能假装缺失的命令运行过。
分配给你的Skills：${r.skills.join('、')}。本轮不要求一次加载所有技能；保留每项真实状态，区分文件可读、显式读取入口、工具原生触发和实际使用。

你的长期记忆仅属于${absolute(r.memory)}，状态文件是${absolute(r.status)}。正常工作按FORMA更新本人文件；本次只读阶段先把结果发在本对话，不修改文件、不暂存或提交Git、不安装依赖、不启动其他员工。不得操作正式健康数据、部署或创建付费资源。

首次回复请使用：
1. 身份确认：编号、ID、工具、主管/汇报关系。
2. 已实际读取：列出文件；无法读取的单独列出，不写成已加载。
3. 工作区事实：实际目录、分支、SHA、未提交内容；未知如实说明。
4. 职责与边界：用自己的话说明你负责什么，哪些请求交主管。
5. Skills：真实路径、已读/未读、缺失资源、原生加载是否验证。
6. 已知、未知、阻塞和下一步。
回复后等待明确任务，不自动开始四项架构候选。`;
 const filename=r.slug+'.prompt.md';
 fs.writeFileSync(path.join(output,filename),`# Forma ${r.number}｜${r.name} · 新对话Prompt\n\n本文件是启动适配，唯一职责定义仍是${r.md}。2026-10-21用户要求逐人生成Prompt，首轮只读登记，不代表对话已由系统创建。\n\n\`\`\`text\n${prompt}\n\`\`\`\n`);
 files.push({number:r.number,id:r.id,title:`Forma ${r.number}｜${r.name}`,platform:d.platform,file:base+'/agent-prompts/launch/'+filename,prompt});
}
const old=path.join(root,base,'START-PROMPTS.md');
const oldCopy=path.join(root,base,'archive/20261021-chat-launch/START-PROMPTS-before-readonly.md');
if (!fs.existsSync(oldCopy)) {fs.mkdirSync(path.dirname(oldCopy),{recursive:true});fs.copyFileSync(old,oldCopy);}
const table=files.map(f=>`| ${f.number} | ${f.title} | ${f.platform} | [${path.basename(f.file)}](agent-prompts/launch/${path.basename(f.file)}) |`).join('\n');
fs.writeFileSync(old,`# Forma 每人独立新对话Prompt

2026-10-21。当前主目录保留${root}。现在按用户要求准备对话，首轮是只读身份确认：可以读取主目录中尚未提交的新配置，未建立独立worktree或未同步不等于不能读文件；只把工程写入标blocked。不能声称已创建对话、启动会话或配置了自动通信。

| 编号 | 对话标题 | 打开位置 | 完整可复制Prompt |
|---|---|---|---|
${table}

每个文件里的text代码块可完整复制。七份启动适配都指向唯一员工MD，不在这里维护第二套职责。01优先沿用当前主管对话；只有确认原lead停止写入并明确交接后，才由新对话接管。

00使用已有Dot（羊羊）；普通Claude网页对话不等于具备本机文件访问的Claude Code。02/04/06在能访问本项目的Claude Code独立对话使用，原生入口与具体工具权限仍需实测，不能把配置文件存在当成已加载。03/05使用Codex项目独立对话；所有会话首轮只读，之后工程写入需确认自己的checkout和唯一writer。

${files.map(f=>`## ${f.title}\n\n\`\`\`text\n${f.prompt}\n\`\`\`\n`).join('\n')}
`);
console.log(JSON.stringify({roles:files.length,files:files.map(({prompt,...f})=>f),conversationsCreated:0,employeesStarted:0},null,2));
