# 独立iPhone App：原生界面与现有服务

2026-10-18，用户直接授权。iOS 17+ SwiftUI，五个原生Tab，现有邮箱账户与/api/sync。详细训练工作台作为原生训练页内的可选同源WKWebView；不称所有训练功能均已Swift重写。无新供应商依赖，无支付，无HealthKit/Apple登录冒充已接入。

FormaCore（Swift Package，Foundation）提供JSONValue Codable/Equatable/Sendable、SyncSnapshot、FormaUser、NativeRecords及Metrics。JSONValue下标缺失返回.null；stringValue/doubleValue/intValue/boolValue/arrayValue/objectValue均optional。JSON原值只用于读取，写入仅指定记录的/api/sync变更，禁止全量PUT覆盖未知字段。记录采用稳定UUID，entityVersions的collection:id作为baseVersion；冲突由用户审核，不自动重放新mutationId。

AppStore（@MainActor @Observable）：state:JSONValue、user:FormaUser?、isDemo:Bool、isBusy:Bool、error:String?、language:String(zh/en)、text(zh,en)、records(collection)、refresh()async、saveRecord(collection:value:)async throws、baseURL:URL?。Features只调用上述接口；工作台为WorkbenchView(store:route:)（home/stats/library），Root提供。表单使用NativeRecords.meal(name:date:grams:kcal:protein:carbs:fat:type:)、sleep(start:end:quality:energy:timezone:)、workout(name:date:duration:exerciseName:sets:reps:weight:notes:)均throws，日期均Date，营养为每100g；训练必须真实填写动作、组数、次数及负重（明确0有效），保留现有server至少一动作的契约，输出legacy摘要不伪造setLogs。String日期由工厂按当前时区输出，睡眠按指定时区醒来日。

登录前用户配置可信HTTPS服务根地址；Debug允许loopback http用于测试，Release强制HTTPS。凭据不进代码/日志；URLSession私有cookie会话，cookie与随机profile UUID存不可迁移Keychain。WebKit使用iOS17每账户/服务命名持久dataStore，仅注入同源cookie且验证me绑定后再加载；拒绝跨源导航/下载，不向网页注入密钥或原生桥。退出/换服务清理本地状态，迟到响应用generation隔离。导出/删除沿用已有私有API。

复查发现训练active与未同步媒体只在客户端，非持久dataStore会在关闭sheet时丢失；因此改为AppStore持有同一WKWebView，关闭只detach，切路由只改hash。Keychain UUID支持重启后恢复；每次展示前重新核验me，不能离线展示未验证账户。同账户重登保留隔离草稿；确认不同账户/服务或显式退出/删除时同步lock，再将UUID写入UserDefaults清理队列（不含记录/token），清除所有WebKit数据并移除profile；失败保留队列、限制登录并可重试。待完成cookie注入计数阻止删除后迟到写回。Library设置isExcludedFromBackup，失败则拒绝创建工作台。窗口级遮罩包含原生及sheet；不是端到端或应用层静态加密声明。

Windows工具实际list_sims失败spawn xcrun ENOENT；目前未连接Mac，仅远端设备offline。使用GitHub Actions macOS无签名模拟器编译、Swift单测与UI测试；是否通过以真实运行结果为准。开发者会员未确认；没有签名证书、IPA/TestFlight上传或iPhone实机验证。
