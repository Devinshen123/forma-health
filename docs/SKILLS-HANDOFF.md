当前Claude执行补充：见 [真实Claude任务](collaboration/tasks-20261017-claude.md)。三个session均已通过CLI实际确认及模型Read；CF实际读Claude树playwright/security-review，CB读backend-patterns/security-review/database-migrations，CQ读security-review/backend-patterns/database-migrations/playwright。均按绝对路径读文件，不冒称slash技能注册，也不使用Codex插件作为Claude技能。旧Codex回执与旧会话不可用记录是历史阶段。

# FORMA 技能与会话接续

核对：2026-10-17 UTC。目标是让既有 Codex / Claude 按 FORMA 的实际源码选择技能；本轮只读核验与交接，不安装、不升级、不复制私人技能树，不执行其中的脚本。先读 [项目状态](PROJECT-STATUS.md)、`../AGENTS.md` 和 [任务板顶部](collaboration/TASKS.md)。

后续用户已授权实际三方向任务，上一段“只读”是文档轮历史。执行前须读 [三方向任务书](collaboration/tasks-20261017-three-directions.md) 中自己条目的 skill、触发、精确本地路径与缺失处理。当前前端实际读取 playwright/tdd/security-review/frontend-design（最后一项仅用于保持错误提示的原设计）；后端读取 backend-patterns/security-review/tdd；审查读取 playwright/security-review/tdd，三者均已回执，不因安装目录存在就推定使用。三个长期会话服务不可用时由任务板登记的本地 agent 执行，没有冒充长期会话已接新任务；旧交接的不确定补充没有盲重发。

## 本机已存在且可读

以下六项的 Codex 与 Claude `SKILL.md` 都已实际读取，两侧 SHA-256 相同。表中摘要只用于识别本机文件，不代表上游版本已锁定、技能已被会话调用或所有工具已执行成功。

Codex 路径：`C:\Users\devin\.codex\skills\<技能名>\SKILL.md`（目录为指向 `C:\Users\devin\.agents\skills\<技能名>` 的 junction）。Claude 路径：`C:\Users\devin\.claude\skills\<技能名>\SKILL.md`（独立副本）。没有把个人助手笔记、设置、凭证或历史对话放入本项目。

| 技能名 | 触发条件与 FORMA 用法 | 本机来源 / 许可证据 | SHA-256 前16位 |
|---|---|---|---|
| `frontend-design` | 明确的新界面或设计任务；保留现有 React/Vite、自定义 CSS、双语和手机交互，不自行换设计体系 | 本机 `LICENSE.txt` 为 Apache-2.0；未发现锁定的远程仓库与提交，不能仅凭名称证明与公开候选相同 | `B81E2FF87ED8FA4D` |
| `backend-patterns` | Express 路由、Zod 输入、事务、错误、CAS/幂等/回执；先读现有 server 实现 | 与公开 ECC 提交 `76aaa77` 逐字节对应；上游 MIT，当前本机目录未附许可。来源对应关系已核实，不证明最初安装渠道 | `9B983D0297A98311` |
| `security-review` | 账号边界、会话、私有健康记录、上传附件、导出、外部输入/AI 请求 | 与 ECC 历史提交 `3a46c82` 对应；属于旧版，缺少 SQL 示例参数展开修复，Claude 须留意字面 `$1` 被展开。本轮不更新共享文件 | `FE6F9151FB15C1DF` |
| `database-migrations` | 仅在明确数据库 schema/index/数据转换任务时使用；为 SQLite 设计事务、前后兼容、回滚与合成数据验证 | 与公开 ECC 提交 `76aaa77` 逐字节对应；上游 MIT / ©2026 Affaan Mustafa，本机有 `UPSTREAM_LICENSE` | `DAD2F1964295EEE1` |
| `playwright` | 表单、旧确认框、账号切换、断网队列、附件与移动视口真实浏览器回归 | 本机 NOTICE 指向 `microsoft/playwright-cli` 的 `skills/playwright-cli/SKILL.md`，标注 Codex 适配；Apache-2.0 | `C52CC95125B720CD` |
| `tdd` | 用户已明确要求缺陷修复/回归时，先有真实失败，再最小修复，再验证；避免镜像实现的测试 | 本机未发现可验证来源与许可；可读现有文件，不复制或声称供应链已验证 | `5505D25BBAA8FC14` |

