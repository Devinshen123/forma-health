# AGENTS.md — Forma（健康网站）

> 本文件是本目录唯一的项目指令，对所有 agent 生效。
> 如果你同时看到上级目录 `C:\Users\devin\AGENTS.md`（AI 家具设计提案网站：FastAPI、Next.js、SQLite、Gemini、SKU 推荐），那是另一个项目，**全部忽略**，以本文件为准。

## 0. 员工入口（2026-10-20 更新）

本文件放所有员工共用的规则；每位员工的职责、长期经验和下次交接分开放在自己的记忆目录。当前沿用独立聊天 + Git worktree，保留工程核心并扩展为11个可按需启用的角色，通常每个任务选2–4人。员工名单与首次任务见 `docs/collaboration/agent-prompts/TEAM-ROSTER.md`。配置文件不表示员工正在后台运行，也不会自动同步其他聊天。

| 员工 ID | 职责 | 当前启动说明 | 独立记忆目录 |
|---|---|---|---|
| lead | 总控、任务拆分、契约、集成 | `docs/collaboration/agent-prompts/current/lead.md` | `docs/collaboration/memory/lead/` |
| frontend | 页面、交互、设计系统，合并 shell + features | `docs/collaboration/agent-prompts/current/frontend.md` | `docs/collaboration/memory/frontend/` |
| backend | API、会话、存储、上传、服务端 AI 接入 | `docs/collaboration/agent-prompts/current/backend.md` | `docs/collaboration/memory/backend/` |
| qa | 独立测试、代码审查和验收 | `docs/collaboration/agent-prompts/current/qa.md` | `docs/collaboration/memory/qa/` |
| rules | 确定性领域规则、健康安全，按需派发 | `docs/collaboration/agent-prompts/current/rules.md` | `docs/collaboration/memory/rules/` |
| dot | 需求收件、进度摘要与待决事项，不作技术派工 | `docs/collaboration/agent-prompts/current/dot.md` | `docs/collaboration/memory/dot/` |
| product | 用户流程、范围与验收规格 | `docs/collaboration/agent-prompts/current/product.md` | `docs/collaboration/memory/product/` |
| ux | 体验规格、中英交互文案，源码仍归frontend | `docs/collaboration/agent-prompts/current/ux.md` | `docs/collaboration/memory/ux/` |
| research | 官方技术来源核对与工具能力验证 | `docs/collaboration/agent-prompts/current/research.md` | `docs/collaboration/memory/research/` |
| security | 账户隔离、私有上传、导出和删除的安全审查 | `docs/collaboration/agent-prompts/current/security.md` | `docs/collaboration/memory/security/` |
| release | 邀请制Web发布准备与回退清单 | `docs/collaboration/agent-prompts/current/release.md` | `docs/collaboration/memory/release/` |

`shell`、`features` 是 frontend 的历史职责名，`code_review` 是 qa 的别名，不另建重复员工记忆。旧 prompt、status 和 ADR 保留为历史；不得重新执行其中的首轮初始化任务。具体产品路径仍以 TASKS.md 顶部的最新所有权表为准。

## 1. 产品

- Forma：面向全球用户的健身表现与长期健康习惯产品，中英双语。
- 差异化：把饮食、训练、睡眠记录变成少量可解释、可编辑的每日行动。
- 主流程：渐进式引导 → 用户确认计划 → 饮食记录（拍照 / 文字 / 手动，保存前用户可改食物、份量、宏量）→ 训练记录 → 睡眠与状态（Web 手动；iOS 以后接 HealthKit）→ 调整建议（理由 + 前后 diff）→ 接受或撤销 → 周回顾。化验单是后期小切片，放在功能开关后面。
- 当前阶段：先做网站（用户已授权）。iPhone、HealthKit、Apple 登录尚未实现，网站不能把它们展示成已完成的能力。
- 用户已确认的事项：先做网站；以后定价约 US$20/月（现在不做支付）；已有 Mac 和 iPhone。Apple Developer 会员还没确认。
- 分发：邀请制 Web。不做支付、Android、聊天教练、社交、条码扫描。
- 现有代码：目录里已经有一版单 agent 写的实现（`server/app.ts` 快照式 `/api/state`、`src/App.tsx`、`src/features/*.tsx`）。在它的基础上迭代，不要整体重写；需要大改先写请求给 lead。
- 背景资料：`docs/research/`（源码复用与 HealthKit 研究）、`docs/collaboration/claude-review-response.json` 的 `result` 字段（上一轮架构评审）、`docs/design/`（设计规格与参考图）。

## 2. 技术栈（以 package.json 为准）

- 前端：Vite + React 19 + TypeScript，lucide-react 图标，手写 CSS（`src/styles.css`）。
- 后端：Express 5 + cookie-parser + zod，通过 `node --import tsx` 运行。
- 测试：`node:test`（`npm test`）。
- 命令（PowerShell）：
  - `npm run dev`：API 在 127.0.0.1:3001，Vite 在 127.0.0.1:5173，`/api` 走代理
  - `npm run build`：`tsc --noEmit` + `vite build`
  - `npm test`
