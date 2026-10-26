# 2026-10-24 AUTH-ENABLE-01 实际开通（当前）

用户明确要求真正开通Google/Apple网站登录并打开申请页面引导配置。唯一01 lead，当前checkout C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站，分支codex/fud-food-photo-20261022，源码0aa698db7d066655a2f1e10b8a0e156988529773；实际3001为产品5e6b34c。只登记此配置任务，不启动其他员工或Claude桌面交接。

| ID | owner / 独占范围 | 状态 | 依赖与验收 |
|---|---|---|---|
| AUTH-ENABLE-01 | lead：docs/architecture/authentication-setup.md、docs/collaboration/deliverables/lead/auth-provider-activation-20261024.md、本任务板/本人status与memory；本机被Git忽略的服务端配置和官方申请界面 | doing | Google本机真实登录/刷新通过，5e6b34c/PID95536。用户2026-10-25明确继续Apple申请引导；已在外部Chrome从官方enroll页点击Start your enrollment到达Apple登录页，等待本人登录/双重认证与个人/公司申请身份选择；未填写身份、提交协议、付款或生成凭证。登录后先核实实际会员，避免重复申请；Apple网站还缺正式HTTPS域名。Google生产核验/旧secret停用/上线前私下轮换仍待用户，不改当前Google配置或健康记录 |
# 2026-10-24 AUTH 实施（当前）

用户明确要求实现登录并选择邮箱密码、Google与Apple。沿用唯一lead、fud-food-photo checkout与现分支，覆盖旧只读限制；不执行WHOOP/Oura下一阶段申请。方案/契约见docs/architecture/authentication-20261024.md及src/auth.ts。

| ID | owner / 独占写入 | 状态 | 验收 |
|---|---|---|---|
| AUTH-SERVER | fud_backend技术助手已冻结交回lead：server/auth/、server/app.ts、server/store.ts、server/auth.test.ts、.env.example | done | 本人最终全套429通过；助手7/7与独立44/44；新增旧库迁移由root最终429全套确认，邮箱验证/恢复/密码、Google+Apple验签/双阶段、单次/竞态、旧邮箱不自动合并，真实provider未开通 |
| AUTH-WEB | fud_frontend技术助手已冻结交回lead：src/components/Auth.tsx、src/components/AccountSecurity.tsx、src/auth.css | done | 双语登录/注册/忘记重置验证/快捷登录、配置说明、pending/卸载保护；root合成浏览器含verify/reset/new密码、390px无溢出/console0；真实provider缺凭证 |
| AUTH-INTEGRATE | lead：src/auth.ts、src/api.ts、src/App.tsx、src/components/Modal.tsx（可选关闭禁用）、src/features/Settings.tsx、docs/architecture/、vite.config.ts（开发回调代理）、scripts/build-offline-shell.mjs（OAuth回调绕过离线壳）、README、docs/collaboration/decisions/20261024-authentication.md及任务板/本人记忆/构建部署 | done | 最终429/429、完整build与CUA通过；代码5e6b34c已上GitHub main/本机3001，原账户/data/env保持，邮件/Google/Apple真实配置未完成 |
| AUTH-DIAG-02 | 拟02 claude-lead：docs/collaboration/deliverables/claude-lead/auth-ios-report-diagnostics-20261024.md及本人既有记录 | todo | 静态诊断候选；正式单requests/20261024-1235-lead-to-claude-lead-static-diagnostics.md；等待Showroom明确桌面交接，未发送/未接单，不解除受限操作 |
| AUTH-QA | fud_qa技术助手已冻结交回lead：tests/authentication.test.ts、docs/reviews/authentication-20261024.md | done | 独立44/44；其新增旧库迁移用例由root最终429全套执行，fail/skip0；真实provider/邮件/跨站正式配置未验证 |

助手是本任务技术助手，不创建第二名lead或同时写其他正式员工记忆。配置/开发者凭证与正式HTTPS缺失不阻塞代码，但不声称真实快捷登录已开通。
# 2026-10-23 HEALTH 实施（当前）

用户明确要求实现WHOOP/Oura回调及后端同步、Google Health与Apple Health，并授权技术助手并行。沿用既有lead及fud-food-photo checkout，产品方案沿用已批准Prompt并具体化为docs/architecture/health-integrations-20261023.md。本表覆盖本切片的历史只读/冻结，不接管其他会话目录。

| ID | owner / 独占写入路径 | 状态 | 验收 |
|---|---|---|---|
| HEALTH-SERVER | fud_backend技术助手已冻结交回lead：server/health/、server/health.test.ts、server/app.ts、.env.example | done | root最终377/377，助手专项9/9、独立QA23/23；OAuth/加密token/刷新/15分钟轮询/最近7天+2天重叠/Apple批次revision；未连接真实provider，云端删除不推断 |
| HEALTH-IOS | ios技术助手已冻结交回lead：ios/、docs/health/apple-health-setup.md；lead维护generator | review | 6e02aa0修复未保存HK样本来源nil；Mac CI40061328110：Core25/25、新HealthKit4/4、NativeAPI6/6、UI4/4与unsigned Release archive通过；完整job有旧Workbench草稿恢复测试1失败，不能标全绿；未真机 |
| HEALTH-WEB | lead：src/health.ts、src/api.ts、src/features/HealthConnections.tsx、src/features/Settings.tsx、src/styles.css、scripts/ios-generate-project.mjs、docs/architecture/、docs/health/provider-application-guide.md、README、任务板/本人记忆与发布集成 | done | root全套377/377与完整build通过，CUA隔离合成Oura同步3项/来源日期审核/console0；实际3001已7c5b9a9，凭证缺失诚实显示未配置；四个平台申请入口已打开，WHOOP/Oura/Apple待用户登录，Google实际被2SV阻塞 |
| HEALTH-QA | 独立qa技术助手已冻结：tests/health-integrations.test.ts、docs/reviews/health-integrations-20261023.md | done | 独立23/23、skip0；首轮Google来源失败修复，scope/旋转/事务/断开删除竞态/Apple旧preview/数据语义通过；不把HTTP夹具当跨站或真设备验证 |

真实接入与申请仍待用户：正式HTTPS网站/隐私政策、各开发者账户登录/条款及应用凭证、Google账号两步验证、Apple开发团队与iPhone真机。未创建付费资源、未提交平台申请或自动开启Google账号安全设置。原C盘数据与OpenAI配置保持，真实可穿戴数据未访问。iOS完整回归的Workbench旧测试失败保留证据并另行分析，不把新增HealthKit测试通过当全套通过。

IOS-WK-REGRESSION（lead，todo）：保留旧WK草稿跨view恢复严格断言，用可见非零尺寸合成窗口与公开WebKit状态诊断传播时序。现有只读比较确认WorkbenchSession/其测试/NativeAPI本轮未改，不能据此声称已证明根因；没有在健康切片中跳过或削弱旧测试，也未大改持久化产品实现。

# 2026-10-22 Fud AI 真实模型示例验证

FUD-LIVE-01（lead，done）：用户明确授权创建独立本机测试账户，使用公开CC0鸡肉米饭照片，经实际3001网页上传、逐图授权与OpenAI真实模型识别成功。返回4项可编辑候选、合计760kcal；审核框未勾选、饮食记录未保存。图片来源commons.wikimedia.org/wiki/File:Chicken_Rice_SMJ.jpg；截图为本机忽略的photo-entry-20261022/real-recognition-summary.png。验证了真实响应与审核展示，不代表重量/营养准确率已验证。

# 2026-10-22 Fud AI 密钥配置回执

| ID | owner | 状态 | 验收 |
|---|---|---|---|
| FUD-KEY-01 | lead：本机忽略的服务端环境配置与服务重启、本人状态/交接 | done | 用户本轮明确授权配置；未提交密钥。当前3001返回foodPhoto.available=true、reason=ready、engine=fud-ai/provider=openai；OpenAI固定模型元数据GET返回HTTP200。未上传照片或请求模型生成，真实照片效果待用户实测。 |

下方“稍后配置/未配置”是配置前历史记录，已由本回执替代。密钥仅保留本机，不随GitHub同步。

# 2026-10-22 Fud AI 拍照接入（当前）

用户在本聊天批准最新版 Prompt 开始实施，先完成 Fud AI 拍照识别、可编辑食物/份量与确认保存。保留 Apple/Google/WHOOP/Oura 与优先华为/小米/Keep 的后续分步计划，本切片不接真实健康账号。用户已选择稍后配置 OpenAI 密钥；当前真实模型测试不可执行，不作为代码/夹具验证已完成的证明。

唯一 lead 沿用当前会话；实施 checkout C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站，分支 codex/fud-food-photo-20261022，基于正在运行的 199221b。bdd7 当前干净、相关前端会话 idle；本切片不写 bdd7 或原主目录的既有未提交文件。子代理仅为本任务助手，不启动第二名 lead 或另一个员工聊天。

