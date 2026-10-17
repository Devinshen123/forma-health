# CQ-17 Claude 独立边界审查（类型诊断 / 可运行边界 / CF-17 与 CB-17 复核）

- 执行：真实 Claude Code 会话 `bf755c6b-5bb9-413a-a6f4-63f764629745`（协调者已按 CLI stream 核实），2026-10-17 UTC，单一串行时段。
- 本工作区：`forma-health` / `claude/forma-boundary-review-20261017` / HEAD `9559f7230d980715170e6669ecf0892f22c0c383`（产品 = `579d905`；协调者仅提交入口 MD）。未提交：四项用户删除 + 未跟踪 `AGENTS.md`，以及本报告和状态文件。
- 被复核的确切提交（运行前后 HEAD 不变，CQ-17 未改其任何文件、未切分支、未集成）：
  - CF-17 `forma-record-flows` / `claude/forma-frontend-recheck-20261017` / `d794e384646559302edecc269e5c6b6507de1bd9`；`src/`、`server/` 与 `2786a33` 相同，只有测试脚本 +63 行和文档。
  - CB-17 `forma-review-recovery` / `claude/forma-attachment-retry-20261017` / `c32d8fc8197a0bff73263243e5819edb09fdf9ba`；相对 `b27c3cc` 改了 `server/app.ts`、`server/store.ts`、`server/approval-failure-recovery.test.ts`。CB 证据 `changes-r2.patch` 的 server 部分与该提交 diff 一致（忽略 index 行）。
- 历史与本轮的区别：上一轮 Codex Q-17 的 tsc 38 条、207/207、3/3、已知红例 0/1，以及 CF/CB 的 18/18、12/12、214/214，都是其他执行者的结果，只作证据读回。**下文“本轮实跑”的数字是 CQ-17 自己执行的。**

## 已读技能（Read 绝对路径，未声称调用已注册 slash skill）

| 文件 | 本轮适用 |
|---|---|
| `C:\Users\devin\.claude\skills\security-review\SKILL.md` | owner 只来自会话、参数化 SQL、私有附件不跨账号、错误不回显健康内容。旧版的 Supabase/RLS/`$1` 示例不适用 |
| `C:\Users\devin\.claude\skills\backend-patterns\SKILL.md` | 事务边界、可重试操作的幂等、错误处理；以 Express + `node:sqlite` 对照，不用 Supabase/Redis 示例 |
| `C:\Users\devin\.claude\skills\database-migrations\SKILL.md` | 审查 CB 新表：纯增量 `IF NOT EXISTS`、无回填、可空/默认值、回滚代价；PostgreSQL CONCURRENTLY/ORM 流程不适用 |
| `C:\Users\devin\.claude\skills\playwright\SKILL.md` | 该技能以 `npx` 包装 CLI 为主；按 SKILLS-HANDOFF 未调用 `npx`，沿用仓库已有 `.mts` + 系统 Edge，做真实 DOM 代表例 |

## 本轮实跑命令与结果

证据根目录：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-claude-evidence-20261017\review\execute\`。每次运行都有 `.metadata.json`，记录 worktree/branch、前后 SHA、前后 `git status`、命令、退出码和 UTC。运行进程继承协调者设置的 `ESBUILD_BINARY_PATH`、`NODE_OPTIONS`（runtime-hook）和独立 TEMP/TMP（`review\temp-execute`）。

| # | 位置 / SHA | 命令 | 退出码 / 结果 | 日志 |
|---|---|---|---|---|
| 1 | F `d794e38` | `node ../forma-task-runtime-20261017/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **exit 2，38 条**；与 Codex 在 `2786a33` 的日志逐字相同 | `tsc-F-d794e38.log` |
| 2 | B `c32d8fc` | 同上 | **exit 2，38 条**；与 F 只差一行：各自分支的新测试文件互换，均为 `node:crypto` TS2307 | `tsc-B-c32d8fc.log` |
| 3 | B `c32d8fc` | `node --import tsx --test --test-concurrency=1 server/approval-failure-recovery.test.ts` | **exit 0，12/12**（10 个顶层 + 2 个 SQL 子测试），0 fail/skip/cancel/todo，约 1.13 s | `backend-focused-c32d8fc.log` |
| 4 | F `d794e38` | `FORMA_QA_MATCH='^(sleeps-own-uncertain-save-then-remote-change\|reports-own-uncertain-save-then-remote-change\|reports-uncertain-attachment-conflict-cancel)$'` `FORMA_TEST_OUTPUT=<review\execute\frontend-representative>` `node --import tsx tests/browser/sleep-report-lifecycle.mts` | **exit 0；results.json 恰好 3 项**，名称与过滤一致，全部 passed，`pageErrors: []` | `frontend-representative-d794e38.log`、`frontend-representative\results.json`、3 张 PNG |

