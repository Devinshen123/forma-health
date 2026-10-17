# FORMA Q-17 三方向独立审查

## 范围与基线

2026-10-17 UTC，审查工作区 `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-health`，分支 `codex/forma-three-direction-review-20261017`，开始 SHA `33f12568e7fb386efd88def9cd63dc1ee5883217`。前后端指定提交均已交叉审查和独立复验。三个分支没有集成，不能声称组合版本已验收。

## 结论

未发现本轮指定补丁新增的阻塞性问题。前端守卫修复和后端最新引用检查有真实失败与修复后行为证据；**仍有一项已独立证实的未修复清理重试缺陷，以及完整静态检查/构建阻塞**，不能把本轮概括为所有问题已解决或可发布。

| 指定提交 | 独立审查结果 | Q-17 实际验证 |
|---|---|---|
| F-17 `2786a336edd15dc99803520417a3216d5855e1ac` | Sleep/Reports 各独立 edit/delete RecordDraft、自己的不确定提交 observe、保留 AttachmentLifecycle；没有恢复动作库 | Edge代表场景3/3，pageErrors=0；完整 TypeScript exit2/38条诊断，未build |
| B-17 `b27c3cce48e3dc088a17df06d040b5e9aa2105dd` | 最新 owner 引用检查在 SQLite 写锁内先于 metadata/draft/bytes 删除 | 新测5/5、完整现有套件207/207；单独已知缺陷repro 0/1（实际200、预期404），不是绿色套件一部分 |

待决定：是否授权为具体 owner/asset 清理意图设计持久恢复，涉及 schema/持久化策略；动作库 JSON 的删除意图及后续产品处理。当前不做全账号 GC、不改生产数据、不自动恢复删除、不合并或上传。

只写本报告、`docs/collaboration/status/qa.md` 以及必要独立浏览器回归脚本。前后端产品文件只读，不切换他们的分支、不合并、不上传。开始时已有四项删除与未跟踪 `AGENTS.md`；全部保持原样，不恢复或暂存。未读取真实 `data/`、`.env` 或账号数据。

已读本工作区 `AGENTS.md`、`CLAUDE.md`、`docs/collaboration/TASKS.md`、`docs/collaboration/tasks-20261017-three-directions.md`、`docs/PROJECT-STATUS.md`、`docs/SKILLS-HANDOFF.md` 和历史 qa 状态。当前三方向任务书覆盖上一轮仅文档的阶段限制。

## 实际使用的技能

以下三个文件已实际读取，名称仅为提示词技能名，不是 PowerShell 命令：

| skill / 可用入口 | 本次用途 | 已读取的本机路径 |
|---|---|---|
| `playwright` / `$playwright` | 复核真实 DOM、账号、附件、取消/确认及重试的证据；沿用本项目已安装的 Windows Playwright/Edge 流程 | `C:\Users\devin\.codex\skills\playwright\SKILL.md` |
| `security-review` / `$security-review` | 独立检查账号所有权、私有附件、输入校验、回执和事务边界 | `C:\Users\devin\.codex\skills\security-review\SKILL.md` |
| `tdd` / `$tdd` | 核对回归是否在约定的 HTTP / 实际组件 DOM 边界证实失败；不将镜像实现或仅内部断言视为充分行为证明 | `C:\Users\devin\.codex\skills\tdd\SKILL.md` |

本机 `security-review` 为技能指南标注的旧版；不运行其中 SQL 示例或照搬 Supabase/Next.js 例子。`npx` 可解析到现有 `C:\Program Files\nodejs\npx.ps1`，没有调用 `npx` 下载或运行 CLI 包，也没有执行技能包装脚本。没有把公开高星候选说成此次已安装或调用。若后续工具/技能缺失，报告准确路径与影响，继续独立可做部分，不安装陌生脚本。

## 缺失动作库的静态诊断

`Test-Path src/catalog/exercises.json` 返回 `False`；`git status --short` 同时记录该路径为用户原有删除。`src/catalog/exercises.ts:1` 仍有 `import data from './exercises.json'`，不是仅在文档中被提及。

