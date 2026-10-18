# CF-17 Claude 前端复核状态

执行者：真实 Claude Code CLI 会话 `bb523eca-ef12-424d-8f35-0b01a1d4d551`（Opus 5.5）。分支 `claude/forma-frontend-recheck-20261017`，HEAD `06dc8ea71b655896fd97bf14288f20fd58128216`（协调者入口 MD 提交；Sleep/Reports 产品代码仍为 `2786a33`）。状态：**done（独立复核，无新产品缺陷，无产品 diff）**，测试时段已释放。

## 已读
AGENTS.md、CLAUDE.md、tasks-20261017-claude-frontend.md、TASKS.md 顶部、PROJECT-STATUS.md、SKILLS-HANDOFF.md、status/frontend.md（上轮 Codex 状态）、../forma-task-evidence-20261017/delivery.json。技能实际读取：
- `C:\Users\devin\.claude\skills\playwright\SKILL.md`：只采用真实 DOM 交互、交互后重新定位、留截图证据；不用其 npx 包装器，沿用既有 `.mts` + 系统 Edge。
- `C:\Users\devin\.claude\skills\security-review\SKILL.md`（旧版 ECC）：只采用账号/私有附件保留、错误不泄露条目；不照搬 Supabase/Postgres/Next 示例。
- 未读 frontend-design（未改错误展示）；未读 tdd（任务书不列必读）。

## 本次实跑（均为 Claude 本次执行，非历史 Codex 结果）
证据根：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-claude-evidence-20261017\frontend\execute-browser\`。命令均为 `node --import tsx tests/browser/sleep-report-lifecycle.mts`，进程环境由协调者设置 ESBUILD_BINARY_PATH / NODE_OPTIONS / TEMP；系统 Edge 无头、禁 GPU、1280×900、UTC、随机端口、临时 SQLite、合成账号/PDF。

| run | FORMA_TEST_OUTPUT | 结果 | 退出码 |
|---|---|---|---|
| 既有基线（未改脚本） | baseline-13 | 13/13，pageErrors 0 | 0 |
| 新增5案（FORMA_QA_MATCH 过滤） | new-gaps | 5/5，pageErrors 0 | 0 |
| 最终全量（无过滤） | final-18 | 18/18，pageErrors 0 | 0 |

`git diff --check` 通过。测试 diff 另存 `cf17-tests.patch`。

## 改动（未 stage / 未 commit）
仅 `tests/browser/sleep-report-lifecycle.mts` +63 行，新增：每页面 `stale-delete-confirmation-remote-delete`、`own-uncertain-save-then-remote-change`，以及 `reports-uncertain-attachment-conflict-cancel`。Sleep.tsx / Reports.tsx 未改。

远端删除两案的断言范围：断言服务端为空且 revision 不变；对话框若仍打开则条件断言 alert 并以 Keep 关闭（直接关闭也允许）；`writes`（POST /sync 次数，本次 0）只记录在结果中，未断言。

## 未验证 / 可选未执行
- 可选实验未执行：用 `2786a33^` 的 Sleep/Reports 临时替换后跑新案、再 `git checkout` 还原的整条命令，执行前被 Claude CLI 权限规则拒绝（非产品红例，非本机自动审批审查拒绝）；未执行、未重试、未绕过，产品文件未触碰。新案对旧版的敏感性未实证。
- 冲突放弃后新上传附件可能无服务端引用：独立、未验证的冲突放弃/上传生命周期范围，与 CB-17 的 previous→next 清理持久重试缺陷不同；本轮不改变保留政策，当前保留是安全方向，不应扫除。
- 组件 harness 不含完整 App、SyncPanel 冲突审核 UI、跨账号外壳；未跑 build / tsc / 全量 npm test；未跑移动视口；不是真机 Safari/iPhone。
- 四项用户删除与未跟踪 AGENTS.md 原样保留。

## 待决定
无待用户决策。测试是否纳入提交由协调者按现有授权核对；旧确认文案仅作观察。测试时段已交还，本轮之后未再运行测试/服务。
