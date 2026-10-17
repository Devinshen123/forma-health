# Forma 协作任务板

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