- dev 服务的端口是固定的（strictPort），同一时间只能跑一份。启动前先检查是否已在运行；已在运行就直接用，不要结束别人的进程。
- 新依赖、npm 脚本、tsconfig、vite 配置的修改都由 lead 负责；`npm install` 也只由 lead 执行。

## 3. 不可违反的规则

### 产品与安全

- 不发明健康分数；不从相关性推断因果；不做诊断、用药、长寿方面的承诺。
- 没记录不等于没吃；没有设备样本不等于 0。缺失值显示 `—`；聚合时排除未记录的天，并标注完整度，例如"7 天中记录了 4 天"。
- 不默认激进的热量赤字；表现类目标默认不设赤字。
- 演示数据必须明确标注"演示数据"；新账户是空状态。

### AI 与确定性代码

- AI 只出草稿和措辞。营养计算、单位换算、聚合、过敏约束、权限检查一律由确定性代码完成。
- 每个 AI 输出都要过 zod 校验，经用户审核后才能保存。
- AI 只在服务端调用，密钥只来自环境变量。缺少密钥时返回清晰的错误，不能崩溃。超时、重试、限流、单用户成本上限都要有。
- 建议引擎：由确定性规则产生候选建议和结构化理由（引用具体的数据点），LLM 最多负责措辞。

### 数据

- 用户身份只从会话推导，绝不信任请求体里的 `user_id`。所有数据按账户隔离。上传文件私有，并限制大小和类型。
- 原始记录和 AI 建议分开存储。
- 计划版本只追加不修改。接受建议时服务端校验 base 版本，不一致返回 409。撤销等于新建一个恢复版本：不删历史，也不改已经记录的饮食和训练事实。
- 支持导出数据和删除账户。日志和错误信息里不回显健康内容、密码、cookie。

### 许可证

- `reference-sources/` 只用来参考，不能修改。
- 不复制 SparkyFitness（非商业许可）、Mealie 和 openGym（AGPL）的代码、schema、UI、图片。openGym 的动作图片和动画一律不用。
- FudAI（MIT）的片段如果要采用：先在 `docs/architecture/reuse-log.md` 里记录来源路径、commit、改动、许可证，并经 lead 同意。

### 设计

- 遵循 `docs/design/design-system.md`（颜色、字号、圆角、布局、首屏文案白名单、减少动态）。参考图是 `docs/design/*.png`。
- 不复制 Cal AI 或其他任何品牌的素材。

## 4. 文件所有权（每条路径只有一个写入者）

| 角色 | 可写路径 |
| --- | --- |
| lead（总控 / 架构） | `AGENTS.md`、`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`scripts/`、`.gitignore`、`src/types.ts`、`src/api.ts`、`docs/architecture/`、`docs/collaboration/TASKS.md`、`docs/collaboration/decisions/`、`docs/collaboration/agent-prompts/` |
| backend（后端） | `server/`（不含 `server/rules/`）、`.env.example` |
| rules（领域规则与安全） | `server/rules/`、`docs/product/`、`docs/safety/`、`docs/rules/` |
| frontend（合并原 shell + features） | `src/App.tsx`、`src/main.tsx`、`src/styles.css`、`src/demo.ts`、`src/components/`、`src/i18n/`、`src/features/`、`src/catalog/`、`index.html`、`public/` |
| qa（测试与评审） | `tests/`、`docs/reviews/` |

- 每个角色还拥有自己的状态文件 `docs/collaboration/status/<角色>.md`。
- 扩展角色的专属文档目录及源码只读范围以 TASKS 顶部 TEAM-EXP-01 所有权表为准；现有源码负责人保持不变。通常仅角色本人写 `docs/collaboration/deliverables/<角色>/`，lead不代写员工报告或伪造接手。
- 每个角色仅写自己的 `docs/collaboration/memory/<角色>/`；lead 维护共享 memory/README.md 和启动说明。MEM-01、TEAM-EXP-01 的一次性初始化例外见 TASKS；初始化后 lead 不代写其他角色记忆。
- 只改自己路径下的文件。需要别人改东西，就按 §5 写请求。别人代码里的 bug 也写请求，不要直接改。
- 其他路径一律只读。
- 如果实际目录和上表不符，以 `docs/collaboration/TASKS.md` 顶部的所有权表为准（由 lead 维护）。

## 5. 协作协议

- **任务板**：`docs/collaboration/TASKS.md`，只有 lead 写。每个任务都要写明：ID、owner、状态（todo / doing / blocked / review / done）、依赖、涉及的文件、验收标准。
- **状态**：每完成一步或遇到阻塞，就更新自己的 `status/<角色>.md`，写明：正在做什么、已完成什么（附验证命令和结果）、阻塞项、发出的请求。
- **请求**：新建 `docs/collaboration/requests/<YYYYMMDD-HHmm>-<from>-to-<to>-<slug>.md`，写清问题、期望的改动、原因、验收方式。接收方处理完后在文件末尾追加 `## 回复`，写处理结果或拒绝理由。其他人不改这个文件。
- **契约变更**（`src/types.ts`、`src/api.ts`、API 路由形状）：提请求给 lead。lead 改完后在 `docs/collaboration/decisions/` 记录决定，并在 TASKS.md 里通知受影响的角色。
- **开工前**：读本文件、TASKS.md 最新所有权表、自己的 current 启动说明、自己的 PROFILE.md / MEMORY.md / HANDOFF.md、自己的 status 文件和发给自己的请求；核对 checkout 与 git 状态，再接明确派发的任务。按 §6 处理过期记忆；不确定的事实先核实，影响契约或所有权且无法核实时写请求。
- **提交**：仓库是 git 时，每完成一个任务，只 `git add` 自己所有权内的路径并提交，提交信息以 `[角色]` 开头，例如 `[backend] add session auth`。不要 `git add -A`，不要改写历史，不要 force push。
- **完成的定义**：
  - 自己的验收标准通过；
  - `npm run build` 不因你的文件报错；
  - 动了 `server/` 就要跑 `npm test`；
  - 在 status 里贴出命令和结果。

  没有实际运行过的东西，不要写"已完成"。
