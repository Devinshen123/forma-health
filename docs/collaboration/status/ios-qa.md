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
- 本机仍未执行 Swift / 模拟器或真机；实际执行由 root 的 Mac CI 提供。root 回执第三轮 `39190242113`：App build 通过、Native URLProtocol 四项通过，live HTTP 一项 skipped（root 修正 scheme 后重跑），UI 中五 Tab / 三 gate 两项通过，但两个指标用例当时读取 AX value 失败，不能将该轮标全绿。
- 指标测试已改为精确 StaticText 查询，空白或不可解析 AX value 才回退真实 label，全部 500/25/50/12.5/30/8 和未知 — 断言保留，附 label/value/debugDescription 与截图诊断；没有用测试常量补显示值。下一轮 Mac CI `39191189690` 的真实数值用例已经通过。
- 已实际读取 `gh run view 39191189690 --repo Devinshen123/forma-health --log-failed`，该轮 UI **2/4 通过、2/4 失败**：五 Tab 与实际合成数值通过；训练三入口和英文饮食表单用例在 `training.workbench` / `nutrition.add` 的 `isHittable` getter 报 AX activation point invalid，未进入正常 tap，尚不能称入口或表单保存链通过。
- 已查看该轮真正的原生截图和录屏，并抽取录屏 t=13s 训练 / t=25s 饮食帧到外部 `ios-20261018/attempt-5/qa-training-after-swipe.png` 与 `qa-nutrition-after-swipe.png`。按钮在原始截图及滚动后都视觉可见；单凭这些证据不能证明产品按钮被遮挡，也不能认定只因屏外，原测试宽泛 Any 包装查询 + 预先 AX hit-test + 单方向 swipe 是需修的 harness 风险。原始日志和附件保留。
- 已仅在 UITest 中把交互改为 `app.buttons` 精确 ID；reveal 先读有限非空 frame、实际 ScrollView/Form 可见范围（避开导航、演示条、TabBar、键盘），再按目标位置上下滚动，完全进入视口后才读 `isHittable`。普通 wait 同样先排除屏外/空 frame。正常 tap、真实数值和操作后断言均保留，无坐标点击。每次前置 hit-test 附 keepAlways 截图、控件 frame/viewport/完整 AX 以便若继续失败时区分生产可访问性问题。指定 diff check exit 0；新修改等待下一轮 Mac CI，不能预先称通过。
- root 同时给纯装饰卡片边框增加不参与点击的设置，这是合理产品小修，但尚未独立验证，不能冒称本次失败的唯一根因。Swift HTTP / WK 生命周期与真实登录测试的最终结果仍以相应 Mac CI 为准；Node 契约不能替代它们。未进行 iPhone 真机或签名安装。

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

## Lead 最终 Mac 验证（2026-10-18）

GitHub CI 39193436826 / a5b65f3 已实际成功：Core 21/21、Native API/WebKit 10/10、UI 4/4，零失败/跳过，模拟器编译与无签名 iPhone Release archive通过。本角色代码已冻结交回lead；这些是lead的Mac CI结果，不是Windows本地运行。真机安装、签名与TestFlight尚未完成。

