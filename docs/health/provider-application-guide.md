# Forma 健康平台申请与本机联调

更新2026-10-23；申请资料草稿，尚未提交或获得任何平台审核。

## 先准备什么

应用名：Forma。应用类别：健身与健康习惯记录。用途说明可以填写：

> Forma helps users review their own activity, sleep and recovery records alongside manually entered fitness and nutrition logs. Users explicitly authorize read-only access to supported wearable data. Imported records retain their original source and are stored separately from manual records. Users can disconnect a source, delete imported records and export their data. Wearable data is not automatically sent to AI services.

这是本次实现的用途说明草稿，不承诺医疗功能、平台合作关系或已通过审核。申请时仍需本人填写真实联系邮箱、运营主体、网站和隐私政策；如以后增加AI分析、商业用途或数据转发，必须重新核对相应平台要求和用户同意范围。不要编造域名、公司或审核结果。

## 精确的授权回调

| 平台 | 后端回调路径 | 官方入口 |
|---|---|---|
| WHOOP | `/integrations/whoop/callback` | https://developer-dashboard.whoop.com/ |
| Oura | `/integrations/oura/callback` | https://developer.ouraring.com/ |
| Google Health | `/integrations/google-health/callback` | https://console.cloud.google.com/ |
| Apple Health | 无网页OAuth回调，使用iPhone HealthKit授权 | https://developer.apple.com/account/ |

完整回调由`FORMA_HEALTH_PUBLIC_BASE_URL`加以上路径组成，设置页面会显示实际值。当前本机实例使用http://127.0.0.1:3001；这个地址用于本地开发，不代表WHOOP/Oura等第三方后台一定允许HTTP。申请后台要求HTTPS时，先准备稳定的HTTPS网站与上述路径，再精确登记；不把Github仓库URL填成OAuth回调。回调来源、路由及服务端baseURL必须保持一致。

## WHOOP

1. 用自己的WHOOP会员账户登录官方开发者后台，创建Team和Forma App。
2. 填写用途、联系邮箱、网站、隐私政策及精确回调URL。按照网站实际实现配置read-only数据范围与offline刷新权限。
3. 将后台生成的Client ID/Secret仅配置到服务端环境。不能发到聊天、存入VITE变量或GitHub。
4. 在Forma设置页点击连接账户。本人在WHOOP官方页面决定共享权限，回到Forma后再同步。
5. 新应用可先在Sandbox测试10位成员；扩大用户数时按后台Open Request → Request higher limits提交。至少验证一位成员，提供真实隐私政策与设计材料，审核结果由WHOOP决定。

官方：https://developer.whoop.com/docs/developing/getting-started/ 与 https://developer.whoop.com/docs/developing/app-approval/ 。

## Oura

1. 用自己的Oura账户登录新开发者后台并注册Forma OAuth应用。
2. 填写真实应用资料与回调地址，按实际读取类型设置权限。
3. 服务端配置Client ID/Secret后，在Forma发起授权；用户可逐项决定共享范围。
4. API应用未审核前限10位用户；扩大使用范围按开发者门户申请审核。Gen3及后续型号用户需要有效Oura会员才能API共享。旧personal access token已经停用，不使用旧教程的PAT方式。

官方：https://cloud.ouraring.com/v2/docs 与 https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API 。

## Google Health

1. 登录自己的Google Cloud控制台，选择或创建用于Forma测试的项目；不要擅自启用付费资源。按Google Health官方setup核对当前项目资格并启用API。
2. 配置Google Auth Platform的应用品牌、受众、联系信息、隐私政策与服务条款。测试阶段加入本人测试账号。
3. 创建Web应用类型OAuth客户端，登记`/integrations/google-health/callback`的完整回调。按官方文档登记实际使用的Google Health只读scopes；不要选择旧Google Fit权限。
4. 配置后端凭证并连接；服务端同时验证该Google账号的Google Health身份关联。OAuth登录成功不代表该账号已经有可读取健康数据。
5. 向公众开放前依当前restricted scopes要求完成Google审核/必要的安全评估，不把测试成功当正式审核通过。

Google Health云端API与Android Health Connect设备SDK不是同一件事；当前并未创建Android App。官方：https://developers.google.com/health/get-started 、https://developers.google.com/health/developer-checklist 。

## Apple Health / Apple Watch

Apple没有可供网页填写的HealthKit Client Secret，也没有网页“授权Apple Health”OAuth流程。使用现有Forma iPhone工程，在Xcode为本人真实Bundle ID和开发团队开启HealthKit capability，设置只读用途说明与entitlements。安装到本人iPhone，登录可安全访问的Forma服务，逐项授权读取，再审核与显式确认上传。Apple Watch数据先进入Apple Health，再由iPhone导入。

本机Windows localhost不能由实体iPhone访问；真机需要安全可达的HTTPS服务。签名、Apple Developer会员/TestFlight及真机权限验证是后续本人操作，不因源码含HealthKit而视为已完成。具体见apple-health-setup.md。

## 服务端环境（无可用秘密）

```
FORMA_HEALTH_PUBLIC_BASE_URL=https://your-actual-forma-domain.example
FORMA_HEALTH_TOKEN_KEY=<32 random bytes encoded as base64>
FORMA_HEALTH_WHOOP_CLIENT_ID=
FORMA_HEALTH_WHOOP_CLIENT_SECRET=
FORMA_HEALTH_OURA_CLIENT_ID=
FORMA_HEALTH_OURA_CLIENT_SECRET=
FORMA_HEALTH_GOOGLE_CLIENT_ID=
FORMA_HEALTH_GOOGLE_CLIENT_SECRET=
```

不要直接照抄示例域名。加密密钥必须稳定保存，轮换之前先按计划迁移凭证或让用户重新授权。缺少凭证时网站明确显示待配置，不会假装连接或同步成功。
