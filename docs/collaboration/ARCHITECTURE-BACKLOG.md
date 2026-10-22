# Forma 架构后续规划

2026-10-21；01整理。配置前主仓库基线`e4c6a1b98761e88ceda84b89ae9688343610b2c5`。本文件解释候选与验收，不是第二块任务板；唯一任务ID、owner、状态、依赖和路径在[TASKS](TASKS.md)。本轮没有实施下列重构。

原评审日期2026-10-20，基线ac56b65，逐字节副本与来源说明在`docs/architecture/reviews/`。早期Claude评审result是brief建议，不能当成今天代码缺陷。已核对README、package.json和现有源码入口：Vite/React/TypeScript/Express、node:sqlite、node:test、已有Playwright。保持这些实际选择，不引入微服务、多数据库、存储框架或新测试平台。

## A：第一优先，训练切片的计划调整

相关源码：`server/validation.ts`、`server/app.ts`、`server/store.ts`、`server/sync.ts`、`server/rules/`、`src/types.ts`、`src/api.ts`、`src/training/domain.ts`和实际建议审核页面。当前建议的base复核、计划追加、状态转换和存储横跨调用层；目标是让调用者一次表达接受或撤销意图，由模块集中维护候选/证据、base、追加版本、状态转换、撤销恢复版本和原子保存。不要只移动文件或增加薄转发函数。

历史报告已复现“最新revision+旧建议base”在state/sync入口400且零写入；项目要求语义冲突409。当前源码静态仍有baseVersionId校验和StateInputError分类，但**本轮未重新执行HTTP场景**，不能把它描述成旧base曾错误保存。过期revision/实体CAS本身已有409能力，不能说所有冲突检查都缺失。

按A-PRODUCT → A-CONTRACT → A-BACKEND/A-FRONTEND → A-REVIEW分工。03定义用户可见接受、撤销、理由与冲突；01先重新核对当前checkout、错误分类/形状、证据字段和实际所有权；05做训练候选与权威校验/原子保存，04只展示差异和收集确认，06验证同一包含修改的候选SHA。server/rules与training接管必须先HANDOVER-01。只先做训练调整，不顺便启用新营养阈值。

模块收益判断：如果删除新模块，base/版本/补偿/保存顺序会重新泄漏给多个调用者，才有集中复杂性的价值。保留原始记录、服务端权威校验与规则的可解释性。

## B：账户工作区生命周期编排

相关源码：`src/App.tsx`、`src/api.ts`、`src/sync/engine.ts`、`src/sync/storage.ts`、`src/sync/changes.ts`及服务端会话/删除入口。现有SyncEngine与IndexedDB存储已经实现，不把它们写成待从零实现或整体替换。

集中启动、切换、恢复、退出、删除、撤回离线同意的编排，使页面不必掌握重复的调用顺序。必须保留账户身份绑定、epoch、停止旧引擎、generation、IDB原子操作、CAS、稳定mutationId、receipt、重试幂等、未同步记录保留和私有缓存清理。旧报告提出的复杂性不等于已证明账户泄漏。

B-PRODUCT确定可见行为；B-CONTRACT确定编排接口与责任；B-ENGINE由01维护engine/共享契约，B-BACKEND由05维护storage/服务端，B-FRONTEND由04维护页面；02协调前端与B-REVIEW，06验证同一候选。不能把App.tsx的所有权顺便转给主管，不能让05修改engine或让04修改storage。

## C：日与周汇总

相关源码：`src/features/Dashboard.tsx`、`src/features/Trends.tsx`、`src/types.ts`日期帮助函数及实际营养/训练/睡眠聚合。统一日期窗口、时区、缺失值、完整度与舍入语义，区分当前视图日期和已保存记录归属日期；睡眠按现有醒来日约定复核。旅行记录不追溯改写。

