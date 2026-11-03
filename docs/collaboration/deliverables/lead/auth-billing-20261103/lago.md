# 开源Lago本地测试计费候选

2026-11-03，执行者01 / lead；D:/Forma/source，codex/fud-food-photo-20261022，Casdoor基线41055327ae5b5698482905b8aa98a4d0d373111e。仅本地测试，无真实扣款或OpenAI请求；原健康库不作为测试库。候选先正常推主管分支，正式06验收与main集成仍待。

## 当前可用

设置→会员与账单可查看Free/Pro测试模板、登录后本人额度、测试账单、显式模拟结算和取消下期续费。新空账户可以直接进设置，不必先填写健康档案。已有账户ID、原登录/数据保留，登录绑定见[Casdoor回执](casdoor.md)。AI仍只生成草稿，编辑食物/份量后由用户保存，计费不自动保存餐食事实。

测试模板：Free每周期3次成功食物识别，Pro测试价US$20/月、100次；未发布正式价格/额度，不连接真实支付商。失败/非食物不扣用户额度；原AI成本预算独立。未付款Pro只享Free额度，重复识别/付款/通知不重复计数。开源版使用invoice PUT payment_status模拟结算，不使用商业POST/payments，不生成伪造实付凭证。

## 运行和配置

固定`getlago/api:v1.56.0`、front同版、Postgres15、Redis7，独立Compose项目`forma-lago-local`。API 127.0.0.1:3442，管理台127.0.0.1:3443；只发布loopback端口，数据库/Redis不发布端口。数据/密钥/Compose只在D:/Forma/services/lago，Docker实际WSL磁盘已核D:/HeyGem/Docker/wsl-data/main。没有借用其他项目容器。

首次准备Docker后，在D:/Forma/source依次运行：

```powershell
node scripts/setup-lago-local.mjs --start
node scripts/provision-lago-local.mjs --write-env
powershell.exe -NoProfile -File D:\Forma\Start-Forma.ps1
```

已有运行网站需按本项目启动器协议安全重启，不能把幂等launcher当作自动重载。setup重复运行复用私有state和持久数据，不重置数据库；provision对已存在套餐仅复核/设置本轮测试权益，避免擅改价格。真实密钥只进入private-state.json和.env托管区块，不输出/进Git。复制.env.example的新环境可在空值/模式off时生成托管区块；非空未托管配置拒绝覆盖。

通知由独立服务访问`http://host.docker.internal:3001/api/billing/webhooks/lago`；只有本地沙盒启用private webhook URL。正式公开域名、支付、邮件和PDF另行配置；现无真实SMTP/支付商/PDF。

停止收费限制而保留资料：私有.env改`FORMA_BILLING_MODE=off`并重启Forma。不开服务时不通过旧缓存授予收费权益，但已有登录、健康记录、导出和手动记录仍可用。不使用旧快照覆盖后来新增的用户数据。

Mac需从主管候选分支拉取，自行准备Docker及本机私有配置/数据；Windows的.env、数据和密钥不通过Git分发，不能声称Mac已实测或已同步本机账户。

## 实际验证

本人执行，退出0：

- `node --import tsx --test tests/billing.test.ts`：16/16，配置失败关闭、原数据/会话/附件不变、并发最后额度、非食物、事务回滚、过期旧租约、毫秒事件、跨账期/套餐、付款归属/账期、丢回执后重启/不确定POST、外部删除队列、签名/raw路由/换号拒绝。
- `node --import tsx scripts/verify-lago-local.mjs`：真实OSS Lago v1.56服务16项通过，Forma/图像/AI均为隔离合成。实际签名worker通知、真实生成账单、OSS模拟结算、并发限额、非食物/失败、原草稿幂等、Lago实际聚合3次、跨账户账单403、body防篡改/去重、未付款不授Pro、取消保留本期/用量、健康state未改与安全导出。最新隔离目录D:/Forma/cache/tmp/forma-real-lago-VT6wuy；无真实支付、OpenAI或主健康库。
- `npm test`：464/464，fail/skip/cancel均0；完整`npm run build`通过，现有大chunk提示保留。无新增依赖或锁文件改动。日志D:/Forma/logs/auth-billing-full-tests-20261103.log、auth-billing-build-20261103.log、lago-real-acceptance-20261103.log。
- 原主库复核：35张原表中33表逐行逻辑SHA相同；仅本轮浏览器OAuth启动状态及安全单调时钟变化，原账户/健康表/4附件不变；去除新增两个托管块后原.env内容相同，SQLite quick_check=ok、外键错误0。发布后再复核新计费表与页面。

首次测试记录：非食物fixture起初误填非空营养值被原schema拒绝，已修fixture；最初在升级后查active-only current_usage误当旧Free总和，已改升级前核对；发现floor秒导致首事件漏聚合，改精确毫秒并验证真实3次聚合。辅助审查又指出丢回执重复POST422、读途中跨账期、Free快照混入未付款Pro权益，均修复并由本人回归/真实服务复测；辅助审查不是编号06。

## 待完成的正式事项

本候选的真实浏览器会员页检查、最终提交/运行身份绑定在发布后补充；正式06产品审查与共享main集成未通过，不将01自测写为独审。正式收费仍需收款主体/地区、域名/HTTPS、商户渠道、正式价格额度及续费/退款/条款；本任务不擅自开通。Casdoor真实邮件、经Casdoor的Google回调及Apple仍是外部配置事项。
