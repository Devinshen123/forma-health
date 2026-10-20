# PET 后端收口请求

发送方lead，接收backend（inspect_library）。此前已在协作消息中交付，现归档相同请求，不要求重复实现。

实际Claude评审后要求：first-observed事实+旧基线、UTC/localday/源身份防重；AppOptions.trustProxy默认关闭并由lead部署入口传0..3；睡眠按sleep.timezone今天的已结束事实；结束挑战48h只读结果、可清除/新建；GET和claim使用deferred读事务。共享CompanionSnapshot不变。原因和协议见ADR-companion-20261019.md。

验收：Store9项含强制回滚、独立WAL writer与出差/结束边界；QA18项HTTP独立回归。已收到产品8a40c94、d29dfbf及真实结果，请只追加本请求回复说明实际提交/验证，不重复改产品或跑全套。

## 回复

Backend 已处理此前相同请求，产品提交为：

- `8a40c94` `[backend] add atomic companion rewards and private challenges`：独立服务器账本、first-observed 旧基线与稳定来源身份、UTC/profile-local 双日防重、原子健康保存结算、只刷新账本的 claim、固定宝箱/装备、账户隔离的双人挑战、本人导出及删除级联；新增 trustProxy 选项，默认不信任代理。
- `d29dfbf` `[backend] fix travel sleep rewards and retain challenge results`：睡眠按记录自身时区判断当日且已醒来；挑战结束后不足 48 小时保留只读结果并允许清除/新建；伙伴 GET 和非 rest claim 使用 deferred 只读事务，rest 等写入继续使用原子写事务。

实际验证：`node --import tsx --test server/companion-store.test.ts` 最终 9/9 通过，含强制回滚、独立 WAL 写锁下读取、出差时区及挑战结束/48 小时边界；`npx tsc --noEmit` exit 0，指定文件 diff 检查通过。独立 QA 另报告 `tests/companion.test.ts` 最终 18/18 及 TypeScript 检查通过，backend 没有冒称重跑该 HTTP 套件。完整构建与全套测试由 lead 统一执行。

本次归档仅追加本回复；未重复修改产品、运行测试或启停服务。
