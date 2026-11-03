# Casdoor登录与开源Lago本机测试计费

2026-11-03；01 / lead，D:/Forma/source，codex/fud-food-photo-20261022，起点0cc595dd137c7e772ff32e800647e14204bff553。用户已批准上一轮五步方案并明确Lago使用开源版；本设计将该授权具体化，不重复请求已获实施许可。仅本机测试、无真实扣款/商户申请/付费云资源/公网发布。所有完成阶段验证后正常push GitHub。

## 保留和边界

- Forma继续Vite/React/Express/SQLite；既有accounts.id及健康数据owner不迁走、不重编号、不按邮箱批量合并。Casdoor只管理认证资料，Lago只接收不透明客户编号与计费事件，不接收照片/健康记录。
- 先给当前D数据库作在线一致性私有快照，并保存配置/附件SHA；代码仅做加法式认证/计费迁移。回退用功能配置停用新服务，保留新增绑定/账本和现有数据，不用旧快照覆盖新记录。
- 同一01唯一写者；只读辅助审查不冒称06本人。尚未注册writing-plans技能，采用本项目TASKS与下方实施清单，不假称已加载不存在技能。

## Casdoor

- 独立本地服务，端口仅绑定127.0.0.1；按上游稳定版固定镜像/记录来源，不使用他项目Casdoor、默认管理员密码或共有组织。应用客户端密钥、签名私钥和初始管理凭证仅私有存放D盘。
- 标准授权码流，PKCE S256、state、nonce、严格redirect URI；服务端换码和验签，验证issuer/audience/时间/nonce并限制算法。只允许配置固定issuer的授权、token和JWKS端点，拒绝任意远端重定向/动态端点，限制响应大小/超时。
- 优先应用专属JWKS与JWT-Standard token；issuer与sub组成稳定身份键，issuer变化不能沿用同一sub误绑定。保留现有Google/Apple验证和HttpOnly会话/同源完成机制。
- 新Casdoor账户只有验证过的邮箱才创建Forma账户；若邮箱已存在，拒绝自动合并，指引先用原方式登录，再本人显式绑定。绑定要求新鲜原凭证或已有可信身份再验证，复用当前防换号/过期/并发会话检查。
- 旧scrypt密码不盲目导入Casdoor、不清空/改写；迁移先走已登录绑定或邮件重置。配置邮箱服务未就绪时明确显示，不能伪造发送成功。真实Google经Casdoor和Apple需要官方回调/凭证配置，未完成时保留可用旧Google链路并明确待配置。
- 登录/注册/账户页中英显示Casdoor入口、绑定状态和取消/错误反馈；不把供应商管理后台嵌进用户页面。

## 开源Lago

- 自托管开源固定版本，与Forma数据库隔离；API、worker/clock、Postgres、Redis及必要前端/账单组件独立Compose项目。检查Docker实际磁盘位置；服务数据库/附件/日志/私钥均显式使用D盘持久位置，不能把Named Volume当成已落D盘。
- 仅sandbox测试模式启用。本轮默认测试模板Free和Pro月付（测试价US$20，AI额度为测试参数，最终价格/额度待用户确认）；不是正式销售承诺，不暗中给旧账户创建付费订阅。
- 服务器以Forma owner作为Lago external_customer_id，创建测试订阅/账单；Lago为套餐/订阅/账单来源，Forma维护可核验权益与用量账本。支付状态与invoice finalized区分，只接受有效签名通知或主动向Lago核实的支付状态，不信前端跳转或提交的金额。
- 无支付商测试密钥时，提供明确标注“不扣真实款”的本地模拟结算，经Lago开源版PUT /api/v1/invoices/:id更新已定稿账单payment_status后重读权威状态；不调用普通账单需要Premium的POST /payments。只允许loopback sandbox，production不能调用；不生成伪造收款凭据，不伪称Stripe实卡/自动续费开通。
- 用量：一次成功返回的Fud识别计1次；失败释放预留，不计用户次数，修改/保存不再计次。后端先原子预留额度，成功提交唯一事件；重试/重复请求/回调使用稳定idempotency key，异步发送用持久outbox并可重试/对账，供应商成本保护账本与用户计费分开。
- 不在浏览器保存服务API密钥。所有客户查询/账单/订阅变更从已认证会话owner推导，拒绝跨账号读写。Webhook专用raw body验签、防重放/乱序，必要时重新读取Lago权威状态。限流/大小/超时/错误脱敏按现有后端约定。
- 网站增加会员/套餐、测试支付、额度/用量、账单、取消续费及状态提示；取消不删除健康数据。当前尚未定正式商户国家/地区、域名和实际收款渠道，这些留待正式收费阶段。

