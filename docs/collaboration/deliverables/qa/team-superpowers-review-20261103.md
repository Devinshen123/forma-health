# TEAM-SUPERPOWERS-REVIEW-20261103 独立审查

审查者：本次新专项06，Codex子会话 `/root/team_config_independent`；独立于01实现者。本报告不是Claude审查，不接管旧06记忆或状态。日期：2026-11-03，America/Los_Angeles。

实际checkout：`D:/Forma/worktrees/qa-team-superpowers-20261103`，detached HEAD。实施分支为 `codex/team-superpowers-20261103`，本审查员未push或merge。

- BASE：`70170640b74c9067291eb2195aef17ca4a6a9fb3`。
- 首轮HEAD：`79a7ffa9d3039ecaa32b0593bdac41bbe8070fab`。
- 最终复验HEAD：`7e56e950a842b0b7fe9b033cea3017ce5a79f112`。
- 审查范围：完整BASE至最终HEAD，50个文件；另检查首轮至修复HEAD的两文件差异。没有用HEAD~1缩小范围。
- 依据：本checkout及主源码的AGENTS/FORMA/唯一TASKS、`skills/SUPERPOWERS.md`、`deliverables/lead/team-superpowers-20261103/plan.md`和本次具名派工。仅配置审查，不执行业务实现或其他任务。

## 双结论

- **需求符合性：通过，绑定最终HEAD。** 七ID/编号/协调关系和原旧技能保留；他人记忆及业务树不变；首次只读与日常正式任务区分明确。发现F1已由01修复并经本人复验关闭。
- **代码质量与安全：通过，限定本批配置。** 固定资源及换行策略、读取失败关闭、相对路径生成、host映射拒绝非法输入和生成确定性已独立验证。没有安装、自动部署、自动启动员工或执行上游脚本的新增行为。
- **候选具备本任务配置分支上传条件。** 01还须按AGENTS再次核实远端，精确集成本报告及必要收尾元数据；若改变配置/实现内容，须复验相应新差异。只允许上传本配置分支，不合并main、不重启网站。报告提交本身不代替远端推送结果。

## 发现、原失败及复验

### F1，P2：01共享契约权限与本职任务冲突，已关闭

位置：首轮 `docs/collaboration/agent-prompts/01-codex-lead.md:45`，对应该文件:9/:43、FORMA §5及TASKS中的CONTRACT任务。

复现：按01唯一权威MD接续已正式派发的契约任务；通用权限段仍将“共享契约”绝对列为只读，并要求接口变化向01请求。预期：01在TASKS本人精确授权内维护契约，其他角色向01请求；实际：01本职也会被此段阻断或要求向自己再次请求。

修复owner：01。首轮具名交回01，没有由审查员修改实现。01在 `7e56e95` 改为01专用授权措辞，保留未派发路径/他人记忆只读及旧owner交接冻结，并增加验证器一致性断言。本人逐行复核修复差异、重新运行Windows/portable及独立scope/生成检查，均通过；F1关闭，无未关闭阻断发现。

### E1：独立checkout缺两项既有被忽略技能，环境失败保留

首轮未配置host映射时：`node scripts/verify-forma-team.cjs` exit1，17/18；`node scripts/forma-skills.cjs verify` exit1，23/25。缺失的是checkout中的 `.agents/skills/vercel-react-best-practices` 和 `.agents/skills/i18n-expert`，合计77个资源；13项Superpowers读取全部exit0。这不是上述两项旧技能已安装到新checkout的证据，也未直接归因为新增资源回归。

01修复提交同时让配置验证器遵循读取器的host映射。本审查员只在自身忽略目录 `.forma-local/skills-paths.json` 将这两项映射到 `D:/Forma/source/.agents/skills/` 下已有对应目录；没有安装或复制技能，没有修改共享库。映射后最终Windows18/18、25技能160资源verify通过。保留原失败日志，不以最终通过抹去它。

`agent-development`既有 `scripts/test-agent-trigger.sh` 缺失警告仍保留。25/25表示注册资源校验通过，不表示该未注册缺失脚本存在或完整原生触发已验证。

## 本人实际命令与证据

执行者均为本报告Codex审查员，实际cwd为上述独立checkout。Node进程TEMP/TMP=`D:/Forma/cache/tmp`，npm缓存环境为`D:/Forma/cache/npm`；没有运行npm安装、业务构建、业务全套测试、CI或真实服务。

日志根：`.forma-local/team-superpowers-review/`，首轮日志和`commands.json`保留原SHA结果；`final/`保存最终SHA的36条CLI完整命令/退出码/输出、独立检查脚本与结果、反例结果及六MD备份差异。日志和本机路径映射不提交。脚本生成的team-validation内部既有executor字段固定为01，不代表实际执行者；本报告以本次工具执行及独立日志记录真实执行者。