没有运行：Vite/完整 build（必然被 tsc 挡住）、完整 214 套件、18 项全量浏览器、完整 App、npm install、`npx`、3001/5173 服务。也没有恢复文件、写占位声明、修改配置或依赖。

## 类型诊断分类（两个 SHA 各 38 条，下表按 F 计）

| 类别 | 条数 | 证据 | 性质与最小后续选择 |
|---|---|---|---|
| 用户删除 | 1 | `src/catalog/exercises.ts(1,18)` TS2307 `./exercises.json`；该 JSON 在 `4ca685f` 中被跟踪，约 774 KB | 意图不明，**不能猜、不能恢复**。由文件所有者决定：误删则按原来源恢复；有意移除则另行限定产品范围，改 catalog 引用和训练页提示后再回归 |
| 依赖缺件：lucide | 20 | `lucide-react@0.468.0` 的 `typings` 指向 `dist/lucide-react.d.ts`，共享 `node_modules/lucide-react/dist/` 下只有 `esm/` | 共享安装不完整，不是代码缺陷。由 lead 按 lockfile 校验或重装（npm install 只由 lead 做）；不写 `declare module` 占位 |
| 依赖缺件：`node:crypto` | 15（F）/ 15（B） | `@types/node@24.19.2` 的 `index.d.ts:57` 引用 `crypto.d.ts`，文件不存在（`sqlite.d.ts`、`fs.d.ts` 存在） | 同上，交由 lead 处理 |
| 派生 | 2 | `server/app.ts(43,8)`、`(43,15)` TS7006：`scrypt` 来自缺声明的 `node:crypto` 而成为 `any`，`(error, result)` 回调失去上下文类型 | 依赖补齐后预计会消失；补齐前无法证实 |
| 可证实的代码问题 | **0** | 两个 SHA 都没有指向产品逻辑的诊断；CB 新增的 store/app 代码没有带来新诊断 | — |

**遮蔽范围（38 条只是下限，不能当成“类型正确”）：**
- `node:crypto` 成为 `any` 后，`randomUUID()`、`createHash`、`randomBytes`、`scrypt`、`timingSafeEqual` 的返回值在 `server/store.ts`、`server/app.ts` 中都不再受类型检查，账号与 ID 路径的类型保证暂时缺位。
- lucide 图标成为 `any`，JSX props 不受检查，风险较低。
- 缺失的 JSON 遮蔽很窄：`exercises.ts:12` 用了 `data as CatalogExercise[]`，下游仍按该类型检查。它的主要影响在运行时和构建：Vite 无法解析该导入。

`node_modules` 在 F、B 都是指向 `forma-health/node_modules` 的 junction，因此三个工作区的依赖缺件完全相同。

## 各类证据分别证明什么