## 实施顺序与验证

1. 本设计/所有权和备份先落地；只读辅助审查核对可实施性；文档阶段正常提交同步。
2. Casdoor配置/协议增量、账户绑定与前端；单元/HTTP回归覆盖签名/issuer/nonce/PKCE/过期/状态重放、旧邮箱冲突、换号/并发、原Google流程和数据归属。
3. 本机独立Casdoor运行/真实本地测试账号授权验证，真实健康库不填合成记录。完成Casdoor阶段后提交推送，再开始Lago。
4. Lago开源服务、schema/API/持久用量账本/前端；用合成隔离账户验证账单产生→测试付款→权益启用→额度消耗→失败/重试→取消/账单查询，不触发真实支付或OpenAI费用。
5. 适当全套测试、类型/构建、真实本机页面检查；复核旧账户/健康表与备份逻辑内容，检查私有文件未入Git；候选推主管分支，独立审查/最终集成按TASKS，未通过不伪称完成。
6. 本机服务使用最终已验证构建；运行标识、路径与GitHub提交核对一致。记录实际通过、未测和外部配置阻塞，不把合成测试写成真实支付验收。

## 开工核验与只读辅助审查

本机Docker29.8.2/Compose5.5.1可用，docker-desktop发行版位于D:/HeyGem/Docker/wsl-data/main；仅建立Forma独立服务，不借用或修改其他项目容器/配置。当前Forma数据库35表、4附件及私有配置已在线备份至D:/Forma/backups/auth-billing-20261103/before并通过完整性校验。

固定上游：Casdoor v4.25.0（528a0213f01caf70b9f41009cbf7b2f67bdd67ec）、Lago v1.56.0（c06b03ccfb4eb475bf0af85c709f3b49d3a4ae86）。只读辅助审查未改文件，不是06本人验收，确认以下实施要求：Casdoor issuer+sub须共同命名空间，JWT-Standard/RS256/非共享应用、tokenType=id-token、有效期<=24小时，旧Google-only账户先显式设置原Forma密码才能绑定，不弱化会话版本/浏览器绑定；前端授权URL白名单必须精确校验配置Casdoor端点。

Lago v1.56.0签名细节：HMAC为原始JSON的SHA256 HMAC之Base64；JWT为RS256，data是完整JSON字符串、iss是LAGO_API_URL，无exp/iat。算法由可信配置固定，不信任请求头选择；X-Lago-Unique-Key未签名，持久防重同时保存已验证body摘要并重读权威状态处理乱序。专用raw webhook挂在现有/api Origin/JSON中间件之前，只豁免该精确路径。Fud成功草稿/用户额度扣减/outbox事件须在同一可恢复事务提交，owner作用域operation key可在丢失HTTP响应后返回原结果，禁止重复扣次数。

官方依据：[Casdoor标准OIDC](https://casdoor.ai/docs/how-to-connect/oidc-client/)、[Lago开源自托管](https://getlago.com/docs/guide/lago-self-hosted/overview)、[Lago账单与支付职责](https://getlago.com/resources/how-lago-works)。版本/具体接口以本轮固定上游源码与实际服务验证为准。
