# Backend 状态

## B-17 — 2026-10-17 当前执行

- 唯一执行者：`/root/backend_task`；分支 `codex/forma-approval-failure-recovery-20261017`，起点 `33f12568e7fb386efd88def9cd63dc1ee5883217`；不向此前不可用的旧角色会话重复发送 GO。
- 已读取本区 `AGENTS.md`、`CLAUDE.md`、`docs/collaboration/TASKS.md`、`tasks-20261017-three-directions.md`、`docs/PROJECT-STATUS.md`、`docs/SKILLS-HANDOFF.md`。
- 已实际读取技能：`C:\Users\devin\.codex\skills\backend-patterns\SKILL.md`（Express/SQLite 错误与事务）、`C:\Users\devin\.codex\skills\security-review\SKILL.md`（账号/私有附件；本机是已标记旧版）、`C:\Users\devin\.codex\skills\tdd\SKILL.md` 与其 tests/mocking 参考（已授权 HTTP/SQLite 故障 seam，先红后绿）。没有把推荐上游视为已安装，也没有安装、更新或执行来源脚本。
- 已新增 `server/approval-failure-recovery.test.ts`：第二 Store 在提交/清理间隙新增引用、Store 层过期清理候选、实体/receipt 写入中途 SQL ABORT 回滚。仅使用临时 SQLite、合成账号/附件和注入 Responses HTTP，不读取 `.env` 或真实 `data/`。
- 已实证并最小修复：另一 Store 在状态提交后新增 report 引用，原清理操作仍把该图删除，HTTP GET 从预期 200 变成 404，Store 删除也误返回 true。`Store.deleteAsset` 现在在 `BEGIN IMMEDIATE` 写锁内按 owner 查最新 meals/reports 引用，仍被引用则保留；最终引用真正删除后仍可有针对地清理。未改 schema、接口、依赖或客户端。两个实际红例修后通过。
- SQL 中途故障验证无产品缺陷：在第二个实体版本插入、以及 receipt 插入时触发 SQLite `RAISE(ABORT)`；完整 state/revision/entityVersions/receipt 均不提交，撤销故障后原 mutationID 成功一次且重放不重复写。没有为这部分修改事务逻辑。
- 最初共享依赖缺少 esbuild.exe、Sharp `.node` 与 TypeScript 主文件，Node 26 内置 TS 亦不支持现有参数属性；这些加载错误没有算作产品红例。总控从本机缓存按 lockfile SHA-512 核对后建立独立 runtime overlay，未下载、执行安装钩子、恢复或覆盖共享 node_modules。后续使用精确 esbuild 0.28.2 / Sharp 0.35.5 的 overlay 实测 HTTP 与 SQLite。普通沙盒阻止 loopback（EACCES），已授权的临时本地 HTTP 回归通过升级审查运行；没有权限拒绝或真实外部请求。
- 证据根目录：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-evidence-20261017\backend`。真实修复前证据为 `baseline-http-sql-loopback.log`（3 通过、3 失败，含 SQL 子用例）；修复后局部 `fixed-race-sql.log` **5/5 通过、0 失败**。仅运行 `--test-name-pattern='second Store|stale cleanup|SQL failures'`，不把未修复清理重试算作通过；全量由 QA/总控串行安排。
- 实际测试命令：进程内设置 `ESBUILD_BINARY_PATH=C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-runtime-20261017\node_modules\@esbuild\win32-x64\esbuild.exe`、`NODE_OPTIONS=--import=file:///C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017/runtime-hook.mjs`，并令 TEMP/TMP 指向上述证据目录；执行 `node --import tsx --test --test-concurrency=1 --test-name-pattern='second Store|stale cleanup|SQL failures' server/approval-failure-recovery.test.ts`。无需全局环境改动。
- 源码诊断：`Store.sync` 先提交状态、实体版本与 hash receipt；随后 `cleanRemovedAssets` 执行附件删除。SQL DELETE 故障可在提交后返回 500，而 receipt replay 不再有 previous state。安全持久重试需要明确的清理意图，现有 hash-only receipt 不包含候选；不通过扫描/删除全部未引用附件补救，避免误删未保存编辑器/outbox 仍持有的附件。若需 schema/持久化策略变化，先报告决策。
- 若确认实施持久清理重试，最小后续设计应把“确切曾引用、现移除的 owner/asset 候选”与状态/receipt 在同一事务记账；重试仅消费对应意图，并在 SQLite 写锁内重新查当前引用。文件删除失败也必须保留可重试意图。该方案涉及持久化策略/迁移，本任务未获授权实施；未把候选上传、未保存编辑或全部无引用资产纳入清理范围。
- 未修复问题已放独立可复跑诊断 `forma-task-evidence-20261017/backend/reproduce-postcommit-cleanup.mts`，保留“同 mutationID 重试后旧附件应 404、实际 200”的原始断言，预期退出码 1。正常回归没有隐藏 TODO 或把此失败算作通过；`POSTCOMMIT-CLEANUP.md` 说明运行命令、提交状态与所需决策。
- 四项用户预存删除与未跟踪 `AGENTS.md` 保留，不暂存；不恢复动作库，不声称当前工作区 build 通过。未运行全量、构建、浏览器、真实 AI、部署、push 或合并。