| ID | owner / 本轮独占路径 | 状态 | 验收 |
|---|---|---|---|
| FUD-01 | lead：src/types.ts、src/api.ts（如需要）、docs/architecture/reuse-log.md 与计划/契约文档、public/licenses/fud-ai-MIT.txt、scripts/source-policy.mjs、TASKS、本人 status/HANDOFF、README、.env.example、本机发布集成 | done | 固定MIT来源/适配映射，沿用安全模型调用与限额，整体验证并更新本机网站；无密钥则真实状态可见 |
| FUD-02 | 后端技术助手：server/food-photo.ts、server/fud-ai-food-photo.ts、server/fud-ai-food-photo.test.ts、server/food-photo.test.ts，以及server/{api,approval-failure-recovery,confirmation-boundaries,review-recovery}.test.ts的旧模型夹具迁移 | done | 实际移植Fud识别提示/结构解析及按份量归一化；未知不造0，原有照片/账户/限流/预算安全边界保持 |
| FUD-03 | 前端技术助手：src/features/Nutrition.tsx、src/features/foodPhotoReview.ts、src/styles.css 中本任务专用样式（如需要） | done | 真实引擎标识、食物名称/克重/份数可编辑重算，明确基准与审核后保存，取消/重试不提前保存 |
| FUD-04 | 独立验证助手：tests/food-photo-independent.test.ts、tests/fud-food-photo.test.ts、本任务验证产物 | done | 更新原模型夹具并独立验证新Fud形状、边界、账户隔离和保存；不修改产品实现 |


## Fud 切片交付与健康平台后续

FUD-01..04代码/审核保存闭环完成，运行代码28a993639ac22a1b6a5698da6c918f9ceb2c2a0d；完整345/345测试与构建通过，CUA合成输入审核/保存/取消通过，实际3001已验证analysisEngine=fud-ai、provider=openai、reason=not_configured。用户选择稍后配置密钥，真实照片模型验证待配置后执行，不将夹具当成真实识别。

| 后续ID | owner | 状态 | 依赖与验收 |
|---|---|---|---|
| HEALTH-BASE | lead | todo | 统一连接/来源/同步游标/去重与用途契约，依用户已批准Prompt分步实施 |
| HEALTH-CN | lead（后续再登记具体技术路径） | todo | 优先华为/小米官方资格与scopes；Keep依Apple Health桥接，按地区/设备/版本验证，不伪造未开放通道 |
| HEALTH-MOBILE | lead（后续再登记具体技术路径） | todo | 现有iPhone工程HealthKit只读授权/显式上传同意、Mac签名真机与安全可达API；Android Health Connect单独核对工程条件 |
| HEALTH-CLOUD | lead（后续再登记具体技术路径） | todo | Google Health、WHOOP、Oura凭证/审核后逐项联调，原始来源与跨平台重复数据可追踪 |
本表只对上述切片覆盖历史冻结与只读表；主项目仍在C盘。本轮用户授权覆盖此前仅写方案的阶段限制，不代表批准付费服务、上传真实照片或修改已有健康事实。
# 2026-10-22 动作库悬停预览

用户在现有01主管会话明确要求：动作库鼠标放上去直接播放视频。沿用本聊天唯一lead，在现有干净bdd7发布checkout增量实现；历史MUS/WB写入者已完成并交回lead。本任务不启动其他员工、不改健康数据或API。

| ID | owner / 独占路径 | 状态 | 验收 |
|---|---|---|---|
| HOVER-01 | lead：src/features/training/Library.tsx、src/styles.css、TASKS及本人status/HANDOFF | done | 本轮完整npm run build exit0；实际3001进入卡片readyState4/paused=false/muted/loop，换卡只一个预览，移开0视频/12缩略图；详情保留controls且默认暂停；390px无横溢出、console error/warn0。减少动态保护静态核对，未真机或模拟系统偏好；截图.forma-local/deliverables/hover-preview-20261022。只更新本机发布包前端静态文件，未重启服务或改健康数据；其他会话3D伙伴新增文件/依赖不在本提交 |

# 2026-10-22 发布整合

本轮将已完成产品和完整5,632动画动作更新GitHub默认main与当前网站。以1557a7e产品合并91509d4的Mac/团队配置，保留主worktree未提交文件。验证与发布完成前不记完成。此前AGENTS.md已被用户撤销，下方为历史记录。

# 2026-10-20 原创 3D 风格伙伴（当前任务）

用户要求更多可爱形象，偏好3D风格、生图，并授权真实Claude Code合作。本轮增量扩展伙伴页；采用原创透明背景3D渲染图片，不冒称实时3D模型。保留已有芽芽，新增糯糯兔、桃桃獭、云朵、蜜蜜熊、月月海豹，共6个可选伙伴。所有角色免费可选，切换不重置XP、装扮或奖励。来源/真实健康数据不输入AI，不读取data/.env。以下表优先于历史所有权。

| ID | owner / 本轮独占写入 | 状态 | 依赖、验收 |
|---|---|---|---|
| CHAR-01 | lead：src/companion.ts、src/api.ts、public/companions/、scripts/prepare-companion-art.mjs、scripts/build-offline-shell.mjs、tests/companion-cache.test.ts、docs/architecture/、任务板与lead状态 | done | 6原创生图/真实Claude三轮exit0；最终build与297/297、合成CUA/3001通过；02e1291已推送且ls-remote一致，实际站点/图片HTTP200 |
| CHAR-02 | inspect_library（backend）：server/companion.ts、server/companion-router.ts、server/store.ts、server/companion.test.ts、status/companion-backend.md | done | 64c68bb；旧库默认sprout、严格会话/导出删除/保留奖励；专项13/13 |
| CHAR-03 | muscle_ui（UI）：src/features/Companion.tsx、src/components/CompanionAvatar.tsx、src/companion.css、status/companion-ui.md | done | 02a51ba+3587352；6角色/演示/衣柜/双语/手机、缺图重试、中性加载；最终完整构建通过 |
| CHAR-04 | qa：tests/companion.test.ts、tests/browser/companion.mts、tests/companion-art.test.ts、docs/reviews/companion-characters-20261020.md、status/companion-qa.md | done | f2d7bb6；HTTP/12透明WebP实际decode22/22、总229968bytes；root串行完整296/296 |

共享契约：COMPANION_CHARACTERS = ['sprout','bunny','otter','cloud','bear','seal']；CompanionCharacter为该联合；CompanionSnapshot.character为必填，旧档默认sprout。PUT /api/companion/character严格接收{character}并返回完整snapshot。src/api.ts新增selectCompanionCharacter(character,accountId,signal?)。资产路径/文案统一由src/companion.ts的COMPANION_CHARACTER_DETAILS提供，full /companions/<id>.webp，thumb /companions/<id>-thumb.webp；均正方形透明背景。预览只写UI局部状态，切账号/离开后复位；真实选择由服务端保存，所有既有并发保护继续适用。lead独占资产；UI不画替代3D角色，装饰沿用原SVG配件并合理定位。

# 2026-10-19 伙伴养成与部署（已完成/正式托管待定）

用户要求实现 reel DeoTnV0B6Il 的功能并上线，授权真实 Claude Code 合作。方案见 docs/architecture/companion-plan-20261019.md，契约 src/companion.ts。当前表覆盖下方历史冻结；不读取真实 data/.env、不修改来源、不停止其他人的服务；lead可受控重启本聊天拥有的3001，并统一安排浏览器/测试/推送。

| ID | owner / 本轮独占写入 | 状态 | 依赖、验收 |
|---|---|---|---|
| PET-01 | lead：src/companion.ts、src/api.ts、src/types.ts、src/App.tsx、配置/scripts/部署入口、tests/source-policy.test.ts、CLAUDE.md、docs/architecture、任务板/lead状态 | done | 方案/契约/路由集成、构建、真实Claude评审、GitHub提交和部署产物准备 |
| PET-02 | inspect_library（backend）：server/（含新增规则文件，除server/index.ts）、.env.example、status/companion-backend.md | done | 会话隔离服务器奖励账本、原子结算、防重/装备/宝箱/双人挑战/导出删除；针对测试交QA，全套lead运行 |
| PET-03 | muscle_ui（features+shell）：src/features/Companion.tsx、src/features/Dashboard.tsx、src/components/CompanionAvatar.tsx、src/companion.css、status/companion-ui.md | done | 原创SVG、双语今日卡/成长页/换装宝箱私密挑战、演示/空错误/减少动态/手机；不写App或shared contracts |
| PET-04 | qa：tests/companion.test.ts、tests/browser/companion.mts、tests/companion-container.mjs、status/companion-qa.md、docs/reviews/companion-20261019.md | done | 独立合成HTTP回归/浏览器验收；不修改产品、不启停用户服务；专项运行前和lead协调 |
| PET-05 | lead：正式部署与HTTPS验收 | blocked | 等用户提供已有服务器/托管项目或供应商/预算选择；当前仅本机与已验证私有镜像，不冒称公网链接 |

