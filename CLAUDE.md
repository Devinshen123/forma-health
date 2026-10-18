
## 2026-10-17 Claude Code 实际任务（最新授权）

本工作区当前只执行 CB-17，任务书为 docs/collaboration/tasks-20261017-claude-backend.md，分支 claude/forma-attachment-retry-20261017。必须先读其准确Claude技能路径与阶段/所有权限制；旧F/B/Q任务仅作历史。真实Claude会话执行，协调者不替代。保留AGENTS原文及用户删除，禁止恢复JSON、上传、合并、部署或真实数据服务。

本工作区当前只执行 CF-17，任务书为 docs/collaboration/tasks-20261017-claude-frontend.md，分支 claude/forma-frontend-recheck-20261017。必须先读其准确Claude技能路径与阶段/所有权限制；旧F/B/Q任务仅作历史。真实Claude会话执行，协调者不替代。保留AGENTS原文及用户删除，禁止恢复JSON、上传、合并、部署或真实数据服务。

本工作区当前只执行 CQ-17，任务书为 docs/collaboration/tasks-20261017-claude-review.md，分支 claude/forma-boundary-review-20261017。必须先读其准确Claude技能路径与阶段/所有权限制；旧F/B/Q任务仅作历史。真实Claude会话执行，协调者不替代。保留AGENTS原文及用户删除，禁止恢复JSON、上传、合并、部署或真实数据服务。

# FORMA 接续入口

2026-10-17 新授权：当前执行 [三方向实际任务书](docs/collaboration/tasks-20261017-three-directions.md)，按其中 F-17 / B-17 / Q-17 的独占范围开发、测试或审查。下面“只读文档”文字保留为上一轮记录；新任务书与任务板顶部覆盖该阶段限制。每项任务都规定实际要用的 skill、触发、准确本地 SKILL.md 路径和缺失处理；必须先读相应文件并在状态中确认，不能仅凭推荐仓库名声称已调用。不要自动重复已发出的任务或恢复用户删除。

先读本仓库 `AGENTS.md`、[当前项目状态](docs/PROJECT-STATUS.md)、[协作任务板顶部](docs/collaboration/TASKS.md) 和 [技能与会话交接](docs/SKILLS-HANDOFF.md)。用户后续授权与任务板本轮范围优先于历史阶段说明。原目录的 `docs/handoff/claude-continuation-prompt.md` 是早期阶段材料，不代表网站尚未实现，也不自动授权新的产品任务。

当前为 React 19 + Vite + TypeScript 网页，Express 5 + Zod + Node `node:sqlite` / SQLite 后端；不是 Next.js、Postgres 或 Supabase 项目。产品修复到 `367ae3e`，文档分支为 `codex/forma-docs-skills-20261017`，没有自动并回原 main。

本次仅核对与更新 MD、技能来源及接续信息；收到交接后只需读取并确认理解，不启动开发、测试、构建、服务、安装或全局配置变更。后续开发须按用户的新任务限定范围、独立 worktree 与唯一写入者规则执行。保护用户未提交改动、真实饮食/睡眠/附件，测试只用隔离合成数据；保持 Showroom 与视频任务的标签、服务、GPU 和数据独立。

当前 worktree 有四项预先存在的文件删除，含仍被导入的 `src/catalog/exercises.json`；保留它们，不自动恢复。三轮测试与浏览器通过是各提交的历史证据，不能代表当前脏工作区已重新验证。

技能按任务选择：前端设计 `frontend-design`，API `backend-patterns`，账号/隐私/上传 `security-review`，SQLite 结构变更 `database-migrations`，浏览器回归 `playwright`，明确缺陷回归 `tdd`。Claude 文件位于 `C:\Users\devin\.claude\skills\<name>\SKILL.md`；先读取，再按指南适配实际技术栈。来源或许可不完整的本机技能只引用，不复制分发。原项目 HealthKit / SwiftUI 技能属于未来原生范围，本轮不触发。

禁止 push、远程分支、PR、合并、部署、生产迁移、真实健康数据接入、付费 AI、Apple 登录及 HealthKit。JSON 导出没有图片/PDF本体；服务端导出也不包含客户端尚未同步的队列。保留原附件，勿把 JSON 当成完整备份。
