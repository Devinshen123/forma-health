# FORMA / 2026-10-17 真实 Claude Code 三方向任务

用户最新授权要求本轮由实际 Claude Code 执行，协调者不以 Codex 或内部 agent 替代。官方已安装 CLI 2.1.293，沿用当前 Claude 订阅与默认模型，不修改认证、账号、权限设置或开启额外用量。原 Claude 工作区与历史均保留；`agents --all --json` 未找到可寻址会话，因此新建三个命名 session。会话真实性由 CLI init/result 和模型工具调用证明，不由预先生成 UUID 推定。

| 任务 | 实际工作区 / 分支 | 已确认 Claude session |
|---|---|---|
| CF-17 前端旧草稿/确认覆盖复核 | `task-2/forma-record-flows` / `claude/forma-frontend-recheck-20261017` | `bb523eca-ef12-424d-8f35-0b01a1d4d551` |
| CB-17 提交后附件清理的持久重试 | `task-2/forma-review-recovery` / `claude/forma-attachment-retry-20261017` | `a02c2fec-4908-4d91-972a-06c1f05c67c8` |
| CQ-17 缺动作库/类型诊断/运行边界独立审查 | `task-2/forma-health` / `claude/forma-boundary-review-20261017` | `bf755c6b-5bb9-413a-a6f4-63f764629745` |

每个执行区有自身 `docs/collaboration/tasks-20261017-claude-<role>.md`，并在 CLAUDE、AGENTS、TASKS 增补入口，原文保留。任务书直接列出技能名称、准确路径、何时用、先读及缺失处理，不把 Codex 插件路径当作 Claude 注册。本轮用 Read 绝对路径实际读取：

- CF-17：`C:\Users\devin\.claude\skills\playwright\SKILL.md`（真实 DOM/附件生命周期回归），`C:\Users\devin\.claude\skills\security-review\SKILL.md`（账号与附件保留）；实际需要错误展示设计时才读同树 `frontend-design\SKILL.md`。
- CB-17：同树 `backend-patterns\SKILL.md`（Express/SQLite事务与幂等）、`security-review\SKILL.md`（owner/附件边界），以及持久结构设计实施前的 `database-migrations\SKILL.md`（增量兼容/事务/回滚）。三个均有预检读取证据。
- CQ-17：同树 `security-review\SKILL.md` 与 `backend-patterns\SKILL.md` 已读；实际审核持久结构前再读 `database-migrations\SKILL.md`；获得浏览器时段才读 `playwright\SKILL.md`。

本机旧版 security-review 不照搬 PostgreSQL/Supabase/Next.js 示例。tdd 来源未独立核实，本轮不把该文件列为必读或复制分发；仍按真实失败→最小修复→回归验证。其他来源与许可限制见 [技能交接](../SKILLS-HANDOFF.md)。

执行按同一 session 先只读预检，后由协调者串行授予测试时段；`forma-claude-evidence-20261017/test-slot.json` 记录本项目唯一时段。前后端只写各自产品/测试范围和自身新状态/报告，独立审查只写自身报告/状态。协调者仅准备 MD、核对结果并精确提交，不执行其产品修复或冒称 Claude 完成。

所有任务保留四项用户删除与 AGENTS 原文；不恢复 exercises.json、不造空数据/占位声明、不弱化配置。仅合成数据/临时SQLite/mock外部AI/禁GPU系统Edge，沿用已验证的离线运行区，不安装、不碰真实 data/.env/供应商。无 push、远程分支/PR、合并、部署、生产迁移、邮件、付费服务、Apple/HealthKit；Showroom/Mail/视频标签和服务独立。

证据目录：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-claude-evidence-20261017`。`dispatch.json` 汇总；各 role 有原始 prompt、CLI stream 和 receipt。前端首次 CLI 参数解析错误未建立会话/调用模型，原错误单独保留，修正参数终止符后沿用同 UUID；不把此启动错误称产品红例。三个 preflight 均 exit0 且有真实模型 Read 回执，旧 Codex F/B/Q 完成结果单独归档。

CB-17 的有界单表增量恢复可在用户本次授权内实现；不能扩大清理保留政策或进行 schema 大改。旧 hash-only receipt 没有原asset列表，不能凭空修复历史遗留，PUT路径及DB/文件系统跨资源原子性必须明示范围。JSON导出无附件本体；服务端导出无客户端未同步队列。

## 最终本地交付

| 方向 | 产品/测试或审查提交 | 最终分支HEAD（其后仅MD收尾） | 实际Claude结果 |
|---|---|---|---|
| CF-17 | d794e384646559302edecc269e5c6b6507de1bd9 | 4674a98a7503792b8be1357d9ba077b17e33ac36 | 5新增场景，最终18/18，页面异常0；无产品页面diff |
| CB-17 | c32d8fc8197a0bff73263243e5819edb09fdf9ba | d88b4e604f63b7dcc872e81ab5e74fb867d5eb91 | 聚焦12/12、完整214/214；sync持久清理重试及无精确意图不删均已修 |
| CQ-17 | 8df22c68683ed759302573081fcecfed4fbe1e38 | 8df22c68683ed759302573081fcecfed4fbe1e38 | 独立12/12、精确3浏览器例3/3；F/B各自tsc退出2/38条；无新可复现产品缺陷 |

源码/测试由实际Claude编辑并运行，协调者仅核对后本地精确提交；CLI内部没有commit或stage。Q报告位于`forma-health/docs/reviews/20261017-claude-review.md`，CF/CB各有同名方向的报告与新状态。补丁、所有实际命令/退出码/模型回执、来源于原始stream的工具调用、旧/新版本日志及真实会话文件元数据都在本轮evidence。最终索引为`forma-claude-evidence-20261017/delivery.json`；MD原文件清单更新为47项，不确认Mail是否已重新打包或发送。

保留事项：38条是缺件状态的下限，不能证明源码类型正确；未恢复JSON或补依赖。完整App/账号壳/训练路由/build/组合版本均无本轮通过结论；PUT及旧receipt历史恢复未实现；没有广泛GC、过期策略或真实崩溃原子性验证。重放时先cancelAsset的低级观察只有静态推断，未复现，不作已证实新bug或擅自改策略。

连接复查：22:44 UTC本地Windows命令成功，三个Claude均已正常结束、exit0；未因短暂断连重启session或重复测试。Desktop Commander设备75541861-a718-497f-b4bb-cfc72a3a0a21的独立连接器报告Offline，ping无在线设备，其authorized状态无法据此确认。当前本地执行环境可用，继续已授权收尾，没有重启Remote或改变账号/权限。详见本轮`connection-check.json`。