历史固定时刻`2026-10-17T06:30:00Z`、浏览器`America/Los_Angeles`、档案`Asia/Shanghai`时，首页与趋势算法曾得到不同日期。原证据不是完整挂载页面验收；本轮仅静态核对Dashboard仍调用未显式传档案时区的localDate，后续必须重新核验当前Trends代码和真实浏览器。不能将旧算法复现写成当前页面全部通过或已修复。

C-PRODUCT定义记录与视图语义；01在C-CONTRACT确认接口与代码归属；05负责服务端确定性聚合，04负责呈现与已确认窗口，06在C-REVIEW覆盖跨时区、同区、跨午夜、夏令时、缺失完整度与舍入。共享纯逻辑须按实际依赖设计，不能将整个server/rules打包进浏览器。

## D：训练计划版本

相关源码：`src/training/domain.ts`、`src/training/import.ts`、`src/features/training/`、`server/training-validation.ts`、`server/validation.ts`、`server/store.ts`及共享类型。手动编辑和接受进阶共用追加版本、历史保留、日程引用迁移、时间规则和原子提交，减少两条路径的重复顺序知识。

编辑合法性与进阶证据分别校验；不把手动编辑强行要求成“两次达标”，不移除进阶证据。保持旧routine不可变，已记录训练事实不随新计划修改。不扩成无实际需求的通用状态机。

D-PRODUCT定义两类用户流程；D-CONTRACT先登记共享契约与handover；05负责领域/保存，04负责展示和确认，06在D-REVIEW覆盖历史、时间和日程引用迁移。新领域文件先由01逐路径登记owner，不能凭目录名字扩大权限。

## 继续保留的封装与限制

FoodPhoto已有供应商调用、超时/重试、Zod、预算预留与独立草稿，保留其封装和用户审核，不把重构扩大到新的AI调用体系。保留现有SyncEngine/storage防护和追加历史。不因为一个Vite分包大小提示就声称测得性能问题；性能结论需要单独测量。

## 最低回归矩阵

06需记录候选SHA、checkout、执行者、命令、预期与实际，未执行标未验证。下表是计划，当前均未在本轮执行。

| 场景 | 必须验证的行为 | 主要任务 |
|---|---|---|
| 正常接受/撤销 | 只追加版本，撤销产生恢复版本，历史事实不变 | A-REVIEW |
| 最新revision+旧base | 语义冲突按正式契约409；整批零写入，不误归因成允许旧base保存 | A-REVIEW |
| 普通无效输入 | 400；不把所有输入错误改成409 | A-REVIEW |
| 过期revision/实体CAS | 保留原有409与冲突审核 | A/B-REVIEW |
| 失败与重试 | 事务失败零写入；稳定mutationId和receipt保证重试幂等 | A/B/D-REVIEW |
| 历史事实 | 饮食、训练、原始记录不受接受/撤销或计划编辑追溯修改 | A/D-REVIEW |
| 跨账户 | 切换/恢复/401不向另一账户重放队列，上传保持私有 | B-REVIEW |
| 双标签 | epoch/generation/CAS、旧引擎停止、队列竞争、撤回同意后不重建缓存 | B-REVIEW |
| 离线恢复 | 待同步数据不丢；退出/删除/撤回的确认与清理顺序正确 | B-REVIEW |
| 跨时区 | 固定时刻LA/Shanghai真实页面与算法、同区对照、跨午夜/夏令时 | C-REVIEW |
| 缺失完整度 | 未记录不是0，聚合排除缺失并显示记录了几天；舍入一致 | C-REVIEW |
| 训练版本/引用 | 手改与进阶各自校验，追加历史与日程引用迁移同批原子提交 | D-REVIEW |
| UI与双语 | 空/加载/错误/冲突/未保存、键盘焦点、390px/1440px中英 | 各FRONTEND及REVIEW |

通过某条用例不代表全矩阵通过。没有自动派工、定时验证或部署；实际实施必须依赖正式任务板和独立会话接手。
