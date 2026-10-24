# 健康平台接入独立审查 · 2026-10-23

状态：独立合成 HTTP 测试 **23/23 通过**，无 skip；只读审查未见剩余阻塞。真实供应商与 iPhone 设备验证不在此结论内。

范围：`codex/fud-food-photo-20261022` checkout。独立助手只维护本报告和 `tests/health-integrations.test.ts`，不修改产品实现、不提交代码、不读取 `.env` 或用户数据库。测试使用临时 SQLite、合成账户和注入 HTTP transport，禁止真实供应商请求。

## 官方资料与验收依据

- [WHOOP OAuth](https://developer.whoop.com/docs/developing/oauth/) 与 [WHOOP v2 API](https://developer.whoop.com/api/)：授权码在服务器交换，offline 才能获得 refresh token。刷新会使旧 access/refresh token 失效，所以同一连接必须串行刷新并持久化旋转结果，不能因为后续数据请求失败而恢复旧令牌。
- [Oura authentication](https://cloud.ouraring.com/docs/authentication)：服务器授权码流程，推荐 S256 PKCE；用户可部分拒绝 scopes，refresh token 单次使用。按实际获授范围读取，不能把未授权流当成零数据，也不能请求不需要的邮箱/个人资料权限。
- [Google Health setup](https://developers.google.com/health/setup)、[scopes](https://developers.google.com/health/scopes)、[v4 list](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list)、[v4 DataPoint](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints) 与 [getIdentity](https://developers.google.com/health/reference/rest/v4/users/getIdentity)：使用 Google Health v4，不是 Android Health Connect 或历史 Google Fit。OAuth 后先验证 Health identity，未建立 Google Health 档案不能标为 connected；粒度授权需降级。数据有 camelCase union、int64 字符串和可缺资源名的记录，需正确换单位及稳定去重。
- [Google OAuth web-server](https://developers.google.com/identity/protocols/oauth2/web-server)：精确注册回调、state 绑定和 server-only token 处理。开发/生产项目分离，真实回调、应用审批和用户凭证未完成前，合成成功不等于真实平台接入。
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)：Strict 不随跨站回调发送；Lax 允许安全方法的顶层导航。独立回调绑定 Cookie 可设短期 HttpOnly/Lax，原登录 Cookie 保持 Strict。HTTP 夹具验证“缺 Strict 仍安全”的服务器路径，不等同于真实 Safari/Chrome Cookie 导航测试。
- [Apple Health 授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) 与本地 HealthKit 技能：授权请求完成不能证明用户给了读取权限；空查询不是 0，也不能断言拒绝。原生读取、单独上传确认、原始 UUID/source、按 server/account/type 命名的 anchor 和后端确认后推进，是本轮审查重点。

## 已反馈的高风险边界

1. **Strict Cookie 与换账号**：只验证 state 不够。需同时验证短期绑定和原始仍活跃的 session；收到不同 session 必须拒绝。当前既有 `issueSession` 确实撤销浏览器原 session，已核对，不作为已发现漏洞。另加“state 已消费、token exchange 途中退出”的测试，避免只在 await 前检查。
2. **Apple 旧预览恢复已删除数据**：初始契约仅 consent/records/deletedIds，无法阻止网页断开或删除后旧手机批次继续导入。已反馈 lead、后端、iOS；lead 已采纳 `HealthConnection.syncRevision` / `AppleHealthImport.expectedRevision`。断开和删除递增版本，普通批次不递增以支持 lost-ack 重放。修复结果待独立 HTTP 验证。
3. **原子同步与旋转令牌**：所有页和端点完整成功才能提交记录及 lastSync。令牌旋转必须在拿到新令牌后先安全持久化；后续某页失败时保留新令牌但不保留部分数据。断开/删除/重新授权后的旧异步结果不得重新写入。

## 独立运行与修复证据

真实命令：`node --import tsx --test tests/health-integrations.test.ts`。

- 首轮：exit 1，14/15 通过；Google 合成 v4 数据提供了原始设备名和应用包名，导入后只剩平台名和 hash，独立来源保留断言失败。未修改测试来掩盖该问题。
- 后端修复来源映射后扩展并重跑：exit 0，**23 tests，23 pass，0 fail，0 skipped**，总时长 3377.9653ms。
- 路径限定的 `git diff --check` 没有输出。没有运行全量 npm test/build，没有改产品文件或启动用户服务。

运行覆盖：未配置与认证/Origin；官方 OAuth URL、S256 PKCE、HttpOnly/Lax 短期回调 Cookie；模拟无 Strict Cookie 的合法回调；state 重放/过期/provider 错配/缺绑定；授权拒绝；跨账号/退出/换号；token exchange 过程中退出或删账号；存储密文及导出不泄漏；Oura 部分 scopes、缺 scope 时受控探测且不信 callback scope；分页失败原子性；refresh rotation 后数据失败并重启；连接并发锁、断开与删除记录的在途竞态；2MiB HTTP 响应上限与重复分页；即使 transport 忽略 AbortSignal 仍有硬超时；Google identity/v4 union/int64 字符串/克转千克/无 ID 重放；WHOOP 秒毫秒与kJ换算、RMSSD、真实0与pending null；Apple consent/revision、UUID 重放、原子校验、缺失值、删除与账号隔离；跨来源重叠记录保持分开；账户删除级联与 foreign_key_check。

## 只读审查与已处理发现

- 初始 Apple stale-import 缺陷已用同步版本契约修复，并独立验证网页断开/删除后旧批次得到 409；普通批次成功保持版本不变，支持相同 UUID 重试。
- Google 原设备/应用来源丢失已由上述失败测试推动修复并通过。Oura 睡眠平均心率原先标为静息心率，已改为 `heart_rate` + `sleep_average` 并加入独立断言。WHOOP 恢复记录原用更新时间作为区间结束，现保持为创建时刻的点记录并单独保留 updatedAt。
- `server/health`：固定官方目的端点、禁止重定向、严格数据范围、完整 job 后事务落库；凭证 AES-256-GCM、随机 IV 和 account/provider AAD；只导出公开连接信息及本账户记录。旋转凭证先持久化，记录失败不倒退令牌。没有把合成值写进用户数据库。
- `HealthConnections.tsx`：账户/demo 变化递增 epoch、abort 请求并清列表/确认框；异步状态更新与 OAuth 导航检查旧票据。只按来源展示，不自动合并进手动记录或 AI。已采纳睡眠 stage、睡眠平均心率和 provider 当地日期标签，避免把清醒/在床误叫已睡，或 UTC 占位日期变成洛杉矶前一天。
- iOS：只读 `toShare: []`，独立上传确认；先获取并冻结 expectedRevision，409 后清预览且不自动取新版重试；server/account/type anchor 命名；每类全部请求确认后才落盘候选 anchor，UUID 重放；账户 generation、精确 NativeAPI 实例和 server 在每个 await 前后校验；没有 HealthKit 写入/删除、后台上传或把空结果填0。Info.plist 读取说明与 HealthKit entitlement、工程引用存在。
- 本助手未运行 Swift/Xcode 或 iOS 静态脚本，不将源码存在当作 Mac 编译/HealthKit 权限验证。lead 的 Mac CI 结果由 lead 单独记录。

## 尚未验证

真实 WHOOP/Oura/Google 注册、审核、凭证、用户授权、跨浏览器站点导航、供应商实时数据、限流与设备删除通知；iPhone 签名构建、真机 HealthKit 权限、后台变化和上传。后续运行结果及发现会追加，不能以静态检查替代这些验证。
