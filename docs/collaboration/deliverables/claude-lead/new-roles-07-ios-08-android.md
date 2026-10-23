# 新员工草案：07 iOS工程师、08 安卓工程师

- 起草：02 claude-lead，2026-10-21 18:35 PDT；checkout：C:\Users\devin\健康网站（共享主目录），main，HEAD e4c6a1b。
- 状态：草案，待01登记。不是正式员工定义，不构成派工，也不表示员工会话已启动。
- 请求：[20261021-1835-claude-lead-to-lead-register-ios-android](../../requests/20261021-1835-claude-lead-to-lead-register-ios-android.md)

## 1. 用户决定（2026-10-21，02对话中的选择）

| 问题 | 用户选择 |
|---|---|
| 新建哪些员工 | “iOS+安卓原生各一名”（选项说明已写明：安卓进入范围，需要01同时改FORMA的产品范围） |
| 谁登记 | “02起草，01登记” |
| 技能装在哪里 | “项目级.claude/skills”；每项安装前先向用户列来源、许可证和文件并确认 |
| 何时开对话 | “登记完成后再开” |

仍待用户决定：Apple Developer Program（US$99/年）及个人/公司身份；Google Play开发者账号；Mac的访问方式与使用哪个工具；本机是否安装Android Studio/JDK；托管服务商、地区与月预算。以上均不由02代决。

## 2. 角色草案

编号、ID、工具与协调关系由01最终登记；下列为02建议。

### 07｜iOS工程师（建议ID `ios`）

- 工具：Claude Code独立会话；工作目录应在Mac上的独立checkout（Windows可以编辑Swift源码，但不能编译、签名或运行模拟器）。
- 协调：建议02协调（与04同属客户端交付）；共享契约交01；体验与03核对；06独立审查。
- 职责：SwiftUI客户端；HealthKit默认只读（睡眠、步数、训练），原始样本留在设备，单独同意后只上传日汇总；Apple登录客户端流程；当前账户离线outbox与账户切换隔离；中英文。设计依据[healthkit-architecture](../../../research/healthkit-architecture.md)。
- 不做：不改server/、src/types.ts、src/api.ts或依赖；不默认上传原始样本或逐条心率；不把未实现能力展示为已完成；未经正式任务和会员确认不签名、不上传TestFlight。
- 建议可写路径：ios/（新目录，由01登记）、docs/collaboration/deliverables/ios/、本人memory与status。
- 首任务：ONBOARD-07。后续候选IOS-SPIKE：Mac与真机上的HealthKit只读技术验证（权限空结果、睡眠重叠、锚点新增/删除、锁屏与前台补同步），依赖Mac访问、开发者会员、HTTPS测试环境与05的同步接口。
- 完成定义补充：iOS构建与测试必须在Mac实测并贴命令与结果；Windows上的工作不能写成“已编译”。

### 08｜安卓工程师（建议ID `android`）

- 工具：Claude Code独立会话，独立checkout。
- 协调：建议02协调；共享契约交01；体验与03核对；06独立审查。
- 职责：Kotlin + Jetpack Compose（Material 3）客户端；Health Connect默认只读，与iOS使用同一份日汇总上传契约；邮箱登录（安卓没有Apple登录，账户方式由03/01确认）；离线outbox与账户隔离；中英文。
- 不做：不改server/、共享类型/API或依赖；不做Play结算、支付或Android以外平台；不把未实现能力展示为已完成。
- 建议可写路径：android/（新目录，由01登记）、docs/collaboration/deliverables/android/、本人memory与status。
- 首任务：ONBOARD-08。后续候选ANDROID-SPIKE：Health Connect只读技术验证，依赖Android Studio/JDK、真机或模拟器、HTTPS测试环境与05的同步接口。
- 本机环境（02于2026-10-21实查）：java、adb、gradle均为not found；ANDROID_HOME、ANDROID_SDK_ROOT未设置；%LOCALAPPDATA%\Android\Sdk不存在。

### 对现有岗位的影响

- 05：设备连接、健康日汇总上传、Apple令牌交换等接口（先由01定契约）。
- 06：增加真机与两个平台的审查范围，需要用户或Mac/设备配合。
- 01：FORMA §1产品范围（当前写“不做Android”）、共享契约与集成。

## 3. 技能分配（find-skills实查）

执行者02，2026-10-21。搜索命令：`npx -y skills find <词>`，词包括healthkit、swiftui、swift testing、sign in with apple、testflight、swift concurrency、android、kotlin、jetpack compose、health connect、healthconnect、android testing，以及`--owner android`和`--owner dpearson2699`。星数与许可证来自GitHub API，描述来自各仓库main分支的SKILL.md。安装数与星数只是参考，不代表质量结论。

### 07 iOS

