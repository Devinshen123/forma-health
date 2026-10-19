# 2026-10-18 独立 iPhone App（当前任务）

用户明确要求独立iPhone App；采用iOS 17+ SwiftUI原生五页与现有Forma会话/API，先进训练工作台通过同源WKWebView复用。不是把网站作为整个App根界面。无HealthKit/Apple登录/支付扩围；缺失与演示规则不变。Windows无xcrun，Mac尚未连接，先用公开仓库Mac CI无签名构建与合成测试，不声称已安装真机。保留现有Web服务。

| ID | owner / 本轮独占写入 | 状态 | 验收 |
|---|---|---|---|
| IOS-01 | lead：ios/Forma（不含Features）、ios/Forma.xcodeproj、ios/Config、scripts/ios*、.github、根文档 | doing | 原生入口/设置/登录/会话隔离/同源工作台；实际Mac构建及如实限制 |
| IOS-02 | inspect_library：ios/Packages/FormaCore与status/ios-core.md | doing | 纯Swift JSON/请求结构/确定性营养与睡眠/记录工厂/边界测试 |
| IOS-03 | muscle_ui：ios/Forma/Features与status/ios-features.md | doing | Today/Nutrition/Training/Sleep/Trends原生页面、真实记录表单、空态/双语 |
| IOS-04 | qa：ios/FormaUITests、tests/ios-contract.test.ts与status/ios-qa.md | doing | 真正API契约/模拟器UI测试；不改root工程或构建依赖 |

核心接口在本轮消息和ADR-ios-native-20261018.md确定；所有agent不改其他路径、不读data/.env、不自启/停止5173、不自行安装/推送/合并。只有lead整合并上传，commit前逐条确认测试结果。ios开发的完成状态与Web已有完成记录分开。

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
