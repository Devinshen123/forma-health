# Forma的Superpowers适配

2026-11-03。用户已批准在现有七身份中采用Superpowers流程；本文件是FORMA共享协作规则的技能适配，不是额外任务板或权限表。来源为obra/superpowers，MIT，7.0.2，固定提交22f0b463e7a5e579904dd6211a520321035526f7。

## 加载与来源

- 先读实际checkout的AGENTS、FORMA和TASKS，再检查本人可用技能。所有员工使用显式入口 `node scripts/forma-skills.cjs list <角色ID>`；需要时 `node scripts/forma-skills.cjs read superpowers:<技能名>`，继续读取输出列出的相关资源。
- 新技能注册名带superpowers:，保留旧技能名；流程以本适配及固定Superpowers来源为准，旧tdd等仅作补充，不重复执行两套流程。
- Windows共享副本为D:/AI-tools/skills/superpowers/skills。只读引用，不自动更新或安装。registry记录来源、版本与资源SHA；Superpowers文本按LF规范化后验证，避免Mac/Linux与Windows仅换行不同就误报内容变化。其他旧资源仍按原始字节校验。
- Mac先核实已获准的本机副本，再在Git忽略的 `.forma-local/skills-paths.json` 为注册名映射绝对目录，例如 `{"superpowers:using-superpowers":"/实际位置/superpowers/skills/using-superpowers"}`。其他所需技能分别映射；不得把Windows D盘路径称为Mac已安装。
- 文件存在只表示可用；read与hash通过只证明显式读取可验证。只有具体工具会话真实触发证据才能标“原生自动加载已验证”。当前不改用户级Codex配置、Claude插件或hooks，不自动声明任何工具原生触发成功。

## 触发顺序

首次接手且没有已授权执行任务时仅做ONBOARD只读核验；已有身份收到明确正式任务后按范围执行，不重复冻结。新会话仍须确认原写者交接。启动文本分别在agent-prompts/launch（首次）和agent-prompts/resume（日常），都不自动创建会话。

1. 所有人开始任务先读取 `superpowers:using-superpowers` 并按实际工具适配；被明确派发具体任务的子代理按其SUBAGENT-STOP执行，不重复启动主管流程。
2. 需求/行为尚不清楚时03及相关主管使用brainstorming；项目或用户已决定的问题不重复询问。用户明确批准的方案直接进入计划，不另设重复审批。
3. 多步骤任务由主管用writing-plans列基线、唯一owner、精确文件、接口、依赖、验证命令、预期和审查重点。计划放docs/collaboration/deliverables/<本人>/，引用TASKS ID；不再建第二块正式任务状态板。
4. Bug/测试失败先systematic-debugging：保存错误、原始失败及环境，复现并调查根因，再用单一假设最小修改。不能用放宽断言、增加超时或另一环境通过代替原问题验证；确需修正测试时提供原断言错误的证据。
5. 正式新增行为/修复采用test-driven-development，先看到正确原因的失败，再最小实现、回归。使用现有node:test或XCTest，不因技能例子换框架。纯文档/低影响可逆配置不写镜像实现的测试，做相应结构/链接/生成检查；配置工具新增真实行为时验证其行为。不得照搬“删除先写代码”的示例删除已有或他人改动。
6. 实施者用receiving-code-review逐项核实反馈，修正后复验；不盲从、不通过扩大范围掩盖问题。verification-before-completion要求结论对应本轮、同一版本的实际命令/退出码/结果；未测明确标注，不把静态检查称为浏览器/真机验收。

## 分工与审查

- 01维护唯一TASKS和最终集成，02按正式ID协调；00汇总证据，03定义验收，04/05按登记路径实施，06独立审查。编号和角色ID不新增、不复制，不日常代写他人记忆。
- dispatching-parallel-agents只用于确实无共享写入/顺序依赖的工作。每项派工写清BASE、任务、文件、约束、输入/输出、验证、审查者及实际会话ID；已有写者未知就先协调，不再启动同一路径修复。
- subagent-driven-development仅在当前任务授权委派且符合工具限制时采用。固定员工身份不因“fresh agent”而复制；新上下文只是有边界的任务执行或独立审查，不产生第二lead。派发最小必要上下文，不传整段历史或凭据；不得由执行者重复派一个审核员。
- 06分别给出需求符合性、代码质量/安全两个结论；可由同一独立审查者完成，不要求增员。审查包有需求、BASE/HEAD或明确差异、实现者证据、原失败及未验证项；审查者决定必要的独立复验，技能中的节省重复测试建议不能取消本项目独立验证。
- 每项发现含严重度、位置、复现、预期/实际、修复owner及复验条件。原实施者修复，新SHA复验；重大未解决问题不记通过，主管自测/联署/他人摘要不能代替06结论。

## 工具、工作区与交付边界

- 实际工具/平台限制及用户授权优先于技能示例。不要照抄模型名、fork规则、等待时长、自动安装/提权/凭据操作；本工具不支持的参数不得虚构。上下文、模型和等待按实际工具及当前指令执行。
- using-git-worktrees先确认现有checkout、Git common dir、分支、dirty和唯一writer；复用已有正确目录，不自动建重复工作区或复制未提交内容。Windows新产物默认D盘，Mac用本机路径。原生iOS任务须核实原Mac/候选/原实施与审核者，不能自动派给Web前端。
- finishing-a-development-branch及任何技能脚本不能自动推送、合并、删分支/工作区或清理备份。当前任务明确授权且必要时才执行相应动作；审查通过后上传顺序和远端二次核对以AGENTS为准，上传不等于合并main或生产发布。
- 交付包含任务ID、实际checkout/分支、BASE/HEAD、变更文件、测试执行者/命令/结果、独审双结论、未测项及GitHub同步结果。本人HANDOFF保留恢复所需证据与既有改动，已完成任务不重复派发。