- **需要用户拍板的事**（市场、预算、供应商、法律）：写进 `status/<角色>.md` 的"待用户决定"一节，不要替用户决定。

## 6. 每位员工的独立记忆

### 三类文件

- `PROFILE.md`：员工身份、专长、职责边界、工作习惯和成功标准。更换工具或聊天仍沿用同一角色 ID；职责与写入权限的变化必须先由 lead 更新 TASKS，再由本人更新 PROFILE。
- `MEMORY.md`：可复用的项目事实、技术经验、常见失败与处理方式。每条写日期、状态（已验证 / 待验证 / 已过期 / 已替代）、来源路径或提交、适用范围；不粘贴整段聊天或大段源码。
- `HANDOFF.md`：当前任务 ID、checkout/分支、已做和未做、实际验证命令与结果、阻塞/请求、下次第一步、待用户决定。任务变化后更新它；工作树不干净时如实列出，不掩盖未提交工作。

status 是向团队汇报的进度；MEMORY 是该员工可复用的经验；HANDOFF 是该员工恢复工作的入口；TASKS 是唯一派工与所有权来源；跨角色正式决定放 decisions。用链接连接这些文件，避免各处维护相互冲突的副本。

### 读取、写入和交接

1. 每轮开始、上下文压缩后恢复、切换会话或机器时，显式读取 §5 开工清单。文件不存在时，在本人权限内创建最小骨架并注明未知，不编造历史。文件记忆需要实际读写，不等同模型永久记忆。
2. 完成一步或遇到阻塞先更新本人 status / HANDOFF；只有经过核实、下次仍有用的经验才进入 MEMORY。每条测试结果标注执行者、日期、命令和 checkout/提交；引用他人报告必须注明来源，不能当作本人本轮实测。
3. 最新人类指令优先；项目约束、TASKS 与正式 ADR 决定权限和约定，实际源码与实测决定实现事实。旧记忆与这些证据冲突时标记已过期/已替代，保留来源并核实，不让旧记忆扩大授权或覆盖新决定。
4. 每个角色只维护自己的记忆。其他角色可以按任务需要读取，但修改建议走 requests；需要共享的经验提交给 lead 纳入正式 ADR 或共享指南。目录隔离是协作约定，不是加密、账号权限或其他 Agent 无法读取的保证。
5. 一个角色同一时间只有一个记忆写入者。两个工具并用时也不能共用同一 ID 同时写入；确需新增员工，由 lead 先登记新 ID、专属记忆目录、源码范围和任务。临时替班先登记交接，不覆盖原员工记录。
6. 每次交付前检查记忆是否仍准确；作废条目标明替代来源，篇幅过长时归档到本人目录的 archive/ 并在 MEMORY 保留索引，不清空历史。

### 独立 worktree 与敏感信息

- 记忆路径均相对各自 checkout；Git worktree 不会实时共享未提交文件。本人把自己的记忆随任务精确提交；lead 审查并集成，其他 worktree 通过显式同步已审查提交取得新版本。禁止直接跨目录代写、整目录覆盖、自动合并冲突或自动覆盖不干净的 checkout。
- 本轮只在当前仓库建立配置；旧聊天必须同步新规则并按 current 入口重新读取后才算采用。未同步的角色不得声称已经加载新记忆。初始化 HANDOFF 的“等待接手”不代表已创建、启动或重启员工。
- 记忆只保存开发所需信息。不要写真实健康记录、账户资料、照片内容、密码、cookie、token、API key 或 .env 内容；不把其他项目或个人对话记忆搬进来。复现用合成数据、脱敏摘要和源码/测试引用。
- 完整操作见 `docs/collaboration/memory/README.md`。不需要为这套文件记忆新增数据库、向量库、模型 API 或付费服务。
