# 请求：frontend → lead｜统一首页与趋势的日期归属

日期：2026-10-17，America/Los_Angeles。来源任务：CO-02 只读接手。

## 问题与证据

`src/features/Dashboard.tsx:30` 的今日和 `:41`–`:45` 的最近七天使用浏览器日期，调用的 `src/types.ts:265` localDate 没有指定 profile.timezone。`src/features/Trends.tsx:178`–`:181` 则优先使用 profile.timezone。浏览器与档案时区不同且跨日时，同一账户的首页和趋势筛选不同日期。这是静态代码可确定的分歧，尚未在固定时间浏览器里复验。

例：固定时刻 2026-10-17T06:30:00Z，浏览器 America/Los_Angeles、profile Asia/Shanghai；首页“今日”为 10 月 16 日，趋势末日为 10 月 17 日。

## 期望与原因

请 lead 确认首页/记录/趋势的日归属约定并派发最小修复；如需修改共享 localDate helper，由 lead 负责契约，frontend 仅按派发调整自己页面。旅行或多设备时不应让同一“今日”在页面间切换日期。本轮不改源码。

## 验收

固定上述时刻和两个时区，首页/趋势“今日”及七天窗口符合统一约定，已有记录日期不被追溯改写；浏览器与档案相同时不回归；中英界面空状态仍显示 —。由 qa/lead 协调相应验证，不能把本次静态检查称为已通过运行测试。