| 技能 | 来源 | 许可证 | 安装数 / 仓库星数 | 大小 | 处理 |
|---|---|---|---|---|---|
| swiftui-pro | twostraws/SwiftUI-Agent-Skill | MIT | 34.4K / 6297 | 已在项目.agents/skills与.claude/skills | 复用 |
| healthkit | dpearson2699/swift-ios-skills | PolyForm Perimeter 1.0.0（非开源许可，GitHub识别为NOASSERTION） | 3.8K / 1222 | 已在项目 | 复用；许可交SKILL-PROVENANCE-01核对 |
| swift-testing-pro | twostraws/Swift-Testing-Agent-Skill，swift-testing-pro/ | MIT | 9.9K / 469 | 12个文件，50,061字节 | 已安装（见第3节末“安装记录”） |
| authentication | dpearson2699/swift-ios-skills，skills/authentication/ | PolyForm Perimeter 1.0.0 | 3.8K / 1222 | 4个文件，35,291字节 | 用户决定先不装 |
| handoff | D:\AI-tools\skills\_shared\handoff | 待核验 | — | 已有 | 复用 |

以后再评估、本轮不装：app-store-review（dpearson2699，PolyForm Perimeter，4.5K）用于上架审查；ios-localization（同仓库，4.2K）。

### 08 安卓

| 技能 | 来源 | 许可证 | 安装数 / 仓库星数 | 大小 | 处理 |
|---|---|---|---|---|---|
| mobile-android-design | wshobson/agents，plugins/ui-design/skills/mobile-android-design/ | MIT | 24.7K / 41,482 | 5个文件，72,550字节 | 已安装 |
| testing-setup | android/skills（Google官方），testing/testing-setup/ | Apache-2.0 | 2.3K / 9151 | 5个文件，61,023字节 | 已安装 |
| android-intent-security | android/skills，security/android-intent-security/ | Apache-2.0 | 1.6K / 9151 | 1个文件，23,939字节 | 已安装 |
| kotlin-coroutines-flows | affaan-m/ECC，skills/kotlin-coroutines-flows/ | MIT | 10.5K / 285,749 | 1个文件，7,869字节 | 已安装 |
| i18n-expert | daymade/claude-code-skills | 待上游复核 | — | 已在项目 | 复用 |
| handoff | D:\AI-tools\skills\_shared\handoff | 待核验 | — | 已有 | 复用 |

缺口：Health Connect没有可信技能（搜索结果最高82次安装，来源不明），改用developer.android.com官方文档，不装低可信技能。

未选及原因：kotlin-testing（Kotest/MockK属于测试框架选型，归01）；android-clean-architecture（应用架构归01）；uizze.sh@ios-design（来源不明）；expo/*（不是原生路线）。

### 安装约束

- 只装到本项目.claude/skills；已有同名技能不覆盖。
- 每项先列文件、来源、大小和许可证，用户确认后才执行`npx skills add`；装后核对文件与SKILL.md。
- 技能里的例子不构成新平台、依赖、预算或安全授权；SKILLS-MATRIX由01更新。

### 安装记录（02，2026-10-21 18:38 PDT）

- 用户确认：“确认安装5项MIT/Apache技能到项目.claude/skills：swift-testing-pro、mobile-android-design、testing-setup、android-intent-security、kotlin-coroutines-flows。authentication先不装。”
- 命令（设置DISABLE_TELEMETRY=1、DO_NOT_TRACK=1）：`npx -y skills add <repo> --skill <名> --agent claude-code --copy -y --json`，四次调用，退出码均为0，状态均为installed、scope project、mode copy。
- 结果：.claude/skills新增5个目录——swift-testing-pro（12文件，51,213字节）、mobile-android-design（5，75,086）、testing-setup（5，62,396）、android-intent-security（1，24,489）、kotlin-coroutines-flows（1，7,869）。字节数比GitHub树略大，原因待查，推测是换行符转换。
- skills-lock.json新增5条，来源路径与上表一致；原有4条保留。.agents/skills未新增；原有4项技能的目录时间仍为2026-10-13，没有被覆盖。
- 原生发现：安装后本Claude Code会话的技能列表出现这5项。只证明能被发现，没有调用，不算触发验证。
- 尚未完成：SKILLS-MATRIX、registry哈希与`scripts/forma-skills.cjs`读取入口由01登记；07/08未登记前，这些技能不归任何员工。

## 4. 需要01登记

- FORMA §1：按用户决定把安卓原生纳入范围，并注明iOS/安卓尚未实现。
- TEAM-ROSTER：七人增至九人（07、08）。
- TASKS：所有权行（ios/、android/、各自deliverables、memory、status）、ONBOARD-07/08，以及后续IOS-SPIKE/ANDROID-SPIKE的依赖与验收。
- agent-prompts/07-ios.md、08-android.md，current入口，launch Prompt，START-PROMPTS。
- memory/ios/、memory/android/的PROFILE/MEMORY/HANDOFF，status/ios.md、status/android.md。
- SKILLS-MATRIX新增行；可选.claude/agents适配器。
- WORKSPACES：07的Mac checkout与08的本机checkout位置。

## 5. 开对话

01登记完成后，02按launch Prompt开07、08独立对话，首轮只做只读接手；07最好开在Mac上。登记前不开。
