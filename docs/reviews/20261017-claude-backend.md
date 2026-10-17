# CB-17 报告：同步提交后附件清理的持久重试（Claude backend，2026-10-17）

绑定：HEAD `d509bc9538d21f3399fadadc6470f49c4f9a8ebc`（产品 = b27c3cc）+ 未提交 diff `server/store.ts`、`server/app.ts`、`server/approval-failure-recovery.test.ts`。当前最终 diff 为 `forma-claude-evidence-20261017/backend/changes-r2.patch`（SHA-256 `16264796…5928`）；第一轮 `changes.patch`（`5454a21a…2c09`）保留为历史证据。执行会话 `a02c2fec-4908-4d91-972a-06c1f05c67c8`。

## 已读技能与适用

- backend-patterns：事务边界、集中错误处理、可重试操作幂等；不用 Supabase/Redis/Next 示例。
- security-review：身份只来自会话 owner、参数化 SQL、错误不回显健康内容；旧版 `$1`/RLS 示例不适用。
- database-migrations：新增表仅增量、无数据回填、有回滚说明、合成数据验证；PostgreSQL CONCURRENTLY/ORM 不适用。

## 缺陷（已证实）

`Store.sync` 在一个事务内提交 state/revision/entity versions/hash receipt，随后 `app.ts` 才按内存中的 previous→next 差异删除附件。删除失败返回 500；同 mutationId 重放命中 receipt 后没有 previous，不再清理，旧照片 GET 200。重启后同样丢失。红例见 `red-approval-failure.log`。

## 设计

1. 新表 `asset_cleanup_intents(owner_id → accounts ON DELETE CASCADE, mutation_id, asset_id → assets ON DELETE CASCADE, created_at, PK(owner_id,mutation_id,asset_id))` + `asset_id` 索引。
2. 记账：`Store.sync` 在同一 `BEGIN IMMEDIATE` 事务内、receipt 插入后，对「previous 的 meals/reports 引用 − next 引用」逐个 `INSERT … SELECT FROM assets WHERE owner_id=? AND id=?`。因此只记本 owner 实际存在的、确切被移除的附件；新上传候选、编辑器/离线队列持有但从未保存的附件、在同一 mutation 中移到另一记录的附件都不会记入。意图写失败则整个提交与 receipt 回滚（合成 ABORT 已验证）。
3. 消费：`/api/sync` 在新提交与同 hash receipt 重放后都调用 `finishMutationCleanup(owner, mutationId)`，只处理该 owner+mutation 的意图。每条在 `completeAssetCleanup` 的 `BEGIN IMMEDIATE` 内：先确认该 owner+mutation+asset 的精确意图存在，不存在则无副作用返回 false（第二轮补充，见下）；再重查 owner 最新引用（沿用 b27c3cc 的跨 Store 保护，抽成 `deleteUnreferencedAsset`）；仍被引用则保留附件、删除本条意图；无引用则删 asset 行与文件；失败则回滚、意图保留。不同 hash 的 receipt 仍 409，不触发清理。
4. 同一 asset 多 mutation：主键含 mutation_id，旧重放只删除自己的那条，不影响较新 mutation 的意图；附件真正删除时由外键级联退役所有指向它的意图。
5. 重复/并发：每条消费各自持写锁，附件已不存在时返回 false 并删除本条意图，可重复执行；两个 Store 消费同一意图安全（已测）。
6. HTTP 契约不变：清理失败仍 500，提示客户端以同一 mutationId 重试；成功重放仍 200 且响应体与提交快照一致、revision 不变。没有新路由、新字段或客户端改动。

## 前后兼容与回滚

