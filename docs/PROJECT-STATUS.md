## 2026-10-18 local Codex implementation and real Claude cross-review

Current direction: review, branch codex/forma-recovery-audit-20261018, integrated product baseline85912f2. Codex task /root/forma_review_20261018 completed and handed off before real Claude session eb252693-373a-4e70-a821-4b8e1aca635d reviewed source 67dff9c8a78a76e22fd9290e10c95e0a17130dec. See [current task](collaboration/tasks-20261018-review.md), [Codex report](reviews/20261018-review.md), [Claude completed review](reviews/20261018-claude-review.md) and D evidence at D:\CodexTaskData\forma-codex-claude-20261018. This entry supersedes older phase/status claims below without rewriting their history.

The three local branches remain separate; this worktree contains only its direction's changes, and no combined F+B build/browser run was performed. Frontend: Codex focused8/8/full24/24; real Claude then authored two review-requested assertions, and coordinator validation of that final source passed focused2/2/full24/24, pageErrors0. No new product frontend patch. Backend: precise durable PUT cleanup retry plus missing-byte guard; Claude caught an overbroad guard and Codex narrowed it to newly added/changed record-asset associations, preserving unrelated saves with old broken references. Final focused22/22/full225/225; Q narrow verification3/3 plus final2/2. The review branch retains a baseline crash audit with2pass/1known failure: process exit before cleanup COMMIT restores metadata/intent but cannot restore already-unlinked bytes. The guard does not establish cross-database/filesystem atomicity or recover bytes. Legacy hash-only receipts cannot reconstruct historical removal candidates; no broad GC was added.

All new data is synthetic and isolated. User AGENTS content and four deletions remain unstaged; exercises.json was not restored. Existing integrated service, Showroom/Mail tabs/services and global dependencies/settings were untouched. No push/remote branch/PR/merge/deployment, production migration, real health data, Apple/HealthKit or app paid-AI call. Full dirty-worktree build/App/Training and real iPhone/Safari remain unverified. JSON export excludes attachment bytes; server export also excludes unsynced client outbox.
# FORMA 当前项目状态

## 当前：整合版已构建并本地启动

2026-10-17（America/Los_Angeles），用户直接授权整合最新前后端、修复构建并启动打开网站。执行区为 `C:\Users\devin\.codex\worktrees\bdd7\健康网站`，分支 `codex/forma-integrated-20261017`。已通过保留历史的 merge 纳入前端 `4674a98`、后端 `d88b4e6`、审查 `8df22c6` 和交接文档 `2976a87`；产品代码无合并冲突，协作文档冲突保留双方记录。

本工作区此前就包含已跟踪的动作库 JSON 和图片，没有恢复其他工作区的四项删除。原修复工作区的删除和未跟踪 AGENTS 保持原样，原 main 未改变。本地依赖此前不存在，按现有锁文件 `npm ci --no-audit --no-fund` 安装完整独立依赖，不修改共享目录、依赖版本或构建检查。

本轮新增修复：后端回归 helper 的 UUID 参数显式采用 Meal.id 的 string 类型，消除两处 TS2345；睡眠/报告浏览器脚本改用仓库自己的 react-dom，去除旧临时 runtime 路径；Express 首页改用相对文件名加固定 dist root，修复 `.codex` 隐藏工作区下绝对 sendFile 路径被拦截而返回 500。新增真实 HTTP 红绿回归，覆盖隐藏/中文目录的首页与客户端路径、静态脚本、dotfile 不泄露及 API 认证边界，没有放开 dotfile 访问。

实际最终验证：