导入链：`src/main.tsx:3` → `src/App.tsx:20` 的 `lazy(() => import('./features/Training'))` → `src/features/Training.tsx:5–9` → 下列训练页面 → `src/catalog/exercises.ts:1` → 缺失 JSON：

| 直接消费动作库的文件 | 导入行 |
|---|---|
| `src/features/training/Library.tsx` | 3 |
| `src/features/training/Import.tsx` | 3 |
| `src/features/training/Progress.tsx` | 4 |
| `src/features/training/Routines.tsx` | 4 |
| `src/features/training/Session.tsx` | 4 |

`package.json` 的 build 依次执行 `tsc --noEmit`、`vite build`、离线 shell 构建。`tsconfig.json` 包含 `src`，因此训练的 lazy import 不能排除 TypeScript 对缺失模块的解析；至少完整构建存在明确缺文件阻塞。后续实际完整 TypeScript 诊断在 `frontend-typescript-full.log` 确认 `src/catalog/exercises.ts(1,18): TS2307`，不是仅推测。没有继续执行 build 或 Vite产物构建。浏览器完整 App 的实际启动表现也未测试，不能把开发服务器能启动等同于训练路由可加载。

不恢复该 JSON、不生成空目录、不修改导入掩盖删除。最小后续方案由文件所有者决定：若误删，则由获授权的所有者恢复准确来源；若有意移除动作库，则另行限定产品范围、调整实际引用和用户提示并回归。Q-17 不替用户选择。Sleep/Reports 可考虑直接导入真实组件的隔离测试 harness；这只能验证指定组件与真实本地 HTTP/sync 行为，不能替代完整 App、训练路由或构建验收。

其余三个既有删除为设计参考图片两项与 `public/demo-meal.png`。本轮不恢复图片，也不宣称引用图像在当前工作区完整。

## 待交叉复核的行为边界

### F-17：Sleep / Reports

基线 `Sleep.tsx:74–78` 打开时存旧 draft，`185–188` 保存时与最新 `state.sleeps` 合并；`208–216` 的删除确认按旧 id 筛掉最新集合。`Reports.tsx:179–200` 同样保留旧对象，`323–328` 按最新集合更新或追加，`364–372` 旧删除确认按 id 删除。App 每 15 秒和 online/offline 触发刷新（`App.tsx:146`），每次 render 的 writeContext 刷新；所以前端任务有当前代码依据，不能仅依赖服务端 CAS 保护未重新审核的新值。

跨账号已有 `App.tsx:149` 的 `assertWriteBinding`、`App.tsx:361` 的 account/epoch keyed Fragment；Reports 上传和删除也带打开时 ownerAccount。独立审查不得把这些已有保护描述为缺失。仍需用实际交互检验正在等待的上传、保存、取消与账户切换，以及自己的不确定保存重试：同一请求、同一记录 id、不误删队列引用附件。

交叉复核将检查：打开快照守卫是否分别绑定编辑和删除；后台修改/删除后是否阻止覆盖/复活/误删；无关记录新增是否仍允许本条操作；关闭不产生保存；提交后的不确定结果是否沿用原请求；附件取消后仍被待确认记录引用时是否可读。睡眠样本须时间不重叠，防止业务重叠校验掩盖真正的并发缺陷。

### B-17：批准、回执与清理

当前批准经 `POST /api/sync`，没有独立批准 API。`server/app.ts:295–311` 校验状态、AI draft/source/index 以及账户私有附件；`store.ts:151–166` 在事务中检查 mutation hash/CAS，写 state、entityVersions、receipt。事务辅助在 `179–181` 使用 `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`。这些已有机制需要故障注入验证，不能在无证据时宣称未实现原子性。

