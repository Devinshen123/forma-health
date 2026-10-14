# AI-04 独立照片识别接入审查

日期：2026-10-14（America/Los_Angeles）。Owner：qa / native_architecture。

结论：**本次独立代码边界与夹具测试通过，没有发现阻塞本轮接入的缺陷。** 独立测试 44/44 通过；包含原有后端测试的 `npm test` 为 55/55 通过。本次也实际运行了一次完整 build 并成功，之后遵照 lead 的串行构建安排不再并行清理 dist，最终产物以 lead 集成构建为准。

这个结论不等于真实 OpenAI 调用、照片识别准确度、费用账单、供应商连接、生产环境或完整 UI 验收已通过。测试没有使用真实密钥、没有访问供应商网络、没有产生供应商费用。

## 范围与方法

根据 [ADR-AI-food-photo](../collaboration/decisions/ADR-AI-food-photo.md)，独立创建两个测试文件：

- `tests/food-photo-independent.test.ts`：临时目录 SQLite、port 0 HTTP 服务、真实账户/附件/草稿/保存路由。注入的是原始 Responses HTTP envelope，不是已经校验的草稿；所以每个响应仍经过生产解析器、Zod 与来源验证。
- `tests/upload-account-boundary.test.ts`：一次性假的 FileReader 和 fetch，验证读取期间账户变更与取消边界。测试结束恢复全局对象。凭据、姓名、食物、图片、日期都是明确的测试夹具。

所有配置显式传入 `ai`，`ai:{}` 用于缺密钥场景；不读取机器环境密钥。HTTP harness 只监听临时随机端口，未启动、停止或修改共享的 3001/5173 服务。测试 cleanup 先核实临时目录绝对路径，再删除自己的临时目录。qa 未修改 server、src、依赖或其他角色文件。

## 实际验证

| 检查 | 结果与证据 |
| --- | --- |
| Responses 请求 | 固定官方 URL/model、`store:false`、reasoning none、image high、2000 输出 token 上限、严格 JSON schema；测试检查生产适配器实际发出的 body |
| 图像处理 | 实际生成有 EXIF 的合成 JPEG；传给适配器的是 ≤1024 边长 JPEG，EXIF 不存在；只传图像和输出语言，没有账户名、过敏备注或 user ID |
| 草稿与事实分离 | 成功返回独立草稿，AppState.meals 仍为空；经用户校正的名称/份量/营养可以保存，原始草稿内容不被改写 |
| 未知与零 | `null` 保留为未知；明确返回的 0 仍为 0；不能将未知营养值直接存成已审核 Meal；非食物保留空候选，不自动保存 |
| 每次同意 | 缺失/false 同意在供应商调用前拒绝；成功草稿及导出保留服务端开始时间、`food-photo-v1` 与语言；客户端伪造 acceptedAt 拒绝 |
| 登录/账户/私有附件 | 未登录、旧账户 header、跨账户附件、外部 URL/model/user_id、错误 Origin 等在供应商调用前阻断；不存在与跨账户附件均 404 |
| AI 来源 | 假 draft ID、越界 item index、其他图片、非 100g 基准、缺少 provenance 和 manual/label 附 AI provenance 均拒绝；另一个账户不能借用草稿 |
| 严格输出 | 错误类型、缺字段、>8 候选、负数、异常宏量、顶层/item/营养层额外字段、控制字符、非食物却有候选均 `AI_INVALID_OUTPUT`，只尝试一次，不生成假数据 |
| 格式与拒绝 | 错 envelope、坏 JSON、incomplete 与 refusal 映射为安全错误；无供应商正文、测试 key 或 stack 回显 |
| 未配置/无效配置 | capabilities 明确不可用，503 对应 code；没有 transport 调用，没有草稿 |
| 失败与重试 | 认证错误不重试；503/500/429 或真实 abort-aware 超时最多两次；失败不返还预留，每个尝试单独记账 |
| 持久个人额度 | 日请求上限、分钟限流和预算跨 service restart 保留；新 UTC 日使用新 bucket；其他账户独立计数 |
| 项目全局预算 | 两账户耗尽 0.04 USD 测试上限后，删除账户、创建新账户和重启仍阻断；下个 UTC 日可用；账户 export 只含自己的预留 |
| 并发 | 同一账户已有在途分析时第二个请求被阻断，没有重复供应商调用 |
| 图片边界 | GIF、损坏 PNG、>5MiB、>20MP 都不调用供应商 |
| 删除与取消 | 未引用照片删除会清理草稿；有已保存记录引用的照片 409；在途删除照片/账户不会恢复草稿或私有行，外键检查无孤儿；已经发生的预留不会退款 |
| 前端上传账户边界 | FileReader 等待时 A→B 切换后，POST 仍使用发起方 A header，使服务端能够阻断跨账户写入；pre-abort/read-abort 都不发 POST |