上述路径可直接按技能名替换 `<技能名>` 打开，例如 `C:\Users\devin\.claude\skills\security-review\SKILL.md`。未来调用前重新确认文件和摘要，避免两个独立副本后续漂移。

## 按角色调用

| 现有角色 | 首选技能 | 适配重点 |
|---|---|---|
| 前端 | `frontend-design`；涉及行为回归时 `playwright` / `tdd`；账号/附件改动加 `security-review` | 遵循 RecordDraft / RecordBatchDraft 的当前值与已提交值边界，保留不确定保存的原请求；不要把视口模拟称为实机验收 |
| 后端 | `backend-patterns` + `security-review`；只有 schema 改动才加 `database-migrations` | Express/Zod/SQLite、账户所有权、原子批次、mutation receipt、附件引用；不能照搬 Postgres / Supabase 示例 |
| 代码审查 | `security-review`；按被审范围读取其余相关技能 | 结论绑定具体提交与证据；历史通过不等于当前脏工作区通过；只报告可证实的问题 |

Codex 可显式写 `$backend-patterns` 或 `$security-review`，并指定上述 `SKILL.md` 绝对路径；若当前会话注册表没有该名称，先按路径读取，不假装已成功加载。Claude 可用 `/backend-patterns`、`/security-review` 等已注册名称，或写“先读取 `C:\Users\devin\.claude\skills\backend-patterns\SKILL.md`，按 FORMA 的 Express / SQLite 实现处理”。斜杠命令是否在当前运行时注册，仍须由接收会话确认。

本机 `playwright` 偏 CLI / Bash 包装，带 `npx` 前置条件。本轮未执行，也不因指南自动下载包。此前三轮已证明可用的是现有 Windows Playwright `.mts` 脚本 + 系统 Edge；后续先沿用这一流程，单独测试、禁 GPU，使用隔离端口/临时 SQLite。不能占用或关闭 Showroom 的标签和服务。

React 性能补充可读原项目 `C:\Users\devin\健康网站\.agents\skills\vercel-react-best-practices\SKILL.md`。本机 `skills-lock.json` 指向 `vercel-labs/agent-skills`、`skills/react-best-practices/SKILL.md`，技能标注 MIT。它只在原项目目录已存在，未复制进当前隔离 worktree；只采用适用于 React 客户端的规则，跳过 Next.js RSC、Server Actions、`next/dynamic` 等不适用条目。原项目 `healthkit`、`swiftui-pro` 为未来原生任务；`i18n-expert` 仅在明确国际化任务时另审来源，不据目录存在就启用。

## 公开候选与安装边界

本轮已读取 `find-skills`，并实际读取集中发现报告 `D:\CodexTaskData\showroom-docs-skills-20261017\docs\SKILLS_DISCOVERY_20261017.md`。该报告先查 skills.sh，再用已缓存官方 `skills@1.7.2` CLI 实际执行 find，通过已连接 GitHub 的只读 REST / 仓库文件核对来源、许可和内容；没有新下载或运行候选脚本。核对时点 **2026-10-17 21:08–21:10 UTC**。stars 属整个仓库，是变化中的参考值，不是单技能质量、安全或兼容性保证，也不是 skills.sh 安装量。

