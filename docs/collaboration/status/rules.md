# rules 状态

更新：2026-10-14 12:40 PDT。执行者：Claude Code（本机交互会话）。

- 依据：用户对 Q1–Q5 回复“全部同意继续工作把”。
- 已通知 lead：`requests/20261014-1205-claude-to-lead-user-decisions-and-rules-start.md`。
- 在 lead 于 TASKS 确认或改派之前，只写 `server/rules/`、`docs/rules/`、`docs/safety/` 和本文件。

## 正在做

等 lead 回复两份请求：角色确认，以及契约扩展和测试脚本。

## 已完成

- `server/rules/`：纯函数和测试，**未接入** `server/app.ts`。
  - `nutrition`：缩放、汇总（null 和 partial）、单位换算、宏量一致性检查。
  - `days`：时区、日期运算、按日汇总、完整度、睡眠按醒来日期归档并合并重叠。
  - `plan`：diff、取值范围、apply、base 检查、补偿式撤销。
  - `safety`：18 岁门槛、保守模式、引擎只能改训练时长和天数、上调幅度上限、过敏原提醒。
  - `engine`：3 条提议规则和 5 条行动规则，含去重、冷却期和上限。
  - `messages`：中英文模板。
- 文档：`docs/rules/README.md`、`docs/safety/safety-rules.md`（草案）。
- 验证（12:3x PDT）：

  | 命令 | 结果 |
  |---|---|
  | `node --import tsx --test server/rules/*.test.ts` | 42/42 通过 |
  | `npx tsc --noEmit`（全项目） | 退出码 0 |
  | `npm test` | 57/57 通过 |

## 阻塞与请求

- `requests/20261014-1240-rules-to-lead-integration-and-contract.md`：测试脚本、Suggestion 和 Profile 的扩展、`GET /api/today`。
- **提交信息约定冲突（请 lead 定夺）**：用户本机有 Claude Code 的提交钩子，要求 conventional commit 格式（`feat:`、`docs:` 等），会拦截以 `[角色]` 开头的提交信息。因此我用 `feat(rules): …` 格式，角色写在 scope 里，正文中也注明 `Role: [rules]`。建议把 AGENTS.md §5 的约定改为 `type(角色): …`。
- 提交作者用一次性身份 `Claude Code <claude-code@local.invalid>`，与 Codex 的做法一致，没有修改 git 配置。

## 下一步（等确认后）

- 根据问卷生成初始计划草稿（需要体重和年龄字段，并经营养师审核）。
- 周回顾聚合。
- 化验单数值比较规则。

## 待用户决定

- 是否有公司（决定 Apple Developer 用组织还是个人身份）。
- 托管区域：美国还是欧盟。
- 营养师审核的人选和时间。在此之前，引擎不自动改动任何营养目标。