待证明的两个清理风险：`app.ts:325` 在 sync 事务提交后调用 `cleanRemovedAssets`；`store.ts:155–157` 对已接受回执重放只返回 snapshot，不带 previous，因此不会走原清理分支。`deleteAsset`（`store.ts:269–276`）先删除 metadata，再移除文件。提交后发生异常时究竟留下何种状态、相同 mutationId 能否恢复，以及跨实例提交/清理间隙有新引用时是否被旧清理误删，需要 B-17 的确定性 HTTP/SQLite 故障证据，当前仅为审查假设。

将核对 SQL 中途失败的公开响应、完整 state/revision/entityVersion/receipt 回滚、解除故障后同 ID 成功一次、重放幂等、跨集合与跨实例附件引用保护。数据库查询用于故障诊断和事务原子性支持证据，同时要求 HTTP 最终状态/附件可读取证据；不能用内部细节断言取代公开行为。

## 本轮运行记录与后续验收

### B-17 指定提交的首次交叉检查

已只读检查后端任务工作区的 `server/store.ts` diff、新测试和 `forma-task-evidence-20261017/backend` 日志；随后按总控指定核对确切提交 `b27c3cce48e3dc088a17df06d040b5e9aa2105dd`（`codex/forma-approval-failure-recovery-20261017` / `forma-review-recovery`），仅3项自身文件，产品改动与首次 diff 相同。首次只读检查未运行测试；之后独立执行记录见下节。

新增 `deleteAsset` 将查 asset、最新 owner state 引用检查、metadata DELETE 和 unlink 放在同一 `BEGIN IMMEDIATE` 事务中。若最新 `meals` 或 `reports` 仍引用该 asset，立即返回 false，发生在 metadata DELETE、`food_photo_drafts` 外键级联删除和 unlink 之前；写锁保持到 unlink 后的 COMMIT。其他 state writer 使用同一 SQLite 写锁，因此修复针对已提交的新引用有明确锁范围，未改 API/schema/AI provenance。

`approval-failure-recovery.test.ts` 的 HTTP 竞态用真上传和注入 AI 原始响应创建草稿，确定性地在 sync 提交后、旧清理之前用第二个 Store 提交 report 引用；随后 GET 附件、导出 draft 和 DELETE 409 均为公开 HTTP 断言。第二个 Store 边界测试另外核对原 bytes、错误 owner 无权删除和实际最终引用移除后可清理。故障 seam 用 `store.sync` 包装注入精确时序，断言仍落在实际服务/Store 行为，不是重新实现引用检查。

`baseline-http-sql-loopback.log` 记录跨 Store HTTP 附件 404（预期200）和直接 Store 误删 true（预期false）的真实失败。`fixed-race-sql.log` 记录 5/5、0 fail/skip/cancel，其中是三个顶层测试加两个 SQL 子测试，不能称五个独立顶层场景。两项 SQL ABORT 用公开 Store.sync/Store.syncSnapshot 和临时数据库支持断言，覆盖 state/revision/entityVersion/receipt 全回滚及相同 mutationId 重试；它们没有分别检验 Express 的错误响应。

**已证实但未修的清理恢复问题：** `app.ts:325` / `store.ts:155–157`。在旧附件替换提交后注入 assets DELETE 的 SQL ABORT，HTTP 返回500，但新记录与 receipt 已提交；解除故障后重放同 mutationId 返回200且 revision不重复增加，旧附件仍GET200，本应清理却未重试。红例日志中的 `same receipt retry must finish the failed cleanup` 实际200、预期404，与单独的 `reproduce-postcommit-cleanup.mts` artifact 对应。该红例已单独保留，不混入声称通过的绿色套件；不能把5/5说成清理恢复已全部完成。

持久恢复需只记录具体 owner/asset 清理意图，并与状态/回执同事务记账；不能扫描清除所有“当前无引用”文件，因为未保存编辑器和 outbox 也可能仍持有上传。此设计涉及持久化策略，由总控/用户限定后续范围。本次修复也不提供 SQLite 与文件系统的跨资源原子保证：若 unlink 成功后 COMMIT 失败或进程中断，仍有 metadata/bytes 不一致窗口；未做此类故障注入，保留为未验证事项，不据此扩写产品。

