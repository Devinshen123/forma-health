# ADR — 原创训练功能与实体同步

2026-10-14。人类明确要求实现五组训练能力，lead批准在现有网站上增量扩展，不重写营养/睡眠/认证。backend 请求 20261014-1424 获准。

## 契约

src/types.ts 为权威。旧 Exercise sets/reps/weight 保留；新 setLogs 真实记录，旧摘要不自动变成完成组。新 AppState routines/schedules/activeWorkouts optional，服务端默认 []。Workout RPE 可 null。重量统一 kg；份量/时间/计算确定性完成。SessionExercise 可自定义文字动作，catalog ID 是字符串而非 UUID。实体/组/槽的 id 是 UUID。warmup/work/drop，dropParentId 只引用同动作中前置组。超级组使用同一 supersetGroup 标签。计时保存 ISO deadline，页面恢复根据当前时间计算。

GET /api/sync -> SyncSnapshot {state,revision,entityVersions}。POST /api/sync -> SyncSnapshot，请求 SyncMutation {mutationId,changes[]}。版本键 collection:id，未知=0；删除保留墓碑版本。每次触及实体版本+1。集合包括所有记录与训练实体；profile id='profile'、currentPlanId id='currentPlanId'、completedActions id=日期。变化为 upsert(value) 或 delete，无 user_id。baseVersion逐实体CAS；不同实体可自动合并，同一实体冲突409 {code:'SYNC_CONFLICT',snapshot,conflicts:string[]}，前端必须审核，不能静默覆盖。成功同mutationId同payload重试幂等，同ID不同payload409。批次原子（最多1000变更），保持旧PUT/state并更新同版本账。所有路径同样执行stateSchema、validateTransition、AI来源和owned asset校验。接受/撤销计划变化同批次，仍执行currentPlan base验证。

前端 outbox 是账户绑定 IndexedDB，用户显式开启离线后存储健康记录；退出/删除清理私有缓存。Service Worker 仅缓存自己构建的静态文件，API/文件/用户数据一律不入共享cache。队列保存稳定mutation ID及实体baseVersion；重连后逐批flush；409展示本机/服务端两版本，用户决定丢弃冲突实体本机变化或重基后提交。401/账户改变不跨账户重放。在线客户端轮询拉取服务端数据。机制支持部署到同一服务的多设备；当前实例仍本机，不能宣称已公网上线。

## 领域模块（qa/domain）

src/training/domain.ts 导出 estimated1RM(weightKg,reps):number|null（Epley，1–10次，1次返回原重），trainingStats(workouts,catalog)（真实完成非warmup组、PR、每主肌群完成组、覆盖记录数），progressionSuggestions(routine,workouts)（达到指定范围最高次数的两次近期同动作训练才生成增量草稿，未完成/未知/高RPE不触发），scheduledRoutine(schedule,date):string|null。源码原创，不能移植 openGym。

src/training/import.ts 导出 parseTrainingImport(text,format,options):ImportPreview，format='strong'|'hevy'|'fitnotes'|'forma'；options {timezone,weightUnit:'kg'|'lb',existing:Workout[],catalog:CatalogExercise[]}；preview {workouts:Workout[],issues:string[],duplicates:number}。CSV每组归会话，单位确定性转换、日期实际有效、大小行数限额、缺失reps/weight保持null，未知duration要求用户补填（候选duration=0直到审核，server拒绝0）；强度未知=null；导入fingerprint可重复复核。禁止外部asset/AI来源混入；UI审核、编辑、选择后sync，绝不默默整份替换。

## 来源/REA

不复制 openGym schema/UI/code/图片。完整引入yuhonas/free-exercise-db固定SHA的876项文字，另加8项原创基础动作，共884；声明Unlicense与上游说明已核对，记录在architecture/training-source-log.md；所有源媒体均排除。教学示意只用原创SVG关键帧与独立说明，默认暂停，尊重减少动态。

已用REA静态检查当前dist（SHA256 8964335320f6e1d6354e83942578088d657fc3e863d3eb74f848039c6b05878b），父证据 ev_1343afbb285d35c26d21620d88e352b738ae27ef0296e458c06b602bcefb48d4，摘要 ev_e9379dd0faeb267bf8c9cc323a4e77e9392b4d872bd7117351a700ab532e9953。解析1个JS/109825 AST节点，无parse failure；semantic worker heap耗尽、coverage partial。静态结果不能证明运行行为，后续用真实HTTP/浏览器测试验证，不将未知当缺失。

训练 Routine 是追加版本：修改时以新 UUID 新建，supersedesId 引用旧版本；已有 Routine 不能编辑/删除。UI默认只显示叶版本，计划改动不改训练事实；接受进阶也追加版本并更新相关日历引用。日历 Schedule 可编辑，使用实体 CAS。

计时新增 restRemainingSeconds?:number|null。详细setLogs模式旧Exercise reps/weight可0兼容占位，UI/PR不把它读成事实；无setLogs摘要保持原校验。

导航契约新增 FeatureProps.onUnsavedChange?(dirty,busy)，业务页报告本地未保存状态；App主导航/账户设置跨页弹出保留或明确放弃输入，不删除已存事实。Session卸载须清状态。