- `npm run build`：exit 0，TypeScript/Vite/离线壳完整通过，壳 `41bd32dcc736728e`；训练分包 896.56 kB 的大小提示仍存在。
- `npm test`：exit 0，215/215，0 fail/skip；包含本轮新静态服务回归和既有账户/附件/CAS/回执恢复测试。
- `node --import tsx tests/browser/record-flows.mts`：8/8；`node --import tsx tests/browser/sleep-report-lifecycle.mts`：18/18，均 pageErrors 0。
- 系统 Edge 冒烟：1440×1000、390×844 首页与训练导航；桌面 884 动作库、搜索/展开及中英切换通过，console/pageerror 0，无横向溢出。内置浏览器也已实际打开首页并点击训练库和切换语言。
- 浏览器 JSON/PNG 证据在本聊天 workspace 外 `C:\Users\devin\.codex\visualizations\2026\10\17\01a148dd-26a1-7812-a1fd-e10d8f096bd5\integration-qa\`；本轮使用新合成数据，不将历史验证当成本轮结果。

`npm start` 已在本工作区运行，地址 http://127.0.0.1:3001 ，仅绑定本机回环。启动前确认端口空闲、当前工作区不存在 data 或 .env；仅创建本工作区的新空数据库，没有迁移或读取原真实数据。页面明确显示演示数据，用户可创建自己的空账户。capabilities 实测 foodPhoto.reason=not_configured，没有真实 AI 调用、付费接入、Apple/HealthKit 或公网部署。

这段只更新当前整合工作区的验证事实，不抹除下文各历史修复区当时缺件/失败的记录；PUT 清理恢复、旧 hash-only receipt、跨资源崩溃原子性和真实 iPhone/Safari 等既有界限仍保留。

## 最新：真实Claude Code三方向

用户已明确本轮必须由Claude执行。三个已安装官方CLI会话均有真实init/result、模型Read及preflight exit0回执，实际分支/工作区/session见 [Claude任务总览](collaboration/tasks-20261017-claude.md)。协调者仅准备任务/技能入口、串行资源、交付核对及精确本地提交，不以先前Codex或内部agent代替本轮产品开发/独立审查。三分支保持隔离，未合入当前协调分支或main。

CF-17交付`d794e38`：产品Sleep/Reports仍是2786a33，没有新产品缺陷；新增5个边界例，Claude自己的13基线、5新案和18全量均通过，页面异常0。CB-17交付`c32d8fc`：新增一张owner/mutation/asset精确清理意图表及索引，与state/revision/receipt同事务记账，首次提交和同receipt重放均可恢复清理；写锁内先确认意图，再核最新引用，避免删除无匹配意图的候选。真实HTTP红例与Store边界红例均保留，最终聚焦12/12、完整串行214/214。不是扫描所有未引用资产，没有改变保留政策或HTTP契约。

独立Claude已核对上述确切SHA并实跑聚焦12/12和新增浏览器代表例3/3；F/B完整tsc都exit2/38条诊断，分别绑定自身分支，缺件可掩盖其他错误，不能宣称代码类型正确。审查已完成自身两个MD，源报告为forma-health/docs/reviews/20261017-claude-review.md；证据在`task-2/forma-claude-evidence-20261017`，旧Codex证据仍留在`forma-task-evidence-20261017`，不混算。

限制：用户删除的exercises.json未恢复，共享lucide/node声明缺件未补，完整App/训练路由/build未通过验证；PUT路径同类恢复仅静态分析、未做本轮故障注入；旧hash-only历史receipt没有原asset列表，不能凭空恢复；DB与文件系统无跨资源原子保证，未测真实崩溃。新增意图表未作用于真实数据；旧代码忽略该表但不会完成待清理意图，DROP会丢意图，不是无代价回退。本轮没有生产迁移、上传、合并、部署或启用真实健康/AI服务。JSON无附件本体，服务端导出无客户端未同步队列。

下文是此前Codex各轮的当时快照；其中“清理重试未修复”等状态已由本段及Claude报告更新，历史数字不相加。

核对日期：2026-10-17 UTC。本页依据本地源码、Git 状态、既有测试日志和结果 JSON；本轮仅改 MD，不执行产品开发、测试、构建或安装。

后续授权更新：用户已要求三方向实际执行。当前任务以 [三方向任务书](collaboration/tasks-20261017-three-directions.md) 和任务板顶部为准；下文“本轮仅改 MD”及三轮验证数字保留为上一文档核对快照，不是本次新开发结果。三个新分支实际基于 `33f1256`，不合并主分支。现有依赖有缺件，测试使用本机缓存中与锁文件/SHA-512匹配的包，在独立 `task-2\forma-task-runtime-20261017` 解析覆盖；没有下载、安装钩子或修改共享安装目录。用户四项删除仍保留，完整构建/全 App 不能据此声称通过。各方向结果与未修复项由其状态及独立审查报告记录。

三方向交付：前端 `2786a33` 修复 Sleep/Reports 旧编辑与删除确认，两个真实红例后组件 DOM + HTTP 回归13/13；后端 `b27c3cc` 以写锁内最新引用检查修复跨 Store 附件误删，局部5/5且审查完整串行207/207。审查提交 `579d905` 独立复跑前端代表例3/3、页面异常0，确认清理重试真实失败（旧附件200，期望404）；完整类型检查失败38条，含缺动作库JSON、lucide及node:crypto声明。提交后清理失败的持久重试尚未修复，需明确清理意图存储策略；没有以全账号 GC 代替。三个任务补丁独立，尚未整合，不能把这些结果写成完整 App 或构建通过。最终证据在 `task-2\forma-task-evidence-20261017`；源报告为 `forma-health\docs\reviews\20261017-three-direction-review.md`，全部自有服务已关闭。

## 代码与工作区

- 本地目录：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-confirmation-boundaries`。
- 文档分支：`codex/forma-docs-skills-20261017`，产品基线 `367ae3e9a088a263f13ba8600536d563ca0911c9`，包含下列前两轮修复。
- 2026-10-17 只读核对：远程 main 为 `eb6b559790f3d08e35ebeae9557d68bec6e09e90`；[PR #1](https://github.com/Devinshen123/forma-health/pull/1) 为 OPEN / DRAFT，远程 head `500e66bdace0f9b86a173fdb3cc530a3a1cd67f5`。三轮新增修复尚未上传、合并或部署。此状态是核对时快照，之后操作前须重查。
- 原项目本地 main 是 `ac56b65e15adc2f89f9ceb2962bef876b11eef8b`，含并行接管文档；没有把它与修复分支自动合并。

开始本轮时已经存在四项删除：`docs/design/dashboard-concept.png`、`docs/design/mobile-meal-concept.png`、`public/demo-meal.png`、`src/catalog/exercises.json`，以及未跟踪的 `AGENTS.md`。全部保留，不纳入本轮提交。`src/catalog/exercises.ts` 仍导入已删除的 JSON，因此**当前脏工作区没有可直接构建的验证结论**；动作库 884 条的产品描述对应既有提交，不表示缺文件后的目录仍完整。本轮没有恢复图片或目录数据。

## 已实现能力与技术栈

React 19、Vite、TypeScript、自定义 CSS / lucide；Express 5、Zod、Sharp、Node 内置 `node:sqlite` / SQLite。测试为 `node:test`，浏览器脚本使用已有 Playwright 和系统 Edge。没有引入 Next.js、Supabase、Postgres、Prisma 或 Drizzle。

网站已有本机账户、饮食/训练/手动睡眠/趋势、私有图片与 PDF、AI 照片草稿审核、计划版本与周复盘、训练导入和 JSON 导出。AI 服务端适配器已实现但真实付费调用未验证；Apple 登录、HealthKit、原生 iPhone/TestFlight、OCR 与收费未实现或未接入。跨客户端实体同步、墓碑、CAS 冲突和幂等回执已实现；明确启用离线后使用账户独立的 IndexedDB/outbox，附件不进共享离线缓存。详情见 [README](../README.md) 与 [API 契约](API-CONTRACT.md)。

## 三轮修复与实际证据

下表为各提交完成时的结果。本轮读回日志与 JSON 核实，没有重跑；测试计数是逐轮全量总数，不能相加。

| 轮次 / 本地提交 | 源码与修复 | 当轮结果 | 外部证据根目录 |
|---|---|---|---|
| 普通记录 `874b13cac7db203d7c36db0191e9c2490fe1f55a` | `RecordDraft`；Nutrition 旧编辑/删除不得覆盖新值或复活删除记录；QuickSummary 不确定保存原请求重试；已打开草稿固定 kg/lb 单位 | 191/191；build 成功，壳 `5cd67b87961bf8f8`；Edge 8/8 | `D:\CodexTaskData\forma-record-flows-20261017` |
| 审核恢复 `1ec7b3a1ef463ffb91602e5f7b4b859b91607532` | `RecordBatchDraft` 固定已尝试批次；AI 审核不确定保存/旧值保护；Progress 校正重试；Session 完成审核遇后台更新失效；4 项真实 HTTP 合约回归 | 198/198；专项 12/12；build 壳 `8e214ee1e8811712`；Edge 12/12 | `D:\CodexTaskData\forma-review-recovery-20261017` |
| 确认边界 `367ae3e9a088a263f13ba8600536d563ca0911c9` | Session 丢弃、Progress 删除、QuickSummary 删除各自绑定打开确认时的快照；4 项真实 HTTP 回归验证批次 CAS、畸形删除回滚、回执重放、跨集合附件引用清理 | 202/202；后端专项 4/4；build 壳 `2a24c4362fea75f4`；Edge 13/13，页面异常/console warning 0 | `D:\CodexTaskData\forma-confirmation-boundaries-20261017` |

每轮根目录有 `final-tests.log`、`final-build.log`。第一轮结果为 `final\results.json`；第二、三轮为 `final-confirmed\results.json`，并有 `QA.md`、浏览器脚本、截图与日志。第三轮 `baseline\results.json` 留有修复前 3 个确认框实际误删证据，`backend-tests.log` 为 HTTP 专项，`changes.patch` / `diff-summary.txt` 供审阅。测试只使用临时 SQLite、合成账号/附件与 mock AI。

源码入口为 `src/features/Nutrition.tsx`、`src/features/training/QuickSummary.tsx`、`Progress.tsx`、`Session.tsx`，草稿守卫位于训练/编辑相关模块；后端专项见 `server/review-recovery.test.ts` 与 `server/confirmation-boundaries.test.ts`。没有为了增加计数改动无缺陷的后端产品行为，没有添加删除后撤销功能。

较早 `500e66b` 安全轮已修复账号切换草稿/延迟保存、API 路径别名旧账号头、重新登录队列、附件不确定保存引用、跨账号编辑器、睡眠 DST、训练导入去重/距离单位及舍入；当轮 186/186、Edge 15/15，见 [安全轮 ADR](collaboration/decisions/ADR-local-safety-20261016.md)。[第一轮 ADR](collaboration/decisions/ADR-record-flows-20261017.md)、后两轮 D 盘 `QA.md` 与 [验收记录](VALIDATION.md) 保留具体范围和限制，旧“尚未覆盖”描述只代表当轮。

## 验证边界与数据保护

浏览器为 Windows 系统 Edge，桌面与 390px 移动视口；不是实体 iPhone / Safari。WebKit 未安装。尚未验证真实 AI 供应商质量、真实供应商全部 CSV 版本、生产 HTTPS、多设备实机、VoiceOver、Apple 登录或 HealthKit。三轮覆盖的编辑/确认路径不能推广为所有业务删除路径均已专项验证。未开展生产数据迁移。

服务端设置导出 `/api/export` 仅包含已保存记录、附件元数据/引用、AI 草稿及预算记录，不含客户端未同步队列，也不含附件本体。待同步 JSON 可保存客户端文字变更和引用，同样不含图片/PDF bytes；任何 JSON 均不能替代原附件备份。未启用离线时待确认保存只留当前页面；启用后的离线文字队列也不代表照片已离线备份。

`data/forma.sqlite`、`data/uploads/` 与真实 `.env` 不在源码提交中；SQLite/附件依赖系统账户和磁盘保护，没有应用层静态加密。不得读取、迁移或清理用户真实数据以验证文档。之前自有测试服务已结束；历史验收中的“服务运行中”不是当前服务状态声明。

## 接续顺序

1. 文件所有者先确认四项既有删除的意图，尤其动作目录 JSON；本轮不推定恢复或删除都已获授权。
2. 审阅本地三个提交和证据，选择后续集成基线与范围；原 main、远程 main、PR #1 与本工作分支不同，不自动 cherry-pick / merge。
3. 收到明确产品任务后才在独立 worktree 分工，按实际改动选择相关测试与技能；先核对 Git 状态、AGENTS 和任务板，再运行命令。重跑测试需标明新提交与当前文件完整性。
4. 真实设备、供应商和部署属于后续独立验证。当前仍禁止 push、远程分支/PR、合并、部署、生产迁移、真实健康接入及付费 AI。

现有 Codex / Claude 路径、技能触发条件与交接回执见 [SKILLS-HANDOFF](SKILLS-HANDOFF.md)。技能指南本身不授予新的开发或数据访问权限。
