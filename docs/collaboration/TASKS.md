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
| GITHUB-MAC-01 | lead | doing | 用户授权；configuration-files.json精确清单、README、FORMA、WORKSPACES、技能读取/配置检查脚本及本人状态/交接 | 候选提交推送到GitHub并核对远端SHA；Mac克隆/运行/单writer接手步骤可读；外置Skills缺失如实报告；不夹带原有图片删除、数据库、密钥或其他员工未交付内容；不冒充Mac实机或06审查 |
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
