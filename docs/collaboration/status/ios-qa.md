# IOS-04：原生界面与真实后端契约测试

更新：2026-10-18。Owner：qa。唯一可写 `ios/FormaUITests/`、`tests/ios-contract.test.ts` 和本状态；不提交、不推送、不读真实 data/.env，不触碰既有 5173/3001/8080 服务。

## 正在做什么

- 已读 AGENTS、TASKS 新顶部和 ADR-ios-native-20261018，与 root / Core / Features 对齐测试隔离与可访问 ID。旧 workout 空 exercises 方案已明确弃用；Core 工厂和黄金 fixture 使用一条真实 legacy 动作摘要，不扩展服务端 schema。
- 已编写 4 项 Node 真实 HTTP 契约：cookie 注册/身份与三种 Core 黄金记录 baseVersion0 round-trip；原 mutation 精确重试幂等；另一账户 header 与 cookie 不一致拒绝、来源检查；stale 409 整批原子拒绝。
- 隔离 createApp 使用 OS 临时目录、随机 loopback port，并校验未使用已有服务端口；测试结束关闭自己的服务器/数据库并验证绝对目录后清理。测试只读 Core 的 meal/sleep/workout JSON，不复制其所有权文件。
- 已编写 `ios/FormaUITests/FormaUITests.swift` 四项 XCUITest：五个原生 Tab 保留演示标识且无 WebView；真实合成 500 kcal / 25P / 50C / 12.5F、30 分钟、8 小时与 legacy 逐组/容量仍 —；三个训练入口均 gate、无账户网页；英中切换、完整合法营养表单仍禁止保存、取消后原合成总量不变。ID 直接与 root / Features 协调并只读核对，tab 标签有 SwiftUI→UIKit ID 未传播时的中英文后备，不使用坐标点击。

## 已验证

- 实际 `node --import tsx --test tests/ios-contract.test.ts`：**4/4 通过、0 fail/skip/cancel、exit 0，1062.8497 ms**。真实 HTTP 保存并回读 Core 三 JSON 完整一致；150g/每100g 营养在 Web 计算得到 375 kcal /30P/45C/7.5F，LA 睡眠 7.5h，20.5 分钟训练 legacy 摘要无伪造 setLogs。
- 实际 `npx tsc --noEmit`、指定 `git diff --check`：exit 0。未运行全局测试，不改变 schema。
- **尚未执行 Swift / 模拟器 UI / 真机测试。** Windows 无 iOS SDK；四项 UI 用例仅完成编写与静态复审，实际编译运行等待 root 的 Mac CI。root 另加 NativeAPI URLProtocol transport tests，也尚未据此宣称通过；Node HTTP 契约不能替代 Swift 传输/会话生命周期验证。

## 只读会话复审

- 按 root 请求只读 AppStore / NativeAPI / SessionVault / WorkbenchView。检查了 generation 对迟到响应的保护、私有 URLSession cookie、Keychain ThisDeviceOnly、退出本地清理、同源 action 导航和 web cookie 完成回调 active guard；这是有限源码复审，不是全面安全审计或实际 iOS 执行结论。
- 已向 root 提交两处具体请求：bootstrap restore catch 需要 ticket guard，避免旧失败清掉新会话；WK 响应阶段也需拒绝跨源、不可显示 MIME 和 Content-Disposition attachment，不能只靠 action.shouldPerformDownload。root 已在其所有权代码修复，已只读核对相应 guard / navigationResponse 实现。
- Core 源测试复审发现亚毫秒睡眠可能序列化为相同毫秒时间却未拒绝；已告知 Core owner，其已补序列化回读 interval 校验。未自行修改其他角色文件，也未把未执行的 Swift 边界测试称为已通过。

## 依赖与请求

- Root 已提供 `--uitesting` 中文初始语言、不恢复 Keychain，settings.open / settings.language / settings.done / demo.banner / workbench.demo-gate；Features 的工作台采用 sheet，通过 workbench.close 关闭。
- Features 已对齐 screen.*、training.workbench/library/statistics、record.save / record.cancel / record.demo.notice / demo.form，以及真实数值 Text 的指标 ID。测试只使用自己的隔离演示表单，不模拟真实账户注销/空态。
- Core 三 JSON 已落盘并经 Node 真实服务接受。待 root Mac CI 实际编译、执行 Swift transport / Core / UI 用例后，按真实结果继续修复或标完成。

## 待用户决定

- 无新增事项；Mac CI / 真机 / 签名的实际能力与完成情况由 root 如实报告。
