# 邮箱、Google 与 Apple 登录配置

本切片保留现有Forma数据库和邮箱密码登录。快捷登录使用网站自己的服务端回调，不与健康数据授权共用凭证。邮件服务或第三方未配置时，页面显示未配置；不是通过演示结果冒充开通。

2026-10-25实际申请进度：Google本机网站登录已真实验证成功：用户确认姓名/头像/邮箱授权，外部Chrome完成Google回调与Forma同源登录确认，进入空的新账户引导页，刷新后仍保持登录。服务端配置位于本机被Git忽略的.env，实际运行5e6b34c/PID95536；旧密钥停用及正式上线前私下轮换仍待处理。此结论仅适用于http://127.0.0.1:3001；正式HTTPS域名、Google生产项目/品牌核验未完成，Apple会员与网站登录尚未配置。详情见[开通记录](../collaboration/deliverables/lead/auth-provider-activation-20261024.md)。

## 先准备网站地址

确定长期稳定的HTTPS域名，确保反向代理转发到Forma，按部署文档设置可信代理跳数与安全cookie。认证public base URL必须与浏览器访问的站点一致，不含子路径、查询或片段。Google可另建本机开发凭证；Apple网站登录需要正式可达HTTPS地址，不支持把localhost或IP当作正式返回地址。不要把GitHub仓库地址填入回调。

开发时如果浏览器访问Vite的`http://127.0.0.1:5173`，Google开发客户端回调与`FORMA_AUTH_PUBLIC_BASE_URL`都使用此确切站点；Vite会将回调转给API。不要在localhost与127.0.0.1或5173与3001间混用，否则浏览器绑定cookie不会跟随到另一站点。

## 邮箱密码

已有账户继续使用原密码。创建账户后可在“设置 → 账户安全”请求验证邮件。忘记密码入口发送恢复链接；链接30分钟有效，使用后撤销其他会话。验证邮件24小时有效。链接打开后需在页面确认，不会因为邮件扫描器预览就消费。所有链接只存服务端哈希；页面读取后移除地址中的片段。

邮件发件域名需在邮件服务完成验证。服务端支持Resend传输，凭证与发件人只写本机或托管平台的环境变量，不进入前端、Git或聊天。发信请求接受不等于对方已经收件；收件箱、垃圾邮件与供应商投递状态需另查。开发测试使用注入邮件夹具，不会发送真实邮件。

配置项为`FORMA_AUTH_PUBLIC_BASE_URL`、`FORMA_AUTH_RESEND_API_KEY`、`FORMA_AUTH_MAIL_FROM`。Resend是本轮可选的邮件传输实现，并未替你创建账户、订阅或发送真实邮件。

## Google

1. 打开[Google Auth Platform](https://console.cloud.google.com/auth/overview)，选择或创建你自己的项目，填写品牌、支持邮箱、受众和隐私政策。
2. 创建Web应用OAuth客户端，登记精确回调：`https://你的域名/auth/callback/google`。
3. 仅申请`openid email profile`基础登录范围；健康数据授权由独立的Health应用配置处理。
4. 将客户端ID、Secret与网站public base URL放在服务器环境中。测试阶段将指定测试用户加入受众，然后验证第一次登录、回访和原账户绑定。

Google官方流程与ID token校验依据：[OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)。服务端验证签名、issuer、audience、时间及nonce；仅按Google稳定subject查找身份。

服务器配置项：`FORMA_AUTH_GOOGLE_CLIENT_ID`和`FORMA_AUTH_GOOGLE_CLIENT_SECRET`。

## Apple

1. 登录[Apple Developer](https://developer.apple.com/account/)，准备支持Sign in with Apple的主App ID，并为网站创建Services ID。
2. 配置网站域名与精确返回地址：`https://你的域名/auth/callback/apple`；关联主App ID。
3. 为Sign in with Apple创建私钥，记录Team ID、Key ID、Services ID；`.p8`私钥只放服务器安全配置。服务端据此签发短期client secret。
4. 隐藏邮箱用户需要Apple Private Email Relay的发件域名/SPF等配置，确保密码恢复邮件能投递。
5. 使用自己的Apple账户实测授权、隐藏邮箱、取消、回访和绑定。Windows上的合成验签测试不能证明Apple开发者配置或iPhone流程已通过。

Apple回调使用跨站表单POST。代码将其转换为短时一次性票据，回到同源页面后再检查浏览器绑定和原会话，保留原本Strict登录cookie。官方参考：[其他平台接入](https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms)、[环境配置](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)。

服务器配置项：`FORMA_AUTH_APPLE_CLIENT_ID`（Services ID）、`FORMA_AUTH_APPLE_TEAM_ID`、`FORMA_AUTH_APPLE_KEY_ID`、`FORMA_AUTH_APPLE_PRIVATE_KEY`（PEM，环境配置支持换行转义）。不要把私钥放进`VITE_*`变量。

## 原账户与快捷登录

邮箱相同不会自动合并。先用原来的密码登录，再到“设置 → 账户安全”输入当前密码绑定Google或Apple。第三方首次创建的账户可在新登录会话里设置密码，之后用于敏感操作确认；超时需重新快捷登录。切换账户、退出或重置密码会令未完成绑定失效。

## 当前交付与真实开通的区别

代码、合成HTTP和浏览器验证分别记录在审查文档中。真实开通需要你的HTTPS域名、邮件发件配置、Google客户端凭证及Apple团队/Services ID/私钥；凭证不随GitHub同步到Mac。未配置这些内容前，邮箱密码仍可使用，快捷登录与发信按钮会清楚显示限制。