| 公开来源 / 当时 stars | FORMA 选择与许可 | 安装 / 对应状态 |
|---|---|---|
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) **32,561** | [react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)，实际名 `vercel-react-best-practices`；用于 React 客户端性能。技能与仓库 README 标注 MIT | 原项目本机入口已存在，锁文件记录该来源；本轮未安装精确上游最新版，跳过 Next 专用条目 |
| [anthropics/skills](https://github.com/anthropics/skills) **181,772** | [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)；明确浏览器测试任务可另审 [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing)。两项各自 LICENSE.txt 为 Apache-2.0，仓库整体混合许可 | frontend-design 本机存在，但没有证明与此上游逐字节一致；webapp-testing 精确上游版未因此安装。其服务启动脚本须先另审，当前优先沿用既有 Playwright/Edge |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) **282,370**，社区项目 | [backend-patterns](https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/skills/backend-patterns/SKILL.md)、[database-migrations](https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/skills/database-migrations/SKILL.md) 适配 Express / SQLite；上游 [MIT](https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/LICENSE)，不是 Anthropic/OpenAI 官方 | 这两项本机 SHA 与固定提交对应；只读使用现有文件，不装整包，不启用 hooks/MCP。复制时须附许可与版权 |

本机 `security-review` 的准确公开对应为 [ECC 历史提交 `3a46c82b0c074d8c872be26b8141708c2771ab87`](https://github.com/affaan-m/ECC/blob/3a46c82b0c074d8c872be26b8141708c2771ab87/skills/security-review/SKILL.md)，不是最新版；尚未包含 [2026-09-12 参数展开修复](https://github.com/affaan-m/ECC/commit/afa5651e9fcd082ebdc6e8e21189ab491bed7234)。两侧本机摘要相同，不表示已更新。后续若获授权更新，应只更新指定副本、保留许可并重新核对，不在此次文档任务中改共享目录。

集中报告亦核对 [supabase/agent-skills](https://github.com/supabase/agent-skills) **2,859** stars、MIT；FORMA 使用 SQLite，因此不纳入本项目组合，不据此创建 Supabase 或迁移 Postgres。`openai/skills` 已标 DEPRECATED，集中报告不把它作为新的维护首选。本机 TDD 的独立来源与许可仍未确认，不能用 ECC 或其他高星仓库的数字替代证明。

本轮不需要新增安装。任何后续安装前应固定仓库、技能子路径和提交，读取实际 SKILL.md、LICENSE/NOTICE 与脚本，再决定项目级安装；不覆盖两侧全局技能，不运行未知安装脚本，不复制凭证/私人笔记。不因技能建议创建数据库服务或更换技术栈。

## 现有会话交接

本指南与 [CLAUDE.md](../CLAUDE.md) 已准备好。Codex 目标是已存在的三个独立工作区，只发送“读取并确认”的文档任务；不要求复制当前用户改动或合并分支，不创建新产品任务。

| 现有会话 / ID | 交接状态 |
|---|---|
| Forma 前端开发 / `01a148dd-26a1-7812-a1fd-e10d8f096bd5` | 消息工具确认已发送；21:16 UTC 已最终回执：读三份文档及 frontend-design / playwright / security-review，理解 React/Vite 适配，未开发，等待新任务 |
| Forma 后端开发 / `01a148dd-3a73-7261-b95c-433fb7d3bbc6` | 消息工具确认已发送；已回复将只读检查 backend-patterns / security-review / database-migrations，执行中，最终回执尚未确认 |
| Forma 代码审查 / `01a148dd-4bf0-7eb0-9289-48288bef781c` | 消息工具确认已发送；21:19 UTC 已最终回执：读文档、AGENTS/任务板及两侧 security-review / tdd，理解 SQLite 边界，未开发，等待新任务 |
| 既有 FORMA Claude Code 会话 | 未交付：CLI `2.1.293` 可运行，但 `claude agents --json` 返回空，`--all --json` 未找到 FORMA 可寻址会话；没有 Claude 会话消息工具。旧响应产物的 session ID 不能证明现在可续接，未强行 resume 或创建新会话 |

上述初次交接已发送三条。随后补入公开发现结果与旧 security-review 提醒；向前端发送该补充的工具调用持续无响应，停止等待后**执行结果不确定**，没有重发，未对另两会话重复启动交接。前端本地回执记录尚未出现该补充，因此不能宣称三个接收者都已确认公开来源更新。会话 API 曾返回 `Unavailable or failed hosts: local, durable`；不属于权限拒绝。新任务开始前须重读本指南，以其最新内容为准。

收到交接者只需读取本指南、项目状态和与角色相关的本地 SKILL.md，回报路径是否可读、适配边界和阻塞。没有授权开始产品开发、测试/构建、安装、服务或新子任务。交接消息已发送与接收者实际确认应分别记录；未找到 Claude 目标就是未交付，不能记为完成。
