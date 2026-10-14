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

### 2026-10-14 13:20 PDT 增量

- lead 已确认 Claude Code 为 rules 所有者，并把 rules 测试加入 `npm test`。
- 新增：
  - `safety.ts`：`ageOnDate()` 和 `adultStatus()`，按完整出生日期精确判断，回应 lead 对“只有出生年份”的质疑；
  - `weekly.ts`：`weeklyReview()`；
  - `messages.ts`：周回顾的 6 个中英文模板。
- 已把用户对 Q6–Q9 的回答和对 M1 审查三点的答复写入 `requests/20261014-1300-rules-to-lead-user-decisions-q6-q9.md`。
- 验证：

  | 命令 | 结果 |
  |---|---|
  | `npx tsc --noEmit`（全项目） | 退出码 0 |
  | `npm test` | **106/106 通过**（其中 rules 49 项） |

## 阻塞与请求

- `requests/20261014-1240-rules-to-lead-integration-and-contract.md`：测试脚本、Suggestion 和 Profile 的扩展、`GET /api/today`。
- **提交信息约定冲突（请 lead 定夺）**：用户本机有 Claude Code 的提交钩子，要求 conventional commit 格式（`feat:`、`docs:` 等），会拦截以 `[角色]` 开头的提交信息。因此我用 `feat(rules): …` 格式，角色写在 scope 里，正文中也注明 `Role: [rules]`。建议把 AGENTS.md §5 的约定改为 `type(角色): …`。
- 提交作者用一次性身份 `Claude Code <claude-code@local.invalid>`，与 Codex 的做法一致，没有修改 git 配置。

## 下一步（等确认后）

- 根据问卷生成初始计划草稿（需要体重和年龄字段，并经营养师审核）。
- 周回顾聚合。
- 化验单数值比较规则。

## 待用户决定

- 已决定（用户 2026-10-14 在 Claude 会话中回答）：
  - 个人账号做内部测试；
  - 托管区域选美国；
  - 拍照识别用 OpenAI；
  - 域名等部署时再买。
- 仍未决定：
  - 营养师审核（Q10，用户还没回答）。在此之前，引擎不自动改动任何营养目标。
  - 提交信息格式：用户本机的钩子要求 conventional 格式，与 AGENTS.md 要求的 `[角色]` 开头冲突。lead 的意见是以项目规范为准，但钩子会直接拦截 `[rules]` 开头的提交，所以本次仍用 `feat(rules): …`，由用户定夺。
