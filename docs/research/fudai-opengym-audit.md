# FudAI 与 openGym 源码复用审计

核查日期：2026-10-13（America/Los_Angeles）。范围：官方 GitHub 仓库、浅克隆源码、许可证、依赖清单、构建配置、健康接入及公开维护记录。本报告用于我们的全球健身表现与长期健康产品，网站邀请测试与 iPhone TestFlight，计划 US$20/月；不是对上游产品的安全认证或临床验证。

## 决策结论

1. **FudAI 可作为 iPhone 营养记录和 HealthKit 的技术参考。** HealthKit 是实际实现，不是只有 README 标签；但它没有睡眠、HRV、静息心率的数据通路，也没有我们的 Apple＋邮箱账号体系及网站与 App 的完整云同步。
2. **FudAI 的网站是营销官网，不能当成健康 Web App 直接复用。** iOS 是 SwiftUI，Android 是 Kotlin/Compose，两套应用实现；共享的主要是动作目录、图片清单和部分测试资料。
3. **openGym 适合借鉴训练领域模型和交互流程，不适合作为默认闭源商业底座。** 自有代码为 AGPL；其动作图片、动画另有 Gym visual 授权，商业产品不能因仓库公开而直接复制。
4. **openGym 的跨平台能力是真实的 React＋Capacitor 架构，但健康功能不跨平台。** 当前健康接入仅 Android Health Connect 写入训练和体重，iOS 明确返回 unsupported。iOS 签名、TestFlight 发布流程在其文档中仍未配置。
5. **两者都不能直接提供整合饮食、训练、睡眠恢复及长期健康趋势的完整产品。** 统一事件模型、账号、跨端同步、睡眠导入、数据来源与去重规则、订阅权限及 AI 预算需要单独设计。

## 可复现快照与维护情况

| 项目 | 审计固定 commit | 提交时间（洛杉矶） | 已公开的近期版本 | 维护证据 |
|---|---|---|---|---|
| FudAI | `a1dd53b025d403c470a009116b4f8d9cc62669d5` | 2026-10-13 18:32:36 PDT | Android 7.2：2026-10-08；iOS 7.1.2：2026-09-28（日期按发布 API 的 UTC 值列示） | 未归档；近期持续提交；该 commit 的 Quality checks、CodeQL 成功；最近 iOS tests 的另一个 commit 成功 |
| openGym | `e348fc17c42c7e9a211c5972e573ad3698190ee2` | 2026-10-13 11:31:16 PDT | v1.4.1：2026-10-10（发布 API UTC 日期） | 未归档；持续提交及 PR；最近部分 GitHub Tests 状态为 `action_required`，不能解释成测试失败或测试通过 |

这里固定的是默认分支 commit，而不是仓库 `pushedAt`：后者也可能被其他分支的推送改变。主分支与最新商店版本并不等同，尤其 FudAI 主分支中的 workout 导入不可直接假定已进入 iOS 7.1.2。

