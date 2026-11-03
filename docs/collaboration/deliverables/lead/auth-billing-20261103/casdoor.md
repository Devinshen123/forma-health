# Casdoor本机接入与阶段证据

2026-11-03；01 / lead，CASDOOR-01，D:/Forma/source，主管分支。用户已授权本机接入并保留旧账户/健康记录；未接触真实Google/Apple管理后台，不启用真实收费。

## 接入方式

新增Casdoor提供方，复用现有state/nonce、PKCE、HttpOnly会话、同源完成页和当前密码确认绑定。Casdoor固定配置issuer、应用专属JWKS、授权/换码端点；严格RS256、issuer/audience/nonce/时间和id-token类型校验，issuer+sub的明确JSON序列作SHA256身份键，旧Google/Apple键和owner不变。

新账户从Forma统一账户入口到独立账户中心注册/登录；原邮箱密码和直连Google保留。旧邮箱冲突不会合并或覆盖记录，用户须先按原方式登录并在账户设置明确绑定。仅Google登录的旧账户先显式设置Forma密码，不能仅凭同邮箱或长期会话直接绑定。

## 本机运行（不覆盖原配置/数据）

Windows在D:/Forma/source执行；TEMP/TMP/npm缓存按根AGENTS使用D盘。Docker磁盘已核实在D:/HeyGem/Docker/wsl-data/main，独立服务持久目录D:/Forma/services/casdoor；不借用其他项目Casdoor或修改其容器。

```powershell
node scripts/setup-casdoor-local.mjs --write-env --start
node --import tsx scripts/verify-casdoor-local.mjs
```

Mac使用其实际checkout；默认服务目录是checkout上级services，可用FORMA_SERVICES_DIR明确指定。脚本只管理独立Compose项目forma-casdoor-local；不安装Docker、不切其他项目或全局设置。

| 内容 | 位置 |
|---|---|
| 账户中心 | http://127.0.0.1:3440 |
| 本机测试邮件收件箱 | http://127.0.0.1:3441（邮件不会投递真实邮箱） |
| 应用名/组织 | forma-web / forma-local |
| 数据、配置、签名证书、会话、日志、初始化凭证 | D:/Forma/services/casdoor 下私有文件与数据库；不进GitHub |
| 原数据备份 | D:/Forma/backups/auth-billing-20261103/before |

Casdoor v4.25.0，Mailpit v1.33.0均固定官方镜像。initAdminPassword首次创建强随机管理员密码；isDemoMode=false、initDataNewOnly=true，重启不重建已有用户/证书或改变Id。独立应用JWT-Standard、RS256、非共享、1小时，签名证书由Casdoor首次生成并持久保存。

## 实际验证

- 类型检查通过；认证专项62项及授权导航1项通过，全套448/448、失败/跳过0。均使用合成/隔离数据库，未调用真实OpenAI、Google、Apple或健康平台。
- 真实本机Casdoor通过7项：无邮件码注册被拒、实际Mailpit验证码、注册后签名ID token返回Forma并建立会话、issuer作用域身份、已验证邮箱落库、错误/缺失PKCE被真实服务拒绝。
- 只重启本项目Casdoor后，使用同一实际注册账号复验6项通过，原subject保持相同。Forma验收数据库为D盘独立临时目录，不在真实健康库创建测试记录。
- 未配置或配置错误只禁用Casdoor入口，不影响原邮箱/Google。未把旧scrypt密码导入/改写，没有按邮箱合并或迁走健康数据。

完整npm build通过，无新增依赖；既有大chunk提示保留。账户中心真实浏览器显示Forma标题、完整注册/邮箱验证码表单，中英语言切换实际通过、无框架错误或相关console错误，截图D:/Forma/logs/casdoor-signup-20261103.png。Forma新入口随阶段提交启动后再核对，不把API成功当全部页面验收。

辅助代码审查指出4.25源码硬编码文件会话为/tmp，最初/sessions配置被忽略；已更正绑定，实际强制重建本项目Casdoor容器后用原cookie读取原账户、同subject完成签名登录/PKCE7项全部通过。没有其他材料级认证或旧数据回归被审查指出；这不是06本人产品验收，最终独审/集成状态见TASKS。

首次启动曾因Beego的logConfig不接收被双重转义的JSON而退出，已改为原生JSON配置并重启本项目容器后通过；首次导航单元测试直接导入带CSS组件失败，已把纯校验函数移至auth-navigation模块后测试通过。无重置数据库/跳过验证。

## 仍需外部配置

本机验证邮件仅进入测试收件箱。真实邮件投递需配置SMTP/邮件供应商；Google经Casdoor需在Google客户端加入新回调，原Google直连继续可用；Apple和正式域名尚未完成，不冒称自动开通。停用Casdoor时移除或清空本机配置区块并重启本站即可恢复旧登录入口，保留身份绑定/服务数据，不用备份覆盖新增健康记录。
