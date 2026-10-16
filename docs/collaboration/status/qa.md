# qa 状态

更新：2026-10-14（America/Los_Angeles）。Owner：native_architecture / T-04，AI-04 为已完成历史。

## 当前状态

T-04：原创领域/导入、完成链路及多标签离线同步独立 QA 已通过。39 项新增独立测试与全仓155项通过；等待 lead 浏览器/原生 IndexedDB 最终验收。

## T-04 已完成与验证

- 已读最新 TASKS 所有权与 ADR-training-sync；拥有 src/training/、tests/、docs/reviews/、本状态文件，不碰 server/rules/catalog/sync。
- agent-reach gh 核实官方文字源固定 SHA/Unlicense/876 项完整度与未知字段；lead 批准纯文字，catalog 导入由 lead 完成。
- src/training/domain.ts：完成证据/旧摘要区分、负重训练量、1–10 rep 有界 e1RM、PR/主肌群记录完整度、两次达标的进阶候选、无 DST 漂移的星期/循环排程。
- src/training/import.ts：Strict CSV 预览、明确单位/时区、DST 歧义错误、缺值 null、duration=0 等待人工校正、整份错误不跳行、Forma 白名单与重新生成身份、稳定防重。
- 独立 tests/training-domain.test.ts 和 tests/training-import.test.ts 22/22 通过，0 fail/skip/cancel（约 0.18s）；npx tsc --noEmit 通过。
- lead 通知串行完整 npm run build 成功（8.4s / 1598 modules）；qa 未并行清理 dist。最终产物仍以 lead 集成后构建为准。
- 来源和限制见 docs/reviews/2026-10-14-training-domain-review.md。官方 CSV 帮助页未公开完整样例；本轮验证合成的明确英文格式，不宣称所有导出版本兼容。
- 当前 backend 已通知同步路由就绪；后续独立测试实体 CAS、原子/墓碑/幂等、旧 PUT 互操作、离线队列与账户边界。没有改固定端口/生产账号。

## T-04 最终独立验证

- 首批精确提交 e633a21，仅原创 domain/import、两个测试、review和状态文件。
- 新 routine 版本只采用该 routineId 的两次完成证据，避免旧高负重历史反复加重；原事实保持原 routineId。
- 独立 UI helper → 实际 backend schema：3/3，通过目标/actual隔离、超级组/递减组休息、稳定重试 UUID、timed null与动作备注保留。
- 独立客户端同步13/13：真实 engine/API、临时 SQLite随机端口、公共 IDB fixture；基线捕获、丢失响应幂等、账户切换、双标签合并/同时重连、settled/generation、重认证、审核 CAS 和存储失败等通过。
- 初次复现队列顺序、stale标签误删pending、迟到写复活三项失败；lead/backend修复后全部通过。只读 UI 的 drop parent/备注/自写状态问题由 features修复。
- `node --import tsx --test tests/training-domain.test.ts tests/training-import.test.ts tests/training-session-boundary.test.ts tests/sync-client.test.ts`：39/39通过，0 fail/skip/cancel，约1.62s。
- `npm test`：全仓155/155通过，0 fail/skip/cancel，约4.87s；`npx tsc --noEmit`通过。
- 未并行 Vite清dist；root先前完整build成功，最终训练集成构建/浏览器由其复核。没有调用真实 AI或固定服务，没有采购/部署。
- 核查与限制已写 docs/reviews/2026-10-14-training-domain-review.md。官方导出样例/真实浏览器IDB/服务地区公开使用仍需后续验证；这些不是本轮运行事实。
- features 最后跟进：在既有 session rest 测试补同一父工作组的两个 drop 分支；完成分支一仍提示分支二，两者完成才休息。仅改该测试和 qa 状态；`node --import tsx --test tests/training-session-boundary.test.ts` 3/3通过（约0.21s），`npx tsc --noEmit`通过。未扩展其他功能或重新运行固定服务。

## 工作范围

- 独立验证 AI 食物照片 HTTP → 原始 Responses 响应 → 生产 Zod → 私有草稿 → 用户审核保存这条链路。
- 测试只注入假 HTTP transport，使用临时 SQLite 与假测试凭据；不调用真实供应商，不读取或配置生产密钥。
- 只写 `tests/`、本次 `docs/reviews/2026-10-14-ai-photo-review.md` 与本状态文件；不修改其他角色代码。

## 已完成