以下为早先已完成任务的历史结果，不能当作本轮新验证。

2026-10-14，America/Los_Angeles。

## 正在做

T-02 已完成并提交13b3bbd。客户端独立审查后，lead新增分配src/sync/storage.ts独占写权限，存储consent epoch与队列事务保护已实现并验证；engine/App/api仍由root修改。AI-02 保持完成。

## 已完成

- 已读 AGENTS、TASKS、ADR 和请求；不存在此前 backend status，现补充。
- 已核对官方 Responses / Structured Outputs / 图像输入与最终模型页。按 lead 最终决定固定 gpt-5.4-mini-2026-03-17，不采用已弃用的候选。
- 已向 lead 与 QA 发布 createApp 注入形状：ai 配置、原始 aiFetch、aiNow 测试时钟。独立 QA 只注入原始 HTTP envelope，不能绕过 Zod 或解码。
- 原11项本机后端测试保持通过。
- 已实现固定 Responses fetch、结构化输出/Zod、Sharp 20MP/1024/10秒、账户绑定路由、private immutable drafts、两级 UTC microUSD 账本、逐次同意凭证及 provenance。取消/删账号会中断本进程在途请求，持久化前再查附件，失败不退预留。
- `npx tsc --noEmit`：通过（本轮代码完成后的实际执行）。
- `npm test`：57测试通过、0失败；包含自己的13项HTTP/存储测试（原11＋原始响应上限＋跨账户并发全局预留）及独立QA 44项。真实fetch adapter由原始 Responses HTTP fixture验证，未联系供应商。
- 已处理请求1210（日请求=AI_BUDGET_LIMIT、Sharp10秒与持久lease）和1220（独立全局UTC账不随删账号退还、同意凭证、拒控制字符）。
- Lead最终串行执行 `npm run build`：完整通过；再次 `npm test`：57/57通过。backend没有并发清理dist。
- Lead实际浏览器夹具链路：识别草稿→逐项审核→保存一项260kcal、source=ai_estimate成功。该数据由临时原始HTTP夹具供应，不能当真实模型识别质量验证。
- 实现提交：`e9d4a6c [backend] add private AI food-photo drafts and budget guards`，仅10个自身所有权文件，排除 server/rules；请求回复由lead随其文档提交。

## 阻塞项 / 请求

- 请求：`20261014-1424-backend-to-lead-training-sync-contract.md` 已由 lead 通过消息及 ADR-training-sync 批准。
- 无后端实现阻塞。没有启动/重启固定端口服务；lead 将加载新代码做浏览器离线与多客户端验证。
- 用户将稍后配置密钥，所以不做真实供应商请求，不开通付费服务；缺配置本身须作为正常错误场景验证。

## T-02 实现与验证

