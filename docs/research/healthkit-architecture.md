# iPhone、HealthKit 与健康数据架构核查

核查日期：2026-10-13（America/Los_Angeles）。状态：开发前研究与设计建议；未创建 App、未运行 HealthKit、未签名、未上传 TestFlight。

已确认背景：面向全球用户，核心是健身表现与长期健康；简体中文及英文；响应式网站与真正的 iPhone App；共用账户与后端；Apple 登录与邮箱登录；网页邀请测试与 TestFlight；后期价格意向为 US$20/月。用户最新已授权先实现网站，并确认已有 Mac/Xcode 与 iPhone，但版本和实际连接未核实。首发服务地区、健康数据上云范围、保留期限、邮箱认证形式、开发者会员与总体预算尚未确认。以下没有锁定完整技术栈，也不代表全球法律或 App Review 已通过。

## 1. 结论与推荐边界

推荐采用两个客户端和统一服务契约：Web 承担账户、计划、记录、复盘与报告；iPhone 承担相机、通知、本地离线记录及原生 HealthKit 读取。网站展示获同意上传的服务端副本，不能替代 iPhone 的 HealthKit 系统授权。Apple Watch 已写入 Apple Health 的记录，可由 iPhone 在系统同步后读取；第一版无需先交付 watchOS App，也不能承诺直接实时读取手表。依据：[HealthKit](https://developer.apple.com/documentation/healthkit)、[框架架构与设备同步](https://developer.apple.com/documentation/healthkit/about-the-healthkit-framework)。

SwiftUI 是优先候选，适合原生导航、Apple 登录、HealthKit 和系统可访问性；React Native 或带原生插件的其他方案仍可评估。复用项目的 HealthKit 代码要经过能力核查与真机验证，不能因有一个插件或安装包便视为同步已完成。技术取舍应等参考源码、许可证与运行能力核查后确定。

建议第一版 HealthKit 默认只读，先读取与今日行动直接相关的睡眠、步数、训练记录；活动能量按明确用途纳入。体重可选，静息心率等可放在之后的有限试验。不要一次请求所有健康类型；不请求位置、心电图、用药、血糖或临床记录来实现本轮已确认流程。化验报告上传走用户主动上传流程，与 Clinical Health Records 接口不同。依据：[授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)、[HealthKit 设计指南](https://developer.apple.com/design/human-interface-guidelines/healthkit/)。

HealthKit 导出到我们后端、发送给 AI 服务，是额外的数据处理步骤。推荐第一轮默认设备内处理原始健康样本，只在用户独立确认后上传最小必要摘要与训练条目。摘要仍是健康数据，并不会因聚合而免除用途和同意要求。是否提供原始样本云端保存由用户决定；本建议不默认上传完整历史或逐条心率。

## 2. 读取权限不能用布尔值表示

Apple 明确：App 不知道用户是否允许读取某种数据；拒绝读取时会表现为没有匹配记录，或只能看到自己曾写入的样本。`authorizationStatus(for:)` 表示写入权限；`getRequestStatusForAuthorization` 表示是否需要展示授权页；`requestAuthorization` 成功只说明请求流程完成，不能作为全部读取项已获授权的证明。依据：[HKAuthorizationStatus](https://developer.apple.com/documentation/healthkit/hkauthorizationstatus)、[授权请求](https://developer.apple.com/documentation/healthkit/hkhealthstore/requestauthorization(toshare:read:completion:))。

因此系统连接状态、产品同意状态、查询结果和记录数值必须分开存储。我们自行定义如下状态模型：

| 维度 | 建议字段 / 状态 | 界面表现 |
| --- | --- | --- |
| 设备能力 | `available / unavailable` | 不支持时提供手动记录 |
| 授权请求流程 | `not_requested / completed / failed` | 不展示“全部已授权”的伪结论 |
| 可辨识读取范围 | `unknown`；新系统可选 `limited` 与最早日期 | 不声称能识别拒绝或完整授权 |
| 查询与同步 | `idle / running / pending_unlock / retryable_error / synced / stale` | 显示最近成功读取与上传时间 |
| 结果 | `present / no_visible_data / partial` | “未读取到记录，请检查健康设置或手动记录” |
| 产品云同步同意 | `off / on / revoked`，带版本和范围 | 开关由我们的后端实际执行 |

数值字段使用 `value: null` 表示无可用值，附 `missing_reason`。只有明确样本、用户录入或已定义统计结果中的真实零才保存 `0`。不能对空数组、空统计量自动 `?? 0`，也不能把未穿戴、未记录或未授权推断成零步数、零睡眠或没有进食。睡眠阶段缺失不等于某阶段持续零分钟。

当前官方文档还介绍时间窗口授权。`getEarliestAuthorizedSampleDate(for:completion:)` 能返回可辨识的有限读取范围；无返回项仍无法区分完整授权与拒绝。读取到的官方 DocC 可用性元数据标记该接口从 iOS 27.0 引入，必须在选定 SDK 与最低支持版本后用 availability guard 核实；较旧系统保持范围未知。不要把这一新接口误写成所有 iPhone 可用。依据：[该接口文档](https://developer.apple.com/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate(for:completion:))、[官方可用性元数据](https://developer.apple.com/tutorials/data/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate(for:completion:).json)。

## 3. 同步语义与失败恢复

HealthKit 采用设备内读取，再由 App 调用我们的同步 API。服务端和浏览器不保存或运行 `HKHealthStore`。服务器也不能直接向 Apple Health 拉取后续变化。

Apple 提供 `HKAnchoredObjectQuery` 获取新增和删除，并返回下一次用的锚点；`HKObserverQuery` 只通知有变化，不包含变化本身。后台 delivery 需要 capability / entitlement，observer 要在启动时注册。每条回调路径要及时调用 completion handler。后台频率是上限，不是交付承诺；官方注明 iOS 的步数更新最高每小时。模拟器不能验证此后台行为。锁屏时健康存储可能不可读。依据：[anchored query](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery)、[observer](https://developer.apple.com/documentation/healthkit/executing-observer-queries)、[后台 delivery](https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:))、[锁屏与隐私](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)。

建议同步算法（我们设计）：

1. 登录并确认当前账户后，确认产品云同步范围；首次读取用户同意的有限历史。初始建议 30 天，提供调整；这是待确认参数，不是假定用户已同意。
2. 每个样本类型、设备安装标识、查询范围版本保存独立锚点。锚点只在本地使用，不把设备 A 的锚点拿到设备 B 上运行。
3. 前台启动、用户下拉刷新、后台 observer 触发同一个串行同步器，合并重复触发，分页读取新增和删除。
4. 在一个本地事务里保存样本变动、待上传操作和新锚点。持久化成功后才前移锚点；远端上传稍后完成。这样网络失败不会丢数据，也无需在后台回调里等待长时间 HTTP。
5. 删除事件按 HealthKit UUID 查本地索引，移除对应副本，标记受影响日期或睡眠段需要重算。只上传摘要时，重新计算并替换摘要；若用户选择原始云同步，则同步 UUID 删除操作。
6. 服务端以用户、设备、数据类型、操作 ID 和批次 ID 做幂等处理；响应成功后清理本地 outbox。遇到 401 暂停等待登录，429/临时网络错误退避重试，校验错误隔离并向用户提供修复方式。
7. 锁屏读取失败保持旧锚点，记录“待解锁”，及时完成 observer 回调；下次前台补同步。不要标成“没有健康数据”，不连续请求系统权限。
8. 每次显示 `last_read_at / last_uploaded_at / data_as_of`，陈旧数据不触发声称基于“最新状态”的建议。系统后台不稳定时用前台补同步，不承诺持续实时。

删除通知不是永久审计日志：`HKDeletedObject` 是临时记录，UUID 可定位外部副本，其 metadata 不保留全部原始字段。必须维护 UUID → 时间段映射；不能期待删除事件里还有原开始、结束时间。长时间未运行、重装和锚点丢失之后需要在明确范围内重新获取当前可见快照并进行对账；没有读到某 UUID 也可能因权限变化，不能未经证据把所有云端历史当作已从 HealthKit 删除。可标记待对账、暂停作为新建议依据，并提供明确的云端删除入口。依据：[HKDeletedObject](https://developer.apple.com/documentation/healthkit/hkdeletedobject)、[删除 UUID](https://developer.apple.com/documentation/healthkit/hkdeletedobject/uuid)、[删除 metadata](https://developer.apple.com/documentation/healthkit/hkdeletedobject/metadata)。

第一版建议每个账户明确指定一台 iPhone 作为健康同步主设备。更换主设备先做受控对账，不能把两台设备的每日统计相加。即使后续支持多设备，也需要分别保存读取状态，并以外部 UUID 和明确的来源/摘要选择政策合并。

## 4. 去重、时间与睡眠

原始时间统一保存为 UTC instant，另存来源的 IANA 时区（如存在）、导入时区、时区推断方式和汇总所用时区。单位使用标准值和原始单位双轨记录，显示端按用户偏好转换。语言、居住地区、单位和时区分开设置，不能由中文界面推断用户在中国，或由英文界面推断使用美制。

每天按日历和明确时区的边界聚合，不以固定 `86400` 秒划一天，避免夏令时 23/25 小时日期错误。建议首版以用户选定的汇总时区生成日趋势，并保留来源当地时间；旅行时修改汇总时区须说明会影响哪些图表。时区缺失以导入时区作为有标记的 fallback，不能伪称来源时区。依据：[HKMetadataKeyTimeZone](https://developer.apple.com/documentation/healthkit/hkmetadatakeytimezone)。

我们建议以下类型政策：

| 数据 | 计算与去重政策 | 不应采取的办法 |
| --- | --- | --- |
| 同一 HealthKit 样本多次上传 | 用户范围内 `external_uuid` 唯一；重复操作幂等 | 每个请求都新建记录 |
| 步数、活动能量 | 优先使用本机 HealthKit 统计查询取得选定日边界的结果，再作为带来源/计算版本的快照上传；真机对比 Apple Health | 直接把所有设备的原始累积量或两台 iPhone 的每日统计相加 |
| 训练记录 | 外部 UUID 去重；自家训练与第三方训练疑似同一次时关联，并保留来源让用户选择 | 仅凭相近时间或相似热量无条件删除一个 |
| 睡眠 | 按明确来源优先规则组合区间；保留全部原样本，计算层避免相同时间重复累计 | 把所有分类和所有设备记录时长全部相加 |
| 手动与自动记录冲突 | 保留独立来源、显示冲突，允许用户选择摘要采用哪条 | 把用户手动改动偷偷写回原始 HealthKit 样本 |

统计查询支持 quantity 的离散统计或累计求和；训练和睡眠仍需要各自处理。Apple 文档并没有对所有第三方重复数据和我们的自定义跨端合并算法作普遍保证，最终需用有重叠样本的真实设备核对。依据：[HKStatisticsQuery](https://developer.apple.com/documentation/healthkit/hkstatisticsquery)、[统计时间区间](https://developer.apple.com/documentation/healthkit/executing-statistics-collection-queries)。

睡眠必须单独处理：`inBed` 与 `awake / asleepREM / asleepCore / asleepDeep` 可以合法重叠；inBed 不等于睡着，不能将两层相加。Apple Watch 的 awake 数据也不一定覆盖卧床区间两端。依据：[睡眠分类定义](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)。

建议将 23:30–次日 07:00 合为一个 episode，并以醒来日归属“昨晚睡眠”；同时保留 UTC 区间、计算时区和归属政策。午睡可作为独立 episode。睡着时长取所选可信来源 asleep 区间的并集，阶段不全则标记阶段数据不完整；不要用 inBed 补作 asleep。多个来源的阶段冲突先标记，不推断睡眠质量或疾病。若来源区间都不全，只显示已记录时长。所有规则需有计算版本，重新计算只改派生结果，不改原记录。

另外，系统会把较旧第一方训练样本压缩为 quantity series 并删除/替换旧对象。若以后接入逐条心率，不能假设每个 quantity sample 都是单个瞬时点；需要支持相应 series 查询或使用系统统计。该复杂度是首版不上传逐条心率的理由之一。依据：[压缩训练样本](https://developer.apple.com/documentation/healthkit/accessing-condensed-workout-samples)。

## 5. 统一模型与 API 草案

下列是模型与接口建议，不是已创建的数据库或可用接口。持久层、对象存储和任务队列供应商待源码核查后选择。

| 模型 | 最小字段与约束 |
| --- | --- |
| `User / AuthIdentity` | 内部 user_id、locale、region、display_units、analytics_timezone；provider+provider_subject 唯一，邮箱不是 Apple 身份主键 |
| `DeviceConnection` | user_id、installation_id、设备类型、主设备标志、请求流程、读取/上传时间、同步范围版本；不保存伪造的读取授权布尔值 |
| `ConsentRecord` | purpose、允许类型/历史范围、接收方、说明版本/语言、granted_at、revoked_at、consent_epoch；分别管理云同步与第三方 AI 处理 |
| `HealthObservation` | user_id、来源、external_uuid（适用时）、type、start/end UTC、原值/单位、来源时区、来源版本；原始样本不可直接编辑 |
| `HealthSummary` | metric、区间、bucket_timezone、nullable value、unit、provenance、availability、计算版本、输入修订、data_as_of、完整性说明 |
| `Meal / TrainingLog / ManualState` | 客户端稳定 ID、事实来源、发生时间、timezone、revision；AI 估算与用户确认值分开 |
| `Report / ReportItem` | 私有对象引用、报告日期、原名称/结果/单位/原范围、OCR 候选与用户校正、extraction_version；没有用户确认的结果不能作确定事实 |
| `Recommendation / PlanVersion` | draft、校验状态、解释、input_revision、base_plan_version、before/after diff、accepted_at、undo_of；建议与事实记录分开 |
| `SyncOperation / DeletionJob` | operation_id、批次、主体、对象、expected_revision、consent_epoch、状态、retry_after；删除与导出可追踪 |

API 建议：

| 接口 | 用途与关键保证 |
| --- | --- |
| `POST /v1/auth/apple/exchange` | 服务端验证 Apple token/code、nonce、audience、issuer、expiry，签发我们自己的会话 |
| `POST /v1/auth/email/challenge`、`/verify` | 邮箱验证码/链接候选；先检查地域可达性与成本，再定形式 |
| `POST /v1/device-connections` | 注册当前账户的同步设备和允许范围 |
| `POST /v1/consents`、`POST /v1/consents/{id}/revoke` | 设置/撤回独立用途；服务端立即阻断相关新上传与 AI 作业 |
| `POST /v1/sync/health/batches` | 仅接受当前会话所属用户/设备、有对应同意 epoch 的幂等批次；摘要 upsert/delete 与原始样本模式明确区分 |
| `GET /v1/sync/changes?cursor=...` | 返回我们平台的跨端变化游标；它与 HealthKit anchor 完全不同 |
| `PUT /v1/meals/{id}`、`PUT /v1/training-logs/{id}` | 版本条件更新；冲突返回 409 及当前版本，不静默覆盖 |
| `GET /v1/dashboard?date=...&timezone=...` | 事实、来源、空数据与 freshness 一起返回 |
| `POST /v1/uploads`、`/complete` | 私有、限大小/类型、短期上传授权；对象必须与 user_id 绑定 |
| `POST /v1/reports/{id}/extract`、`/review` | OCR 作业和用户核对分开，失败保留手动录入路径 |
| `POST /v1/recommendations/{id}/accept`、`/undo` | 校验 base revision；新计划版本应用/撤销，不能影响已经记录的餐食/训练事实 |
| `POST /v1/exports`、`POST /v1/account/deletion` | 导出及删除作业，不把注销等同删除 |

安全约束统一由服务端执行：从身份令牌推导用户，不能信任请求体里的 user_id；租户查询、数据库规则和对象授权都执行账户隔离。标准错误包含稳定 code、retryable 和本地化 message key，不在错误或日志里回显健康内容。服务端密钥、签名私钥和 AI 密钥不进入 App/Web 包。

离线餐食、训练、主观状态先保存在当前账户的本地 outbox；重新联网时上传。重要计划接受/撤销应服务端确认版本后生效，离线最多保存待确认操作。退出登录与账户切换时停止 HealthKit 同步，隔离或清理缓存、锚点和 outbox；旧账户队列绝不能在新账户令牌下重发。新账户要重新确认健康云同步用途，不能认为操作系统的 HealthKit 授权等于同意上传给另一个平台账户。

## 6. Apple 登录与邮箱账户

已确认 Apple + 邮箱登录，不再把是否采用 Apple 登录当成未决问题。通用 App Review 4.8 并不意味着所有只用自己邮箱登录的 App 都强制 Apple 登录；其规则与第三方/社交登录和豁免条件相关。本项目选择 Apple 登录来自产品决定。依据：[App Review 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)。

网站需要 Services ID、关联 primary App ID、正确 return URL 和服务端私钥配置。回调不能是 localhost/IP 或带 fragment 的地址；建议注册我们部署项目的稳定 HTTPS 测试子域，避免每次预览随机 URL，暂不买域名。开发者账户和真实后台配置尚待实测。依据：[网站配置](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)、[网页回调要求](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)。

Apple provider subject 映射到内部 user_id；不要按邮箱自动合并 Apple 与邮箱账户。用户可能选用私有 relay 地址。显式“关联账户”需要登录状态、重新验证另一身份与冲突确认，防止邮箱相同造成健康记录串号。开发与正式 App/Services ID 的 audience 必须白名单校验；生产不接受测试 audience。依据：[用户身份](https://developer.apple.com/documentation/signinwithapple/receiving-a-users-identity-token)、[服务端验证](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)。

给 relay 邮箱发送通知还依赖注册发信源和 SPF/DKIM 等配置，不能把普通邮件供应商已接通视为 Apple relay 已可送达。删除账户时，除清理平台数据还要撤销 Apple token，提供可在 App 内启动的删除入口。依据：[relay 配置](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)、[Apple 账户删除技术说明](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)。

## 7. 同意、隐私与 AI 边界

Apple 对 HealthKit 信息要求明确健康/健身用途、第三方共享的事先明确同意，不允许健康数据用于广告或出售给数据经纪商；App Review 5.1.3 还限制个人健康信息存储在 iCloud。5.1.2 要求向第三方 AI 分享个人数据时明确说明并获许可。依据：[当前开发者协议](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)、[App Review 5.1](https://developer.apple.com/app-store/review/guidelines/#privacy)。

因此架构推荐以下控制（我们设计，不是苹果对具体供应商的认可）：

- **系统读取**：按需展示用途并请求 HealthKit；可拒绝，手动记录仍可用。
- **我们的云同步**：单独可撤回，说明类型、历史范围、目的、存储地区/服务商、保留与删除方式；默认不开启原始全量历史。关闭后服务器立即拒绝过期 epoch 的上传，包括离线旧队列。
- **第三方 AI**：另行说明接收方与内容，并提供不调用 AI 的记录路径。没有核实供应商对健康/健身服务用途、日志、保留、训练和删除条款之前，不把 HealthKit 原始或派生数据发给通用模型。去名化不代表匿名。
- **照片与报告**：用户主动上传并查看 OCR/AI 提取结果；私有对象存储，短期下载链接，无公开 bucket；去除无关 EXIF、将无关姓名/证件等在可行时遮除。OCR 日期不明确、单位或参考范围缺失时要求核对，不能补造。
- **设备缓存**：选用合适的系统文件保护和 Keychain 存令牌；健康缓存避免 CloudKit/iCloud 同步，并检查 App 备份排除策略。日志和监控只存操作状态、耗时及脱敏错误，禁止照片、报告文本、健康数值、身份令牌进入普通日志。
- **撤回和删除**：撤回云同步不等于删除既有云副本，界面应提供立即停止与删除已同步数据两项。用户仅在 iOS 设置撤回读取，App 不能可靠检测具体拒绝项；不能保证据此自动清空云副本。平台自己的“断开/撤回”可停止后台 delivery、阻断新处理并执行约定清理。
- **账户删除**：清理主数据、图片、报告、派生摘要、建议、队列和用户可识别缓存；备份保留与清除周期需明确，恢复备份时须重新应用删除记录。第一版只读，因此删除平台账户不会删除 Apple Health 原始数据。

若将来加入写回，App 只能删除自己写入的 HealthKit 对象，且仍受写入权限约束；不能承诺删除其他来源数据。AI 营养估算第一版不自动写入 HealthKit；用户审核也不等于数值已变为仪器测量。需额外评估准确性标注、来源、同步 ID 和版本。依据：[HealthKit 删除权限](https://developer.apple.com/documentation/healthkit/hkhealthstore/delete(_:withcompletion:)-17hzm)、[HealthKit sync identifier](https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier)。

AI 服务只生成候选：食物/OCR 识别、计划草稿、通俗解释与复盘表达。营养算术、单位转换、过敏/限制过滤、目标约束、聚合和账户权限使用确定性逻辑。结构化输出通过 schema 校验，并附输入版本、真实来源及不确定性；没有可靠依据就不展示虚构置信度或健康分数。

建议在用户接受前只处于 draft。接受要显示原因与前后差异，服务端以 base plan version 校验。撤销生成一个新的恢复版本并保留历史，不倒退删除事实记录。报告解释使用原报告范围及日期，不凭颜色做诊断，不自动改药或治疗；睡眠关联不能写成因果，不凭单项指标自动取消训练。数据不足只提出保守可选动作。

全球用户是产品目标，不是已具备全球开放资格。推荐邀请测试按服务地区逐步开放，维护 `service_region` 能力开关，逐一核查供应商可达性、数据存储/跨境流动、隐私文本与通知支持。不能笼统宣称“使用某数据库就符合 HIPAA/GDPR”或默认所有健康 App 都适用同一法规；相关适用性待首发地区、业务主体与用途明确后单独核查。

## 8. 真实开发与分发依赖

| 依赖 | 目前状态 | 进入实现后的验收依据 |
| --- | --- | --- |
| Windows 工作区 | 已知当前在 Windows；可以做 Web、API、契约与 Swift 源码编辑 | Web/API 本地运行、接口联调；不能由此声称 iOS 已编译 |
| Mac / Xcode | 用户确认已有；版本、远程连接与实际工具访问未核实 | 按官方兼容表选择 Xcode/macOS，原生编译、模拟器、签名工具可运行 |
| iPhone 真机 | 用户确认已有；型号与系统未核实 | 权限、锁屏、后台、离线、设备时间变化真机测试 |
| Apple Watch | 可选，未确认 | 验证已写入健康的睡眠/训练记录读入 iPhone；无设备提供手动路径 |
| Apple Developer Program | 未确认已加入 | Team/App ID/entitlement/profile 配置与签名；TestFlight 上传处理成功 |
| TestFlight | 用户选择的分发方式，尚未上传 | 构建号、处理状态、测试者实际安装记录；外部测试须走相应 Beta App Review |
| Apple 与邮箱登录服务 | 设计阶段 | 真 token 校验、跨端同一账户、relay/邮箱送达、删除撤销实测 |
| AI / OCR / 云存储 | 未选型、未启用 | 地区可用、数据处理条款、真实失败与限流、成本测量 |

Xcode 的受支持运行环境是 macOS；Windows 本身不能执行 Xcode 的 iOS 构建、签名和真机调试链。可使用已有 Mac、受控远程 Mac 或 macOS CI，但 CI 构建不能代替 HealthKit 真机测试。精确 Xcode/macOS 组合在实现前按官方表复核，不在本阶段锁定 beta。依据：[Xcode 系统要求](https://developer.apple.com/xcode/system-requirements)、[TestFlight 流程](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)。

Apple 当前公开 Developer Program 费用为 US$99/年或当地货币，地区税费另算；免费账户的自用设备测试与 TestFlight 分发资格不同。本轮未加入或付款。依据：[会员权益与费用](https://developer.apple.com/programs/whats-included/)、[免费与付费账户](https://developer.apple.com/programs/)。Mac、iPhone、云 Mac、邮件与 AI 的成本取决于已有设备和选型，不虚构已购买预算。

## 9. 建议阶段与验收闸口

1. **网站实现与剩余决策并行**：用户已授权先做网站；完成参考源码与许可证核查，确认服务地区、健康上云模式、保留规则、邮箱认证、Mac/真机版本与开发者会员；确定 OpenAPI 与事件/计划版本契约。网站不能展示尚未实测的 HealthKit 或 Apple 登录为已完成能力。
2. **原生技术验证**：在 Mac 和真机完成最小 HealthKit 只读、权限空结果、睡眠重叠、锚点新增/删除、锁屏与前台补同步；验证 Apple 登录与服务器账户。安排随 iPhone 开发任务推进；验证产物不能替代正式产品交付。
3. **邀请 MVP**：Web 与 iPhone 共用真实后台完成引导 → 初始计划确认 → 饮食审核 → 训练记录 → HealthKit/手动状态 → 建议确认/撤销 → 周复盘；报告 OCR 保留独立用户核对步骤。演示数据清楚标识。
4. **有限地区 TestFlight**：记录每个构建的设备/系统、后台成功/失败证据、账户隔离与删除结果。完成隐私与审核材料，未获确认不发布生产。
5. **扩展**：写回健康、详细心率、更多地区、外部穿戴同步与商业订阅分别作为后续评审，不挤入当前原生验证。

必须覆盖的集成测试：

- 新账户 A 拒绝或部分读取、未设备记录、真实零、手动补录、中英文空数据文案；不产生误导值。
- 23:30–07:00 跨午夜、午睡、两来源重叠、inBed 与阶段重叠、时区缺失、旅行、夏令时转换。
- 相同 batch 重试、删除后重试、网络中断、本地提交后进程退出、锁屏、强退后重新打开、过期/失去锚点、新增历史记录。
- 主设备更换、两台设备同日记录、账户 A 退出后 B 登录、A 的待上传队列不会进入 B。
- 在产品内撤回云同步后离线旧批次被拒绝；AI 排队期间撤回处理同意；删除账户后无法从链接/队列恢复数据。
- Web 与 App 同时编辑训练或计划产生明确冲突；接受、撤销、再次修改保留正确版本和事实。
- OCR 错字、结果单位差异、不同日期格式、缺失参考范围、AI 超时/结构不合法；用户核对前不形成确定结论。

## 10. 证据与工具状态

以 Apple 官方技术文档、Help、开发者协议和 Review Guidelines 为依据，所有来源在正文对应位置链接。Apple 文档为动态内容；实施和提审前需重新核查支持版本和条款。本文件的状态模型、同步事务、API、分阶段范围和用户界面文案都是本项目设计建议，尚未实测。

研究使用 agent-reach（本机 v1.5.0）：已读取 SKILL、search/web references 并检查 Exa schema；Exa 免费额度返回 429，没有付费或申请新 key。随后使用可用 web 搜索定位 Apple 官方资料，结合 agent-reach 的 Jina Reader 路径读取官方页面，并直接读取官方 DocC 元数据确认新接口的 availability。`check-update` 返回当前为最新版。未从普通论坛帖子推定稳定 API 保证，也未把工具连接等同可运行 iPhone 能力。
