# Backend 状态

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
