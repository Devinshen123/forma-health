# features 状态

## 正在做

AI-03 初次交付已提交 526ecbd，完整构建和 IAB 夹具交互通过。当前完成“新草稿出现后定位审核区”的聚焦修复，待 lead 串行构建并重拍响应式截图；未将真实 OpenAI 推理质量写成已验证。

## 已完成

- 已读 AGENTS、TASKS、ADR-AI-food-photo、共享类型/API、当前页面和设计规格；没有发给 features 的既有请求。
- 使用项目 React best practices 和 i18n-expert 的双语/错误码指导；沿用现有语言切换，不改全局 i18n 架构。
- 上一轮四模块实现已有 TypeScript/Vite 与双语渲染验证；这些不充当本轮 AI 流程已通过的证据。
- Nutrition 保留原手动/标签流程，新增照片 → 每次明确 OpenAI 同意 → 私有上传与识别 → 多食物候选校正/移除 → 用户确认保存。每项使用每 100 g 标定和确定性份量换算；null 保留空值，未知或无效值不参与完整合计、不允许确认保存。
- 保存保留 aiDraftId、原 aiItemIndex、assetId、referenceGrams=100、source=ai_estimate；候选 Meal UUID 在重试期间稳定。既有 AI 记录修改数值保留来源，明确改为手动/标签时才清 AI 关联。
- AbortController + 运行代次 + mounted guards 覆盖上传、识别、确认、取消、卸载后响应与 toast；变更照片清草稿/同意。新上传资源在取消/替换/移除或卸载时清理，失败保留可重试，成功保存清 staged 标志；从不直接删除旧记录引用的附件。
- Settings 读取 capabilities：区分配置存在、未配置、无效与读取失败；识图、OCR、Apple 登录、HealthKit 分开说明。演示不请求识别、不模拟 AI；提供创建账户入口。
- 每次同意说明仅照片副本及输出语言发送 OpenAI、不附其它记录、去 EXIF 和供应商保留政策；链接到已读取的 OpenAI 官方数据政策。没有零保留、医学判断、过敏原确定性或置信分数承诺。
- 处理 lead 的 20261014-1300 请求：审核 h3 使用 ref / tabIndex=-1；只有新的 aiDraft.id 出现且 analyzing=false、标题已渲染时触发一次 preventScroll focus 和 scrollIntoView(block=start, behavior=auto)。非食物结果同样定位到审核说明；编辑数值、删候选和同意 checkbox 不改变草稿 ID，不抢焦点。

## 验证

- node node_modules/typescript/bin/tsc --noEmit：通过（Nutrition/Settings 接入完成后再次运行）。
- 临时 node --import tsx --input-type=module SSR smoke：通过；验证中英渲染、用户食物原文保留、AI 来源标注、每 100 g 的 150 g → 300 kcal 换算、Settings OCR/Apple/HealthKit 分离及政策链接。
- git diff --check -- src/features/Nutrition.tsx src/features/Settings.tsx：通过；只有 LF/CRLF 提示，无 diff 空白错误。
- 本轮首次 npm run build：tsc 通过，Vite 清理 dist/demo-meal.png 时 EPERM；lead 确认当时并发构建，lead 的完整构建已成功。随后不再并发执行 Vite，只运行 tsc；最新完整交付等 lead 串行构建确认。
- QA 已报告独立 HTTP/API 边界 44/44、全套 npm test 55/55 通过；这些是 QA 执行结果，不是 features 自己运行的供应商实测。
- lead 最终串行 npm run build：完整通过；最新 npm test：57/57 通过。以上由 lead 执行并在协作消息确认，覆盖最终集成代码；首次并发构建的 EPERM 不再阻塞。
- lead 在 IAB 的隔离测试夹具完成真实 UI 交互：模型 null 保留空且保存禁用 → 米饭名称/150 g 改为 200 g → 鸡肉补 100 g、fat 3.6 → 425 kcal 合计 → 删除鸡肉候选 → 显式审核 checkbox → 保存单项。保存结果 260 kcal、protein 5.4 g、carbs 56 g、fat 0.6 g，来源仍 AI estimate。
- IAB 截图接口不可用，lead 改用已授权的现有 Edge 补响应式查看；features 没有把不可用截图或真实供应商照片质量写成已验证。
- 聚焦修复后 node node_modules/typescript/bin/tsc --noEmit 与 git diff --check -- src/features/Nutrition.tsx：通过（仅 LF/CRLF 提示）。遵照 lead 协调，没有并发执行 Vite；本次完整构建和滚动截图由 lead 接续验证。
- lead 报告聚焦修复前全套测试已达到 99/99（含独立 Claude rules 测试）；未把这视为新滚动行为的浏览器验证。

## 阻塞与请求

- 请求 requests/20261014-1157-features-to-lead-ai-upload-cancel.md 已获 lead 回复并完成 API/App 修改；features 已采用 signal 和 onCreate。
- 实现没有待解决契约阻塞。lead 已完成隔离测试夹具交互验收，qa 已获知最终 Settings 和源标注行为；不会停止或改动共享服务端口。
- requests/20261014-1300-lead-to-features-ai-review-focus.md 已在接收方回复中记录修复和 tsc 结果；没有接口、后端或样式改动。

## 待用户决定

- 用户已说明稍后配置 OpenAI 密钥；本轮不会启用账单或声称真实供应商推理已验证。
