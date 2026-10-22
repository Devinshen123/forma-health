# Forma 本次配置交付与实际检查

## 2026-10-21补充：GitHub候选与Mac接手

用户授权将已做工作同步GitHub供Mac操作。最新状态见TASKS的GITHUB-MAC-01及status/lead；本节更新下方历史限制：本轮Git精确暂存已成功，配置候选拟推送到codex/mac-handoff-20261021，独立审查前不合入远端main。旧index.lock拒绝不再代表当前权限。GitHub API和CLI确认仓库目前PUBLIC，本轮没有修改可见性。

本轮Windows lead实际执行：默认及--portable配置检查各15/15；本机技能12项/110资源哈希一致（保留agent-development缺脚本）；npm.cmd test 155/155；npm.cmd run build通过（既有Training分包提示）；变更脚本语法与git diff --check通过。独立临时目录副本通过portable15项；验证缺技能exit1、覆盖目录正常读取exit0、POSIX路径解释通过。未在Mac实机执行，不等于06审查。

跨机器说明见WORKSPACES的Mac接手；FORMA/START-PROMPTS明确实际checkout替换Windows根路径。reader新增Git忽略的本机Skills目录映射及实际可用状态，--portable不再依赖原电脑的C盘目录和临时报告源文件，使用已登记归档SHA256核对。未打包原有外置技能、原图片删除、凭据或数据；configuration-files.json精确136项包含本轮配置与两项历史记忆ADR依赖。其他员工新请求/草案留在Windows，不冒充已交付。

以下为此前配置交付的历史记录，未做全局改写；后续推送回执记录准确候选SHA。

02的dispatch/HANDOFF/status已有本人更新；候选只保存01初始化骨架，02本人后续正文保持在工作区未提交，未当作01成果上传。精确例外记录在configuration-files.json的indexSnapshots。Mac不能据骨架判断02尚未接手；实际报告需后续由02交付。

暂存导出曾复现Windows换行转换导致的两项检查失败；修正入口CRLF解析并用.gitattributes保留vendor/原报告字节后，最终实际暂存导出portable检查15/15、vendor读取exit0。活动文件cached diff检查通过；历史archive与原报告的既有空白/混合行尾保留，不以清理空白改写证据。

---

2026-10-21；执行者01 lead；实际checkout `C:\Users\devin\健康网站`，分支main；配置前/当前HEAD `e4c6a1b98761e88ceda84b89ae9688343610b2c5`，本轮未提交。最新用户决定取消D盘项目迁移，保留C盘原位置。

## 文件与目录

已生成根FORMA唯一共享手册、Codex/Claude入口、七人员工表、唯一TASKS/所有权、Skills矩阵及逐文件注册表、每人不同职责的编号MD、current薄入口、独立记忆与状态入口、七份可复制启动Prompt、工作目录说明、四项架构候选及分阶段任务、迁移与退休决定。唯一权威职责是编号MD；完整路径见TEAM-ROSTER、WORKSPACES与configuration-files.json。

旧11人名单、共享规则/任务板和被改入口有修改前快照；旧记忆正文完整保留。01仅按本次明确授权一次性更新身份/交接元数据，之后由本人维护。退休rules/ux/research/security/release不再出现在活跃名单；旧任务逐项记录替代/取消，没把它们写成完成。不能据此断言外部旧写入者已停写。

项目没有迁移；C盘原仓库和所有现有worktree原地保留。新建`.forma-local/runtime/`及`deliverables/`，加入Git忽略。02—06的新目录仅预留，没有创建Git worktree或分支。01直接使用主仓库，不创建同分支重复checkout；Dot未建worktree。既有D盘技能库与用户级链接未修改。

## 本轮实测

