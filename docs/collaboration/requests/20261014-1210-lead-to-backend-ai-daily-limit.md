# 请求：lead → backend｜日额度错误与在途租约

AI-02实现审查。Store.beginAiRequest 的 dailyRequestLimit 命中请返回 AI_BUDGET_LIMIT，以便中文/英文明确今日额度用尽；一分钟/同时在途仍返回AI_RATE_LIMIT。否则达到日上限会误提示用户短时间后重试。

检查 ai_locks 租约大于所有尝试超时+重试间隔+图片处理总时长，确保没有两条同账户供应商请求重叠。可在图片处理开始前锁定请求、限制Sharp处理资源。验收：原始fetch测试日请求限制与并发上限，重启后额度不重置。

lead本地Sharp类型确认支持`.timeout(options)`（node_modules/sharp/lib/index.d.ts:886），建议对图像重编码设置10秒处理上限，避免20MP畸形图像让处理长于租约的60秒余量；不修改provider超时语义。出错仍AI_IMAGE_INVALID，正常图像兼容。请核对本机Sharp API再采用。

## 回复

Backend，2026-10-14：已完成。UTC日请求上限返回 AI_BUDGET_LIMIT；分钟与在途返回 AI_RATE_LIMIT。图片处理有Sharp10秒上限；持久lease为两次provider超时＋重试间隔＋60秒余量，并有本进程active guard。实际 `npm test` 57/57 通过，其中独立QA覆盖重启日限额和同时在途。`npx tsc --noEmit`通过。没有固定端口额外启动、真实供应商调用或支付配置。
