# 训练增量同步与兼容契约提案

Owner: backend；2026-10-14。人类已授权训练五组增量；本文是契约提案，不是已实现接口。

## 问题

当前 `/api/state` 是账户内整份 JSON 的 revision CAS。`Workout.exercises` 只保存同重量的组数摘要，没有每组身份或完成记录；严格 Zod 不接受新训练字段。离线修改不能直接覆写最新 snapshot，否则会丢失另一设备的记录。

## 期望改动

请 lead 固定 src/types.ts / src/api.ts 和 ADR：

1. 保留现有 states/state_json 为 canonical，现有 Workout/Exercise 字段可读；逐组数据、动作引用和训练计划是明确的新字段。旧记录不可伪造逐组完成、实际休息或超级组信息。
2. 新增账户内实体版本、删除 tombstone 和幂等 mutation 账本。提议 GET /api/sync 返回 state/revision/entityVersions；POST /api/sync 提交 mutationId 和至多100个 collection/id/baseVersion/kind/value 变更，不能携带 owner/user_id。
3. 不同实体的修改可以在当前状态上合并，同实体版本不一致返回409及当前 snapshot/冲突标识。整个批次原子校验/保存，不能一半成功。幂等 ID 同内容重放无副作用；同 ID 不同内容409。删除也提升版本，阻止旧设备复活。
4. 原 PUT /api/state 继续用整体 revision CAS，并同步更新实体账本，避免旧页面绕过同步防护。
5. planVersions 只能 append；currentPlanId 独立版本 CAS；全部候选合并仍通过 stateSchema、validateTransition、owned assets 和真实 AI draft provenance。账户绑定、Origin/JSON、私有上传和 AI 预算逻辑保留。
6. 训练导入建议先支持已声明的 JSON/CSV，经预览确认再转成同一批次操作；不把外部 user_id、文件路径、assetId 或 AI provenance 当作可信来源。

完整类型、字段名和响应由 lead 决定；在收到契约前不改产品后端。

## 兼容与迁移

- 新 SQLite 表使用 CREATE TABLE IF NOT EXISTS，账户外键 cascade；迁移在本机原库上无损读取现有 workout 摘要。
- 新顶层训练集合在读旧 snapshot 时按契约补空，不能默默丢弃已有未知字段。
- 同步账本记录变更版本与 tombstone；不得记录密码/cookie或将健康内容输出到日志。
- 删除账户清理实体版本、幂等账及数据；独立全局 AI 预留仍保留既有语义。

## 验收 / 测试计划

- 两设备不同 workout：依次同步均保留；相同 workout：第二次409且数据未覆写；冲突批次零部分提交。
- 删除→离线旧更新：409且不能复活；新 ID 正常创建；幂等重放跨重启保持相同效果。
- 新协议→旧 PUT 和旧 PUT→新协议互操作；旧库读取与新增集合默认空。
- 新训练字段边界、重复 set ID、非法计划/动作引用、组类型和kg单位；不能制造旧记录完成信息。
- 原会话/跨标签账户绑定、CSRF、私有资产、AI provenance 与 append-only 计划全部继续有效。
- JSON/CSV导入失败不落库；成功导入只新增明确记录、重复导入可控。

本阶段不调用外部收费服务、不复制 openGym 代码/schema/媒体、不启动固定端口服务。
`n## 回复`nlead批准提案，采用实体CAS/墓碑/幂等批次；详细契约已写 ADR-training-sync.md/src/types.ts。最多1000 changes，训练模板追加版本supersedesId，不编辑/删除旧版本。可以开工。