预算测试验证的是应用内保守预留账本，不是 OpenAI 的实际费用。图片夹具只证明解码/尺寸/元数据边界，不证明“图中的食物”被正确识别。

## 前端只读审查

审查 `src/features/Nutrition.tsx`、`Settings.tsx`、`src/App.tsx` 与 `src/api.ts`：

- 不确定项转换为空输入；合计缺失为 `—`，不补成 0；缺值、空候选或未确认审核时不能保存。
- 修改任何审核项会清除已核对状态；移除候选保留原 item index，保存 UUID 稳定，重试不默认添加第二份新记录。
- `AbortController`、代次与 mounted 检查阻止取消、换图和卸载后的旧结果填入新表单；按用户 ID key 的 Nutrition 隔离账户页面状态。
- 每次同意与用户审核分别处理；不把单次照片许可写成 `profile.aiConsent=true`。配置状态只声称“已配置”，不冒充连接或真实照片效果已验证。
- 明示 OpenAI、照片/输出语言、EXIF 去除与供应商保留政策链接；原始照片保留在当前私有实例。
- 原本手动记录仍可使用，演示模式不发分析请求；Apple 登录、HealthKit、报告 OCR 明确尚未接通。

以上是代码审查与 API 单元证据；qa 没有运行本轮完整浏览器/响应式/键盘验收，也没有操作 lead 的测试页面或 viewport。由 lead 统一完成浏览器流程与截图证据。

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `node --import tsx --test tests/upload-account-boundary.test.ts` | 4/4 通过 |
| `node --import tsx --test tests/food-photo-independent.test.ts tests/upload-account-boundary.test.ts` | 44/44 通过，0 fail/skip/cancel；约 4.65 秒 |
| `npm test` | 55/55 通过，原 11 个后端回归与独立 44 个检查均通过；约 4.19 秒 |
| `npm run build` | TypeScript 与 Vite 成功；这是实际运行结果，最终 dist 以 lead 串行集成构建为准 |
| `npx tsc --noEmit` | 最终只读复查后再次通过；后续不并行执行 Vite build |

## 未验证与后续范围

- 真实供应商是否接受整个 request/schema、账户 API 权限、模型质量及 token/账单实测需配置密钥后验证；夹具成功不能替代实际调用。
- 未验证多供应商、OCR、HealthKit、Apple 登录、公开邀请部署或生产并发。
- 真实图片评估需要覆盖中餐/混合菜、不可见油脂、份量、非食物、低光及多语言名称；保存仍必须由用户审核。
- 原图/草稿保留期限、首发服务地区与运营预算仍待用户决定；默认资源护栏不代表用户已批准运营预算。
- 本轮无需要发给其他角色修复的阻塞项；没有越过文件所有权替他改代码。
- 55/55 是本报告运行 `npm test` 时的实际计数；backend 后续新增的独立测试由其和 lead 运行，最终全仓测试计数以集成验收为准。
