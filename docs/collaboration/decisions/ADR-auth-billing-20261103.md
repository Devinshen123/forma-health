# ADR：Casdoor身份与Lago开源测试计费

2026-11-03；决定人01 lead；用户已批准按先登录、后开源Lago测试收费的方案实施。详见[设计](../deliverables/lead/auth-billing-20261103/design.md)与TASKS；当前只登记本轮明确范围，不授权真实扣款或其他业务重构。

- 保留Forma accounts.id、数据owner、既有Google/Apple身份键和会话规则；新增casdoor提供方，auth/options的providers新增casdoor及公开authorizationEndpoint，客户端类型同步扩展。不向浏览器传客户端密钥。
- Casdoor主体键为SHA256(JSON.stringify([verifiedIssuer,verifiedSub]))，不按邮箱自动合并。旧账户本人登录、确认原密码后显式绑定；没有原密码的Google账户先设置Forma密码，不以单纯已登录替代再确认。
- 验证固定配置的应用专属JWKS、RS256、issuer/aud/nonce/时间和id-token类型；复用S256 PKCE和同源ticket完成流程，认证故障不得影响未启用的旧提供方。
- 认证服务与Forma健康存储分离；Casdoor配置/证书/数据库、测试邮件持久化在D盘独立服务。文件会话按固定4.25源码真实路径/tmp绑定D盘，重建容器不得丢会话或改变主体。
- 后续Lago1.56仅自托管开源sandbox，按会话owner做客户/订阅/账单归属。外部接口及前端会员契约在LAGO-OSS-01实施时增量登记；不把商业版POST/payments当开源接口。
- 签名通知专用raw body路由和持久防重，权益从后端权威状态推导；不会以跳转成功、前端金额或套餐名字开通会员。Fud成功结果、额度和outbox需原子提交、可恢复幂等。

本轮技术辅助审查非06本人产品验收；候选先同步主管分支，正式验收/集成遵循唯一TASKS。关闭服务时保留新增身份/账本和当前数据；不靠恢复旧快照回滚新健康记录。
