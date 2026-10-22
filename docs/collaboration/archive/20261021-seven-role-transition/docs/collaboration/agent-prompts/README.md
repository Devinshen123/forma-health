# Forma 员工启动入口（2026-10-20）

当前员工池为11个角色，通常每项任务启用2–4人；完整名单、建议工具和首次任务见 [TEAM-ROSTER.md](TEAM-ROSTER.md)。每位员工有自己的 PROFILE / MEMORY / HANDOFF。完整规则先读根 AGENTS.md 和 TASKS.md 顶部所有权表，只有lead负责正式技术派工。

| 员工 | 当前启动说明 | 身份与独立记忆 |
|---|---|---|
| lead | [current/lead.md](current/lead.md) | [memory/lead/](../memory/lead/PROFILE.md) |
| frontend（shell + features） | [current/frontend.md](current/frontend.md) | [memory/frontend/](../memory/frontend/PROFILE.md) |
| backend | [current/backend.md](current/backend.md) | [memory/backend/](../memory/backend/PROFILE.md) |
| qa（code_review） | [current/qa.md](current/qa.md) | [memory/qa/](../memory/qa/PROFILE.md) |
| rules（按需） | [current/rules.md](current/rules.md) | [memory/rules/](../memory/rules/PROFILE.md) |
| dot（需求与进度） | [current/dot.md](current/dot.md) | [memory/dot/](../memory/dot/PROFILE.md) |
| product（验收规格） | [current/product.md](current/product.md) | [memory/product/](../memory/product/PROFILE.md) |
| ux（体验设计） | [current/ux.md](current/ux.md) | [memory/ux/](../memory/ux/PROFILE.md) |
| research（技术研究） | [current/research.md](current/research.md) | [memory/research/](../memory/research/PROFILE.md) |
| security（安全审查） | [current/security.md](current/security.md) | [memory/security/](../memory/security/PROFILE.md) |
| release（发布准备） | [current/release.md](current/release.md) | [memory/release/](../memory/release/PROFILE.md) |

新会话示例：

> 你是 Forma 的 frontend。先读取 AGENTS.md 和 docs/collaboration/agent-prompts/current/frontend.md，按其中顺序读取你自己的记忆、状态、任务和请求；核对 checkout 后只接明确派发的工作。

更换角色时替换 frontend。旧聊天需先显式同步配置，再重新读取；这些文件不启动后台员工，也不自动同步其他 worktree。使用方法见 [memory/README.md](../memory/README.md)。

---

# 历史：旧版多 agent 使用说明

以下保留原始分工与首轮流程用于溯源，已由上方 current 入口替代。不要重新初始化仓库、安装依赖或执行旧首轮任务；Claude Code 等工具是否自动读取 AGENTS 取决于实际工具配置，必须按当前入口显式读取，不能只依赖下方历史说法。

## 文件

| 文件 | 给谁 | 作用 |
| --- | --- | --- |
| `AGENTS.md`（项目根目录） | 所有 agent | 共享规则：产品边界、安全红线、文件所有权、协作协议。Codex 和 Claude Code 会自动读取 |
| `01-lead.md` | lead | 拆任务、定 API 契约、批依赖、集成，和你讨论决定 |
| `02-backend.md` | backend | Express API、账户、存储、上传、AI 网关 |
| `03-rules.md` | rules | PRD、营养和建议规则、安全和文案规则，以及对应的纯函数 |
| `04-shell.md` | shell | App 外壳、布局、设计系统、i18n、通用组件 |
| `05-features.md` | features | 各业务页面（可以拆成 features-a、features-b 两个 agent） |
| `06-qa.md` | qa | 构建、测试、端到端走查、评审报告 |

agent 之间通过文件协作：

- `docs/collaboration/TASKS.md`：任务板，只有 lead 写
- `docs/collaboration/status/<角色>.md`：各自的进度
- `docs/collaboration/requests/`：跨角色请求
- `docs/collaboration/decisions/`：架构决定

## 启动顺序

0. **先等现在正在写代码的那个 agent 停下来。** 2026-10-13 晚上，有一个 agent（很可能是 Codex）一直在这个目录里写 `server/`、`src/`。新开的 agent 和它同时改同一批文件，会互相覆盖。等它停下后，可以让它直接当 lead，接着用下面第 1 步的开场白。
1. **只开 lead。** 在项目目录 `C:\Users\devin\健康网站` 新开一个会话，发：

   > 你是 Forma 项目的 lead。读 `docs/collaboration/agent-prompts/01-lead.md`，严格按它工作。

   等它完成 git 初始化、`npm install`、`docs/architecture/api.md`、`TASKS.md`。它问你的决定（市场、AI 供应商、预算、化验单）要回答。
2. **同时开 backend、rules、shell 三个会话。** 每个都发同样格式的开场白，把角色名和文件名换掉：

   > 你是 Forma 项目的 backend。读 `docs/collaboration/agent-prompts/02-backend.md`，严格按它工作。
3. **shell 写好 `src/components/README.md` 之后，开 features。** 页面多的话开两个，开场白里分别说"你是 features-a"和"你是 features-b"。
4. **第一个纵向切片跑通后，开 qa。**

## 每轮继续（发给任意一个已经开过的 agent）

> 继续你的角色工作。先读 `AGENTS.md`、`docs/collaboration/TASKS.md`、你自己的 status 文件，以及 `requests/` 里发给你、还没有回复的请求。然后做你名下下一个 todo 或 doing 的任务。完成后更新 status，只提交你自己路径下的文件。

推荐的节奏：

1. 让每个 agent 跑完一轮；
2. 让 lead 跑一轮，收请求、更新任务板、跑构建；
3. 再让其他 agent 跑下一轮。

## 精简版（3 个 agent）

不想开 6 个的话，可以两两合并。开场白改成"读 A 和 B 两份 prompt，你同时担任两个角色，可写路径是两者之和"，并让 lead 在 TASKS.md 的所有权表里写明合并关系。

| agent | 合并的角色 |
| --- | --- |
| lead | lead + qa |
| backend | backend + rules |
| frontend | shell + features |

## 工具分配（建议，不是硬性要求）

每个角色用 Codex 或 Claude Code 都可以跑。参考上一轮评审的分工，可以这样分：

- lead、backend：Codex
- rules、shell：Claude Code
- features：都可以
- qa：Claude Code，它有内置浏览器，可以截图检查 375px 和 1440px 的布局

lead 最好用你平时沟通最多的那个工具。

## 注意

- `C:\Users\devin\AGENTS.md` 是家具设计项目的指令，Claude Code 在这个目录下也会读到它。根目录的 `AGENTS.md` 已经写明要忽略它；更稳妥的做法是把那个文件移到家具项目自己的目录里。
- 同一路径同一时间只有一个 agent 写。所有 agent 共用一个工作目录，靠所有权表避免冲突，靠 git 提交留痕和回滚。
- dev 服务的端口 3001 和 5173 是固定的，同一时间只能跑一份。
- agent 之间不会自动通信，靠你按上面的节奏轮流发"每轮继续"。
- iOS / HealthKit 这一阶段不开 agent。等网站的主流程跑通、你确认了 Apple Developer 会员之后，再加 ios 角色（可写 `ios/`，只通过 `docs/architecture/api.md` 对接后端）。