- 已读根 AGENTS、任务板当前所有权、ADR-AI-food-photo 与发给 qa 的请求清单。开始时本状态文件不存在；由 qa 创建。
- 已读现有 HTTP、账户、附件与 API 测试框架，已读 security-review 技能。
- 已取得 backend 原始 `aiFetch` / `aiNow` / config 注入契约，写入 `tests/food-photo-independent.test.ts`；覆盖 raw envelope 严格校验、未知/零、审核来源、图像重编码、同意/隔离、失败/重试、持久预算/速率、在途删除与清理。
- 已补充项目全局预算跨账户/删除/重启限制，以及服务端 acceptedAt/version/language 同意证明测试；测试按 lead 更新的固定模型 `gpt-5.4-mini-2026-03-17`。
- `node --import tsx --test tests/upload-account-boundary.test.ts`：4/4 通过；证明 FileReader 等待时账户切换不重绑定上传，pre-abort/read-abort 不发 POST。
- 只读检查 Nutrition 的 sequence/AbortController、挂载状态与 App keyed-account 边界；未替 features/root 修改代码。
- 生产原始响应解析、图像处理、私有草稿/审核来源、个人/项目全局预算、逐次同意证明、错误降级、在途删除已完成独立 HTTP 验证，44/44 通过。
- 全套 `npm test`（原后端 11 + 独立 44）55/55 通过；完整 build 成功。
- 最终 Nutrition/Settings 只读复查：缺值与合计、逐次同意、审核勾选、源关联、配置状态及 Apple/HealthKit/OCR 边界说明符合本轮契约。
- 审查报告：`docs/reviews/2026-10-14-ai-photo-review.md`。

## 阻塞与请求

- 当前没有阻塞项，没有需要其他角色修复的缺陷请求。
- 浏览器与响应式流程由 lead 统一验收；qa 未操作其页面、viewport 或固定端口服务。

## 待用户决定

- 真实 API key、供应商数据处理/服务地区、服务预算尚未确认。本轮测试不会代用户开通或产生费用。

## 验证

- `node --import tsx --test tests/upload-account-boundary.test.ts`：4/4 通过。
- `node --import tsx --test tests/food-photo-independent.test.ts tests/upload-account-boundary.test.ts`：44/44 通过，0 fail/skip/cancel，约 4.65 秒。
- `npm test`：55/55 通过，0 fail/skip/cancel，约 4.19 秒。
- `npm run build`：TypeScript 和 Vite 成功；后续遵照 lead 的串行构建安排不再并行清理 dist，最终产物以其集成构建为准。
- `npx tsc --noEmit`：最终 Nutrition/Settings 只读复查之后通过；后续不再并行执行 Vite build。
- `npm test` 的55/55为该次实际运行计数；backend后来新增测试的最终全仓计数由lead集成验收记录。
- 未调用真实 AI，无供应商费用；没有真实照片质量或供应商 request 接受度的结论。

## 2026-10-16 L-04 本地隔离修复

- Owner: domain agent；目录为独立 worktree `task-2/forma-health`，分支 `codex/forma-local-safety-20261016`。只修改 `src/training/`、两个训练测试文件和本状态文件；未提交、未联网、未读取真实 `data/`。
- 已读取 AGENTS、TASKS 顶部 L-04、历史 qa 状态和 requests；当前无发给 qa 的未读请求。
- 本地代码仍有训练导入缺陷：指纹忽略 `createdAt`，同日早晚内容相同的训练会被误判重复；米列加 km/mi 声明会被错误转换。先加回归，专项 26 项中 3 项按预期失败，再修复。
- 指纹升级为 `training-v2`，将规范化的 UTC 开始时刻纳入；v1 指纹仅在保存记录的开始时刻范围内兼容，保留手工修改后重复导入的保护。无需迁移或改写历史用户数据。
- 明确距离列与行单位不一致时拒绝预览，保留已有的米/公里/英里转换与缺失单位校验。
- 另复现 10 lb 手工目标为 4.535924 kg、CSV 实际为 4.535923700000001 kg，严格比较误判未达标。仅将进阶资格比较统一到既有 6 位 kg 输入精度，不改变导入原值、统计或 e1RM；仍拒绝 9.999 lb 等不足负重。拒绝舍入后没有增长或超过 2000 kg 的无效进阶草稿。
- 已执行：`node --import tsx --test tests/training-import.test.ts tests/training-domain.test.ts`，28/28 通过，0 fail/skip/cancel，约 0.27s；`node_modules/.bin/tsc.cmd --noEmit` 通过；训练改动 `git diff --check` 通过。
- 未执行真实浏览器、正式厂商导出或生产数据验证；由 root 统一执行完整测试、build 与隔离浏览器验证，避免并发生成 dist 或占用已有服务。
- 边界：无法凭指纹恢复此前已经被旧版本漏导的训练，需要重新预览原始导出文件；仅提供日期而无开始时间的来源无法凭空区分同日同内容的独立训练。v1 记录若原始开始时刻也被手工更改，旧指纹本身不含时间，无法推回原始时刻。
- 本项没有需用户决策的高影响规格，也没有剩余工具阻塞。