| 证据 | 证明 | 不证明 |
|---|---|---|
| 完整 App 启动 / 训练路由 / build | 本轮**未运行**。完整 tsc 已失败（exit 2）；build 第一步就是 `tsc --noEmit`，必然失败。训练的懒加载链 `App.tsx:20 → Training.tsx → training/* → catalog/exercises.ts → exercises.json` 在 Vite 下预期无法解析（静态推断，未实测） | 不能声称 App 或训练路由可用、可构建或可发布 |
| 组件 harness（CF 18/18；本轮代表例 3/3） | 真实 Sleep/Reports 组件 DOM + 真实 SyncEngine + 本地 HTTP/SQLite 的编辑、删除、不确定保存和附件保留行为；Edge headless 1280×900 | 不覆盖 App 外壳的账号切换 key/writeBinding、SyncPanel 冲突审核 UI、训练页、390 px、Safari/iPhone |
| 领域 / 后端套件（CB 214/214；本轮聚焦 12/12） | server/rules/tests 在合成 catalog fixture 与临时 SQLite 下的契约；聚焦文件覆盖清理意图的 owner 范围、原子记账、重启后重放、最新引用和多 mutation | 不证明完整源码可类型检查或构建；没有对 PUT 做故障注入；不证明 SQLite 与文件系统的跨资源原子性 |

不能由 207/207、214/214、13/13、18/18 中的任何一个推断 F+B 组合版本通过：两个分支未集成，本轮也未验证组合。

## CB-17 独立复核（代码 + 12/12）

已核实，与 CB 自述一致：
- **原子记账**：意图在与 state、revision、entityVersions、receipt 相同的 `Store.sync` 事务（`BEGIN IMMEDIATE`）中写入。测试 9 用 ABORT 触发器证实：意图写失败会回滚整个提交和 receipt。
- **owner 与精确范围**：`INSERT OR IGNORE … SELECT … FROM assets WHERE owner_id=? AND id=?` 只记录本 owner 实际存在、且在 previous→next 中被移除的附件。测试 5 证实：移到 report 的附件、未保存的候选、另一个 owner 都不会被记录。测试 2 证实：另一账号复用同一 mutationId 得到非 200，且读不到本 owner 的附件（404）。
- **消费**：`completeAssetCleanup` 在写锁内先查精确意图，再查最新引用（`attachmentIds(snapshot.state)`）；仍被引用就保留附件并只删本条意图；失败则回滚并保留意图。测试 6、7、8、9 分别覆盖跨 Store 新引用、旧/新 mutation 互不影响、无意图无副作用（字节逐字节比对），以及删除失败保留意图后由 peer 恢复。
- **重启与重放**：测试 3 在关闭并重开 app/Store 后，用同一 mutationId 重放完成清理，旧图 404，新图 200。测试 2 证实连续重放幂等、未保存候选不被回收、导出只剩应保留的附件和草稿。
- **迁移**：`CREATE TABLE/INDEX IF NOT EXISTS` 纯增量；外键 `ON DELETE CASCADE` 指向 accounts 和 assets，删除账号或附件会退役相关意图。回退代码不会出错，但未完成的意图不会被消费；DROP 表会丢失意图。CB 报告已写明，不重复。

保留的边界（CB 已报告，本轮只读确认，不作新发现）：
- `PUT /api/state`（`app.ts` 中 `store.save` 后调用 `cleanRemovedAssets`）不记意图。清理失败后，用同一 revision 重试会得到 409，旧附件会残留。本轮只做了静态阅读，没有故障注入。
- 修复前只留下 hash receipt 的历史失败事件无法恢复清理。
- `rmSync` 成功而 COMMIT 失败的窗口仍在，与修复前相同。

## CF-17 独立复核（3 项代表例）

本轮选的 3 项正对应剩余风险：自己的不确定保存被服务端接受后，远端再改同一记录，旧编辑器不能覆盖（Sleep、Reports 各一项）；排队写入引用了新附件时遇到 409，取消后附件保留且字节一致，原附件仍可读。evidence 字段与 CF 报告一致（`ownWriteAccepted`、`laterRemotePreserved`、`cancelSafe`；`conflictStatus: 409`、`queuedAttachmentRetained`、`originalAttachmentRetained`）。

另读回 `frontend/execute-browser/final-18/results.json`：18 项，18 passed，`pageErrors: []`。

