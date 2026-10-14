# Backend 状态

2026-10-14，America/Los_Angeles。

## 正在做

AI-02：实现和测试已完成，等待 lead 最终串行构建/网页验收后归档。仅拥有 server/（不含 rules）、.env.example 和本状态文件；不改 frontend、根契约/依赖或其他文档。

## 已完成

- 已读 AGENTS、TASKS、ADR 和请求；不存在此前 backend status，现补充。
- 已核对官方 Responses / Structured Outputs / 图像输入与最终模型页。按 lead 最终决定固定 gpt-5.4-mini-2026-03-17，不采用已弃用的候选。
- 已向 lead 与 QA 发布 createApp 注入形状：ai 配置、原始 aiFetch、aiNow 测试时钟。独立 QA 只注入原始 HTTP envelope，不能绕过 Zod 或解码。
- 原11项本机后端测试保持通过。
- 已实现固定 Responses fetch、结构化输出/Zod、Sharp 20MP/1024/10秒、账户绑定路由、private immutable drafts、两级 UTC microUSD 账本、逐次同意凭证及 provenance。取消/删账号会中断本进程在途请求，持久化前再查附件，失败不退预留。
- `npx tsc --noEmit`：通过（本轮代码完成后的实际执行）。
- `npm test`：57测试通过、0失败；包含自己的13项HTTP/存储测试（原11＋原始响应上限＋跨账户并发全局预留）及独立QA 44项。真实fetch adapter由原始 Responses HTTP fixture验证，未联系供应商。
- 已处理请求1210（日请求=AI_BUDGET_LIMIT、Sharp10秒与持久lease）和1220（独立全局UTC账不随删账号退还、同意凭证、拒控制字符）。
- Lead报告已执行 `npm run build` 成功；最终 Vite 构建仅由 lead 串行进行，backend没有并发清理dist。待最终构建通知补上最终记录。

## 阻塞项 / 请求

无实现阻塞。用户将稍后配置密钥，所以不做真实供应商请求，不开通付费服务；缺配置本身须作为正常错误场景验证。

## 待用户决定

- 真实 OpenAI 密钥和供应商账户准备情况。
- 真实照片质量评估与以后预算；本次预留账本是应用保守记账，不是实际费用承诺。
