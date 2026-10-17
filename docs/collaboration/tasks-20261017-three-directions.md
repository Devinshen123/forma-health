# FORMA 三方向实际任务 · 2026-10-17

本轮用户已授权实际派发并执行前端、后端、测试审查任务，覆盖上一文档轮“只读、不开发”的阶段限制；其余安全边界继续有效。产品基线 `367ae3e`、文档基线 `0c39cfa`。三个任务使用独立本地分支和现有隔离 worktree，不合并主分支、不上传、不部署。任务派发不等于开发完成。

开工先读当前 worktree 的 AGENTS.md、CLAUDE.md、[PROJECT-STATUS](../PROJECT-STATUS.md)、[SKILLS-HANDOFF](../SKILLS-HANDOFF.md) 与本文件。技能文件必须先实际读取，再按适用条目执行；状态中记录读取的准确路径。Codex 提示词可写 `$playwright`、`$tdd`、`$backend-patterns`、`$security-review`，这些是技能名，不是 PowerShell 命令。未注册时直接只读对应 SKILL.md。若路径缺失、不可读、工具缺失或来源冲突，停止依赖该能力的操作，报告具体路径与影响；继续独立可做部分，不安装、不运行未知脚本、不关闭 sandbox。

共同限制：仅合成账号、临时 SQLite、合成附件与 mock AI；不读用户真实 data/ 或 .env，不接真实供应商、健康接入、邮件、付费 AI、Apple/HealthKit，不改凭证或权限。保持 Showroom/视频服务、标签与 GPU 独立。测试并发 1，不同时跑三份完整测试或构建；浏览器禁 GPU。依赖沿用已存在的 node_modules，不安装。

本轮实测补充：共享安装目录已有缺件，原始命令会在启动阶段失败，不能算产品红例。测试使用独立 `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-runtime-20261017`，10个包均由本机缓存按 package-lock 版本与 SHA-512核对后解出，`provenance.json` 可查；无下载、安装钩子或共享目录修改。下面验收命令需在单独测试进程设置这两个进程级变量，不改系统/用户环境变量；没有该运行区时先报告工具缺失，不假装原命令可运行：

```powershell
$env:ESBUILD_BINARY_PATH = 'C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-runtime-20261017\node_modules\@esbuild\win32-x64\esbuild.exe'
$env:NODE_OPTIONS = '--import=file:///C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017/runtime-hook.mjs'
```

四项用户删除及未跟踪 AGENTS 保留，不恢复、不暂存、不覆盖。任务工作区同样带着这些删除，当前不可宣称 build 通过。禁止为让 build 变绿恢复 `src/catalog/exercises.json`；审查只诊断依赖并提出方案，改变删除意图须报告。若局部浏览器流程因缺失动作库也无法运行，交付具体阻塞、已执行的非浏览器回归和可审阅补丁，不假装已验收。

## F-17：Sleep / Reports 旧编辑与确认快照

- 分支：`codex/forma-sleep-report-lifecycle-20261017`。
- 工作区：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-record-flows`。
- 优先现有会话：Forma 前端开发 / `01a148dd-26a1-7812-a1fd-e10d8f096bd5`。若会话服务不可用，由总控明确指定本地执行 agent；不可同时双写。
- 独占可写：`src/features/Sleep.tsx`、`src/features/Reports.tsx`、`tests/browser/sleep-report-lifecycle.mts`、`docs/collaboration/status/frontend.md`；其他产品代码只读，共享契约先报告。

证据：Sleep 打开编辑/删除只保留旧对象，保存却使用最新集合；Reports 同样缺少 RecordDraft。App 每15秒/online刷新且每次渲染提供最新 writeContext，旧弹窗可能借新 CAS 覆盖、复活或删除未重新审核的新值。先以合成数据复现，再按既有 RecordDraft 方案最小修复；不重复改已修训练/饮食流程，不扩展功能。

执行前必须读取：

| skill | 本次触发 | 已验证本地路径 |
|---|---|---|
| `playwright` | 真实 DOM 的旧编辑、删除确认、取消与恢复验证 | `C:\Users\devin\.codex\skills\playwright\SKILL.md` |
| `tdd` | 保存可复现失败→最小修复→通过证据 | `C:\Users\devin\.codex\skills\tdd\SKILL.md` |
| `security-review` | 跨账号草稿与私有报告附件边界 | `C:\Users\devin\.codex\skills\security-review\SKILL.md` |

`frontend-design` 仅在确需 UI 结构/提示调整时读取 `C:\Users\devin\.codex\skills\frontend-design\SKILL.md`；保持现有设计规范，不借机改版。security-review 是已核实的旧版，详见技能指南，不能把其 SQL 示例参数展开当成可直接执行代码。

验收：旧编辑遇后台更新/删除不覆盖、不复活；旧删除确认不删新版；关闭/取消不写入；无关记录新增不阻止本条操作；不确定保存重试沿用原请求，取消不误删被排队引用的附件。睡眠合成时间避免重叠掩盖问题，报告核对 markers/assetId 和服务端最终值。至少提供修复前失败与修复后浏览器证据；浏览器若被缺目录阻塞则准确报告。

命令边界：先 `git diff --check`；可用时 `node --import tsx tests/browser/sleep-report-lifecycle.mts`（该脚本由本任务交付，不能声称已存在或已通过）。完整 `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` 由总控与审查安排一次串行执行。build 已知受用户删除阻塞，不自行恢复文件或更改导入以掩盖。

交付：独占路径的本地提交、补丁、复现/验证日志、状态文件；只提交自己的文件，排除四项删除和 AGENTS。无缺陷则交付可证实的回归结果，不强行改产品。

## B-17：AI 批准事务与附件清理故障恢复

- 分支：`codex/forma-approval-failure-recovery-20261017`。
- 工作区：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-review-recovery`。
- 优先现有会话：Forma 后端开发 / `01a148dd-3a73-7261-b95c-433fb7d3bbc6`；会话不可用时总控指定唯一替代执行者。
- 独占可写：`server/approval-failure-recovery.test.ts`、确有失败时的 `server/app.ts` / `server/store.ts`、`docs/collaboration/status/backend.md`。不改 rules、客户端契约、依赖或 schema；若需扩展先报告。

