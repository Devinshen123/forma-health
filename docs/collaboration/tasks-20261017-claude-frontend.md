# FORMA CF-17 / Claude Code frontend

任务名：FORMA-Claude-Frontend-Recheck-20261017
工作区：C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-record-flows
分支：claude/forma-frontend-recheck-20261017
基线：2786a336edd15dc99803520417a3216d5855e1ac
拟传入CLI session ID：bb523eca-ef12-424d-8f35-0b01a1d4d551（只有CLI实际确认且模型接单才算派发成功）
## CF-17 具体目标与技能

必读 C:\Users\devin\.claude\skills\playwright\SKILL.md（真实DOM/旧编辑/删除确认/附件取消等回归）；C:\Users\devin\.claude\skills\security-review\SKILL.md（账号绑定、旧编辑器写入和不确定保存附件保留）。只有实际需要调整错误展示设计时再读 C:\Users\devin\.claude\skills\frontend-design\SKILL.md，不做视觉重设计。

复核上轮2786a33对 Sleep.tsx/Reports.tsx 各18行的RecordDraft保护，结合上轮2个真实红例、13项结果，确认旧编辑、远端改删、旧删除确认、Keep/取消、自身不确定提交重试、Reports附件保留均覆盖。不要重新实现已修问题凑数；先找覆盖空白或证据缺陷。确有可复现bug才最小修复。可写 src/features/Sleep.tsx、src/features/Reports.tsx、tests/browser/sleep-report-lifecycle.mts、自身新状态/报告；其他产品文件只读，需要改先报告。

获得时段后优先使用现有真实组件+SyncEngine+HTTP/SQLite Edge harness，独立输出到本轮证据目录。需要增加针对性场景可追加，但不要为缺catalog修改App/Training导入或恢复JSON。明确组件harness不包含完整App跨账号壳，不把模拟viewport称iPhone。若没有新bug，交付独立复核与实际回归即可，不制造代码diff。预期命令 node --import tsx tests/browser/sleep-report-lifecycle.mts，使用其FORMA_TEST_OUTPUT隔离输出；缺件先核查运行区，不下载。
## 执行者与先读要求

本轮必须由真实 Claude Code CLI 会话执行。协调者只准备任务和核对证据，不用 Codex/内部 agent 替代产品任务。既有长期 Claude 会话未找到可寻址活跃条目，因此新建明确命名会话；禁止改写或伪造历史。开工依次读取 AGENTS.md、CLAUDE.md、本任务书、docs/collaboration/TASKS.md 顶部、docs/PROJECT-STATUS.md、docs/SKILLS-HANDOFF.md、自身上轮状态，以及 ../forma-task-evidence-20261017/delivery.json。当前任务覆盖旧文档轮/旧 Codex 执行阶段限制；旧结果是证据，不是你的本次运行。

技能必须先实际读取以下 Claude 本地 SKILL.md，报告准确路径和适用规则。它们是现有公共技能文件的只读引用，不复制分发，不把 Codex 插件路径当作 Claude 注册。当前 CLI 若未注册 slash 名称，直接用 Read 工具读取绝对路径即可，不声称调用了已注册 skill。缺失/不可读先报告具体路径和影响，不安装、不更新全局目录。旧 security-review 的 SQL 示例有已知版本限制，不照搬 PostgreSQL/Supabase/Next.js 示例。未独立核实来源的 tdd 文件不列为本轮必读技能；仍采用真实失败→最小修复→回归的方法。

## 共同安全与所有权

仅在自己的实际 Git 分支和工作区操作；不切其他会话分支，不操作原健康网站、既有健康网站-worktrees 或 Showroom/Mail/视频工作区。保留四项用户删除：docs/design/dashboard-concept.png、docs/design/mobile-meal-concept.png、public/demo-meal.png、src/catalog/exercises.json；AGENTS.md 保持未跟踪，不恢复、不暂存、不以空JSON/占位声明掩盖错误。不读真实 data/、.env、凭证、浏览器真实账号/profile 或其他历史会话内容。

只用随机合成账号、临时 SQLite、合成图片/PDF、mock外部AI。禁止真实供应商、付费服务/健康接入/Apple/HealthKit、邮件发送、push、远程分支/PR、merge、部署、生产迁移、账号/凭证/权限设置变更、陌生软件安装。Claude Code 本身使用当前已登录的订阅和默认模型，不切换认证或修改设置。不执行 npm install/npx 下载，不启动固定3001/5173服务，不关闭他人标签/进程。仅关闭自己创建的 fixtures；浏览器禁GPU并用独立端口、临时profile与cacheDir。

先做 preflight：读取要求、检查自己的 branch/HEAD/status、识别上一轮已完成与本轮剩余，返回确认及执行计划；此阶段不改产品、不测试、不构建、不起服务。协调者以同一真实session的后续消息明确授予串行测试时段后再推进。每项目同时最多1个重测试/构建；不通过观察其他项目进程就自行抢占时段。

独立运行区 ../forma-task-runtime-20261017 已由协调者从本机cache按lockfile/SHA512核验10包，可读取 provenance.json 和 runtime-hook.mjs；不修改共享node_modules。后续测试进程仅临时设置：

```powershell
$env:ESBUILD_BINARY_PATH='C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-runtime-20261017\node_modules\@esbuild\win32-x64\esbuild.exe'
$env:NODE_OPTIONS='--import=file:///C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017/runtime-hook.mjs'
```

日志、结果、截图放自己的 ../forma-claude-evidence-20261017/<role>/；不得把运行器启动错误称为产品红例。结果绑定确切SHA及未提交diff，保留真实命令/退出码；未运行则写未运行。可写自身新状态 docs/collaboration/status/claude-<role>-20261017.md 和自身新报告 docs/reviews/20261017-claude-<role>.md。不要改其他方向状态、协调者任务书、入口和任务板。产品改动按下方所有权，暂不自动commit，由协调者核对路径后只提交本轮明确文件。

JSON导出包含记录和附件引用/元数据，不含图片/PDF bytes；服务端导出不含客户端未同步队列，不能称完整备份。交付要写已读技能、发现、最小diff、执行过的测试、保留改动、未验证事项及需要决策之处。