- `CREATE TABLE/INDEX IF NOT EXISTS` 在构造函数执行，旧库打开即增量建表；不迁移、不改现有表与数据。
- 回退到 b27c3cc 代码：旧代码忽略此表，不会因它出错，但旧代码也不会消费其中尚未完成的清理意图——这些附件会保留到重新部署新代码并重放对应 mutation。若 `DROP TABLE asset_cleanup_intents`，未完成的意图随之丢失，相应附件将无法再按意图清理，因此回退并非无代价；未完成的意图应先保留或另行处理。本轮未执行任何生产 DROP 或迁移。
- 兼容边界：修复前已经失败、只留下 hash receipt 的历史事件没有记录原 asset 列表，重放不会也不能恢复其清理；不以扫描无引用资产作为补救。
- 不声称 SQLite 与文件系统跨资源原子：行删除与 `rmSync` 在同一事务中，`rmSync` 抛错会回滚行与意图；但若文件已删而 COMMIT 失败，会留下无文件的行（GET 会报错）。该窗口与修复前相同，未扩大。

## 测试（全部实际运行，合成账号/临时 SQLite/注入 AI HTTP）

新增于 `server/approval-failure-recovery.test.ts`：
- HTTP：故障下首请求 500 且已提交；故障持续时重放仍 500（可重试）；另一账号用同 mutationId 非 200 且不影响本 owner 附件、无法读取；故障解除后重放 200、旧图 404、新图与未保存候选 200、二次重放幂等、导出只含剩余附件/草稿、未额外调用 provider。
- HTTP：首请求失败后关闭并重新打开 app/Store，重放完成清理。
- Store：精确范围（移到 report 的、未保存候选、他人 owner 均不记）；第二 Store 后续新增引用时保留附件并只消费该意图、重复消费 no-op、后续真实移除记新意图并可由另一 Store 消费；同一附件旧/新两个 mutation 意图互不丢失；意图写入 ABORT 回滚整个提交与 receipt；删除失败保留意图与字节，peer Store 恢复。

第一轮结果：红 exit 1（2 个产品断言失败）→ 绿 11/11 exit 0 → 原独立复现 1/1 exit 0 → 全量串行 213/213 exit 0（仅对应第一轮 diff）。

## 第二轮：`completeAssetCleanup` 精确意图边界

- 核实：第一轮实现在删除前没有检查意图是否存在，只检查最新引用。Store 层合成断言证实，对本 owner 未保存的候选附件传入随机 mutationId，方法返回 true 并删除了附件（`r2-red-exact-intent.log`，exit 1，`true !== false`）。
- 影响范围：这是 Store 方法边界缺陷。当前 HTTP 唯一调用方 `finishMutationCleanup` 只遍历 `assetCleanupIntents(owner, mutationId)` 返回的 asset，HTTP 请求无法传入任意 assetId，本轮未证实可从外部利用。
- 最小修复：在同一写锁事务内先 `SELECT 1 FROM asset_cleanup_intents WHERE owner_id=? AND mutation_id=? AND asset_id=?`，不存在则直接返回 false，无副作用。`deleteAsset` 接口、保留策略、HTTP 契约不变。
- 新增覆盖：无意图的未保存候选、错误 mutationId、正确 mutationId 但未移除的 asset 均不删除且不影响真实意图；正确意图完成一次、重复处理为 no-op；字节逐字节比对。
- 结果：绿 12/12 exit 0（`r2-green-exact-intent.log`）；最终全量串行 214/214 exit 0（`r2-full-suite.log`）。原有跨 owner、最新引用、多 mutation、重启回归均在其中通过。

HTTP 用例在随机 loopback 端口启动临时 app/API fixture，结束后关闭并删除临时目录；未启动持久开发服务（3001/5173）。命令与日志见 status 文件。

## 未覆盖与限制

- PUT `/api/state`（`app.ts` 中 `store.save` 后 `cleanRemovedAssets`）：静态分析显示提交后清理失败时同样会返回 500，且该路径没有 mutationId/receipt，按代码客户端以旧 revision 重试会得到 409，旧附件可能残留。以上仅为静态分析，本轮未对 PUT 做故障注入。本轮不设计或实现该路径的恢复语义；sync 修复不依赖它，PUT 现有行为与测试未回归。
- 未运行 build/tsc（工作区缺用户删除的 `src/catalog/exercises.json`）、浏览器、真实 AI、生产数据。
- 未验证进程崩溃发生在 COMMIT 与文件删除之间的真实断电场景，只用 SQL 触发器模拟故障。
- JSON 导出只含附件元数据/引用，不含图片/PDF bytes，也不含客户端未同步队列，不是完整备份。