实际批准路径是 Nutrition → POST /api/sync → validateOwnedState → Store.sync；没有独立批准 API。已有测试覆盖一般 CAS、receipt 与附件引用，不重复凑数。新边界：提交后 cleanRemovedAssets 失败时重试能否清理；两个 Store 之间提交/清理间隙是否删新引用；sync_mutations 写入中途 SQL 失败是否完整回滚。三者先做确定性故障注入，只有实证缺陷才最小修复。

执行前必须读取：

| skill | 本次触发 | 已验证本地路径 |
|---|---|---|
| `backend-patterns` | Express 错误、事务、幂等回执与清理恢复 | `C:\Users\devin\.codex\skills\backend-patterns\SKILL.md` |
| `security-review` | 账号所有权、AI provenance 与私有附件生命周期 | `C:\Users\devin\.codex\skills\security-review\SKILL.md` |
| `tdd` | SQL故障/竞态失败证据及 HTTP 回归 | `C:\Users\devin\.codex\skills\tdd\SKILL.md` |

仅若发现必须修改 schema，再读取 `C:\Users\devin\.codex\skills\database-migrations\SKILL.md` 并先报告；本任务不预授权生产迁移。采用 node:sqlite 的参数绑定与事务，不照搬 Postgres / Supabase 例子。backend-patterns、database-migrations 与固定 ECC 公开提交对应；security-review 为旧版，来源与许可见技能指南。

验收：临时库触发器在 receipt/entity 写入注入 RAISE(ABORT)，state/revision/entityVersions/receipt 不部分提交，解除故障后同 mutationID 可成功一次；提交后清理失败的精确状态有 HTTP/SQLite 证据；跨实例引用不得被旧清理删掉，已确认引用附件仍可读取。不得删除仍被引用的资产，不调用真实 AI。不明确的清理保留策略或契约变化先报告。

先串行运行 `node --import tsx --test --test-concurrency=1 server/approval-failure-recovery.test.ts`；完成后通知总控安排全量命令，不能与另两方向同时跑完整套件。后端发生产品改动时须最终执行全量 `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts`（可由总控在其分支执行并注明证据）。不跑 build。

交付：故障前后证据、局部/全量结果、本地提交与补丁、状态；无产品缺陷时交付有意义的新回归测试，不制造功能。

## Q-17：跨方向审查与缺失目录诊断

- 分支：`codex/forma-three-direction-review-20261017`。
- 工作区：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-health`。
- 优先现有会话：Forma 代码审查 / `01a148dd-4bf0-7eb0-9289-48288bef781c`；会话不可用时总控指定唯一替代执行者。
- 独占可写：`docs/reviews/20261017-three-direction-review.md`、`docs/collaboration/status/qa.md`、必要独立 `tests/browser/three-directions-review.mts`。产品代码只读，不直接替前后端修复，不合并他们的分支。

执行前必须读取：

| skill | 本次触发 | 已验证本地路径 |
|---|---|---|
| `playwright` | 检查与重放合成账号、离线队列、取消/确认、附件场景 | `C:\Users\devin\.codex\skills\playwright\SKILL.md` |
| `security-review` | 独立复核账号、附件、回执和故障恢复 | `C:\Users\devin\.codex\skills\security-review\SKILL.md` |
| `tdd` | 核对失败能否证明缺陷、测试是否有意义 | `C:\Users\devin\.codex\skills\tdd\SKILL.md` |

审查前后端指定提交的差异与测试，不把既有历史结果算本轮实测；报告触发、影响、路径行号。检查缺 `src/catalog/exercises.json` 的导入链和构建影响，区分“文件删除决定”和“产品缺陷”，不恢复、不生成替代真实目录、不用空数据掩盖。可运行一次 `npm run build` 记录确切错误，但须与总控协调，不能宣称通过；若无需运行即可确认，则给出静态证据并标为未执行。

先做只读审查与本地mock可用性盘点；等待前后端提交和总控测试时段后执行局部 HTTP / 浏览器回归。完整套件仅执行一次并发1，记录工作区、SHA、命令、计数及限制。真实 AI、外部供应商、生产服务、Safari/iPhone 均未验证；移动视口只标模拟。最后交付审查报告与本地提交，用户删除保持不动。
