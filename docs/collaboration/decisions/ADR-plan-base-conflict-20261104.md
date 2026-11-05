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
