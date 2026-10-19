# Forma iPhone

独立 iOS 17+ SwiftUI App。原生今日、饮食、训练、睡眠、趋势五页和邮箱账户；完整动作库/计划/逐组训练/详细统计在原生训练页内使用同源授权训练工作台。不是整个App加载网站。原生营养与手动睡眠/训练摘要写入已有 `/api/sync`，跨端事实共用服务；不把摘要冒充逐组明细。

本工程没有 HealthKit、Apple 登录、支付、推送或自动设备睡眠读取。当前没有已签名IPA、TestFlight或App Store发布。模拟器产物只供Mac模拟器，不能在iPhone直接安装。

## 在 Mac 打开

1. 获取 `codex/forma-iphone-app-20261018` 分支，打开 `ios/Forma.xcodeproj`，选择 Forma scheme。
2. 选择已安装的 iPhone 模拟器，运行。无需填写服务器即可点“先体验演示”；演示明确标注，禁止保存到个人账户。
3. 真机运行前在 Signing & Capabilities 选择你自己的开发团队，并按实际团队选择唯一 Bundle Identifier。不要提交个人签名文件或证书。
4. 个人记录使用现有 Forma 账户。在 App 首屏填写**已部署且由你信任的 HTTPS 根地址**（例如你的Forma服务域名），再登录。这里不会预填虚假的线上地址；127.0.0.1是设备自己，不是Windows电脑。服务必须完整部署现有Web/API/训练工作台与授权素材，并正确支持现有同源HTTPS验证与Secure cookie。

若新增/删除Swift文件，用已有Node运行 `node scripts/ios-generate-project.mjs` 并提交更新的工程。现有图标已提交，不需要重装依赖；更换图标时可用已有sharp运行 `node scripts/ios-create-assets.mjs`。

## 验证

- `swift test --package-path ios/Packages/FormaCore`：纯Swift记录、营养与睡眠区间/完整度边界。
- `xcodebuild test -project ios/Forma.xcodeproj -scheme Forma -destination 'platform=iOS Simulator,name=<已安装模拟器名称>' CODE_SIGNING_ALLOWED=NO`：原生模拟器UI测试；`--uitesting`只用隔离演示，不读取Keychain或健康记录。
- 根目录 `node --import tsx --test tests/ios-contract.test.ts`：合成fixture通过实际Express cookie会话、同步幂等/账户隔离/冲突契约。
- `.github/workflows/ios.yml`：Mac上无签名构建、Core与UI检查，保留结果、截图和模拟器.app。实际运行结论见项目状态文档，不把工程文件存在视为已运行成功。

## 数据与限制

URLSession使用私有内存会话与无缓存请求；会话cookie及随机WebKit profile编号只存本机Keychain(解锁时、不可迁移)，不存密码。工作台每次先核验同一账户，再使用该账户和服务专属的持久WebKit仓库；关闭页面保留原页面和待同步写入，重启或同账户重新登录沿用原profile。离线或会话失效会锁住个人页面，保留草稿待验证。退出/删除或确认换账户先锁旧页面，再清理profile；清理失败保留重试意图并阻止新账户显示。Library排除系统备份。后台切换的窗口级隐私遮罩覆盖原生表单与工作台。服务器拒绝跨账户及不可信Origin；原生并未绕过这些检查。

首版原生表单只新增记录，没有本地持久离线队列。网络结果不确定时原表单复用同一UUID与mutation重试；关闭表单/退出前须先核对服务端记录。高级工作台另有持久训练草稿与待同步媒体；退出会明确提醒移除尚未同步的本机内容。并发409不静默覆盖。原生不编辑未知的全量state字段，不使用 `/api/state` PUT。高级工作台记录沿用原有独立原文和可兼容事实投影，范围规则与Web一致。

原生未确认保存遇会话失效时，在本次App进程内按服务和账户隔离暂存原请求；同账户重新登录先读回核对，再允许重试。退出操作先写不含健康内容的持久标记，Keychain及WebKit清理全部成功前阻止凭据恢复，避免删除失败后重启重新进入旧账户。

高级工作台中Web文件下载/上传及相机在iOS WebKit尚需真机确认；原生设置可导出服务端JSON和执行删除账户。没有离线动画库下载或素材重新分发；授权动画仍由部署服务提供，GitHub不包含独立授权媒体包。

发布前需确定实际开发团队/Bundle ID、可访问HTTPS服务、隐私政策/支持网址与App Store数据声明，并完成真机验证。用户当前Mac可用尚未接入，开发者会员未确认。本工程不代替签名或发布审批。
