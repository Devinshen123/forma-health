# PET-04 伙伴测试（QA）

2026-10-19。只使用合成账户、独立临时数据库与注入服务器时钟；不读真实 data/.env，不启停 3001/5173，不启动自动化浏览器。

## 已交付

- 独立 HTTP 测试 16 案已编写并实际运行。
- 覆盖账户/Origin、禁止注入、三项日奖励、防重、编辑删除重建、UTC 与本地日、防时区刷、失败原子性、工作台投影、固定宝箱/并发重放、双人挑战隐私与导出删除。
- `--serve-only` 合成 UI 验收服务已编写；仅由 lead 启动并在现有 IAB 操作。以启动时真实 Date.now 与主机时区建档，外部记录 UTC/本地/档案日期；包含 fresh 0、grown 180XP/6日/2箱、friend 0 三个合成账户。未启动此服务。

## 验证

- 初次 HTTP：15/16；HTTPS 单例因 Fetch 控制 Host 请求头导致 403。改 node:http 发送真实 Host，产品无改动。
- 第二次 HTTP：`node --import tsx --test --test-concurrency=1 tests/companion.test.ts`，exit 0，16/16，0 skipped。已测奖励 DB 写失败时事实/收据共同回滚。
- 补充同一 UTC 日第二条不重叠睡眠、工作台删除/次日编辑重建原 ID 两个断言后，最终专项再次 exit 0，16/16，0 skipped。中间一次新增睡眠复制相同区间触发既有重叠校验 400，改为合法不重叠区间；未修改产品或降低奖励断言。
- 最终 `npx tsc --noEmit` exit 0。首次检查当时 UI 未落盘、backend 测试缺 stamped 的诊断均由各 owner 完成；QA 两文件无诊断。
- `git diff --check` exit 0（仅已有 LF/CRLF 提示）。
- 尚无真实浏览器结论；范围与边界见 `docs/reviews/companion-20261019.md`。

## 请求与边界

- 已与 backend 确认 companionNow、strict body、宝箱/邀请错误与 export shape，验证其 first-observed 修复防止时区/旧历史回填。
- 跨账户异步与真实手机/键盘/错误重试界面需 lead 的真实 CUA 验收；HTTP 不能替代 UI 结论。
- 没有新增依赖、没有修改产品。完成后只提交本任务四个所有权路径。