| 实际命令 | 首轮 | 最终复验结果 |
|---|---|---|
| `node --test tests/forma-team-config.test.cjs` | exit0，8/8 | exit0，8/8，fail/skip0 |
| `node scripts/verify-forma-team.cjs` | exit1，17/18，见E1 | 映射后exit0，18/18 |
| `node scripts/verify-forma-team.cjs --portable` | exit0，18/18 | exit0，18/18；保留外置技能未认证警告 |
| `node scripts/forma-skills.cjs verify` | exit1，23/25 | 映射后exit0，25/25、160资源 |
| `node scripts/forma-skills.cjs list <ID>` | 七项各exit0 | dot、lead、claude-lead、product、frontend、backend、qa逐项exit0 |
| `node scripts/forma-skills.cjs read <注册名>` | 13项Superpowers各exit0 | 25项全部逐项exit0；注册名见下文 |
| `node .forma-local/team-superpowers-review/final/independent-checks.cjs` | 对应首轮脚本exit0 | exit0，6组独立检查通过 |
| `git diff --check 70170640b74c9067291eb2195aef17ca4a6a9fb3 7e56e950a842b0b7fe9b033cea3017ce5a79f112` | — | exit0 |
| `git ls-remote origin refs/heads/main refs/heads/codex/team-superpowers-20261103` | exit0 | exit0，main仍为BASE，配置ref尚不存在；22:32 PST复核 |

实际read注册名：旧项 `agent-development`、`team-composition-patterns`、`find-skills`、`handoff`、`improve-codebase-architecture`、`codebase-design`、`domain-modeling`、`frontend-design`、`security-review`、`tdd`、`vercel-react-best-practices`、`i18n-expert`；新项为 `superpowers:` 前缀加 `using-superpowers`、`verification-before-completion`、`brainstorming`、`writing-plans`、`executing-plans`、`systematic-debugging`、`test-driven-development`、`requesting-code-review`、`receiving-code-review`、`dispatching-parallel-agents`、`using-git-worktrees`、`subagent-driven-development`、`finishing-a-development-branch`。

独立脚本的6组检查没有依赖实现者“通过”摘要：

1. 从BASE的team-config读取旧值，逐角色断言除新增skills外全部原字段相等，所有旧分配仍存在；精确00–06七身份不变。
2. BASE原12项registry对象与最终项逐值深比较相同；旧资源继续原始字节hash，没有一并改为LF。
3. 枚举完整50文件差异，断言src/server/ios/vendor/public/data、package.json/package-lock.json及他人员工memory/status无差异。
4. 本机上游git HEAD真实为 `22f0b463e7a5e579904dd6211a520321035526f7`，plugin版本7.0.2；通过 `git ls-tree` 和 `git show <pin>:skills/...` 枚举并读取13技能完整50资源，与registry及本机文件的LF规范化SHA256逐一相等；上游working tree干净。
5. 在本人`.forma-local/.../generator-check`合成目录复制实际生成器/config/编号MD，其余前置文件用合成占位；执行 `node scripts/prepare-forma-chat-prompts.cjs` 两次各exit0，逐一比较15份输出与最终HEAD内容（仅规范化checkout换行），第二轮字节完全相等。不在候选tracked文件上重写生成结果，不启动对话。
6. 检查44份变更Markdown中的139个相对本地链接目标，均存在。

补充独立反例：在本人忽略映射文件临时分别设置相对路径和未知注册名，逐一运行Windows验证器、portable验证器、`forma-skills.cjs list`，6次均预期exit1，断言具体映射拒绝错误，finally恢复有效映射；随后有效映射正常复验通过。另在本人合成目录使用实际读取器，保持SKILL正确但篡改引用资源，执行read/verify均预期exit1，read stdout为空且不输出正文。现有8项测试还实际覆盖LF/CRLF等价、旧raw-byte拒绝换行变化、正文hash变化、缺引用资源、非法hash模式及生成确定性；未弱化断言。

## 完整范围与原改动保留

50文件分组核对：AGENTS/FORMA/CLAUDE三入口；TEAM-ROSTER/SKILLS-MATRIX/START-PROMPTS/TASKS四共享文档；七编号MD、七current、七launch、七新增resume；三Claude薄适配；registry/team-config；Superpowers适配和两模板；01计划/本人status/HANDOFF；三配置脚本及一CLI测试。生成输出已全量逐文件比对，非只抽一个角色。

备份 `D:/Forma/backups/team-superpowers-20261103-before/manifest.json` 的六MD逐文件SHA256与备份原文件全部相等；将各备份与候选逐项diff，原先Git同步规则正文保留，仅在TASKS、lead HANDOFF、lead status把三处旧“当前本地”标题改为已纳入本轮的阶段标题，并添加新配置内容。根同步顺序、保留dirty/原写者、上传前二次远端核对和不得扩大业务授权等要求均仍存在。上述六文件完整包含于本次BASE范围。

## 未验证与交付边界

- 未做Mac/Linux实机、Claude Code/Codex/Dot原生自动触发、模型会话实际使用或七员工接手；portable和CLI读取不证明这些通过。Mac需在其实际checkout映射本机已有技能并验证。
- 本次没有运行业务build/npm test/CI/浏览器或真机，因为业务树和依赖完全未改，具名派工仅允许内置Node配置检查。本结论不是业务、iOS、生产或真实收费验收。
- 未下载/安装/更新上游、修改全局配置、申请凭据、重启网站、读取真实健康数据或私有env；未启动其他员工、第二lead或操作视频会话。
- 当前仅本地候选独审通过。审查员仅写本报告及忽略证据；01后续上传结果须由01实际核实并报告，不在此预写“GitHub已更新”。
