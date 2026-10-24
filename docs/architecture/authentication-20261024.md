# 登录增量接入 · 2026-10-24

用户已选择邮箱密码、Google、Apple快捷登录。延续Express/SQLite/HttpOnly Strict会话与既有账户，不迁移平台。邮箱验证与找回密码使用哈希、限时、单次token；生产邮箱通过服务端邮件传输，缺配置如实报告。既有账户仍可密码登录，不突然强制验证。第三方只信固定官方JWKS验签后的issuer/subject/audience/nonce/expiry；禁止仅凭相同邮箱自动合并，绑定要求现有会话与密码再次验证。第三方首次账户可设置密码以保留删除账户等既有密码确认能力。

共享契约src/auth.ts，现有User和login/register响应兼容。GET /api/auth/options公开配置；GET /api/auth/account私有安全状态；POST /api/auth/forgot-password {email}；POST /api/auth/reset-password {token,password}；POST /api/auth/verify-email {token}；POST /api/auth/send-verification {}私有；POST /api/auth/password {currentPassword?,password}私有；POST /api/auth/:provider/start {intent:'login'|'link',password?}，返回{authorizationUrl}，link必须私有account hint及密码验证；POST /api/auth/oauth/complete {ticket}返回{user}。不支持静默合并/解绑，本轮不做短信。

回调 /auth/callback/google GET 与 /auth/callback/apple POST（urlencoded，独立小body上限），保留API通用Origin守卫。Apple跨站POST不带Lax绑定cookie，回调只生成短期不透明ticket转到同源页面#auth=oauth&ticket=...，真正完成必须同源POST并验证浏览器绑定cookie/原会话及一次性state。Google同样走完成流程，不在回调直接换Strict会话。URL片段token在UI首次读取后移除，不放浏览器持久存储。邮件链接#auth=reset或verify&token=...经显式提交消费，GET不会验证或重置。

AuthOptions与AccountSecurity定义见src/auth.ts。发信成功返回{ok:true,delivery:'accepted'}，未知邮箱恢复同响应；未配置统一503 AUTH_MAIL_NOT_CONFIGURED。错误使用AUTH_*代码及无敏感内容的英文error。社交错误回同源#auth=error&code=白名单代码。提供配置说明，不伪造真实OAuth/邮件已验证。所有server/auth代码可注入配置、fetch、时钟与邮件传输做合成测试。

密码重置撤销全部会话与未完成认证/健康OAuth，密码变更旋转当前会话撤销其他会话；退出/删除/换账户使未完成link失效。用户数据导出不含认证token或身份凭据。所有新增表外键级联，所有token只存哈希。无新依赖。

## 迁移与回退

沿用项目构造时幂等SQLite迁移；新增认证附表与sessions.created_ms（NOT NULL DEFAULT 0），既有账户/快照内容不改写。旧会话created_ms=0仍可正常访问，不能用于社交账户首次设置密码的新鲜度证明。新增字段和附表不在本轮下迁移删除，属于前向迁移。

注意：旧后端曾用三列`INSERT INTO sessions VALUES (...)`，新表增加created_ms后直接切回旧服务会导致新登录失败。回退须保留新后端的显式列名会话写入，采用修复后的前向版本；不能只把current.json指回旧后端并宣称安全回滚。部署前在原私有data/backups内做SQLite一致性备份，不把备份写入交付截图目录或Git。不覆盖正在使用的数据库、不用旧备份抹去上线后的新记录；如需数据恢复，先停写并核对恢复点。未执行大规模生产数据基准测试。