API契约以方案为准，新增契约由lead维护。各角色只提交自己路径，按需提交请求文件；本轮不复制视频角色/外观、不付费部署或AI、不声称已连接设备或安装原生。健康记录保持原逻辑；XP是游戏进度，好友仅邀请码双人参与天数。正式供应商/预算待用户回复，不擅自付费。
# 2026-10-18 独立 iPhone App（当前任务）

用户明确要求独立iPhone App；采用iOS 17+ SwiftUI原生五页与现有Forma会话/API，先进训练工作台通过同源WKWebView复用。不是把网站作为整个App根界面。无HealthKit/Apple登录/支付扩围；缺失与演示规则不变。Windows无xcrun，Mac尚未连接，先用公开仓库Mac CI无签名构建与合成测试，不声称已安装真机。保留现有Web服务。

| ID | owner / 本轮独占写入 | 状态 | 验收 |
|---|---|---|---|
| IOS-01 | lead：ios/Forma（不含Features）、ios/Forma.xcodeproj、ios/Config、scripts/ios*、.github、根文档 | done | 原生工程实际Mac编译/iphoneos Release archive通过，账号/Keychain/退出标记/清理及同源工作台；个人真机与发布未完成 |
| IOS-02 | inspect_library → lead：ios/Packages/FormaCore与status/ios-core.md | done | Core21/21，确定性记录/营养/睡眠/完整度；不把未记录填0 |
| IOS-03 | muscle_ui → lead：ios/Forma/Features与status/ios-features.md | done | 原生五页及手动表单，真实数值/缺失/双语/演示禁存经4项UI验证；核心HTTP契约另4/4 |
| IOS-04 | qa → lead：ios/FormaUITests、tests/ios-contract.test.ts与status/ios-qa.md | done | 最终Node4/4，Mac UI4/4无skip；真实截图/xcresult留存，历史失败保留 |
| IOS-05 | inspect_library → lead：ios/Forma/Infrastructure/WorkbenchSession.swift、ios/FormaNativeTests/WorkbenchSessionTests.swift及status/ios-storage.md | done | 命名持久profile/保留页面，真实HTTP WebKit4/4恢复/隔离/清理/lock；旧about:blank及in-use缺陷已修 |

核心接口在本轮消息和ADR-ios-native-20261018.md确定；所有agent不改其他路径、不读data/.env、不自启/停止5173、不自行安装/推送/合并。只有lead整合并上传，commit前逐条确认测试结果。ios开发的完成状态与Web已有完成记录分开。

最终验证为Mac CI 39193436826（a5b65f3）：Core21、Native10、UI4全过，无skip；无签名设备archive成功。最终原生源码冻结；未接用户Mac、未安装用户iPhone、未签名IPA或TestFlight，Xcode安装/团队/HTTPS服务为后续实机交接项。网站5173/8080与原main保留。

# 2026-10-18 训练统计直接整合（已完成）

用户要求“他这个统计的内容放进去”，按前文openGym统计整页执行。vendor统计已有活动热图、肌群/周训练量、体重、动作进步、主观强度和历史/体测入口；本轮增加Forma训练“统计”与趋势页直达入口，复用同源工作台#/stats，不重写图表或还原推测的疲劳/保留力量分数。Forma原有/投影事实单独汇总并明确范围，不能将未反向进入工作台的手动记录冒称已合并进工作台详细图表。来源继续只读。

| ID | owner / 独占写入 | 状态 | 依赖与验收 |
|---|---|---|---|
| STAT-01 | lead：Training.tsx、Workbench.tsx、Trends.tsx、App.tsx及文档 | done | 完整build通过；训练统计/趋势快捷直接#/stats；旧home入口/会话账号/语言/未保存导航结构保留 |
| STAT-02 | muscle_ui → lead：Statistics.tsx与自己状态 | done | 四项只读汇总、范围/覆盖/演示/真实空状态；已知0保留，微量正容量kg/lb显示<0.001，lead已补格式边界 |
| STAT-03 | qa → lead：tests/browser/training-statistics.mts及自己状态 | done | 最终browser-4真实6/6及微量边界通过；四类非预期错误0，tsc与差异检查通过；5173已释放 |

lead统一构建、浏览器时段、提交与GitHub推送。此最新表覆盖下方已完成任务的路径冻结；不新增依赖、后端/schema或外部服务，不读取个人健康数据。

统计角色已冻结并交回lead作最终提交/启动。最终合成证据为本聊天visualizations/statistics-20261018/browser-4；不将早期harness定位失败或微量截图视口未对准冒称数字的视觉证明。Safari/iPhone真机、所有图表计算组合不在本轮浏览器结论内。

# 2026-10-18 动画动作库与探索肌肉（已完成）

最新用户进一步要求将 openGym 所有训练功能放入 Forma，并明确允许本机真实 Claude Code 合作。采用授权前端自托管子应用 `/training-workbench/`，复用 Forma 会话并独立保存完整训练工作台状态；不是链接或反代 localhost:8080。原生训练保留，已完成且兼容的数据确定性投影供 Forma 汇总，不能为未知值造0/时长。原生移动能力、客户端供应商密钥/聊天教练、账户替换不作为网站已实现能力；既有 Forma 安全/事实规则继续适用。

WB所有权追加：实际 Claude Code 已结束两轮前端工作（真实CLI exit0），`vendor/opengym/` 与 `scripts/build-training-workbench.mjs` 交回lead，只作集成缺陷修复；Claude自己的状态保留其交付记录。backend（当前muscle_ui agent）独占server（不含投影两文件）；projection（当前qa agent）独占server/training-workbench-projection.ts及对应test；QA另独占tests/browser/training-workbench.mts。lead独占根build配置、Training入口、Workbench框架及文档。来源只读，不读真实data/.env，不提交密钥或本机数据库。root负责依赖安装及构建串行时段。

| ID | owner | 状态 | 文件 / 依赖 | 验收 |
|---|---|---|---|---|
| WB-01 | 实际 Claude Code → lead | done | vendor/opengym、build-training-workbench.mjs | 两轮真实CLI exit0；84文件构建成功，适配层最终25/25、媒体32/32；会话与存储隔离、禁独立SW/未配置能力 |
| WB-02 | backend → lead | done | server独占范围 | 专项16/16；root最终255/255；cookie/header/Origin、CAS/幂等、媒体隔离、导出删除、投影原子保存通过 |
| WB-03 | projection → lead | done | server/training-workbench-projection.ts/test | 专项11/11；真实浏览器30kg×6投影通过；缺失null/小数时长、warnings及原文保留 |
| WB-04 | lead | done | Training入口/构建集成/合成端到端 | 真实Claude回执、最终工作台9/9无非预期错误；计划/训练/围度/体重/照片/备份/账号及断网会话门禁、390px通过 |

上述角色已完成并冻结写入，交回lead执行最终精确集成提交；不将原始日志中的harness定位/初始化失败掩盖为产品已通过。最终有效证据为workbench-20261018/browser-12及native-library-final，Safari实机、完整进阶组合、ZIP导入/相机不在浏览器结论内。

用户要求移除动作来源筛选及旧图片/示意动作，并采用本地 openGym 动作库的探索肌肉功能，随后明确“我已经得到了opengym的所有授权”。当前聊天 lead 负责整合，继续使用已授权的 5,632 个动画动作；旧目录 ID 只保留给既有训练记录，不展示在选动作界面。允许为本次功能复用授权的必要代码/图形，保留来源归属；不修改来源目录。

本轮所有权：lead 独占 Library.tsx、src/styles.css、文档及服务启动；muscle_ui 仅写 src/components/MuscleExplorer.tsx、MuscleExplorer.css、src/catalog/muscle-explorer.ts、src/catalog/body-paths.ts 和自己的状态；qa 仅写 tests/browser/opengym-catalog.mts、tests/muscle-explorer.test.ts 和自己的状态；inspect_library 只读来源。各写入路径互不重叠，不改后端或数据库。

| ID | owner | 状态 | 文件 / 依赖 | 验收 |
|---|---|---|---|---|
| MUS-01 | lead | done | features/training/Library.tsx、styles.css | 来源/旧示意/文字动作选项移除，默认仅5632动画；既有历史ID保留 |
| MUS-02 | muscle_ui → lead | done | components/MuscleExplorer.tsx/.css、catalog/muscle-explorer.ts | 正背面18区人体图、主次肌群/权重去零、键盘/双语/手机适配；MIT归属保留 |
| MUS-03 | qa / lead | done | 指定tests、外部截图、最终集成 | 完整build与255测试通过；原生目录8/8，人体筛选/重置/分页/加入计划/手机/旧记录兼容通过 |

# 2026-10-18 openGym 授权动作库导入（历史）