来源：[FudAI 固定快照](https://github.com/apoorvdarshan/fud-ai/tree/a1dd53b025d403c470a009116b4f8d9cc62669d5)、[FudAI Releases](https://github.com/apoorvdarshan/fud-ai/releases)、[FudAI Quality checks](https://github.com/apoorvdarshan/fud-ai/actions/runs/38496307902)、[FudAI 最近 iOS tests](https://github.com/apoorvdarshan/fud-ai/actions/runs/38495500569)、[openGym 固定快照](https://github.com/DuarteSantos8/openGym/tree/e348fc17c42c7e9a211c5972e573ad3698190ee2)、[openGym Releases](https://github.com/DuarteSantos8/openGym/releases)、[openGym Tests 示例](https://github.com/DuarteSantos8/openGym/actions/runs/38503934336)。

本机参考源码保存在 `reference-sources/fud-ai/` 和 `reference-sources/openGym/`。它们是研究材料，不属于我们的产品实现。

## FudAI：实际能力与边界

### 架构、依赖与运行

| 项 | 源码事实 | 对我们的意义 |
|---|---|---|
| iPhone | Swift 5、SwiftUI、`@Observable`；主 App deployment target 17.6，部分扩展 target 为 26.2 | 适合原生 iPhone 参考，无法直接共享 React 网站组件 |
| Android | Kotlin 2.4.10、Compose BOM 2026.09.00；minSdk 26；Health Connect 1.1.0 | 是独立 Android 实现，不是 iOS 源码自动生成 |
| Web | 静态 HTML/CSS＋Cloudflare Worker；`build` 是 static validator | 可借鉴下载页，不存在完整 Web 健康仪表盘底座 |
| iOS 第三方依赖 | SwiftPM 锁定 argmax-oss-swift 1.1.0、RevenueCat purchases-ios 5.80.2、swift-argument-parser 1.8.2；项目还有本地 LiteRTLM package | README 的“Native platform frameworks”不能理解为完全没有第三方 SDK |
| Android 第三方依赖 | DataStore、OkHttp、serialization、CameraX、ML Kit、Health Connect、RevenueCat、LiteRT-LM、Whisper 等 | 平台依赖、体积、商店声明都需重新评估 |
| 本地数据 | iOS `FoodStore` 保存 UserDefaults JSON；照片另存 Application Support；Android Preferences DataStore，带损坏保护及一致性包装 | 可参考离线记录与迁移；不等于适合我们的多用户服务端数据库 |
| AI | `GeminiService`/`ChatService` 路由多个供应商，用户审核结果后保存；BYOK 与可选 hosted AI 并存 | 审核与可修正流程值得借鉴；我们需单独定义供应商、计费、预算和失败处理 |

证据：[iOS 项目配置](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker.xcodeproj/project.pbxproj)、[SwiftPM 锁定依赖](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved)、[Android 依赖目录](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/android/gradle/libs.versions.toml)、[Web package.json](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/web/package.json)、[FoodStore](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Stores/FoodStore.swift)、[FudaiDataStore](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/android/app/src/main/java/com/apoorvdarshan/calorietracker/data/FudaiDataStore.kt)、[GeminiService](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Services/GeminiService.swift)。

官方贡献文档建议 iOS 在 Xcode 16+ 打开项目、Android Studio 构建、Web 以静态服务器浏览。但审计快照的 iOS CI 明确运行在 Xcode 27，并依赖 arm64 simulator 的 LiteRT-LM，所以不能把较旧的入门文档当成“Xcode 16 一定能构建最新 main”的证明。本机 Windows 没有 Xcode，本次没有重新构建 iOS 或进行 HealthKit 真机读写。证据：[CONTRIBUTING](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/CONTRIBUTING.md)、[iOS CI](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/.github/workflows/ios-tests.yml)。

### HealthKit 核查

`ios/calorietracker/Stores/HealthKitManager.swift` 第 2 行导入 HealthKit，第 116 行创建 `HKHealthStore`，第 268 行开始权限申请。`calorietrackerApp.swift` 将 FoodStore 的新增、修改、删除回调连接到 HealthKit，因此这不是未接入应用的孤立示例。entitlements 还声明 HealthKit 和 background-delivery。

| 数据 | 权限/实现范围 | 不能误解成 |
|---|---|---|
| 体重、身高、体脂 | 存在读写及体重、体脂回填 | 自动得到所有身体和疾病指标 |
| 营养 | calories/macros、多种微量营养素写入；可恢复带 `fudai_entry_id` 元数据的本应用记录 | 任意第三方 App 的完整食品记录都能无损导入 |
| 活动能量 | 写入本应用计算的训练消耗，以稳定 session ID、版本和删除 tombstone 管理 | 实测训练热量或任意可穿戴设备的准确消耗 |
| 基础能量、步数 | read types 中包含；有 daily steps 查询 | 网页浏览器可直接读取 Apple Health |
| Health workout | main 中读取 HKWorkout，保存到独立 `ImportedHealthWorkout`；查询回溯 90 天 | 已有完整训练 set/reps 导入，或已在最新商店版本上线 |
| 出生日期、生理性别 | read characteristic types | 用户已经授权全部读取权限 |
| 睡眠、HRV、静息心率、血氧 | 审计范围未发现对应 HealthKit type、睡眠记录模型或统计通路 | 已支持睡眠恢复或长期健康监测 |

关键设计可借鉴：营养、体重与 workout 用稳定标识去重；将 Apple Health 导入 workout 与本地力量训练和估算消耗分开；区分查询失败与空数据；保存本应用的份量元数据，防止重装恢复后伪造食物质量。

仍需验证：权限撤销后的真实行为、后台送达、跨时区睡眠分日、多个设备和多来源去重、HealthKit 对读取权限不可直接获知的情况，以及给我们的服务端同步时的用户同意和删除链路。拥有 entitlement 与 observer 源码不等于这些场景已通过真机测试。

证据：[HealthKitManager，权限范围从 L194/L236](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Stores/HealthKitManager.swift#L194)、[应用连接 FoodStore](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/calorietrackerApp.swift#L328)、[entitlements](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/calorietracker.entitlements)、[带标签的营养恢复](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Stores/HealthKitManager.swift#L1395)、[ImportedHealthWorkout](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Models/ImportedHealthWorkout.swift)。

### 数据结构与云服务

- `FoodEntry`：UUID、名称、热量、protein/carbs/fat、timestamp、source、mealType、照片文件名、可选微量营养素、份量克数/单位、原料、商品元数据。原始图片字节不再写进 JSON blob，未知份量显式保持未知。
- `StrengthWorkoutSession`：UUID、日记日期/稳定 date key、开始结束时间、时长、exercises、可选 caloriesBurned、healthSyncVersion。
- `ImportedHealthWorkout`：HealthKit UUID、activity type、起止时间、总能量、来源/设备名称，与力量日志分开。
- `UserProfile` 等模型使用客户端计算目标；并非统一 Web/iOS 服务端领域模型。
- 有可选 hosted-AI Worker、RevenueCat 验证和 D1 用量账本，也有 Weekly Challenge 服务与备份。**有这些服务不等于已有我们的用户账号、原始日志云同步和 Web 账号后台。**

证据：[FoodEntry](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Models/FoodEntry.swift#L321)、[StrengthWorkoutSession](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Models/StrengthWorkoutSession.swift#L439)、[hosted AI](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/services/hosted-ai/README.md)、[仓库说明的同步范围](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/README.md)。

### 许可证与资源

自有代码的根 LICENSE 是 MIT，允许商业改造和分发，但需要保留版权与许可文本。不能因此跳过第三方数据、字体、模型和商标许可。

- Free Exercise DB 的随仓库 LICENSE.md 是 Unlicense；可以单独核查上游后使用目录文本。
- Open Food Facts 采用 ODbL，条码事实数据与图像/数据库许可需要按实际使用核查；本项目是实时查询，不是把整个数据库变成 MIT。
- 动作 PNG 序列由 FudAI 声称为自创，main 的资源说明列示约 1.2 GB、7,000 帧，应用只带 manifest，运行时从 FudAI CDN 下载。复用时应自主托管并核实每类资源授权，不能默认借用其 CDN。
- Provider 标识仍是各方商标；THIRD_PARTY_NOTICES 包含 MIT/CC0 标识来源。

证据：[MIT LICENSE](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/LICENSE)、[ASSET_CREDITS](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ASSET_CREDITS.md)、[FreeExerciseDB 许可](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/ios/calorietracker/Resources/FreeExerciseDB/LICENSE.md)、[图片打包/CDN](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/shared/workout-vectors/README.md)、[THIRD_PARTY_NOTICES](https://github.com/apoorvdarshan/fud-ai/blob/a1dd53b025d403c470a009116b4f8d9cc62669d5/THIRD_PARTY_NOTICES.md)。

## openGym：实际能力与边界

### 架构、运行与验证

| 项 | 源码事实 | 对我们的意义 |
|---|---|---|
| Web UI | React 19.2.7、Vite 8.1.5、Zustand 5、React Router 7 | 有真实训练 Web App，比 FudAI Web 更贴近训练功能 |
| 手机 | Capacitor 7，仓库有 Android 和 iOS shells；同一 React UI | 可共用 Web 代码，但不是原生 SwiftUI 与 HealthKit 已完工 |
| API | 原生 `node:http`；SimpleWebAuthn、undici、web-push；可选 Claude Agent SDK | 自托管小服务参考，不是现成全球订阅业务服务 |
| 数据 | `/data/db.json` 保存用户/凭据；`state-<uid>.json` 保存每人状态；原子写和备份；媒体另存 | 不是 PostgreSQL、SQLite 或关系数据库；扩展与运维要重设 |
| 同步 | localStorage＋手机私有 JSON file mirror；server rev＋baseRev，409 检测和按字段时间戳合并 | 有实际离线同步思路，可参考边界场景；不直接复制进我们的闭源代码 |
| 账号 | 浏览器 passkey/密码；手机可匿名离线，也可单次 code 与服务端配对 | 未找到 Sign in with Apple；不满足我们 Apple＋邮箱登录需求 |
| 发布 | Docker Compose，Node 22 Alpine＋nginx；Android APK；iOS CI 需自有 Mac runner | 其 iOS 文档明确 unsigned IPA、TestFlight 签名与导出尚未配置 |

本次在参考目录中执行 `npm ci --ignore-scripts --no-audit --no-fund`，随后使用仓库规定的 Vitest 跑 `health-connect.test.js`、`health-sync.test.js`、`recovery.test.js`，**3 个文件、80 项测试全部通过**。`npm run build` **成功**；有大 chunk 和无效 dynamic import 的警告。没有执行 Docker API、Android 原生构建、iOS 原生构建、部署或真机健康读写，因此不能把 Web 构建成功延伸成这些功能都已可运行。

证据：[frontend package.json](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/package.json)、[API package.json](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/api/package.json)、[Docker Compose](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/docker-compose.yml)、[数据文件](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/api/server.js#L117)、[useStore 同步设计](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/store/useStore.js)、[MOBILE，iPhone 发布边界](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/docs/MOBILE.md)。

### 健康与训练模型

`frontend/src/lib/health-connect.js` 生成已完成 workout 和体重的记录，按 client ID 与内容 fingerprint 避免重复；训练缺少有效开始/结束时间时不伪造时长。`health-sync.js` 只在 Android 注册原生 HealthConnect 插件，Web 与 iOS unsupported；Java 插件执行写入与删除。其 own-state 文件存储是否启用健康同步，默认关闭，而且此授权状态不随账号同步到另一手机。

没有发现 iOS `HKHealthStore` 或 HealthKit entitlement；没有睡眠/HRV 导入。Android 功能是 write-only，不是读取全健康数据。本次 80 项测试验证的是 JavaScript 记录构造、同步规划和恢复算法，不是 Android 系统权限或真实写入。

证据：[health-connect.js](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/lib/health-connect.js)、[health-sync.js：Android gate](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/lib/health-sync.js#L9)、[HealthConnectPlugin.java](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/android/app/src/main/java/ch/duartesantos/opengym/HealthConnectPlugin.java)。

训练模型值得学习：workouts、routines、week/dayPlan、active session、bodyweight、measurements、customEx；set 包含重量、次数/时长/有氧、warmup/work、dropset/restpause、failure、RIR 等；时间与单位有显式规则。肌肉“恢复”算法以有效训练组数、RIR、7/28 天暴露与指数衰减等启发式参数计算，它是训练日志推算，不是睡眠、HRV 或实测生理恢复，也不是已经验证的个人医疗评分。

证据：[状态 DEF](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/store/useStore.js#L104)、[workout-model](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/lib/workout-model.js)、[recovery 算法](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/frontend/src/lib/recovery.js)、[设计说明](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/docs/dev/FATIGUE_SETS_MODEL.md)。

### 商业许可：必须区分代码、文本与媒体

根 LICENSE 是 GNU AGPL v3；API/frontend manifests 标识 `AGPL-3.0-or-later`，README/NOTICE 简写 AGPL v3。**不是 MIT，也不是禁止收费。** 若修改程序并让用户通过网络使用，AGPL §13 要求向这些用户提供对应源码；分发修改后的应用也涉及 AGPL 的许可义务。采用闭源商业产品方案时，不能仅删除开源声明或换品牌来解决。证据：[仓库 LICENSE](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/LICENSE)、[GNU AGPL §13 官方文本](https://www.gnu.org/licenses/agpl-3.0.en.html#section13)。

NOTICE 给的是 App Store 分发渠道附加许可，要求对应源码仍以 AGPL 可获得；**这不是允许把整个项目闭源的例外**。CLA 授予作者重新许可贡献的权利，也不等于我们获得了另一个商业许可。证据：[NOTICE 的 App store exception](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/NOTICE.md#app-store-exception)、[CLA](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/CLA.md)。

| 资源 | 实际许可/声明 | 本项目建议 |
|---|---|---|
| openGym 自有代码及新动作文本/翻译 | AGPL | 学习需求与行为；闭源产品自行实现，或另行谈商业许可 |
| Gym visual 图片/动画 | 不属于 AGPL；独立商业产品需自有许可；NOTICE 禁止喂给 AI、训练或作为生成素材 | 不拷贝、不热链、不用于生成我们的素材 |
| `textSource: exercisedb` 的历史部分动作文本 | NOTICE 称源于 ExerciseDB/hasaneyldrm MIT；并不包含后来新增描述和翻译 | 优先从 MIT 上游取，经独立核查，保留许可；不要整目录复制 |
| MuscleMap 身体图路径 | 其上游 MIT | 从上游单独核查与取用，保留版权许可；避免带入 AGPL 修改代码 |

证据：[NOTICE 资源分类](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/NOTICE.md)、[示例动作 JSON](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/catalogue/exercises/0001.json)、[目录说明](https://github.com/DuarteSantos8/openGym/blob/e348fc17c42c7e9a211c5972e573ad3698190ee2/catalogue/README.md)。

## 针对我们产品的复用矩阵

“直接复用”只描述技术方向，实际纳入代码前仍需固定版本、保留相应许可和运行测试。

| 能力 | FudAI | openGym | 采用方向 |
|---|---|---|---|
| 食物拍照→AI 估计→用户修正 | 有成熟 iOS/Android流程；MIT | 无完整同等营养主流程 | 参考 FudAI，Web 自行实现统一审核与份量编辑 |
| 训练记录/计划/PR/组数模型 | 有原生力量日记 | 训练 Web 功能丰富，AGPL | 借鉴 openGym 行为和数据需求，自建模型与 UI |
| 原生 iPhone UI | SwiftUI，可提取 MIT 模块并重构 | Capacitor WebView | iPhone 倾向 SwiftUI；Web 保持独立适配 |
| HealthKit 营养/体重/活动接入 | 实际存在 | 无 | 参考 FudAI 的稳定 ID、来源区分、删除链路 |
| 睡眠/HRV/静息心率 | 未实现目标通路 | 未实现 | 新建接入与统计，不能假定上游覆盖 |
| Web＋App统一账号 | 无我们的账号/完整原始日志同步 | 自托管账号＋手机配对，未有 Apple 登录 | 新建 Apple＋邮箱身份模型、邀请和服务端权限 |
| 跨端持久化 | 本地优先/可选平台备份 | JSON 文档同步，具有冲突处理 | 新建服务端数据库/API，保留本地临时记录与可重试队列 |
| US$20/月订阅 | 有 RevenueCat/hosted AI 参考 | 无我们的收费体系 | 先邀请测试；未来服务端验证权益＋IAP/Web订阅映射 |
| 动作数据库与素材 | 文本多为 Unlicense，其他资源逐项核查 | 混合 AGPL/MIT/专有媒体 | 优先选择清晰许可的上游文本，自制或正式授权媒体 |
| AI 长期健康指导 | 有营养/训练上下文 | 有可选训练 Coach | 自建来源可追踪的建议；不把估计数据转成确定生理结论 |

## 尚未证实，不能写进产品承诺的事项

- 两个仓库均未在本机完成 iPhone/TestFlight 编译、签名与分发；FudAI 有公开 iOS CI 成功记录但不代替我们的构建。
- FudAI 主分支新 Health workout 导入是否已经发布；照片/文字的营养识别准确率和全球食物覆盖。
- 任何上游的临床正确性、疾病预测能力、恢复算法验证或 AI 结果准确率。
- 上游模型、付费 provider 与 RevenueCat 配置对我们的实际成本；仅存在配置与代码不能推定可使用作者账号。
- openGym 独立商业许可是否可取得、成本，以及 Gym visual 的我们产品授权价格。
- FudAI 每一种图片与内置模型文件的单独权利链。本报告确认根 MIT 和公开资源声明，不把声明扩展成所有文件无条件商业可用。
- HealthKit 睡眠去重、HRV聚合、多设备归因、权限撤销、长期后台导入，以及用户删除后所有端的删除一致性。

## 后续实施约束

网站先以自建领域模型实现邀请、登录、营养记录、训练记录、睡眠手动记录与趋势；iPhone 后续按相同 API 契约接入。自动健康接入显示数据来源、覆盖日期、最后同步时间与缺失状态。不会把网页手动睡眠标成 Apple Health 导入，也不会把 AI 估计热量标成测量值。

不复制 openGym 自有代码及专有媒体进入闭源产品。若采用 FudAI MIT 片段，记录文件路径、固定 commit、修改说明和许可证，并在独立模块内适配我们的数据与权限边界。

工具记录：依照 agent-reach GitHub 路由使用 GitHub CLI 获取官方仓库与发布/CI 元数据，并读取本地浅克隆；同时浏览官方仓库与 GNU 许可文本。Agent Reach `check-update` 返回 v1.5.0 已是最新版本。
