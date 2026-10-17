# 2026-10-17 Claude Code 本轮任务

Owner：真实Claude会话 a02c2fec-4908-4d91-972a-06c1f05c67c8（待CLI确认）；CB-17，claude/forma-attachment-retry-20261017，见 [CB-17任务书](tasks-20261017-claude-backend.md)。协调者准备MD，先preflight，后按同一session授权时段执行；不把先前Codex工作称Claude完成。

# Forma 协作任务板

## 2026-10-17 三方向实际任务（当前授权，覆盖上一文档轮范围）

用户已要求实际派发前端/后端/测试审查并推进。完整目标、独占路径、验收命令和每项必须先读的本地 skills 路径见 [三方向任务书](tasks-20261017-three-directions.md)。入口 CLAUDE/AGENTS 指向同一任务书；旧“只读文档”限制是上一轮快照，不阻止本轮已授权范围。

| ID | 唯一方向 / owner | 真实本地分支 / worktree | 状态与范围 |
|---|---|---|---|
| F-17 | frontend，执行者由总控登记 | `codex/forma-sleep-report-lifecycle-20261017` / `forma-record-flows` | todo：Sleep/Reports 旧编辑与删除确认；仅两页面、指定浏览器回归、frontend状态 |
| B-17 | backend，执行者由总控登记 | `codex/forma-approval-failure-recovery-20261017` / `forma-review-recovery` | todo：AI批准SQL中途失败/提交后清理/跨实例引用，指定新测试及必要app/store修复 |
| Q-17 | qa，执行者由总控登记 | `codex/forma-three-direction-review-20261017` / `forma-health` | todo：交叉审查、合成mock回归和缺动作目录诊断；产品只读 |

root / lead 只维护任务书/入口/任务板/lead状态及协调，不同时写方向独占产品文件。三个旧角色会话先前为 detached HEAD，不能冒称已是任务分支；以实际创建与回执记录为准。已有四项删除在三个本地修复 worktree 也存在，会跨切分支保留，禁止恢复或纳入提交。不安装、不push/合并/部署，不动真实数据。

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
| Codex root / lead（当前集成者） | src/types.ts、src/api.ts、src/App.tsx、src/main.tsx、src/styles.css、src/sync/、src/catalog/、src/components/、public/、scripts/、根构建配置/依赖、README、docs/PRODUCT-PLAN.md、API-CONTRACT.md、COSTS.md、VALIDATION.md、architecture/、collaboration任务/决定/lead状态；独立浏览器验收 | T-01 done |
| source_audit（backend） | server/（含现有*.test.ts，不含rules/）、.env.example、status/backend.md | T-02 done：13b3bbd/6f58349，训练同步、严格schema、离线同意与身份隔离 |
| fitness_recipes_audit（features） | src/features/Training.tsx、src/features/training/、src/features/Nutrition.tsx、src/features/Settings.tsx、status/features.md | T-03 done |
| native_architecture（qa/domain） | src/training/（原创新纯函数，不含 catalog/sync）、tests/、docs/reviews/、status/qa.md | T-04 done |
| 本机独立 Claude Code（rules） | server/rules/、docs/rules/、docs/safety/、status/rules.md及自己的请求/评审 | 已交付独立纯函数与42项测试并提交；lead纳入测试，运行对接留M1 |

外部新建的 docs/predevelopment、handoff、agent-prompts、AGENTS.md、.agents/.claude Skills 等保持其原所有者；root不整体覆盖或删除。接下来重新分工必须先更新本表，不让两个工作会话同时改同一产品文件。

## 任务

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