- GET/POST /api/sync：所有者header、实体 CAS / tombstone /1000项原子batch、SHA256-only幂等、原 PUT 同版本账，未重写原 snapshot。
- 旧库默认空新集合，旧PUT省略集合保留服务端值；详细组不能同ID剥离。训练 SetLog / Routine追加版本 / Schedule引用 / active暂停严格Zod。
- 全部写入统一走完整state、plan transition、ownedassets和真实AI provenance；保存后取消并清理被移除附件。账户删除cascade同步表，独立全局AI账保持。
- `node --import tsx --test server/sync.test.ts server/api.test.ts`：21/21通过。
- `npm test`：116/116通过，0失败（包含原AI/账户/规则和新10项sync HTTP）。
- `npx tsc --noEmit`：全仓通过；早期root模块暂未落盘的两轮错误已消失。
- lead串行 `npm run build`：成功，包含tsc/Vite与3个静态文件的离线壳。
- `git diff --check` own paths：通过。
- 未复制外部 schema/code/media，未调用外部供应商，未操作真实用户数据。

## 客户端同步只读审查

- 已读engine/storage/App/api并立即向lead报告401清pending、多标签blind覆盖、logout失败epoch失效、无timeout以及resolve缓存失败状态。请求 `20261014-1435-backend-to-lead-client-sync-races.md` 记录触发路径与验收。
- Lead接受并实现修复；独立QA负责客户端测试。没有改客户端、启动新端口或重复后端满测试。
- boot明确user:null不会fallback缓存，已核实并向lead澄清，避免误报。
- 二次指出auth失败提前切hint/epoch、resolve无关batch稳定ID、disable错删其他标签pending及撤回缓存被旧writer重建；lead接受。
- storage实现：meta consent.enabled/generation、私有写入generation CAS、atomic requireEmpty clear、incoming队列顺序和settled ID账、同ID不同payload拒绝、较新snapshot、readLast排除撤回。缓存清除只留无健康内容的撤回generation记录。
- `npx tsc --noEmit`：通过；`node --import tsx --test tests/sync-client.test.ts`：11/11通过；`npm test`：153/153通过、0失败。
- 最后logout账户绑定修复由lead批准：有效session必须hint匹配；无session幂等。真实HTTP证明stale A或缺hint不能注销cookie B。
- 最终 `node --import tsx --test server/api.test.ts tests/sync-client.test.ts`：24/24通过；`npm test`：155/155通过；`npx tsc --noEmit`：通过。较先前153新增的独立用例都纳入最终全仓结果。
- storage/logout最后修复后的Vite构建及真实浏览器等待lead串行验收；backend没有启动服务或操作真实本机账户。

## 待用户决定

- 真实 OpenAI 密钥和供应商账户准备情况。
- 真实照片质量评估与以后预算；本次预留账本是应用保守记账，不是实际费用承诺。

## L-02 local safety audit (2026-10-16)

- Scope: isolated `codex/forma-local-safety-20261016` worktree only; no real data, provider calls, push, remote branch, deployment or commit.
- Confirmed the baseline account-header bypass: Express accepts case/trailing-slash aliases while the old auth middleware classified private paths by exact req.path spelling.
- Replaced the path inventory with route-bound authorization: all existing private data middleware requires X-Forma-Account; attachment GET/HEAD explicitly uses session-only authorization and still looks up the asset by the session owner.
- Regression first failed as expected: `GET /API/state` with B's cookie and A's header returned 200 instead of 401.
- After the fix, `node --import tsx --test server/api.test.ts server/sync.test.ts server/food-photo.test.ts`: 24 passed, 0 failed. The HTTP matrix covers canonical/uppercase/trailing-slash aliases, uppercase API prefix, stale/missing headers, state/sync/export/account/assets/AI-draft operations, data preservation, and owner-scoped attachment GET/HEAD.
- Added an assertion that JSON export contains attachment metadata only (id/name/mime/size/createdAt), not attachment bytes. It is not a complete attachment backup.
- `npm test` was executed: backend, AI and sync tests passed; the concurrent training-import edit was temporarily incomplete (`fingerprintV1 is not defined`). Lead was notified and will run the integrated suite once all edits settle.
- Lifecycle audit: synchronous state/sync/assets use the authenticated immutable owner; async AI uses an owner-scoped active request and checks cancellation/attachment ownership again before persisting. Existing fixture HTTP tests cover deletion during inference. No new API contract or health-rule change.
- Ordinary sandbox localhost fetch was denied by the environment with EACCES. The same synthetic-data tests were allowed through the escalation review and completed; no remaining backend test-network blocker.
