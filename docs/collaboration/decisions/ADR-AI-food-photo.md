# AI 食物照片识别：增量接入

2026-10-14。人类要求添加 AI 识图，并回复“先完成接入，稍后配置密钥”。此次不启用账单或声称真实模型调用已验证。现有网站继续迭代，不重写快照架构。

## 契约

- GET `/api/capabilities` 保留 ai/apple/healthkit/mode，增加 `foodPhoto:{available,provider:'openai',reason:'ready'|'not_configured'|'invalid_config'}`。available 仅表示有效配置存在，不代表供应商连接测试成功。
- POST `/api/food-photo-drafts` body `{assetId:string,consent:true,language:'zh'|'en'}`，受登录、X-Forma-Account 与现有 Origin 防护约束。只处理本账户私有 JPEG/PNG/WebP、原文件最大 5MiB。不接受 user_id、外部 URL 或模型名称。
- 返回 `FoodPhotoDraft`，见src/types.ts：独立持久化草稿，含服务端记录的consent acceptedAt/version=food-photo-v1/language，最多8项食物，每项名称、估算grams和每100克kcal/protein/carbs/fat。不确定为null，非食物isFood=false、items=[]。
- 原始草稿不放入 AppState.meals，只有用户审核的 Meal 保存；source='ai_estimate'、aiDraftId、aiItemIndex、assetId 必须匹配本账户草稿，referenceGrams=100。手工/包装来源不得附 AI provenance。用户能删候选/改所有食物数值。不能客户端凭空声明 AI 来源。
- 每次发送图片前明确同意；不自动开启 profile.aiConsent，不传账户、过敏、训练、睡眠资料。服务端 Sharp 解码限制20MP，旋转、最长1024、重编码JPEG去 EXIF；原私有附件留本地。
- 固定 gpt-5.4-mini-2026-03-17，Responses API structured text.format；store:false、reasoning.effort=none、image detail=high，最多2000 output tokens；zod及合理营养边界检查。供应商错误正文不回显、不记录。查询时4o-mini与4.1-mini已标弃用，因此采用官方仍可用的5.4-mini快照。
- 一账户一次在途，每分钟最多5次请求、每日最多10次识别。每个实际供应商尝试预留US$0.02，最多重试一次，默认账户US$0.40/日、项目全局US$2/日。SQLite原子检查两级UTC日预算、重启不重置；全局聚合不含账户/健康信息，删除账户也不退款。预留是保守应用记账，不是供应商实收或运营预算，价格变化需复核。超时/网络/429/5xx最多重试一次，认证/拒绝/无效输出不重试。
- 错误 `{error:安全英文,code}`：AI_NOT_CONFIGURED(503)、AI_CONFIG_INVALID(503)、AI_CONSENT_REQUIRED(400)、AI_RATE_LIMIT(429)、AI_BUDGET_LIMIT(429)、AI_TIMEOUT(504)、AI_UNAVAILABLE(502)、AI_INVALID_OUTPUT(502)、AI_REFUSED(422)、AI_IMAGE_INVALID(400)。不存在/跨账户附件统一404。
- export 增加独立 aiDrafts/预算预留记录；删除账户级联。取消后未引用附件仍可 DELETE，并清理其草稿。引用中的附件仍409。

## 验证边界

通过注入 fetch 测试原始供应商 HTTP 请求/响应，不注入已解析草稿以绕过生产校验。假供应商仅在测试代码注入；网站没密钥仍返回 unavailable。

官方参考：[图像输入](https://developers.openai.com/api/docs/guides/images-vision)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)、[GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。1024px最多1024个32px patch×1.2，公开单价输入US$0.75/百万、输出US$4.50/百万，2000输出上限为US$0.009；固定短提示与schema加图像预留US$0.02/尝试。不是实际账单；价格变化需复核。配置后另做真实照片质量评估。