### Q-17 独立运行：后端指定 SHA

总控确认前端 fixture/Edge 已关闭后，审查方获得串行时段，在 `forma-review-recovery` / `b27c3cce48e3dc088a17df06d040b5e9aa2105dd` 执行下表。证据根目录为 `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-evidence-20261017\qa`；每次有对应 `.metadata.json`，记录 SHA、命令、退出码和 UTC。

| 实际命令 | 结果 | 日志 |
|---|---|---|
| `node --import tsx --test --test-concurrency=1 server/approval-failure-recovery.test.ts` | exit 0；5/5，0 fail/skip/cancel；约0.63秒 | `backend-new-tests.log` |
| `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` | exit 0；207/207，0 fail/skip/cancel；约15.20秒 | `backend-full-suite.log` |
| `node --import tsx --test --test-concurrency=1 ../forma-task-evidence-20261017/backend/reproduce-postcommit-cleanup.mts`（首次独立复跑） | exit 1；运行器失败，`ERR_MODULE_NOT_FOUND`：独立脚本错误地导入 Sharp 0.35.5 不存在的 `lib/index.js`，**未到达产品失败断言** | `postcommit-cleanup-known-failure.log` |

完整 suite 本次实际通过，因此没有再重复运行一个过滤后的 server/rules 子集。该套件使用合成 catalog fixture/领域模块，测试通过不等于缺少真实 JSON 的完整源码可构建。没有执行 build、TypeScript 或浏览器；本轮脚本与 fixtures 使用临时 SQLite、合成账号/附件、注入 HTTP，未调用外部 AI。测试服务由 finally/after 关闭，时段已释放。

运行时只对本次 PowerShell 子进程设置：`NODE_OPTIONS=--import=file:///C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017/runtime-hook.mjs`、`ESBUILD_BINARY_PATH=C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-runtime-20261017\node_modules\@esbuild\win32-x64\esbuild.exe`，TEMP/TMP 指向上面 qa 证据目录。已读取 `runtime-hook.mjs` 与 `provenance.json`：由总控从本机 npm cache 按 lockfile SHA-512 建立独立 overlay，未下载、未执行 install hooks、未改共享 node_modules。Loopback 按已授权合成回归经升级审查运行，没有权限拒绝。

已把独立 repro 的导入错误报总控，由 artifact 所有者只修为真实项目 `createRequire(... )('sharp')` 包入口，原业务断言保留。审查方读回修正，SHA-256 `8751FEF9904367FEFB81EF7B5AD75C64716F52AA1C89EA6A8198BE82883E4E9A`，获得下一时段后执行相同命令：**exit1，1项测试/0通过/1失败；真正 `AssertionError: same receipt retry must finish the failed cleanup`，actual200、expected404，位于独立脚本93行**。新日志 `postcommit-cleanup-confirmed-failure.log` 与metadata记录 b27 SHA、脚本摘要、命令和退出码；首次缺件日志仍保留，不混淆两次结果。已独立确认新记录/receipt已提交、相同mutationId没有重复写、旧附件仍可读取的原问题。

历史 202/202 和 Edge 13/13 不算本轮结果。

### F-17 精确提交交叉检查

首次读前端分支 `392a7ff54e40c80b2616215d147665679b4397ad` 之后的未提交 diff，随后按总控指定逐项核对最终 `2786a336edd15dc99803520417a3216d5855e1ac`（4路径，两个页面各+18），产品补丁相同。两页面均建立独立 edit/delete `RecordDraft`，打开时绑定原记录；保存/删除前用当前同 ID 记录执行 `canSave`，记录 `submittedValue` 后才调用原 save。edit 的 effect 观察自身已提交值；delete 的 `canSave` 自带 observe，允许自身已接受删除的重试确认。没有用整个集合的变化误判本条冲突，Reports 原 `AttachmentLifecycle.retainForSave` 仍在。不改外层 App、契约、动作库或依赖。本次静态检查未发现新增阻塞项。

