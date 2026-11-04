// Deterministic checkout-relative adapters. No chats, agents, models or installs are started.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'docs/collaboration';
const team = JSON.parse(fs.readFileSync(path.join(root,base,'team-config.json'),'utf8'));
const output = path.join(root,base,'agent-prompts','launch');
const resume = path.join(root,base,'agent-prompts','resume');
fs.mkdirSync(output,{recursive:true});
fs.mkdirSync(resume,{recursive:true});
const files = [];
for (const r of team.roles) {
 const canonical = fs.readFileSync(path.join(root,r.md),'utf8');
 if (!canonical.includes(r.number+'｜') || !canonical.includes('`'+r.id+'`')) throw Error('Identity mismatch: '+r.id);
 const required = ['AGENTS.md','FORMA.md',base+'/TASKS.md',base+'/TEAM-ROSTER.md',r.md,r.current,r.memory+'/PROFILE.md',r.memory+'/MEMORY.md',r.memory+'/HANDOFF.md',r.status,base+'/SKILLS-MATRIX.md',base+'/skills/SUPERPOWERS.md'];
 for (const p of required) if (!fs.existsSync(path.join(root,p))) throw Error('Missing startup file: '+p);
 const common = `你是Forma员工${r.number}｜${r.name}，固定角色ID=${r.id}，工具=${r.tool}。同一身份同时只有一个写入者；01优先沿用现有主管，不创建第二lead。

Windows主目录：${team.projectRoot}。Mac使用实际checkout；下列路径全部相对本机仓库根，不要求Mac创建D盘。先核对pwd（Windows可用Get-Location）、分支、HEAD、dirty、worktree及原写者交接，再执行工程动作。

按顺序显式读取：
${required.map((p,i)=>(i+1)+'. '+p).join('\n')}
再读requests中发给${r.id}的具名任务。唯一职责定义是${r.md}，本Prompt不维护第二套职责；正式路径/任务仅由TASKS授权，最新用户范围优先于历史阶段说明。

技能入口：node scripts/forma-skills.cjs list ${r.id}；相关时read注册名及所需资源。已分配：${r.skills.join('、')}。开始任务按SUPERPOWERS适配识别技能，具体派发的子代理遵守SUBAGENT-STOP。缺失或hash变化报告阻塞；只读文件不等于原生自动加载。不得因此安装、改全局工具配置或启动更多员工。

开工前按AGENTS查询对应GitHub分支；相关更新先在保留原改动和唯一writer的前提下安全同步。分叉、dirty归属不明或原写者未知时先协调，不自动stash、reset、clean或切换他人分支。未经审查不先上传，上传不等于合并main。

交付报告：编号/任务ID、实际checkout/分支、BASE/HEAD、改动文件、实际执行者/命令/退出码/结果、原失败及未测项、独审需求符合性与质量安全两项结论、GitHub同步状态。本人memory/status由本人维护，不代写其他员工记忆；不读取或上传真实健康数据/密钥，不部署或创建付费资源。`;
 const first = `${common}

模式：首次接手ONBOARD-${r.number}，且没有已授权执行任务时只读。可以读取主目录尚未提交的新配置；这不表示自己的工作区已同步。缺独立checkout时先做能做的读取，工程写入保持blocked，不自行建worktree绕过限制。

首次在本对话报告身份、已读/无法读取文件、目录/分支/SHA/dirty、职责、技能真实状态、未知和阻塞。此首次只读阶段不修改、暂存、提交或上传，不启动业务或其他员工；等待明确任务。已有身份获明确执行任务时使用日常接续Prompt，不重复按首轮冻结。`;
 const continuing = `${common}

模式：已有身份日常接续。先确认本人仍是唯一writer、读取最新TASKS和HANDOFF及具体授权。存在明确正式任务就按范围执行，不重新停在首轮ONBOARD；无任务则只报告状态，不自动挑选旧todo。

多步骤任务先读获准计划；Bug先复现查根因，行为修改先正确失败再最小实现。只并行获准且无共享写入的工作；审查发现交原实施者，修复后复验新SHA。06独立审查，不能以实现者自测或提交联署替代。

当前任务的只读/禁推送/禁合并/业务限制保持有效。未核实原Mac或原实施者时不启动重复iOS修复，不操作或重新分配其他项目/视频任务。`;
 const filename = r.slug+'.prompt.md';
 const header = `# Forma ${r.number}｜${r.name}`;
 fs.writeFileSync(path.join(output,filename),`${header} · 首次只读接手\n\n2026-11-03；生成适配器，唯一职责定义为${r.md}。\n\n\`\`\`text\n${first}\n\`\`\`\n`);
 fs.writeFileSync(path.join(resume,filename),`${header} · 日常任务接续\n\n2026-11-03；生成适配器，不能启动重复身份。\n\n\`\`\`text\n${continuing}\n\`\`\`\n`);
 files.push({number:r.number,id:r.id,title:`Forma ${r.number}｜${r.name}`,file:base+'/agent-prompts/launch/'+filename,resume:base+'/agent-prompts/resume/'+filename});
}
const table = files.map(f=>`| ${f.number} | ${f.title} | [首次接手](agent-prompts/launch/${path.basename(f.file)}) | [日常接续](agent-prompts/resume/${path.basename(f.resume)}) |`).join('\n');
fs.writeFileSync(path.join(root,base,'START-PROMPTS.md'),`# Forma员工对话Prompt\n\n2026-11-03。保留00–06七身份。Windows主目录${team.projectRoot}，Mac使用实际checkout，Prompt中的文件均为仓库相对路径。生成命令只写适配文本，不创建对话/启动员工/安装技能。\n\n| 编号 | 身份 | 新会话只读接手 | 已有身份日常任务 |\n|---|---|---|---|\n${table}\n\n复制对应文件的text代码块。01优先复用现有lead；新会话未确认原writer交接前不能接管。首次接手与已有正式任务执行分开，最新用户范围优先。00的Dot连接、Claude Code/Codex原生触发及Mac配置均须实测，不能从文件存在推断。\n\n唯一职责定义见各员工MD，共享流程见[SUPERPOWERS](skills/SUPERPOWERS.md)，任务与路径仅见[TASKS](TASKS.md)。历史启动文本保留在archive，本入口不重复嵌入七份全文。\n`);
console.log(JSON.stringify({roles:files.length,files,conversationsCreated:0,employeesStarted:0},null,2));
