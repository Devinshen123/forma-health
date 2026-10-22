# Forma 员工池与首次任务

更新：2026-10-20。11个角色，按任务启用2–4人；这是实际登记的配置与任务队列，尚未启动新会话。唯一技术总控是lead，Dot只整理需求与摘要。建议工具不自动替换现有会话负责人。

## 员工与任务

| ID | 员工 | 建议工具 | 首个任务 | 交付 |
|---|---|---|---|---|
| dot | 需求与进度助理 | Dot（羊羊） | TEAM-DOT-01 | dot/intake.md |
| lead | 技术总控 | Codex 当前聊天 | TEAM-EXP-01 | 配置、任务板、校验与集成 |
| product | 产品与验收规格 | Codex 独立会话 | TEAM-PRODUCT-01 | product/web-acceptance.md |
| ux | 体验设计 | Claude Code 独立会话 | TEAM-UX-01 | ux/record-editing.md |
| frontend | 前端工程师 | Claude Code（建议；现有会话归属保留） | TEAM-FRONTEND-01 | frontend/timezone-reproduction.md |
| backend | 后端工程师 | Codex 独立会话（建议） | TEAM-BACKEND-01 | backend/plan-conflict-reproduction.md |
| qa | 功能测试与审查 | Claude Code 独立会话（建议） | TEAM-QA-01 | qa/current-baseline.md |
| research | 技术研究 | Dot 或 Codex 独立会话 | TEAM-RESEARCH-01 | research/tool-orchestration.md |
| security | 安全与隐私审查 | Codex 独立会话 | TEAM-SECURITY-01 | security/account-boundaries.md |
| rules | 健康规则专家 | Codex 或 Claude Code，按需 | TEAM-RULES-01 | rules/missing-data-and-undo.md |
| release | 发布准备 | Claude Code 独立会话 | TEAM-RELEASE-01 | release/web-readiness.md |

以上任务验收、依赖、状态和精确路径以 [TASKS.md](../TASKS.md) 为准；交付报告短路径相对 docs/collaboration/deliverables/。按需角色不需要全部同时运行。首次任务围绕现有Web流程、已记录的时区与旧base冲突问题，先核实当前checkout；不扩大到支付、iOS或新平台。

## 如何接手

把角色ID替换为目标员工，并在明确分配给该角色的checkout启动独立会话：

> 你是 Forma 的 product。读取 AGENTS.md、docs/collaboration/agent-prompts/current/product.md、TASKS及本人PROFILE/MEMORY/HANDOFF/status和请求；先报告实际目录、分支、提交、未提交工作与任务依赖。只执行已派给自己的任务，完成后报告交付路径、实际验证和提交编号。

每位角色的入口为 current/<ID>.md，个人记忆为 ../memory/<ID>/。每个ID同时只允许一个记忆写入者。旧规则、未提交文件和独立worktree不会自动同步；由lead集成已审查配置，不往其他checkout直接覆盖文件。

Dot/Research若在外部工具中不能读取仓库，先提供草稿；lead明确导入后才能计入项目交付，不能伪称已同步。遇到工具权限、工作目录或证据不足时报告blocked。员工不自行发送消息或启动其他聊天。

## 协作节奏

1. Dot收件，Product定义可观察验收；Lead决定优先级、契约和文件归属。
2. UX和Research提供规格或技术依据；Frontend/Backend/Rules完成被另行明确派发的实现。
3. QA和Security审查同一个候选提交，缺陷交源码owner处理。
4. Release引用验证证据形成准备清单，Lead集成并向用户交付。
5. 每人更新自己的status/HANDOFF；共识进入decisions，经核实的个人经验进入MEMORY。

本轮已登记首次任务，不表示这些报告已生成，也不表示已部署、已启动自动化或已创建新worktree。