用户直接要求把 openGym 的 5,632 个动画动作加入 Forma，并在本聊天明确回复“是的”，确认授权覆盖 Gym visual 动画/图片及在 Forma 中复制、展示和随网站分发。本轮只依该明确范围导入动作文本及素材；不复制 openGym 应用代码、UI 或数据模型，不写 reference-sources，不赋予其他人任何新素材许可。该最新用户指令覆盖本项目此前对这些动作文本/素材的禁止采用规则，仅限本次指定导入。

| ID | owner | 状态 | 文件 / 依赖 | 验收 |
|---|---|---|---|---|
| CAT-01 | 当前聊天集成者（唯一写入者） | done | scripts/import-opengym-catalog.mjs、src/catalog/、public/exercise-content/、本区public/exercise-media/opengym/及许可证 | 精确5632主动作/MP4/WebP，922变体不重复计；11328媒体/步骤文件SHA通过，原884身份不变 |
| CAT-02 | 当前聊天集成者（唯一写入者） | done | src/types.ts、components/Exercise*、features/training/、styles.css、build脚本与文档 | 来源/类别/肌群/器械/双语搜索、按需内容、默认暂停视频和错误重试；保存计划及进行中教学通过；新预览5173，保留3001旧服务 |
| CAT-03 | 当前聊天集成者（唯一写入者） | done | tests/opengym-catalog.test.ts、tests/browser/opengym-catalog.mts、外部合成证据 | build、220/220、6项浏览器场景通过；实际样本解码/Range/播放/暂停、手机减少动态、保存并启动训练、失败恢复与旧8+876通过；只用合成数据 |

视频和缩略图在本工作区按授权本地暂存，单独被Git忽略；文本索引、步骤和SHA清单可复现。公开GitHub推送/公网部署不包含在本次已执行动作内。构建前检查素材完整性，缺包时须从用户有授权的本地来源重新导入；不下载或热链第三方媒体。

# 2026-10-17 当前整合与本地启动任务（历史）

用户在 Forma 前端聊天直接授权“把最新的前后端代码整合好，修复构建问题，然后启动并打开网站”。本节优先于下方已结束阶段的禁止整合/安装/启动文字；本轮由本聊天在自己的 bdd7 worktree 单独完成集成与必要修复，不创建子代理、不写其他 worktree、不改原 main、不部署公网或调用付费 AI。

