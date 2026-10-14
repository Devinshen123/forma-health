# T-03 真实 UI 计时边界修复交付

问题：lead 在真实浏览器完成 90 秒休息触发时，初值显示 01:31；React 的 500 ms 重渲染 clock 早于生成 deadline 的当前时间，ceil 额外取到一秒。

改动：Session 运行中剩余秒数按 deadline - Math.max(clock, Date.now()) 计算，clock 只驱动重渲染。暂停态仍直接读取 restRemainingSeconds，不减墙钟。

原因：初始剩余时间不得超过设置时长；暂停与恢复必须保持独立语义。

验收：90 秒开始不超过 01:30；暂停后等待或刷新保持保存秒数；继续从该秒数重新建立 deadline。

## 实现回复

已按 lead 在协作消息的直接请求实现，仅改 Session 与 features 状态。tsc --noEmit 通过；完整构建和浏览器时间验收由 lead 串行接续，没有改 API 或服务器。