CF 的可选旧版敏感性实验没有执行（被 CLI 规则拒绝），所以新案在修复前是否会失败没有证据。本轮也未做该实验，不把它当作产品红例或阻塞。冲突放弃后新上传候选的生命周期，与 CB 修复的 previous→next 清理是两个不同的问题，**不能据此做 GC**。

## 发现（按严重度）

本轮**没有发现新的可复现产品缺陷**，因此没有产品 diff，也不需要为了产出而造 diff。

| 严重度 | 项目 | 证据级别 | 状态 |
|---|---|---|---|
| 阻塞（构建/发布） | 完整 tsc exit 2 / 38 条：1 条用户删除、35 条依赖缺件、2 条派生 | 本轮在两个 SHA 实跑 | 等待所有者决定 JSON 去留，并由 lead 校验或重装依赖；之后需重跑 tsc，看清被遮蔽的诊断 |
| 中（已知、未修） | PUT `/api/state` 提交后的清理没有持久重试 | 静态（CB 与 CQ 各自独立阅读） | 是否纳入后续范围由协调者或用户决定 |
| 低 / 观察（未复现） | `finishMutationCleanup` 在 `completeAssetCleanup` 判断之前就调用 `foodPhoto.cancelAsset`。若重放时该附件已被重新引用，而同一 owner 正好在对它做 AI 分析，这次分析会被中止，但附件不会被删 | 静态；这个顺序与旧 `cleanRemovedAssets` 相同，只是重放让时间窗变宽 | 只供原作者参考；影响是一次可重试的分析请求被中止，不涉及数据丢失。没有证据前不建议改动 |
| 低 / 观察 | 客户端从不重放时，意图会一直留着，附件也一直保留（偏安全方向），没有过期机制 | 静态 | 不建议做扫描式 GC |

## 备份边界

JSON 导出（`/api/export`）只含已保存记录、附件引用/元数据、AI 草稿和预算记录，**不含图片/PDF bytes**。服务端导出也**不含客户端尚未同步的队列**。待同步 JSON 同样没有附件本体。任何 JSON 都不是完整备份，需要另存原附件。

## 数据与资源

- 只用了合成账号、临时 SQLite、合成 PNG/PDF 和注入的 AI 响应；没有调用外部 AI，没有读取真实 `data/`、`.env` 或账号。
- B 测试的临时目录已由 `t.after` 删除；前端脚本的合成 SQLite 和 uploads 留在 `review\execute\frontend-representative\synthetic-data-*` 作为合成证据。
- 自有的 Edge、Vite、API fixture 已由脚本的 finally 关闭，运行后没有残留的 node 或 Edge 进程。没有操作其他任务的标签或服务。
- F 工作区在 22:40:26Z（本轮运行开始前）出现两处协调者文档修改：`docs/collaboration/TASKS.md`、`docs/collaboration/tasks-20261017-claude-frontend.md`，内容是 CF 进度和 session 确认，不是 CQ-17 写的，也不涉及产品或测试文件。metadata 的 statusBefore/After 已如实记录。收尾时，`forma-health`（`docs/collaboration/TASKS.md`、`tasks-20261017-claude-review.md`）和 `forma-review-recovery`（`docs/collaboration/TASKS.md`、`tasks-20261017-claude-backend.md`）也各有两处同类的协调者文档修改，同样不是 CQ-17 写的，CQ-17 未触碰；三个工作区都没有暂存内容。
- `frontend-representative-d794e38.metadata.json` 的 `FORMA_TEST_OUTPUT` 字段最初因生成脚本的 sed 转义错误被写空，已更正并在 `metadataNote` 中注明；命令实际收到的是正确路径，results.json 在该目录。

## 待决定

1. `src/catalog/exercises.json` 的删除意图（用户 / 文件所有者）。
2. 共享 `node_modules` 中 lucide 与 `@types/node` 缺件的校验或重装（lead）；之后重跑完整 tsc，再决定是否 build。
3. PUT 路径的持久清理是否纳入范围（协调者 / 用户）。
4. F+B 是否集成及组合验证（需另行授权）。

CQ-17 没有 stage 或 commit。