已读 `frontend/baseline-both/results.json`：真实 Sleep 远端 quality=2 被旧草稿5覆盖，Reports marker=20 被旧草稿11覆盖，两条实际失败、pageErrors为空。脚本不是无缺陷的想象回归。13项最终脚本分别通过真实 DOM 打开/提交/取消/Keep，调用真实 SyncEngine 和本地 HTTP/SQLite；检查服务端记录、mutationId复用及报告附件实际 bytes。其 fixture直接导入真实 Sleep/Reports，排除 App/Training 的缺目录依赖而不修改产品导入；测试边界合理，但**不覆盖完整 App 的会话切换 key/writeBinding 接线**，不能升级为全App跨账号浏览器验收。

脚本刷新用 `online` 事件触发 SyncEngine.refresh，避免点击对话框背后的 fixture 控件；测试前捕获 GET response，减少快回环竞态。mock只用于故障断网与合成外部响应，不 mock RecordDraft/页面组件。

### Q-17 独立运行：前端指定 SHA

工作区 `forma-record-flows` / `codex/forma-sleep-report-lifecycle-20261017`，每次运行前后 HEAD 均为 `2786a336edd15dc99803520417a3216d5855e1ac`，只有原四项删除和未跟踪AGENTS，没有其他产品未提交改动。

1. 实跑 `node ../forma-task-runtime-20261017/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：**exit2，38条诊断**。包括缺失 `./exercises.json`（TS2307）、`lucide-react` 类型入口缺失、现有 `node:crypto` 声明缺失，及其派生的隐式any。随后只读确认：lucide package 的 `typings` 指向 `dist/lucide-react.d.ts`，该文件不存在；`@types/node/crypto.d.ts` 也不存在。完整日志 `qa/frontend-typescript-full.log`、metadata记录SHA和命令。未忽略错误、改配置、添加占位声明或恢复任何文件；这不是完整类型检查通过，更不是构建成功。
2. 实跑 `node --import tsx tests/browser/sleep-report-lifecycle.mts`，按脚本已有 `FORMA_QA_MATCH` 精确过滤 `^(sleeps-stale-delete-confirmation|reports-stale-edit-update|reports-uncertain-attachment-cancel)$`，`FORMA_TEST_OUTPUT` 为 `qa/frontend-representative`。**exit0，3/3，pageErrors=[]**。验证旧睡眠删除确认不删新值/Keep安全；旧报告编辑不覆盖远端指标/取消安全；报告上传后保存未确认、取消、队列重试时附件仍可GET且bytes逐字相同，markers与assetId最终保存正确。没有再跑全部13项或完整App。

浏览器为系统 Edge/headless、1280×900、UTC，脚本显式 `--disable-gpu` / `--disable-gpu-compositing`；默认未启移动视口参数。两张守卫截图和 `results.json`、日志、metadata均在 `qa/frontend-representative`（日志/metadata在qa根）。已实际查看两图：睡眠删除警告完整可见；报告表单很长，警告位置靠近内部滚动区底部，状态保护依DOM断言及服务端值确认，未据截图声称全表单视觉无缺陷。fixture直接使用独立随机API/Vite端口，运行结束finally关闭自有Edge/API/Vite，不操作其他任务标签和服务。

前端执行者另交付 `frontend/final-13/results.json`；Q-17已读回核对13项全部passed、pageErrors为0，且与delivery.json的指定SHA/范围一致。Q-17仅独立重跑上述3项，不混称13项由审查方重跑。没有执行真实外部服务、真实账户/健康数据、生产迁移、付费服务或build。

上述确切 F/B SHA、完整套件、独立红例与代表组件回归已完成；没有改他们工作区产品文件或集成分支。后续若要确认组合版本，需要单独授权集成与验证，不把两分支分别通过推断成组合已通过。

真实 AI、外部供应商、生产/真实健康数据、Safari/iPhone/HealthKit 均未验证；移动视口只能称模拟。JSON 导出含记录和附件引用/元数据，不含附件本体；服务端导出也不包含客户端未同步队列，不能替代附件备份。
