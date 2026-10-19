# IOS-03 — SwiftUI 原生五页

日期：2026-10-18，America/Los_Angeles。Owner：muscle_ui。

## 已交付、等待 Mac CI

- 已读本区 AGENTS、TASKS 最新 IOS 所有权、ADR-ios-native-20261018、设计系统、发给本角色的请求（无待处理）；已应用 swiftui-ui-patterns 与 swiftui-view-refactor 技能。仅写 `ios/Forma/Features/**` 和本状态，没有改根工程、核心包或后端。
- 新增 TodayView、NutritionView、TrainingView、SleepView、TrendsView，均通过 `AppStore` 的注入接口读取并保存，使用原生 SwiftUI 导航、卡片、历史列表与表单。共享小型样式/日期/数字/可访问组件在 FeatureComponents.swift。
- 今日、饮食与睡眠总量复用 FormaCore.Metrics；训练复用新增的 trainingSummary，只从真实已完成非热身逐组数据计算组和容量，legacy 摘要保持未知，不推造组。已知0保留0，未记录显示—，微量正值显示 <0.001。
- 饮食手动输入真实份量和每100克营养，有按份量核对预览；睡眠手动时间、时区与未预选的主观感受/精力；训练必须填写真实动作、组数、次数、公斤负重与时长，只保存动作摘要，复杂逐组/有氧进入同源工作台。
- 三个表单首次生成后缓存同一 JSONValue/UUID；无法确认保存后锁定字段，重试复用同一记录。表单绑定首次打开账户；换户不允许保存，保存过程中禁取消/交互关闭。失败不会关闭表单；401/409等使用 AppStore.message(error) 的具体提示，工厂校验显示双语填写指引。
- 演示模式表单可探索但保存始终禁用；没有 AI、HealthKit、Apple 登录、支付或离线队列承诺。真实新账户显示空态；没有预填虚构营养或训练组值。
- 趋势使用 Swift Charts 展示最近7天真实已有饮食、训练和睡眠数据；未记录日不填0，平均值只除有记录天数并标完整度。详细训练统计入口说明仅工作台原始记录，原生摘要未反向加入。
- 与 QA 对齐 screen.today/nutrition/training/sleep/trends、nutrition.add/training.add/sleep.add、record.save/record.cancel/demo.form、训练三入口和指标 ID。指标 ID 放在值 Text，不把单位与整卡合并为测试值。

## 实际静态检查

- 完整阅读已落盘的 AppStore、WorkbenchView、FormaCore JSONValue / NativeRecords / Metrics 接口后对齐；没有调用未约定的第三方服务。
- Apple 官方 Charts 文档已核对 ChartContent accessibilityLabel/accessibilityValue 与 AxisValueLabel format 接口；参考 https://developer.apple.com/documentation/charts/chartcontent/accessibilityvalue%28_%3A%29-33c0e 和 https://developer.apple.com/documentation/charts/axisvaluelabel 。
- 尚未执行 Swift/iOS 编译、模拟器、设备、网络或安装测试。当前 Windows 无 iOS SDK，按 lead 要求由其统一 Mac CI 验证；不把静态检查冒充可运行证明。
- `git diff --check -- ios/Forma/Features docs/collaboration/status/ios-features.md` 实际执行 exit 0；六个 Swift 文件与本状态已冻结并交回 lead。

## 待验收与边界

- lead 负责 Xcode 工程文件、原生根会话与设置、工作台 cookie/account 隔离和 Mac CI。QA 负责模拟器 UI 测试。本角色没有启动/停止服务、安装依赖、自行提交或推送。
- 本轮原生表单只新增记录与查看历史；编辑/删除细粒度记录、图像饮食识别、HealthKit、Apple 登录、完整 Swift 训练工作台和真机上架未实现，也未展示为完成能力。
- 若 CI 有实际诊断，由 lead 发回后在本所有权内修复，不自行延伸范围。

## 待用户决定

- 无新增决定；签名证书、开发者会员、TestFlight和真机测试由 lead 据实际授权另行处理。

## Lead 最终 Mac 验证（2026-10-18）

GitHub CI 39193436826 / a5b65f3 已实际成功：Core 21/21、Native API/WebKit 10/10、UI 4/4，零失败/跳过，模拟器编译与无签名 iPhone Release archive通过。本角色代码已冻结交回lead；这些是lead的Mac CI结果，不是Windows本地运行。真机安装、签名与TestFlight尚未完成。
