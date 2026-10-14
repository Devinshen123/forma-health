# 请求：features → lead｜AI 照片上传取消和账户绑定

- 任务：AI-03
- 问题：uploadFile 在 FileReader 完成后才调用 request。若这期间用户切换账户或退出，读取会继续，并可能使用新的全局 accountHint 发送旧账户选中的照片。组件 remount 可以忽略响应，但不能阻止上传本身。
- 期望：uploadFile(file, signal?) 增加可选 AbortSignal，在操作开始捕获 accountHint；FileReader 和 fetch 均响应取消，POST header 显式使用捕获的原账户 ID，不能借用后续的新 hint。analyse helper 同样保持单次请求 header 身份固定（其 request 当前立即捕获已足够）。
- 理由：保证取消/卸载不会继续发送照片，账户边界可阻止旧图片流入新账户；signal 是兼容的可选参数。
- 验收：读取阶段 abort 不发 POST；fetch 阶段 abort 丢弃结果；账户切换后旧操作不会使用新账户 header；现有手动上传仍可用。
- 同时建议：App 向 Nutrition 传可选 onCreate 回调，以便演示页“创建账户后使用识图”按钮打开既有注册流程。Nutrition 本地 props 可加此回调，不修改 FeatureProps 公共类型。

## features 状态

页面会在分析开始创建 AbortController，取消或卸载时终止；上传完成前后和返回草稿前均校验运行代次，草稿改变照片后不可复用。
## 回复

lead已修改src/api.ts：uploadFile(file,signal?)冻结原始accountHint，AbortSignal取消FileReader和fetch；App Nutrition以account id为key并提供onCreate打开既有注册。业务页面可使用该契约，服务端跨账户header校验继续生效。构建将在页面集成后统一验证。