| 命令/检查 | 结果 | 范围与限制 |
|---|---|---|
| `node scripts/verify-forma-team.cjs` | exit0，15项通过，0失败 | 七个唯一编号/ID、职责结构、current/记忆/状态、三Claude适配器、退休入口、技能注册、报告逐字节、C盘目录、回归规划；已知缺失脚本作为警告 |
| `node scripts/forma-skills.cjs verify` | exit0，12技能、110个已登记资源可读且SHA256一致 | 存在的文件验证通过；agent-development引用的test-agent-trigger.sh仍缺失，不算资源完整 |
| 显式读取小场景 | team-composition-patterns通过 | 实际执行reader并检查人数规划与reference入口；输出在`.forma-local/runtime/team-skill-smoke.txt`；无模型调用，不是原生触发验证 |
| `npm.cmd run build` | exit0，tsc/Vite/offline shell完成 | 1612模块；离线静态壳7文件排除API；既有Training分包大小提示保留，不称性能故障 |
| `git diff --check` | exit0 | 仅LF/CRLF转换提示；不等于独立代码审查 |
| `git check-ignore`本机输出目录 | exit0 | `.forma-local/runtime/...`与`deliverables/...`被忽略 |
| 主仓库与worktree登记 | 可读主仓库，登记12目录 | 其他checkout执行git status被权限拒绝，不能认定干净或无活跃writer |
| `claude.cmd --version` | 2.1.293 | 本机CLI版本，不是模型能力或登录验证 |
| `claude.cmd --help` | 支持--agent、--agents、--tools | 项目适配文件结构按已读skill及官方文档核对；未执行原生发现或模型触发 |
| `claude.cmd agents --json --cwd .` | `[]` | 只针对本查询范围，不能证明所有工具/旧worktree都没有活跃会话 |
| 精确Git暂存单个新ADR | exit1 | `fatal: Unable to create 'C:/Users/devin/健康网站/.git/index.lock': Permission denied`；没有提交、推送、force或同步 |

未修改`server/`、`src/`、依赖与运行配置，所以本轮未运行npm test；旧155/155仅保留历史，不当本轮验证。未做真实浏览器验收、未复验400/409和固定时区场景、未配置真实AI密钥或调用付费服务。

## Skills真实状态

12项均有可读取入口及显式读取方式。8项复用D盘既有共享库，agent-development引用原C盘Desktop副本，i18n/React复用原项目技能，team-composition完整复用本机3个源文件至C盘项目并附MIT许可；没有为七人重复下载。逐项路径、使用时机、版本/hash和许可证见SKILLS-MATRIX及skills/registry.json。

已知缺口：agent-development本机0.1.0变体与当前上游不同，引用的trigger-test脚本缺失；多个既有技能尚缺可追溯上游commit或独立许可证证明。不得声称这些来源全部认证、资源全部完整或原生加载全部验证。

项目级`.claude/agents/`有02/04/06三份薄适配器，合法name、model=inherit、岗位工具和触发描述静态检查通过。Codex和Dot采用显式MD读取，不把Claude YAML当它们的原生配置。Dot仓库读写、CLI调度、监控和提醒均未接通。

官方形式核对：

- [Claude项目级subagent与字段](https://code.claude.com/docs/en/sub-agents)
- [CLAUDE.md的@文件引用](https://code.claude.com/docs/en/memory)

文档支持不等于这台机器的新会话已成功读取；创建新的agents目录后，旧会话的发现状态仍需实际确认。本轮没有启动新会话进行验证。

## 任务、Git与同步

ONBOARD-00至06全部todo，未启动七个员工会话。四架构候选已拆产品/契约/后端/前端/独立审查，B另保留01所属engine任务；全部是后续规划，没有业务实现。首选训练调整，不启用新营养阈值；保留SyncEngine/storage、FoodPhoto、账户隔离和版本历史。

TEAM7-CONFIG-01标blocked：文件与本地检查已完成，提交/同步和运行接手未完成；不写“全部完成”。HANDOVER-01、WORKTREE-SYNC-01受旧writer审计与Git权限阻塞；TOOL-LOAD-01待明确单会话验证时机。技能来源缺口由SKILL-PROVENANCE-01跟进。

本轮未改动既有`.agents/skills`、`.claude/skills`、skills-lock、handoff/predevelopment或其他项目内容；`public/demo-meal.png`原删除保留，未恢复或纳入暂存。没有迁移数据库、上传、.env或凭据，没有自动派工、部署、支付、iOS、HealthKit或聊天教练任务。

## 后续第一步

具备Git元数据写权限的会话先审查configuration-files.json中的精确文件和旧未提交依赖，完成独立配置审查后精确提交；不能git add -A或整目录暂存其他人的技能。再审计各worktree与旧writer、显式同步已审查配置，由员工逐一ONBOARD。需要业务实现时才启动相应候选的正式任务。
