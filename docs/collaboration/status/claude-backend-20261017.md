# Claude backend 状态 — CB-17（2026-10-17）

- 执行者：真实 Claude Code CLI 会话 `a02c2fec-4908-4d91-972a-06c1f05c67c8`（协调者已核实）。分支 `claude/forma-attachment-retry-20261017`，HEAD `d509bc9538d21f3399fadadc6470f49c4f9a8ebc`（产品代码基线 b27c3cc）。旧 Codex B-17 结果只作证据，不计为本会话执行。
- 已读技能（Read 绝对路径，未调用注册 slash skill）：`C:\Users\devin\.claude\skills\backend-patterns\SKILL.md`、`C:\Users\devin\.claude\skills\security-review\SKILL.md`、`C:\Users\devin\.claude\skills\database-migrations\SKILL.md`。
- 状态：review。mutation/receipt 路径的持久清理意图与重试已实现；第二轮补上 `completeAssetCleanup` 精确意图校验。未 commit/stage。

## 已完成（含实际命令与结果）

环境：协调者在进程内设置的 TEMP/TMP=`forma-claude-evidence-20261017\backend\temp-execute`、运行区 ESBUILD_BINARY_PATH/NODE_OPTIONS。证据目录 `..\forma-claude-evidence-20261017\backend\`。聚焦命令 `node --import tsx --test --test-concurrency=1 server/approval-failure-recovery.test.ts`；全量命令 `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts`。

### 第一轮（diff `changes.patch`，SHA-256 `5454a21a…2c09`）

| 步骤 | 退出码 / 结果 | 日志 |
|---|---|---|
| 红（产品未改） | 1；7 项 5 过 2 败：故障持续时重放仍 200（期望 500，未尝试清理）；重启后重放旧图 200（期望 404） | `red-approval-failure.log` |
| 绿第一次 | 1；10/11，唯一失败是测试辅助函数比较 null-prototype 行（值相同），已修测试 | `green-approval-failure-attempt1-test-helper-bug.log` |
| 绿 | 0；11/11 | `green-approval-failure.log` |
| 原独立复现 `reproduce-postcommit-cleanup.mts` | 0；1/1 | `standalone-repro-after-fix.log` |
| 全量串行 | 0；213/213（仅对应第一轮 diff） | `full-suite.log` |

### 第二轮：精确意图边界（diff `changes-r2.patch`，SHA-256 `16264796…5928`）

| 步骤 | 退出码 / 结果 | 日志 |
|---|---|---|
| 红（Store 层） | 1；12 项 11 过 1 败：对未保存候选用随机 mutationId 调 `completeAssetCleanup` 返回 true、附件被删 | `r2-red-exact-intent.log` |
| 绿 | 0；12/12 | `r2-green-exact-intent.log` |
| 最终全量串行 | 0；214/214 | `r2-full-suite.log` |

`git diff --check -- server` 通过。HTTP 用例在随机 loopback 端口启动临时 app/API fixture，测试结束由 `t.after` 关闭并删除临时 SQLite/上传目录；检查 TEMP 无残留。未启动持久开发服务（3001/5173）。未运行 `npm run build`/tsc（工作区缺用户删除的 exercises.json）、浏览器、真实 AI。

## 阻塞 / 请求

- 无权限或工具阻塞。
- PUT `/api/state` 同类问题仅静态分析，本轮未做故障注入，详见报告。

## 待决定

- PUT 路径的提交后清理恢复语义是否以及如何设计（本轮不设计/实现）。
- 已失败的历史事件（只存 hash receipt）无法恢复原 asset 列表，是否需要人工处置由用户/lead 决定，不用 GC 补。
- 若将来回退代码，表内未完成的清理意图如何保留/处理。
