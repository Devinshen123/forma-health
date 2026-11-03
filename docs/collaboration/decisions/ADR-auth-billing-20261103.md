# ADR：Casdoor身份与Lago开源测试计费

2026-11-03；决定人01 lead；用户已批准按先登录、后开源Lago测试收费的方案实施。详见[设计](../deliverables/lead/auth-billing-20261103/design.md)与TASKS；当前只登记本轮明确范围，不授权真实扣款或其他业务重构。

- 保留Forma accounts.id、数据owner、既有Google/Apple身份键和会话规则；新增casdoor提供方，auth/options的providers新增casdoor及公开authorizationEndpoint，客户端类型同步扩展。不向浏览器传客户端密钥。
- Casdoor主体键为SHA256(JSON.stringify([verifiedIssuer,verifiedSub]))，不按邮箱自动合并。旧账户本人登录、确认原密码后显式绑定；没有原密码的Google账户先设置Forma密码，不以单纯已登录替代再确认。
- 验证固定配置的应用专属JWKS、RS256、issuer/aud/nonce/时间和id-token类型；复用S256 PKCE和同源ticket完成流程，认证故障不得影响未启用的旧提供方。
- 认证服务与Forma健康存储分离；Casdoor配置/证书/数据库、测试邮件持久化在D盘独立服务。文件会话按固定4.25源码真实路径/tmp绑定D盘，重建容器不得丢会话或改变主体。
- 后续Lago1.56仅自托管开源sandbox，按会话owner做客户/订阅/账单归属。外部接口及前端会员契约在LAGO-OSS-01实施时增量登记；不把商业版POST/payments当开源接口。
- 签名通知专用raw body路由和持久防重，权益从后端权威状态推导；不会以跳转成功、前端金额或套餐名字开通会员。Fud成功结果、额度和outbox需原子提交、可恢复幂等。

本轮技术辅助审查非06本人产品验收；候选先同步主管分支，正式验收/集成遵循唯一TASKS。关闭服务时保留新增身份/账本和当前数据；不靠恢复旧快照回滚新健康记录。

## LAGO-OSS-01 已实现契约

- `src/billing.ts`定义公开BillingSnapshot/套餐/账单类型。GET `/api/billing/options`只返回公开测试套餐；GET `/api/billing/account`、POST `/api/billing/{subscribe,simulate-payment,cancel-renewal,sync}`均从原会话推导owner并校验X-Forma-Account。变更另受loopback Host/Origin和限流约束。客户端不能传客户编号、金额、额度或任意上游URL。
- 新增5张billing表，不改accounts.id/健康表：membership缓存、operation预留/成功账本、持久outbox、已验签通知摘要、仅保留opaque编号的删除重试。导出增加安全计费元数据；本地删号级联计费记录，外部清理只在本地账户确实不存在后重试。
- 两个测试模板Free $0/3次、Pro $20/100次，不代表正式定价。Lago套餐、订阅及权益为来源；Pro需属于当前owner/当前内部订阅/当前账期的finalized+succeeded账单、有正subscription费且币种一致。旧账期付款和通知body不能授予新账期。权益直接取同一subscription响应内的entitlements，禁止拼接两个“当前active”读取结果。
- 成功食物草稿才计1次，非食物/失败不计次。owner+asset+language的稳定操作键使丢失HTTP响应可返回原草稿；草稿/成功状态/唯一outbox在同一SQLite事务提交。5分钟预留租约限制并发，旧租约不能释放或提交新租约。预留及最终快照再次核对账期边界；同period_end的套餐切换继承已用次数。
- 使用精确毫秒Unix秒值`created_ms/1000`发送事件，不能floor。发送前先GET已有原回执；404才POST，不确定POST失败后再查回执。严格核对transaction/code/subscription/毫秒时间/空properties；冲突保留pending，不产生替代ID。accepted只指原始回执核对，不代表异步聚合完成，lagoReported单独显示。隔离联调另外断言实际聚合达到3且不重复。
- 唯一服务器通知入口`POST /api/billing/webhooks/lago`位于通用Origin/JSON guard之前，256KB raw JSON、固定可信RS256、issuer及签名内完整data字节匹配；以已验签body SHA去重，unsigned delivery key不能绕过去重。通知只触发权威重读。普通API的Origin/认证规则不放宽。
- 普通账单POST `/payments`需要商业能力，本实现完全不用。开源沙盒通过PUT finalized invoice的payment_status显式模拟结算；拒绝已连接支付商的客户，只允许本机，不会扣真实款。取消续费使用同external subscription降级安排下一期Free，保留当前已付款Pro；不开真实支付、PDF/邮件账单投递。

上游契约核对固定v1.56.0：[订阅含权益](https://github.com/getlago/lago-api/blob/v1.56.0/app/controllers/api/v1/subscriptions_controller.rb)、[事件时间精度](https://github.com/getlago/lago-api/blob/v1.56.0/app/services/events/timestamp_window.rb)、[原始事件查询](https://github.com/getlago/lago-api/blob/v1.56.0/app/controllers/api/v1/events_controller.rb)。未复制Lago应用源码到Forma，通过独立服务REST对接；Lago自身许可证及修改/分发义务继续适用。
