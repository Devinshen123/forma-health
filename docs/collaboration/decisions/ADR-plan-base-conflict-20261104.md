# WEB-PLAN-CONFLICT-01：旧建议base冲突分类

2026-11-04；01 lead；基线main/7017064。用户委托本对话安排下一任务，正式范围见TASKS顶部。

## 问题

以最新snapshot/revision/实体版本接受尚为proposed的旧base建议时，原先在“新版本须接当前计划”的通用校验提前返回400。已有revision及实体CAS的409不能覆盖此语义冲突。真实HTTP合成测试已在原代码复现PUT/sync均400；没有发生旧base写入成功。

## 决定

保持schema、不可变历史及patch验证；只在原proposed建议合法转换为accepted、唯一新增子版本/当前指针/acceptedVersionId一致且子版本数值与原patch匹配后，检查旧base是否仍是previous.currentPlanId。若已变化，返回结构化PLAN_BASE_CONFLICT，HTTP409；否则按原方式追加版本。非法patch、改写历史、schema错误、普通手动计划错误和不合法状态转换仍400。正常撤销不改变。

两条入口共用validateOwnedState的分类。PUT在保存前拒绝；sync在原有事务校验中抛错回滚，revision、实体版本、事实和幂等receipt均不提交。不新增数据库表/外部调用或更改成功响应。

响应为`{error: "The plan changed. Review the latest plan before accepting this adjustment.", code: "PLAN_BASE_CONFLICT"}`，不包含其他账户信息或snapshot。客户端保留ApiError.status/code并增加中文恢复提示。此错误不冒充实体CAS，不附SYNC_CONFLICT自动重基所需snapshot/keys；现有同步层会保留失败队列供查看/导出/明确放弃，不自动把旧建议改成新base或自动重试接受。

## 验证

新增server/plan-base-conflict.test.ts使用随机loopback端口、独立合成库和两个合成账户。修复前6项中3项失败（PUT/sync状态和中文提示），其余正常接受/撤销及400控制组已绿；修复后专项通过，另补手动父版本/拒绝旧建议控制组，最终8/8通过。覆盖重复失败重试、整批completedActions不能偷渡、状态/revision/entityVersions不变、失败无receipt和跨账户401；非法patch/schema/历史改写仍400，过期revision/实体CAS仍409。客户端提示以mock Response验证，不是完整App/同步恢复浏览器验收。最终全套479/479、类型及完整build通过，细节见status的同任务记录。

本候选单独push分支，等待独立审查，不合main，不把01自测称06验收。

## 本轮独立审查发现与修复候选

用户要求独审后集成。独立qa-pr3在2dc5d1e发现P2 PR3-F1：旧base冲突先于附件/真实草稿检查抛出，两接口混合无效附件/伪造草稿实际409，掩盖应有400。01将语义冲突移到所有权/草稿校验后，仍在保存前及sync事务内拒绝。初始反例为51f1988，保留4条红例。

P2 PR3-F2：原engine仅保留失败queue，后台refresh会重复POST同一已拒绝接受。01新增本地planBaseBlocks，将已拒绝mutationId暂停，flush/save均不再自动发出；有离线同意时在原IDB账户记录新增可选字段，与queue/settled及consent epoch一起合并，旧tab不能用空数组擦除标记，移除批次后标记清理。restore/reauth/reconcile沿用，同意撤回或明确discard后清理。没有修改SyncMutation网络形状、自动重基或删除事实。磁盘暂停标记保存失败则保留内存暂停并明确提示导出，不作持久成功保证。独立反例84b76fb/a4721e8分别覆盖后台重复与持久恢复/跨tab控制。

新固定候选待原独立审查者实际复验，01自测不是独审通过。
