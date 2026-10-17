# frontend 状态

更新：2026-10-17（America/Los_Angeles）。Owner：当前聊天 frontend 子代理（合并 shell + features）。

## 当前状态

CO-02 接手盘点已完成，可接手下一项明确派发的前端任务；本轮没有修改产品源码、安装依赖、启动服务或调用真实 AI。构建与测试由当前聊天 qa 独占运行，结果以 qa 本轮报告为准，本状态不将历史结果当成本轮验证。

## 已完成的接手检查

- 已读 AGENTS、TASKS 最新所有权表、20261017-frontend 接手提示、历史 features 状态、发给 features 的两项请求及 features 发出的上传取消、计时/兼容摘要、未保存导航请求和回复、设计规格。没有另建聊天或派生代理。
- 结构：`src/main.tsx` 挂载 React StrictMode，并在 production 注册离线 service worker；`src/App.tsx` 管理账户、演示、导航、语言、引导和同步状态。Training 使用 lazy/Suspense；训练子页面位于 `src/features/training/`，动作文字与原创基础动作在 `src/catalog/`。共享 Modal 使用原生 dialog。
- 双语：当前没有独立 `src/i18n/` 实现，语言为 `zh | en`，由 App 保存到 `forma-language` 并更新 document.lang；页面使用局部 copy 字典或语言条件表达式。动作库明确说明 8 个基础动作双语，其余来源动作说明仍是英文（Library.tsx:20），这属于已说明的覆盖限制。
- 已有代码能力：渐进引导及用户确认初始计划；饮食手动/标签份量校正、照片同意与 AI 草稿审核界面；训练动作筛选、版本计划/日程、逐组训练、暂停休息、进步及四格式导入预览；手动睡眠；趋势与记录完整度；调整前后 diff、接受/拒绝/追加恢复版本；手动报告及附件；设置中的数据导出和账户删除入口。本轮以源码盘点为证据，不声明已重新完成浏览器验收。
- 空状态与边界：`src/types.ts:251` 的 emptyState 无示例记录；Dashboard 的演示条明确标注演示，真实饮食/训练/睡眠无记录时显示 —，Trends 按已记录日期聚合并显示覆盖。Onboarding 的能量目标默认留空，确认后才追加初始版本；没有读取身体参数推定赤字。
- 同步边界：业务页面提交 `FeatureProps.save(next)`，App 注入当次渲染的同步 context；由 lead 所有的 engine/changes 执行实体 diff、队列、账户验证和冲突处理，由 backend 所有的 storage 管理本机缓存。Nutrition 与 Training 按 accountId 加 key；训练页的未保存回调接入主导航保护。前端不擅改 types/api/engine/storage/领域函数。
- 尚未交付或验证的能力：真实供应商照片质量/费用/地区可用性不由本次代码阅读确认；Settings 区分未配置、无效配置与配置存在，演示不调用 AI。报告 OCR、Apple 登录、iPhone/HealthKit 明确为未接入；不存在支付接入。报告手动页面是既有实现，不把它描述为已上线 OCR。

## 有证据的风险与下一任务

1. **确定缺陷（静态证据，待定时浏览器复验）：首页与趋势的“今日”时区不一致。** `src/features/Dashboard.tsx:30`、`:41`、`:45` 使用浏览器日期；其 helper `src/types.ts:265` 未指定 profile.timezone。`src/features/Trends.tsx:178` 则显式使用 profile.timezone。用户旅行或换设备导致浏览器时区与档案时区不同且跨日时，两个页面会筛选不同日期。例如固定时刻 2026-10-17T06:30:00Z、浏览器 America/Los_Angeles、profile Asia/Shanghai，首页为 10 月 16 日、趋势为 10 月 17 日。建议下一任务先由 lead 明确首页/记录/趋势的日归属约定，再派发最小修复与对应验证；不在接手轮更改共享 helper。

本轮不扩展全面重审。没有其他已验证的新缺陷，不把待接入能力当作新回归。

## 验证与范围

- 已实际执行 `rg` 与 PowerShell 源码/文档只读检查，核实上述文件、行号、调用及所有权；未运行 npm test、npm run build 或浏览器验收，以避免与 qa 重复构建。
- `git diff --check -- docs/collaboration/status/frontend.md docs/collaboration/requests/20261017-0054-frontend-to-lead-date-timezone.md`：通过。
- 只新增本状态与下述跨角色请求；没有纳入已有未跟踪目录或其他角色修改。

## 阻塞与发出的请求

- 接手无阻塞；源码修复需 lead 后续派发。
- 已发 `docs/collaboration/requests/20261017-0054-frontend-to-lead-date-timezone.md`，请求确认跨页面日期约定；共享日期 helper 属 lead，不直接修改。

## 待用户决定

- 本轮无新增需要用户决定的事项。
