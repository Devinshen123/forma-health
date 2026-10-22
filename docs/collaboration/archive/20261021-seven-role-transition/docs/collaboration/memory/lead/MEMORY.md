# lead 长期记忆

Owner：lead。初始化：2026-10-20；执行者：lead（MEM-01）。下列为有来源的文档种子，没有运行本角色的新实现验收。

## 项目约束

- 状态：已核对文档；日期：2026-10-20。Forma 当前先做 Web；新账户为空、演示数据明示，未知健康值不填零。来源：根 AGENTS.md §1/§3。适用于全部任务，不表示本 checkout 的每个运行路径都已验收。
- 状态：已核对配置；日期：2026-10-20。本角色唯一 ID 为 lead；只维护自己的记忆和 TASKS 授权路径。来源：AGENTS §0/§4/§6、TASKS 顶部所有权表。旧角色名或个人工具记忆不能扩大权限。

## 本角色值得保留的经验

- 状态：历史记录，接手时待核对；日期：2026-10-20。日期归属分歧与旧建议 base 的 400/409 差异已在 AR-01 历史记录复现；这是待修复问题，不因配置员工而标记解决。
- 来源（文档证据，未在本轮重跑产品场景）：
  - `docs/collaboration/status/lead.md`
  - `docs/collaboration/decisions/ADR-project-worktrees-20261017.md`
- 适用范围：这些来源在当前根 checkout 中的记录；其他分支或未合并 worktree 可能不同。需要结论时读取实际代码和最新提交，不沿用旧测试数字或状态。

## 待本人积累

尚无本角色采用新配置后的个人经验条目。后续按共享 README 的日期/状态/证据/范围模板写入；不要从其他聊天补造历史。被替代的经验保留来源并标注过期。

## TEAM-EXP-01 员工池与验证（2026-10-20）

- 状态：已验证（配置与本机检查）；执行者lead；范围：根checkout main/e4c6a1b加本轮未提交文档。
- 项目现有11角色：lead/frontend/backend/qa/rules及dot/product/ux/research/security/release；TASKS为唯一所有权与任务来源。通常选2–4人执行，角色名单不表示常驻进程或已接手。
- 来源：TASKS的TEAM-EXP-01、agent-prompts/TEAM-ROSTER.md、decisions/ADR-team-expansion-20261020.md。
- 实测：本轮文档检查11角色/10任务/50链接exit0，npm.cmd run build exit0，git diff --check通过。限制：未做首次任务报告、未启动其他员工、未同步worktree，未运行本轮产品测试。
- Git暂存因.git/index.lock Permission denied失败；配置文件已保留，任务未完成提交。当前权限事实只适用于本会话，下一会话需重新核实，不据此绕过权限。
- 上方“尚无个人经验”仅为MEM-01初始化历史，已由本节替代；原记录保留。
