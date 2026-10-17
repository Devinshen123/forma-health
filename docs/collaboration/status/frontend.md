# F-17 前端执行状态

分支 `codex/forma-sleep-report-lifecycle-20261017`；目录 `forma-record-flows`；开工 HEAD `33f1256`。唯一执行者为总控指定的 frontend_task，未对旧角色会话重复下发开发。

已实际读取本区 AGENTS.md、CLAUDE.md、TASKS.md、三方向任务书、PROJECT-STATUS.md、SKILLS-HANDOFF.md，以及：

- `C:\Users\devin\.codex\skills\playwright\SKILL.md`：真实组件 DOM 交互与证据；本次已明确要求交付测试脚本，使用既有 Playwright/系统 Edge，不调用下载包装器。
- `C:\Users\devin\.codex\skills\tdd\SKILL.md`（及 tests.md、mocking.md）：按已授权的真实 Sleep/Reports DOM 与 HTTP 公开边界验证失败→修复→通过，不测内部 guard 实现。
- `C:\Users\devin\.codex\skills\security-review\SKILL.md`：账号及报告私有附件生命周期；该本机文件为指南标注的旧版，只采用适配 React/Express/SQLite 的条目。

技能均存在、可读；npx 存在，但本轮不安装依赖/技能、不运行来源脚本。为补现有弹窗的过期提示，另实际读取 `C:\Users\devin\.codex\skills\frontend-design\SKILL.md`；按用户范围保留既有样式，不做改版。没有 schema 变更，不使用数据库迁移技能。

已静态确认：Sleep/Reports 打开编辑与删除时保留对象，保存时借最新集合与 CAS，缺少已用于其他页面的 RecordDraft 检查。正在准备仅挂载真实两组件、SyncEngine 和独立临时 API/SQLite 的浏览器脚本；不导入完整 App/Training，不创建替代动作库。

验证准备：`node --check tests/browser/sleep-report-lifecycle.mts` 及 `git diff --check` 通过。尝试只读 TypeScript `transpileModule` 检查时发现共享依赖缺 `typescript/lib/typescript.js`（MODULE_NOT_FOUND）；这属于运行时缺件，不是产品失败证据。总控另已查到 esbuild.exe / Sharp 原生模块缺失，要求暂不启动 fixture，正在核对既有完整运行时。

恢复过程：总控将本机缓存的精确锁版本包逐项 SHA-512 核对后解到独立 `forma-task-runtime-20261017`，无下载/安装脚本/共享依赖修改；已实际读取该区 runtime-hook.mjs 和 provenance.json。本命令以 ESBUILD_BINARY_PATH / NODE_OPTIONS 使用仅当前进程的解析映射；harness 为同版本 ReactDOM 加测试专用 alias/dedupe，显式预打包 React/JSX/ReactDOM/lucide 且禁止扫描完整 App。cacheDir、随机 SQLite、Edge profile、TEMP/TMP 全在本任务证据目录。普通受限 Edge 启动失败后，工具批准 require_escalated 的独立本地测试运行；未关闭或操作已有会话。

静态证据已写入 `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-task-evidence-20261017\frontend\static-checks.json`：2026-10-17 21:44:55 UTC，Node v26.1.0，语法/空白检查 exit 0；上述 TypeScript、`@esbuild/win32-x64/esbuild.exe`、`@img/sharp-win32-x64/lib/sharp-win32-x64.node` 实际 Test-Path 均 false。回归脚本准备 13 项检查，但不能标记为执行通过。

真正产品红例：`frontend/baseline-both/results.json`、同级 baseline-both.log 和两张 PNG。系统 Edge 真实组件/SyncEngine/HTTP/临时 SQLite 中，旧睡眠草稿把后台 quality=2 覆盖为5；旧报告草稿把后台 marker=20 覆盖为11（附件ID保留）；两案均实际失败。此前 Edge 启动/测试入口预打包/locator 失败分别留存，属于环境或测试准备错误，未计入产品红例。

据此对 Sleep/Reports 各加18行：编辑、删除打开时建立独立 RecordDraft；提交前核对当前同 ID 记录；保存前记 submittedValue、状态更新时 observe 自己的不确定提交值；删除提交记 undefined。保留报告现有 AttachmentLifecycle 的排队引用保护。不改共享契约、不扩展功能、不把整集合变化当成单条冲突。

总控确认 QA 的后端全量时段释放后，实际执行 `node --import tsx tests/browser/sleep-report-lifecycle.mts`，输出 `FORMA_TEST_OUTPUT=...\forma-task-evidence-20261017\frontend\final-13`，不设置过滤条件。命令进程设置 `ESBUILD_BINARY_PATH=...\forma-task-runtime-20261017\node_modules\@esbuild\win32-x64\esbuild.exe`、`NODE_OPTIONS=--import=file:///C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017/runtime-hook.mjs`，TEMP/TMP 为本任务 `frontend\temp`；没有更改全局变量。

**最终 13/13 通过，pageErrors=0，命令 exit 0。** 证据为 `frontend/final-13/results.json`、同级 `final-13.log` 和6张 guard PNG。每页面6案：旧编辑遇更新、旧编辑遇删除、旧删除确认、取消/无关记录、自身不确定保存重试、自身不确定删除重试；另1案核对报告取消不删被排队引用的合成 PDF，恢复同步后 assetId/markers/附件字节一致。已视觉查看报告过期删除提示截图。系统 Edge，1280×900，UTC；本次不是移动视口或真机验证。

TypeScript 5.9.3 三文件 transpile 语法检查0错，Node语法与 `git diff --check` 通过。额外执行仅 Sleep/Reports 及其导入图的语义检查，结果仍有3个 TS2307：共享 `lucide-react` 类型声明缺失（Modal、Sleep、Reports各一），见 `frontend/focused-typecheck.json`；未通过该项，不能把语法检查说成完整类型检查。没有为此修改共享依赖或恢复用户文件。

自有 Edge/API/Vite 已在 finally 关闭，并向总控释放时段。未执行本分支全量测试或 build，不能宣称当前工作区 build 通过。完整 App 因用户删除的动作库 JSON 未挂载，本脚本没有生成替代目录；全 App 导航、跨账号生命周期、真机 Safari/iPhone、真实 AI/外部供应商均不是本轮验证结论。四项原有删除和未跟踪 AGENTS 原样保留，不会纳入提交；未接触真实数据、AI、凭证、3001/5173、Showroom 标签/服务或 GPU。JSON 仍不包含附件本体，不能当作原文件备份。