| ID | owner | 状态 | 路径与依赖 | 验收 |
|---|---|---|---|---|
| INT-01 | 当前聊天集成者 | done | codex/forma-integrated-20261017；四个已上传的前端/后端/审查/文档分支 | 保留原提交历史与协作记录；不改源工作区的四项删除和未跟踪 AGENTS |
| INT-02 | 当前聊天集成者 | done | 本 worktree 依赖、server/app.ts、server/*.test.ts、tests/browser/、文档 | 锁文件安装；修复 UUID 测试类型、隐藏 worktree 首页发送和浏览器脚本的本机路径依赖；完整 build、215/215、浏览器 8/8+18/18 通过 |
| INT-03 | 当前聊天集成者 | done | 本 worktree dist/data、127.0.0.1:3001、可见浏览器 | 已检查空闲端口并 npm start；内置浏览器实际打开，首页/训练/中英切换通过；Edge 1440/390 无横向溢出和 console/pageerror；仅新建本工作区空数据库 |

当前动作库 JSON 和演示素材在本工作区原本就是已跟踪文件，没有从其他目录复制或恢复；其他修复工作区的用户删除状态保持原样。下文是各独立分支的历史任务和当时限制，不再代表本整合分支当前状态。

# 2026-10-17 Claude Code 历史任务

本轮进度：CB-17真实Claude交付c32d8fc，持久清理重试及精确意图边界已修，聚焦12/12、完整214/214；历史hash-only/PUT/跨资源原子性限制明示。

Owner：真实Claude会话 a02c2fec-4908-4d91-972a-06c1f05c67c8（CLI已确认，预检exit0）；CB-17，claude/forma-attachment-retry-20261017，见 [CB-17任务书](tasks-20261017-claude-backend.md)。协调者准备MD，先preflight，后按同一session授权时段执行；不把先前Codex工作称Claude完成。

本轮进度：CF-17真实Claude交付d794e38，新增5案，最终18/18，产品页面无改动；可选旧版敏感性未执行。

Owner：真实Claude会话 bb523eca-ef12-424d-8f35-0b01a1d4d551（CLI已确认，预检exit0）；CF-17，claude/forma-frontend-recheck-20261017，见 [CF-17任务书](tasks-20261017-claude-frontend.md)。协调者准备MD，先preflight，后按同一session授权时段执行；不把先前Codex工作称Claude完成。

本轮进度：CQ-17真实Claude已完成独立审查；聚焦12/12、3个新增浏览器代表例3/3，F/B完整tsc均exit2/38条，报告明确删除意图/依赖缺件与运行边界。

Owner：真实Claude会话 bf755c6b-5bb9-413a-a6f4-63f764629745（CLI已确认，预检exit0）；CQ-17，claude/forma-boundary-review-20261017，见 [CQ-17任务书](tasks-20261017-claude-review.md)。协调者准备MD，先preflight，后按同一session授权时段执行；不把先前Codex工作称Claude完成。

# 2026-10-17 真实Claude Code三方向（当前）

用户已明确要求真实Claude执行，任务见 [Claude任务总览](tasks-20261017-claude.md)。CF-17/CB-17/CQ-17各有真实命名session、隔离Git分支和工作区，均已完成preflight实际读技能；CF-17已交付d794e38（18/18），CB-17已交付c32d8fc（聚焦12/12、完整214/214），CQ-17已完成独立审查（12/12、代表例3/3、F/B各38条类型诊断）。旧F/B/Q状态保留历史，不当作本轮Claude交付。仅协调者维护入口/任务书，产品由Claude各自唯一写入。

# Forma 协作任务板

更新：2026-10-17，America/Los_Angeles。当前人类授权先做网站并添加AI识图，密钥稍后配置；已确认 US$20/月和已有Mac/iPhone。付费开通、生产发布和iPhone/TestFlight未据此自动获准。早期predevelopment的C08/G01是旧阶段快照，不能覆盖后续人类指令。运行事实以根README、实际API和用户最新指令为准。

## 2026-10-17 三方向实际任务（当前授权，覆盖上一文档轮范围）

用户已要求实际派发前端/后端/测试审查并推进。完整目标、独占路径、验收命令和每项必须先读的本地 skills 路径见 [三方向任务书](tasks-20261017-three-directions.md)。入口 CLAUDE/AGENTS 指向同一任务书；旧“只读文档”限制是上一轮快照，不阻止本轮已授权范围。

| ID | 唯一方向 / owner | 真实本地分支 / worktree | 状态与范围 |
|---|---|---|---|
| F-17 | frontend / `/root/frontend_task` | `codex/forma-sleep-report-lifecycle-20261017` / `forma-record-flows` | done：2786a33；两真红→13/13组件DOM+HTTP，QA代表例3/3；实际读playwright/tdd/security-review/frontend-design。完整App/build未验 |
| B-17 | backend / `/root/backend_task` | `codex/forma-approval-failure-recovery-20261017` / `forma-review-recovery` | partial：b27c3cc；跨Store误删已修，局部5/5、QA全量207/207；实际读backend-patterns/security-review/tdd。持久清理重试有真实未修失败，需持久策略决定 |
| Q-17 | qa / `/root/review_task` | `codex/forma-three-direction-review-20261017` / `forma-health` | done：579d905；独立207/207、代表例3/3、确认未修200≠404；完整tsc失败38条。实际读playwright/security-review/tdd，报告/补丁已交付 |

root / lead 只维护任务书/入口/任务板/lead状态及协调，不同时写方向独占产品文件。三个旧角色会话先前为 detached HEAD，不能冒称已是任务分支；以实际创建与回执记录为准。已有四项删除在三个本地修复 worktree 也存在，会跨切分支保留，禁止恢复或纳入提交。不安装、不push/合并/部署，不动真实数据。

派发记录：三条本地协作任务的工具回执与开工确认均已收到；三分支实际建立在 `33f1256`，旧修复分支指针保留。优先核对的三个长期角色会话仍在各自 detached 工作区，但会话服务报告 local/durable 主机不可用，未向它们下发本轮写入 GO，避免双写。上一轮不确定的公开来源补充没有重发。本轮实际执行者是上表三个本地 agent，不把原会话当作已经接单。四个工作区的 AGENTS 都只增补当前任务/skill读取段，保留原文且仍未跟踪；CLAUDE 与任务书随 `33f1256` 在三个执行区可读。

最终证据根目录 `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-evidence-20261017`，frontend/backend/qa 各有补丁、日志和metadata。三个任务分支未整合，所有自有fixture已关闭。需后续决定：持久记录精确清理意图与重试策略（当前hash-only receipt不能恢复此前asset列表），不能扫描所有未引用资产；文件所有者需另定动作库/依赖缺件处理，未在本轮恢复或迁移真实数据。

## 2026-10-17 文档与技能接续（本轮有效范围）

本轮仅更新 MD、核对既有源码/本地证据/技能来源，并向已有会话交接。分支 `codex/forma-docs-skills-20261017` 基于 `367ae3e`；沿用第三轮 worktree，不合并到原 main。root / lead 是下列 MD 的唯一写入者；证据与技能核验 agent 只读。禁止据此开始产品开发、运行测试/构建、安装技能/依赖、启动服务、push/PR/合并/部署，或启用真实健康接入、付费 AI、Apple 登录、HealthKit。

| ID | owner | 状态 | 本轮可写范围 / 交付 |
|---|---|---|---|
| D-01 | root / lead | done | README.md、CLAUDE.md、docs/PROJECT-STATUS.md、docs/SKILLS-HANDOFF.md、docs/VALIDATION.md、本任务板、status/lead.md；已补三轮真实进度、验证边界、公开候选与下一步 |
| D-02 | 证据审计 agent | done | 只读核对源码与 D 盘日志、结果 JSON、历史说明；191/198/202 项测试与 8/12/13 项浏览器结果匹配各轮提交 |
| D-03 | 技能盘点 agent | done | 只读核对 Codex / Claude 技能路径、摘要、来源与许可；不复制私人笔记、凭证或整套技能目录 |
| D-04 | root / lead | partial | 三个现有 Codex 会话消息均确认发送，前端/审查已回执、后端最终回执待确认；公开来源补充发送结果不确定，未重发。Claude 无可寻址既有会话，未交付；详见 SKILLS-HANDOFF |

开始时已有 `docs/design/dashboard-concept.png`、`docs/design/mobile-meal-concept.png`、`public/demo-meal.png`、`src/catalog/exercises.json` 四项删除，以及未跟踪 `AGENTS.md`，均按用户改动保留，不恢复、不暂存。`src/catalog/exercises.ts` 仍引用被删除的 JSON，历史测试/构建结果不能证明当前脏工作区可构建。当前事实与下一步见 [PROJECT-STATUS](../PROJECT-STATUS.md)，技能路径与交接状态见 [SKILLS-HANDOFF](../SKILLS-HANDOFF.md)。

## 2026-10-17 第三轮：删除/放弃确认边界（三方向，仅本 worktree）

分支 `codex/forma-confirmation-boundaries-20261017` 基于受保护的 `1ec7b3a1ef463ffb91602e5f7b4b859b91607532`，同时保留 `874b13c`；不自动合并并行 main。仅本地合成数据/mock AI，无 push/PR/合并/部署、真实账户/健康数据/邮件、付费服务或权限修改。最多修复三项可复现高价值缺陷，完成该范围即停止。测试由 root 单独串行运行，TEMP/TMP 在 `D:\CodexTaskData\forma-confirmation-boundaries-20261017`，Edge 禁用 GPU，不干扰视频/Showroom。

| ID | 方向 / owner | 状态 | 唯一可写范围 | 验收 |
|---|---|---|---|---|
| C-01 | 前端 / root，独立只读复审 | done | src/features/training/、docs/collaboration/ | 实证并最小修复 Session 放弃、Progress 历史删除、QuickSummary 删除的旧确认误删；绑定记录快照，Keep/重开与普通dirty草稿保持可用 |
| C-02 | 后端 / backend-confirmation agent | done | server/confirmation-boundaries.test.ts，其余 server/ 只读 | 新增4项HTTP回归均通过：删除/放弃CAS、畸形delete整批回滚、旧receipt重放、跨集合附件引用；未发现须改的后端产品缺陷 |
| C-03 | 端到端 / e2e-confirmation agent 编写，root 执行 | done | 本轮 D 盘 browser-confirmations.mts、交付证据，产品只读 | 修复前三案服务端记录被误删，修复后13/13；mock AI审核/删除/放弃/恢复、390px三类控件真实点击，单浏览器禁GPU |

本轮共修三项，到此停止扩展。全量串行 202/202、build、diff检查通过，shell `2a24c4362fea75f4`；D盘 `QA.md` / `final-confirmed/results.json` / 日志 / PNG / 可复跑脚本为交付证据。没有新增依赖、API/数据库/权限变更，也没有新增删除后撤销功能；后端测试的 tombstone 后显式写入只验证协议。仅系统 Edge 与移动视口模拟，不代表真机 Safari/iPhone。JSON 仍不含附件本体，需另存原文件。

## 2026-10-17 第二轮：审核、逐组训练与恢复（仅本 worktree）

分支 `codex/forma-review-recovery-20261017` 从上一轮 `874b13cac7db203d7c36db0191e9c2490fe1f55a` 建立。原目录和上一轮 worktree 保持不动。本轮仅本地、合成数据、mock AI；无付费调用、真实健康数据、生产写入、push/PR/合并/部署。以下分工优先于历史分工；root 为唯一产品写入者，其他 agent 只读审查。测试并发 1，临时文件 `D:\CodexTaskData\forma-review-recovery-20261017`，不使用视频 GPU。

| ID | owner | 状态 | 可写范围 | 验收 |
|---|---|---|---|---|
| R-01 | root / lead | done | src/features/、tests/、docs/collaboration/ | 三组实证缺陷最小修复：AI 批次生命周期、历史校正自身重试、训练审核版本失效；串行测试 198/198、build、Edge 浏览器 12/12 |
| R-02 | AI 审核只读 agent | done | 无写权限；Nutrition、审核/附件与相关服务和测试只读 | 确认 AI 多项不确定保存覆盖/复活及候选集合不一致；复审修复，无新增阻塞，不启动测试/服务 |
| R-03 | 训练只读 agent | done | 无写权限；逐组训练及领域与同步代码只读 | 确认历史校正重试、审核未失效；复审修复，不启动测试/服务 |
| R-04 | backend-contract agent | done | server/review-recovery.test.ts（新增专项测试），其余 server/ 只读 | 4 项真实 HTTP 契约回归通过：AI 来源/批次原子性、共享照片/receipt 重放、结束训练异常恢复与 409；未发现须改的后端产品缺陷 |

用户新增前后端均需任务：R-01 是前端实际交互与最小修复，R-04 是后端实际接口契约检查与回归；没有缺陷的一侧不强行改产品。联调共同使用本轮合成数据库、mock AI 及真实本地接口。

最终证据在上述 D 盘目录：`QA.md`、`final-confirmed/results.json`/PNG、`browser-recovery.mts`、`final-tests.log`、`final-build.log`、`final-browser.log`。浏览器仅系统 Edge，1440×1000 / 390×844；WebKit 未安装，不能视为真机 Safari/iPhone。未验证生产服务、真实 AI、旧删除/放弃确认的并发边界；未扩展删除后撤销功能。JSON 仍不含附件本体。

## 2026-10-17 普通记录核心链路（仅本 worktree）

当前分支 `codex/forma-record-flows-20261017` 从 PR #1 的 500e66b 建立；PR #1 仍 OPEN/DRAFT，main 为 eb6b559。本轮只本地，不 push/PR/合并/部署，不改真实数据、权限、依赖或外部服务。所有原目录与未提交文件保留。以下表优先于历史分工；测试串行，临时数据放 `D:\CodexTaskData\forma-record-flows-20261017`，不使用 GPU。

| ID | owner | 状态 | 可写范围 | 验收 |
|---|---|---|---|---|
| F-01 | root / lead（唯一写入者） | done | src/features/、tests/、docs/collaboration/ | 修复旧饮食编辑/删除覆盖、活动不确定保存重试、打开草稿单位重解释；串行测试 191/191、build、禁用 GPU 的真实浏览器 8/8 |
| F-02 | 只读审计 agent | done | 无产品写权限；只读 F-01 范围 | 独立确认三类问题并复审最小修复；未发现新阻塞，未运行测试/服务或重构 |

复现、命令、D 盘日志与验证边界见 `decisions/ADR-record-flows-20261017.md`。没有 API/权限/依赖变更；AI 多项审核保存和逐组训练专项浏览器回归不在本轮已验证范围。


## 2026-10-16 隔离本地安全修复（本 worktree 当前所有权）

用户要求在独立本地分支核对 eb6b559 的云端问题并补真实浏览器验证。仅使用合成数据；禁止 push、远程分支、PR、部署、真实健康接入及付费 AI。原主目录所有未跟踪文件保持不动。以下分工仅适用于 `codex/forma-local-safety-20261016`，优先于历史所有权表。

| ID | owner | 状态 | 路径 / 依赖 | 验收 |
|---|---|---|---|---|
| L-01 | root / lead | done | src/App.tsx、src/api.ts、src/types.ts、src/components/SyncPanel.tsx、src/sync/、tests/sync-client.test.ts、tests/account-lifecycle.test.ts、根配置、scripts/、README、docs/collaboration/、集成和独立测试服务 | npm test 186/186、build、独立 Edge 15/15；所有实现由 lead 本地集成提交，禁止上传 |
| L-02 | backend agent | done | server/（不含 rules/）及其现有 *.test.ts、status/backend.md | 路由绑定账号头，含大小写/尾斜杠真实 HTTP 回归 |
| L-03 | features agent | done | src/features/、tests/editor-lifecycle.test.ts、status/features.md | 编辑器账号绑定、附件保留、睡眠 DST 与稳定重试身份；12 项专项通过 |
| L-04 | domain agent | done | src/training/、tests/training-import.test.ts、tests/training-domain.test.ts、status/qa.md | 早晚训练去重、距离单位冲突、输入精度；28 项专项通过 |
| L-05 | backend agent 兼 rules | done | server/rules/nutrition.ts、server/rules/nutrition.test.ts、status/rules.md | 十进制/0.25 步长/有限值舍入回归；规则 52 项通过 |
| L-06 | browser_qa | done | worktree 外 `../browser-evidence/`，只读产品代码 | 最终构建独立 Edge 15/15，1440/390截图；仅注入预期断网/401错误，pageerror 0；fixture已关闭 |

临时截图、浏览器脚本及隔离数据库置于 worktree 外的本任务目录。未改动生产数据、未读取原 data/ 内容。

更新：2026-10-15，America/Los_Angeles。当前人类授权先做网站并添加AI识图，密钥稍后配置；已确认 US$20/月和已有Mac/iPhone。付费开通、生产发布和iPhone/TestFlight未据此自动获准。早期predevelopment的C08/G01是旧阶段快照，不能覆盖后续人类指令。运行事实以根README、实际API和用户最新指令为准。

## 本里程碑所有权（优先于 AGENTS 默认角色表）

| 参与者 | 当前可写范围 | 状态 |
|---|---|---|
| Codex root / lead（当前集成者） | src/types.ts、src/api.ts、src/sync/（不含storage.ts）、scripts/、根构建配置/依赖、README、docs/PRODUCT-PLAN.md、API-CONTRACT.md、COSTS.md、VALIDATION.md、architecture/、collaboration任务/决定/agent-prompts新增文件/lead状态；独立浏览器验收 | WT-01 done；负责契约与集成 |
| 项目聊天 Forma 前端开发（合并 shell + features） | 自己worktree内 src/App.tsx、src/main.tsx、src/styles.css、src/demo.ts、src/components/、src/i18n/、src/features/、src/catalog/、index.html、public/、status/frontend.md | WT-02 done；接手就绪，等待具体任务 |
| 项目聊天 Forma 后端开发 | 自己worktree内 server/（含现有*.test.ts，不含rules/）、.env.example、src/sync/storage.ts、status/backend.md | WT-03 done；接手就绪，等待具体任务 |
| 项目聊天 Forma 代码审查（qa） | 自己worktree内 tests/、docs/reviews/、status/qa.md | WT-04 done；接手就绪，产品源码只读 |
| lead 暂管领域函数 | src/training/ | 本轮只读；有修改需要先单独派发 |
| 本机独立 Claude Code（rules） | server/rules/、docs/rules/、docs/safety/、status/rules.md及自己的请求/评审 | 已交付独立纯函数与42项测试并提交；lead纳入测试，运行对接留M1 |

外部新建的 docs/predevelopment、handoff、agent-prompts、AGENTS.md、.agents/.claude Skills 等保持其原所有者；root不整体覆盖或删除。接下来重新分工必须先更新本表，不让两个工作会话同时改同一产品文件。

## 任务

## 2026-10-17 项目级聊天与独立 worktree（最新人类选择）

用户随后明确要求放在整个项目里，并选择“项目下三个独立聊天，各用 Git worktree 隔离”。此选择覆盖下方CO阶段的当前聊天子代理模式；原三个子代理已经结束，不再承担后台写入。总控聊天也已归入“运动健康网站”项目。三个新聊天使用本机托管worktree，每个角色仅可写自己checkout，不写原目录或其他worktree；共享契约由lead集成，不自行合并其他修复分支。

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| WT-01 | lead | done | 项目工具、TASKS、decisions、lead状态 | 三个聊天已实际创建于正确项目，独立目录且各自返回就绪；身份/路径见ADR-project-worktrees-20261017 |
| WT-02 | Forma 前端开发 | done | bdd7 worktree；status/frontend.md | cfa66ce；确认路径/detached HEAD/所有权，仅提交接手状态，等待具体任务 |
| WT-03 | Forma 后端开发 | done | 7f7e worktree；status/backend.md | ecb5012；确认路径/detached HEAD/所有权，仅提交接手状态，等待具体任务 |
| WT-04 | Forma 代码审查 | done | 9260 worktree；status/qa.md | 835f53d；确认路径/detached HEAD/只读范围，引用已有基线，等待具体任务 |

CO基线由qa实际运行：npm test155/155、npm run build成功。尚未运行复现的两项静态发现（日期时区口径与语义旧base的400/409差异）已经写请求，不据此自动扩大本轮设置任务。

## 2026-10-17 当前聊天三子代理接手

用户直接选择“当前聊天里的三个子代理”。本轮仅建立协作与接手检查，不自动实施新功能或合并其他隔离目录的修复。上述新分工替代原已结束角色的本目录写入权；独立 Claude rules 保持原范围。其他聊天的 worktree 不受本表重新分工影响，不修改其文件、分支或进程。

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| CO-01 | lead | done | TASKS、decisions、agent-prompts新增文件、status/lead.md | 三个子代理实际启动并返回接手结果；所有权无交叉；汇总实际基线和阻塞；仅提交自己路径 |
| CO-02 | frontend | done | AGENTS、本任务板、设计规格、frontend新prompt；status/frontend.md | 已完成源码接手与时区请求；未改产品源码；基线由qa统一运行 |
| CO-03 | backend | done | AGENTS、本任务板、backend状态及请求、backend新prompt；status/backend.md | 已完成15路由及数据边界盘点、旧base状态码请求；未改产品源码 |
| CO-04 | code_review（qa） | done | AGENTS、本任务板、qa状态及请求、review新prompt；docs/reviews/、status/qa.md | 实际串行npm test155/155与build通过；有限只读审查报告已交付 |

各子代理不再派生代理。跨角色改动依AGENTS §5创建请求。每个角色只提交自己的文档，不能纳入既有未跟踪文件。后续新增实现须由lead在任务板明确派发；接手完成不代表整个产品或完整代码审查已完成。

## 2026-10-15 GitHub 源码托管（人类直接授权）

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| G-01 | lead；qa只读审查 | done | 现有main、GitHub CLI、README/lead状态 | 检查全部可推送历史；创建Devinshen123/forma-health私有仓库；仅推送产品已跟踪代码与文档，排除.env/真实数据/参考仓库/本机工具；验证远端main与本机HEAD一致 |

已实际创建并推送：https://github.com/Devinshen123/forma-health ，PRIVATE、默认分支main；GitHub API核验远端提交与本机HEAD一致。原有19次提交完整保留，qa检查208个历史blob未发现真实凭据/私有数据路径；npm test155/155与npm run build通过。README提供克隆与启动说明，本机其他所有者的未跟踪文件保持不变。

本次授权为GitHub代码托管。按最小公开范围创建私有仓库，不据此部署公网服务、开通付费资源或上传本机健康记录。没有改写历史或强制推送。

## 2026-10-14 完整训练增量（人类直接授权）

契约：decisions/ADR-training-sync.md 和 src/types.ts。所有旧训练保留摘要，不能编造逐组事实。完整指完整引入所选获准文字数据库，不声称覆盖世界所有动作或包含 openGym 的 5,632 项。教学示意原创，有可用性标识。外部收费/公网上线未启用。

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| T-01 | lead | done | types/api、sync、App/CSS、catalog、原创教学组件、docs | 账户隔离的 IndexedDB/outbox、静态离线壳、重连/冲突审核；合法全文字库和原创播放/暂停；桌面/手机实际验证 |
| T-02 | backend | done | T-01、server/ | 训练严格校验、实体版本/墓碑/幂等同步、旧PUT互操作、原子冲突、原计划/AI隔离安全测试 |
| T-03 | features | done | T-01契约、T-04函数、Training/training | 库筛选→星期/循环模板→逐组/超级/递减/倒计时→确认完成→PR/进阶/肌群→CSV预览确认，双语/空状态/编辑 |
| T-04 | qa/domain | done | types、src/training/、tests/ | 完成组统计、e1RM适用范围/进阶草稿、时间/单位/缺失/重复CSV、计划日期纯函数；独立同步与流程审查 |

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| M0-01 | root＋研究代理 | done | research/、Cal AI官方文字、Apple文档 | 固定仓库SHA与许可、已验证/未验证界限 |
| M0-02 | root | done | design/、Image Gen | 完整桌面、移动与饮食审核概念，独立资产 |
| M0-03 | 后端代理→root | done | server/ | 账户隔离、上传、持久化、版本、CSRF、跨标签身份，11项测试 |
| M0-04 | 页面代理→root | done | src/features/ | 真实记录、份量、训练、睡眠、报告人工校正；未接AI明确显示 |
| M0-05 | 计划代理→root | done | 引导、计划、趋势 | 确认、接受、拒绝、补偿撤销；无缺失填零 |
| M0-06 | root | done | 完整网页、3001构建后服务 | IAB完整主流程与导出/退出；1440/390及原概念1505×1045截图原尺寸复查，无页面溢出；构建后控制台零错误，重启持久化核对通过 |
| M0-07 | root | done | 当前请求与ADR-M0 | 接受Claude评审的真实架构边界，更新阶段冲突 |
| M1-01 | backend / rules候选，尚未派发 | todo | ADR-M0、预算/地区/认证供应商确认 | 实体资源API、增量同步、服务端规则与营养聚合、独立身份；公开邀请前必做 |
| M1-02 | root / Claude qa候选，尚未派发 | todo | 真实服务配置与明确授权 | AI/OCR真实调用、失败/费用/健康数据同意测试 |
| I1-01 | SwiftUI角色候选，尚未派发 | todo | Mac连接、Apple会员/签名确认 | HealthKit原生真机与TestFlight，不能用Web替代 |

M1不是已经完成的后台任务，未创建自动化或偷偷启用账单。当前本机网站有真实功能，但并非完整AI/双端MVP。

训练终验：T-01至T-04已交付。npm test155/155、npm run build通过；实际IAB完成模板/逐组/超级递减/暂停刷新/PR/导入去重/进阶版本/离线刷新/重连合并/冲突审核，1440与390px双语通过。前端a94dffc，领域e633a21，QA8f3a6a3/c0ce4da；root整合记录见VALIDATION。M1-01中的实体同步部分已由本轮交付，其余服务端建议、正式身份和云部署仍未交付。

## 2026-10-14 AI 识图增量

用户明确要求添加识图；密钥“稍后配置”。契约为 decisions/ADR-AI-food-photo.md，src/types.ts；不阻塞代码实现，不伪称真实推理完成。各角色先读 AGENTS、任务板、自己状态和请求。所有新依赖由 lead 安装。

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| AI-01 | lead | done | types/api、配置/Sharp、样式、说明 | .env安全加载；最终build成功，IAB与Edge1440/390交互/焦点/失败手动保存通过，实际3001已运行 |
| AI-02 | backend | done | AI-01契约；server/、.env.example | Responses/Zod、私有不可变草稿、provenance、同意、超时重试、两级持久额度；46AI测试通过，未live调用 |
| AI-03 | features | done | AI-01契约；Nutrition/Settings；1300审核焦点 | 逐图同意→校正/移除→确认保存，未知空值、失败手动、取消/账户隔离、双语/审核焦点，已实际验收 |
| AI-04 | qa | done | AI-02；tests/、review | 独立44项全部通过，真实HTTPparser而非已解析结果注入；全仓加rules后99/99，build通过 |

终验记录见docs/VALIDATION.md。未配置真实密钥，capabilities.reason=not_configured；live质量/供应商账户可用性待用户配置。临时fixture服务/账号已核验清理，真实3001服务不含fakeprovider。

## 2026-10-14 预算核对

用户直接选择“先保持当前测试限额，预算稍后确认”，见decisions/ADR-budget-test-limits.md。维持10次/账户/UTC日及现有账户/全局预留护栏；Claude转述的75/月、1.5/人/月、15次/日不是已确认的新配置。

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| B-01 | lead | done | 用户直接答复；decisions、TASKS、lead状态、COSTS、Claude请求回复 | 文档一致、程序配置维持、diff检查通过 |

T-02补充分工：自现在起 src/sync/storage.ts 唯一写入者为source_audit/backend（增加离线同意generation、原子clear与有序merge）；root只读此文件，继续engine/API/App。tests仍qa单写。


# 合入的 Mac / 团队配置历史记录（91509d4）

# Forma 唯一正式任务板

更新2026-10-21；唯一写入者01（lead）。主仓库继续留C盘原位置。共享规则见根FORMA.md，员工表见TEAM-ROSTER。此处任务是配置与后续规划，不表示员工会话已经启动。

## 当前唯一所有权表

所有路径相对本人checkout。未明确授权的路径只读；外部会话未同步前不能说已采用。路径冲突按最具体路径裁定，每个路径仅一个写入者。

| owner | 路径 | 条件 |
|---|---|---|
| lead（01） | FORMA.md、AGENTS.md、CLAUDE.md、README.md、package.json/package-lock.json、tsconfig.json、vite.config.ts、.gitignore、.gitattributes、scripts/、src/types.ts、src/api.ts、src/sync/engine.ts、src/sync/changes.ts、docs/architecture/、docs/PRODUCT-PLAN.md、docs/API-CONTRACT.md、docs/COSTS.md、docs/VALIDATION.md、docs/collaboration/{TASKS.md,TEAM-ROSTER.md,SKILLS-MATRIX.md,START-PROMPTS.md,WORKSPACES.md,ARCHITECTURE-BACKLOG.md,CONFIGURATION-RESULTS.md,team-config.json,configuration-baseline.json,configuration-files.json}、docs/collaboration/{skills/,decisions/,agent-prompts/,archive/,memory/README.md}、.claude/agents/ | 花括号逐项展开为仓库相对路径；配置与集成，本轮产品源码只读 |
| claude-lead（02） | docs/collaboration/deliverables/claude-lead/（含dispatch.md） | 调度仅引用正式任务，不构成第二块任务板 |
| product（03） | docs/product/、docs/collaboration/deliverables/product/ | 定义行为与验收；原docs/product如有旧writer，先HANDOVER-01核对 |
| frontend（04） | src/App.tsx、src/main.tsx、src/styles.css、src/demo.ts、src/components/、src/features/、src/catalog/、index.html、public/、docs/collaboration/deliverables/frontend/ | 当前源码没有src/i18n/目录，未来新增先由01登记；不因路径名猜权限 |
| backend（05） | server/（含现有*.test.ts，server/rules/除外见下一行）、.env.example、src/sync/storage.ts、docs/collaboration/deliverables/backend/ | 不改共享类型/API；storage和engine明确分属05/01 |
| backend（05，交接冻结） | server/rules/（含测试）、src/training/domain.ts、src/training/import.ts、docs/rules/、docs/safety/ | 目标owner已登记；HANDOVER-01确认旧rules/lead写入者、提交与未提交内容前禁止写入；不能暗中接管 |
| qa（06） | tests/、docs/reviews/、docs/collaboration/deliverables/qa/ | 产品源码和现有server测试只读；新的独立测试写tests/ |
| dot（00） | docs/collaboration/deliverables/dot/ | 连接未验证时仅草稿；01可注明来源导入，不能伪造Dot接手 |
| 每位本人 | docs/collaboration/memory/<本人ID>/、docs/collaboration/status/<本人ID>.md、本人发起requests | 相同ID同时一名writer；请求回复仅接收方追加 |

TEAM7-CONFIG-01一次性例外：用户明确要求重设员工MD与独立记忆，01可为七人更新编号/配置引用及首次交接元数据；已有正文保留历史，不伪造本人接手、经验或实测。初始化结束后不得日常代写。现有退休员工memory/status/deliverables只读保留；其current入口由01改为退休指针并归档旧定义。

## 本轮配置与接手

2026-10-21用户新增明确任务：将已有工作同步GitHub供另一台Mac操作。仅提交经清单核对的配置候选与Mac接手说明，推到`codex/mac-handoff-20261021`供获取，尚未独立审查的配置不合入远端main。此前Git索引拒绝已在本轮精确暂存时解除；旧记录保留历史，源码交接与独立审查仍未解除。02新增07/08原生岗位的请求已收到，但本次同步不等于批准增员、安装技能或启动客户端开发。

| ID | owner | 状态 | 依赖 / 文件 | 验收标准 |
|---|---|---|---|---|
| GITHUB-MAC-01 | lead | done | 用户授权；136项精确候选及Mac接手说明；候选bbc9024已推送codex/mac-handoff-20261021，git ls-remote确认SHA一致 | 测试155/155、构建通过；最终暂存导出portable15/15及vendor读取通过；Mac实际操作未测，外置Skills另配；原图片删除与02本人后续内容保留；回执随同分支更新，TEAM7独立审查仍为review |
| CHAT-PROMPTS-01 | lead | review | 用户要求逐人生成Prompt并准备新对话；START-PROMPTS.md、agent-prompts/launch/、scripts/prepare-forma-chat-prompts.cjs、lead状态/交接 | 00—06各一份可复制Prompt，编号/ID/MD/记忆/Skills入口对应；现有01优先复用；首轮只读登记，不把缺worktree当成不能读取配置，不生成额外writer；新对话由用户打开，未启动/未提交不伪称完成 |
| TEAM7-CONFIG-01 | lead | review | 文件已生成；本轮Windows/portable配置各15项通过，12项技能/110资源校验通过（agent-development有已知缺失脚本）；155测试与构建通过；Git索引精确暂存已可写 | 配置候选经GITHUB-MAC-01推送供Mac获取；仍待06独立审查、技能原生触发和各员工实际接手，不标全部完成；历史权限拒绝保留来源 |
| HANDOVER-01 | lead | blocked | 旧writer与worktree状态读取权限；server/rules、src/training、docs/product及退休角色路径 | 核对所有旧写入者、SHA和未提交工作，确认停写/交接后再启用目标owner；不得假定无活跃会话 |
| ONBOARD-00 | dot | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；具名报告草稿 | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-01 | lead | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-02 | claude-lead | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-03 | product | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-04 | frontend | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-05 | backend | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| ONBOARD-06 | qa | todo | TEAM7-CONFIG-01审查提交、本人独立checkout与技能入口；本人MD/三份记忆/status | 只读取规则并核对编号、目录/分支/SHA/未提交、技能路径和读取方式、可写范围/依赖/验收；向主管报告已知/未知/阻塞；不开发或启动其他员工 |
| SKILL-PROVENANCE-01 | lead | todo | SKILLS-MATRIX、来源与许可证待核对条目 | 对未知上游commit/本机agent变体/缺失脚本给出证据；不覆盖同名版本、不擅改第三方技能 |
| TOOL-LOAD-01 | claude-lead | blocked | ONBOARD-02；本人checkout与明确单会话测试时机 | 只在实际启动获安排后验证02/04/06原生发现及技能触发，记录版本与实际结果；本轮不启动员工 |
| WORKTREE-SYNC-01 | lead | blocked | 可写Git元数据、旧writer审计、已独立审查配置提交 | 复用或创建各自不同分支/checkout；显式同步已审查SHA，重新读取配置；不覆盖脏工作区 |

## 架构后续任务（本轮未执行）

以下均以已审查配置、本人ONBOARD和必要交接为前提；实现任务只有明确依赖通过后才能开工。细化验收见ARCHITECTURE-BACKLOG.md。

| ID | owner | 状态 | 依赖 / 文件 | 验收标准 |
|---|---|---|---|---|
| A-PRODUCT | product | todo | ONBOARD-03；docs/product/plan-adjustment.md | 定义训练调整接受/撤销、可见状态、旧base冲突与证据；不启用新营养阈值 |
| A-CONTRACT | lead | todo | A-PRODUCT、当前checkout复验；src/types.ts、src/api.ts、docs/API-CONTRACT.md、decisions/ | 确认400/409分类及错误形状，登记单一owner/测试接口与原子性；本轮不改代码 |
| A-BACKEND | backend | todo | A-CONTRACT、HANDOVER-01；server/、src/training仅按正式分配 | 训练切片集中候选/证据、base复核、追加/撤销恢复版本、状态转换与原子保存；失败零写入、事实不变 |
| A-FRONTEND | frontend | todo | A-CONTRACT、02调度；src/features/ | 展示证据、差异、确认、冲突与撤销；不重复领域校验，不改后端或共享类型 |
| A-REVIEW | qa | todo | A-BACKEND/A-FRONTEND同一候选SHA；tests/、docs/reviews/ | 正常接受/撤销、最新revision加旧base、400/409、零写入、历史事实、跨账户实际验证 |
| B-PRODUCT | product | todo | A评估后由01排期；docs/product/account-workspace.md | 定义启动/切换/恢复/退出/删除/撤回离线同意与未同步记录行为 |
| B-CONTRACT | lead | todo | B-PRODUCT；src/App.tsx、src/sync只读分析、decisions/ | 保留当前引擎与storage能力，先定生命周期编排和路径归属，不整体替换 |
| B-BACKEND | backend | todo | B-CONTRACT；src/sync/storage.ts、server/ | 保留IDB原子/CAS、稳定mutationId/receipt、幂等及账户数据约束 |
| B-ENGINE | lead | todo | B-CONTRACT；src/sync/engine.ts、changes.ts、共享契约 | 保留账户绑定/epoch/generation/停止旧引擎，集中必要编排 |
| B-FRONTEND | frontend | todo | B-CONTRACT、B-ENGINE；src/App.tsx、src/features/ | 只表达用户意图与恢复/退出确认，保留未同步记录、清理私有缓存与错误状态 |
| B-REVIEW | qa | todo | B实施同一候选SHA；tests/、docs/reviews/ | 跨账户、双标签、离线恢复/重试、撤回同意、退出/删除且不丢未同步数据 |
| C-PRODUCT | product | todo | ONBOARD-03；docs/product/day-week-summary.md | 确定当前视图日期与记录归属、睡眠醒来日、时区/缺失/完整度/舍入 |
| C-CONTRACT | lead | todo | C-PRODUCT；types/api与日期调用点静态复核、decisions/ | 定义共享日期与聚合接口及归属；不导入整个server/rules到浏览器 |
| C-BACKEND | backend | todo | C-CONTRACT、HANDOVER-01；server/ | 确定性聚合、缺失排除与完整度，原记录日期不追溯改写 |
| C-FRONTEND | frontend | todo | C-CONTRACT；Dashboard/Trends及相关页面 | 使用确认后的窗口与显示含义，旅行记录保持原归属 |
| C-REVIEW | qa | todo | C实施同一候选SHA；tests/、docs/reviews/ | 固定时刻LA/Shanghai算法与真实页面复核；同区对照、跨时区/缺失与舍入 |
| D-PRODUCT | product | todo | ONBOARD-03；docs/product/training-versions.md | 手改和接受进阶的共同版本行为、独立证据要求与训练事实保持 |
| D-CONTRACT | lead | todo | D-PRODUCT；src/types.ts、decisions/ | 明确追加版本/日程引用/时间/原子性；不泛化通用状态机 |
| D-BACKEND | backend | todo | D-CONTRACT、HANDOVER-01；server/、src/training/ | 版本历史、手改与进阶各自校验、引用迁移同事务，旧训练事实不改 |
| D-FRONTEND | frontend | todo | D-CONTRACT；src/features/training/实际相关组件 | 共用确认语义，展示版本/日程变化，保留用户编辑 |
| D-REVIEW | qa | todo | D实施同一候选SHA；tests/、docs/reviews/ | 编辑与进阶、重复接受/旧base、版本不可变、日程引用迁移、失败原子性 |

## 旧任务逐项迁移

旧任务原状态与完整正文保留在[历史任务板](archive/20261021-seven-role-transition/docs/collaboration/TASKS.md)，不把替代或取消写成done。

| 旧任务 | 本轮处理 | 后继 |
|---|---|---|
| TEAM-EXP-01、MEM-01 | 旧方案由七人配置替代，原blocked/doing保留历史，未标完成 | TEAM7-CONFIG-01 |
| TEAM-DOT-01 | 旧首次任务取消（未执行），改先接手 | ONBOARD-00 |
| TEAM-PRODUCT-01 | 旧首次任务取消（未执行），范围按新正式任务重排 | ONBOARD-03、A/B/C/D-PRODUCT |
| TEAM-UX-01 | 退休，原blocked未执行；体验责任转03/04 | ONBOARD-03/04与后续FRONTEND任务 |
| TEAM-RESEARCH-01 | 退休，原todo未执行；研究按需归03/主管 | ONBOARD及SKILL-PROVENANCE-01 |
| TEAM-FRONTEND-01 | 原todo未执行，日期复验后续保留 | ONBOARD-04、C-REVIEW |
| TEAM-BACKEND-01 | 原todo未执行，旧base复验保留 | ONBOARD-05、A-CONTRACT/A-REVIEW |
| TEAM-QA-01 | 原todo未执行，不沿用历史155项作本轮结果 | ONBOARD-06及独立REVIEW |
| TEAM-RULES-01 | 退休，原todo未执行；交接后05实现/03定义/06验证 | HANDOVER-01、A/C/D |
| TEAM-SECURITY-01 | 退休，原todo未执行；审查归06 | ONBOARD-06、B-REVIEW |
| TEAM-RELEASE-01 | 退休，原blocked未执行；发布职责归主管，本轮不部署 | 以后另派正式发布任务 |
| AR-01/WT/CO/G/T等历史任务 | 保留原完成状态与证据，不重跑初始化，不冒充当前验证 | 历史任务板、现有ADR |

旧请求20261017-0054的计划base错误分类和日期时区仍未修复，分别纳入A/C，不在此虚假回复为解决。
