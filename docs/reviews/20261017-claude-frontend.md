# CF-17 Claude 前端独立复核报告（Sleep / Reports 生命周期）

- 执行：真实 Claude Code 会话 `bb523eca-ef12-424d-8f35-0b01a1d4d551`，2026-10-17 22:25–22:28 UTC。
- 代码：HEAD `06dc8ea71b655896fd97bf14288f20fd58128216`；被测产品 `src/features/Sleep.tsx`、`Reports.tsx` 与 `2786a33` 相同；唯一未提交改动为本报告、状态文件和测试脚本 +63 行。
- 历史与本次区分：`2786a33` 的修复、2 个真实红例与 13/13（`forma-task-evidence-20261017/frontend/final-13`）为 Codex 历史结果；下文数字全部是本次 Claude 实跑。

## 结论
没有发现新的可复现产品缺陷，因此 **没有产品 diff**。`2786a33` 的 RecordDraft 守卫在原13案和新增5案的覆盖空白上均保持数据安全。

## 复核方法
1. 静态阅读 `recordDraft.ts`、`attachmentLifecycle.ts`、两组件守卫 diff 及 `SyncEngine` 冲突路径，列出原 13 案未覆盖的路径。
2. 未改脚本先复跑既有基线：13/13，exit 0（`baseline-13`）。
3. 只追加协调者指定的三类高价值空白，先过滤跑新案，再无过滤全量。

## 新增回归与观察
| 用例 | 场景 | 实际结果 |
|---|---|---|
| sleeps/reports-stale-delete-confirmation-remote-delete | 删除确认打开期间记录在别处被删除，再点 Delete | 断言：服务端仍为空集合、revision 不变。条件断言：对话框若仍打开，则须有 alert 且点 Keep 后关闭；对话框直接关闭也允许。仅记录不断言：结果字段 `writes`（页面 POST /sync 次数）本次为 0，`dialogStayedWithAlert` 本次为 true |
| sleeps/reports-own-uncertain-save-then-remote-change | 自身保存服务端已接受但响应丢失→恢复同步确认→另一端再改同记录→旧编辑器再修改保存 | 被拦截，服务端保持远端值（quality 2 / marker 30），alert 含 changed；Cancel 安全；报告原附件 GET 200 |
| reports-uncertain-attachment-conflict-cancel | 新附件上传成功、sync 写入未发出（排队）→另一端改同报告→恢复联网时排队写入得到 409→取消编辑器 | 409 冲突未覆盖远端；服务端为远端值；排队写入引用的新附件 GET 200 且字节一致；原附件仍 200 |

最终全量 `final-18`：18/18，pageErrors 0，exit 0。截图在 `final-18/*-guard.png` 与 `reports-uncertain-attachment-conflict-cancel.png`。

## 观察到但不判为缺陷
- 远端已删除时旧删除确认提示“已在另一处变化”，并非“已被删除”；无数据写入，无安全问题，不在本轮范围，仅作观察。
- 冲突案取消后新附件被保留：本地排队写入仍引用它，当前保留是安全方向，本轮不改变保留政策。若用户之后在冲突审核中放弃本地版本，这个新上传附件可能没有任何服务端引用。这属于独立、未验证的“冲突放弃 / 上传生命周期”范围，与 CB-17 已证实的缺陷（服务端记录 previous→next 移除引用后清理失败、需持久重试）不同；不能认为 CB-17 会清理这些候选资产，也不应批量扫除它们。
- 排队写入遇 409 后的审核 UI（SyncPanel）不在 harness 中，未验证用户解决冲突后的最终状态。

## 未验证 / 限制
- **新案对旧版的敏感性未实证（可选实验，未执行）**：用 `2786a33^` 组件临时替换后跑新案、再 `git checkout` 还原的整条命令，在执行前被 Claude CLI 权限规则拒绝（不是产品红例，也不是本机自动审批审查拒绝）；命令未执行，产品文件未触碰，未重试、未绕过。新案在修复前是否失败没有证据；远端删除案按代码推断在修复前也可能通过（filter 后不产生写入）。
- 仅系统 Edge 1280×900 组件 harness；未跑 390 视口（未发现具体疑点）、完整 App、跨账号外壳、build、tsc、npm test；不是 Safari/iPhone。
- 无真实 AI/供应商/生产数据。JSON 导出不含附件本体。

## 交付与归属
- 已完成：基线 13/13、新增5案 5/5、最终全量 18/18（均 exit 0）；测试脚本 +63 行；本报告与状态文件。
- 未验证：上列限制，以及冲突放弃后新上传附件的生命周期。
- 可选且未执行：修复前敏感性实验（见上）。
- 无待用户决策。用户已授权本轮测试/修复与本地交付；测试是否纳入提交由协调者按现有授权核对。本人未 stage / commit。
