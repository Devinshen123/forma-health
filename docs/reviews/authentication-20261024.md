# 登录与账号恢复独立审查 · 2026-10-24

状态：最终独立合成 HTTP **44/44 通过，0 skip**，已冻结交给 lead 集成；只读审查未见剩余阻塞。真实 OAuth、邮件投递和浏览器跨站导航不在此结论内。

范围：`codex/fud-food-photo-20261022` checkout，独立助手仅维护本报告和 `tests/authentication.test.ts`，未修改产品、提交或启动用户网站，不读取用户数据库或环境文件。所有账户、邮件和令牌为合成夹具，数据库位于经过边界检查的临时目录。

## 验证方法与依据

- 用 Node crypto 生成 2048-bit RSA 密钥，向生产 verifier 注入官方地址的 JWKS HTTP 响应，真实签名 ID token；没有替换验签函数或直接注入“已验证身份”。独立使用 P-256 公钥验证后端发往 Apple 的 ES256 client secret 签名。
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)：校验固定官方签名、issuer、audience、nonce 和时间；身份主键应是稳定的 subject，而非可变邮箱。多 audience 时还要检查 authorized presenter。
- [Apple 公开 OIDC discovery](https://appleid.apple.com/.well-known/openid-configuration)、[验证用户](https://developer.apple.com/documentation/signinwithapple/verifying-a-user) 和[授权请求](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.)：使用官方 authorization/token/JWKS 地址，identity token 使用 RS256；email scope 使用 form_post。client secret 使用服务端 P-256 私钥签 ES256，audience 为 Apple，subject 为自身 client ID。
- [MDN SameSite Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)：跨站 Apple POST 不能假定携带 Lax 或 Strict Cookie。回调可以交换并验签后生成短期不透明票据，但不得创建账户/会话；完成必须再经过同源 POST 和原浏览器绑定、原会话检查。
- 邮件链接使用 URL fragment，GET 不消费；token 在数据库中只存 SHA-256 哈希，分用途、限时、单次。普通改密码只能证明知道旧密码，不能证明邮箱所有权；邮箱重置链接才提供邮箱控制权证明。

## 实际运行记录

命令：`node --import tsx --test tests/authentication.test.ts`。

1. 首轮 exit 1：38 tests 中 7 pass / 31 fail。所有社交 `/start` 返回 500，后续 JWT 场景尚未到达验签，不能算作安全拒绝通过。独立定位 `AuthLedger.start` 的 INSERT 为12个占位，而表及参数只有11个字段。反馈后后端改为显式列名和11个占位。
2. 修复后第二轮 exit 0：38 tests / 38 pass / 0 skipped，5682.0785ms。
3. 加入匿名密码重置两阶段竞态、数据库重启后的 token 单次和已知/未知邮箱对称限流后，全专项 exit 0：43 tests / 43 pass / 0 skipped，6557.9786ms。
4. lead 提出 ready ticket 对应账户删除边界后，独立新增并定向执行 `node --import tsx --test --test-name-pattern="anonymous ready ticket" tests/authentication.test.ts`：exit 1，0/1。旧匿名票据在目标身份删除后被当作新注册使用。保持严格断言并反馈后端，未把这种重建视作通过。
5. 后端增加目标账户外键/约束后，最终完整专项 exit 0：**44 tests / 44 pass / 0 fail / 0 skipped**，13477.5159ms。既有失败断言未删除或放宽；旧匿名票据被拒绝，新发起的删除后授权仍可创建不同 ID 的空账户。

已通过的覆盖包括：旧邮箱注册/登录兼容；缺配置诚实状态；验证 token 哈希、用途隔离、GET 不消费、单次/过期；恢复 known/unknown 邮箱及邮件传输异常保持相同202响应；重置撤销已有会话及健康 OAuth；密码修改确认与当前会话旋转；社交账号首次设密码15分钟新鲜度；Google 真实 RSA/JWKS、PKCE；Apple 无Cookie form_post 与 Strict browser binding 的同源完成；Apple ES256 client secret；state/ticket 重放、过期、浏览器错配；14种错误 JWT；旧邮箱不静默合并、显式密码确认绑定、跨账户已绑定身份拒绝；subject 邮箱变化保持原账户；绑定不同邮箱不提高原邮箱验证状态；交换过程中退出/会话切换；Origin/JSON 守卫、Apple body 上限；不跟随恶意 jku/jwk；JWKS 大小限制、忽略 AbortSignal 时硬超时；凭据不进入导出及账户删除级联。

## 已发现或协同处理的问题

- `/start` SQL 占位错误：独立 HTTP 实际失败发现，已修复，后续真实签名成功路径通过。
- 普通修改密码错误提升 emailVerified：lead 首先发现，独立测试覆盖并通过修复；通过邮箱 token 重置才可提升。
- 匿名发起、但 subject 已关联现有账户的登录，在 token exchange 或 ticket-ready 时遇密码重置：只清理 owner-bound state 不够，因为最初 state.owner_id 可为空。后端增加单调安全版本，独立验证同一时钟刻度的两阶段旧请求被拒绝，重置后新 start 仍可登录原账户。
- ready ticket 在身份已验签且已知道目标账户时，必须绑定目标账户。删除原身份后不能把旧匿名票据重新解释成新注册；定向回归实际失败后，后端用 `target_owner_id` 外键级联及目标约束修复，最终独立回归通过。新发起的授权可明确创建空的新账户，未全局封禁 provider。

## 静态审查与剩余验证

`server/auth` 固定官方 endpoint、拒绝重定向，限制 body/JWKS 大小，验证 RS256、kid、RSA 位数、issuer、audience/azp、nonce、iat/nbf/exp，不信 header 内 jku/jwk；provider access/refresh token 与 JWT 不落盘，不进入客户端。数据库只保存已验证身份摘要供短期 ticket 使用；真正创建/绑定身份与签发会话在同源完成阶段。原登录 Cookie 保持 HttpOnly/Strict。

网页 reset/verify/oauth 均为显式提交，不在 effect 自动消费；token/ticket 由入口读取后移除 fragment，仅放内存。账户/卸载用 epoch、account ref 和 abort 保护迟到结果；错误只使用静态映射，不显示 provider 原始文本或凭据。lead 已将 `/auth/`、`/integrations/` 加入 service worker 网络旁路，具体浏览器行为由 lead 单独验证。

本报告没有验证真实 Google/Apple 应用、真实回调域名/浏览器跨站 Cookie 行为、真实邮件投递/垃圾箱/Apple relay、开发者配置/审核或用户健康账号。真正签名的本地夹具证明验签和协议边界，不能代替真实 OAuth 或邮件送达。全量构建/回归与本机网站发布由 lead 单独执行和记录。

边界说明：匿名授权在身份尚未验签、尚不知道对应账户时发生删除，服务端不能在不维护额外身份 tombstone 的情况下精确识别删除目标。本轮保护已知目标的 ready ticket，不新增全局封禁。删除后重新发起的有效授权可能创建空的新账户；不会恢复原账户 ID 或历史数据。
