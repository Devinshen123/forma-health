# qa 状态

更新：2026-10-14（America/Los_Angeles）。Owner：native_architecture / T-04，AI-04 为已完成历史。

## 当前状态

T-04：原创领域与 CSV/JSON 导入已实现，22 项独立测试通过。正在继续多设备同步与离线队列独立 QA。

## T-04 已完成与验证

- 已读最新 TASKS 所有权与 ADR-training-sync；拥有 src/training/、tests/、docs/reviews/、本状态文件，不碰 server/rules/catalog/sync。
- agent-reach gh 核实官方文字源固定 SHA/Unlicense/876 项完整度与未知字段；lead 批准纯文字，catalog 导入由 lead 完成。
- src/training/domain.ts：完成证据/旧摘要区分、负重训练量、1–10 rep 有界 e1RM、PR/主肌群记录完整度、两次达标的进阶候选、无 DST 漂移的星期/循环排程。
- src/training/import.ts：Strict CSV 预览、明确单位/时区、DST 歧义错误、缺值 null、duration=0 等待人工校正、整份错误不跳行、Forma 白名单与重新生成身份、稳定防重。
- 独立 tests/training-domain.test.ts 和 tests/training-import.test.ts 22/22 通过，0 fail/skip/cancel（约 0.18s）；npx tsc --noEmit 通过。
- lead 通知串行完整 npm run build 成功（8.4s / 1598 modules）；qa 未并行清理 dist。最终产物仍以 lead 集成后构建为准。
- 来源和限制见 docs/reviews/2026-10-14-training-domain-review.md。官方 CSV 帮助页未公开完整样例；本轮验证合成的明确英文格式，不宣称所有导出版本兼容。
- 当前 backend 已通知同步路由就绪；后续独立测试实体 CAS、原子/墓碑/幂等、旧 PUT 互操作、离线队列与账户边界。没有改固定端口/生产账号。

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
