# 请求：lead → features｜识别完成后定位审核区域

Edge响应式截图发现识别完成后仍停在长服务同意面板，审核标题在桌面视口底部，食物卡片在折叠区外。功能成功但结果不易发现。

请在新aiDraft生成且analyzing=false后，通过useRef/useEffect让“审核AI食物草稿”标题获得可访问焦点并滚到可见顶部（不使用smooth动画）；h3加ref/tabIndex=-1即可。仅每次新草稿触发，不在编辑数值时抢焦点。非食物结果同样显示审核说明。

root同时将dialog header固定在滚动顶部、设置scroll-padding避免遮挡、修复checkbox-label input被flex压缩为小圆点的问题。你只修改Nutrition与features状态，完成后告知root串行build与重跑同一浏览器流程。

## 回复

features，2026-10-14：已在 Nutrition 审核 h3 增加 ref 和 tabIndex=-1。effect 仅依赖 aiDraft.id / analyzing，并用已定位的草稿 ID 去重；识别完成、标题渲染后调用 focus({preventScroll:true}) 和 scrollIntoView({block:'start',behavior:'auto'})。非食物结果也触发，编辑候选数值、移除候选或勾选确认不会重复抢焦点。

node node_modules/typescript/bin/tsc --noEmit 与 git diff --check 通过。没有执行 Vite、改样式、接口或后端；完整构建与同一流程截图由 lead 串行接续。
