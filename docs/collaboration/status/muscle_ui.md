# STAT-02 — 训练统计只读汇总

日期：2026-10-18（America/Los_Angeles）。Owner：muscle_ui。当前唯一写入为 `src/features/training/Statistics.tsx` 和本状态；下方肌群任务为历史交付，不再表示本轮授权写入。

## 当前实施

- 已读 AGENTS.md、TASKS.md 最新 STAT 所有权、自己的状态和发给本角色的请求（没有未处理请求）；已核对 `src/training/domain.ts` 的 completed/unknown/zero 语义和现有 `displayLoad` 单位 helper。
- 新增默认导出的 `TrainingStatistics(props: FeatureProps)`，上方以所有 `state.workouts` 为范围，复用 `trainingStats(..., catalog)`，提供已保存训练次数、有效总分钟、实际完成工作/递减组、已知负重×次数容量四项。
- 时长只累加有限正数并显示覆盖；无记录/无明细为 `—`，已有逐组记录的真实 0 容量保留 0。详细/旧汇总/未知容量组覆盖明确，不从汇总推算组数据。
- 面板标出全时间已保存事实范围及演示数据；下方直接复用 `Workbench view="stats"`，明确其图表只含工作台原始记录，原生/其他导入未反向进入该明细。
- 仅现有 class 和数字换行小样式，无依赖、样式表、后端、schema、服务启动或提交。

## 验证与请求

- lead 已补 `Workbench` view 契约。`npx tsc --noEmit` 实际执行 exit 0。
- `git diff --check -- src/features/training/Statistics.tsx docs/collaboration/status/muscle_ui.md`：exit 0，仅状态文件已有 Windows 换行提示，无差异错误。
- 完整构建和浏览器由 lead / QA 统一验证；本角色不宣称浏览器或构建已通过。代码及状态已冻结并交回 lead，不再写其他文件。
- QA 已收到 `data-training-summary`、四项 `data-stat` 及中英范围、0/unknown 和单位显示契约。

## 待用户决定

- 无。

---

# MUS-02 — 探索肌肉组件（历史）

日期：2026-10-18（America/Los_Angeles）。Owner：muscle_ui。

## 本轮交付

- 为 Forma 动画动作库实现正背面肌群选择、主要及辅助参与计数、键盘与触屏入口、双语和手机布局，已交 lead 集成验证。
- 已读 AGENTS.md、TASKS.md 当前所有权、design-system.md、frontend-design 技能；没有发给本角色的未处理请求。
- 唯一产品写入路径：src/components/MuscleExplorer.tsx、MuscleExplorer.css、src/catalog/muscle-explorer.ts、src/catalog/body-paths.ts。其余集成由 lead 完成。

## 已完成

- 核对本地 MIT 人体几何的结构和键名，仅让程序读取和复制矢量数据，未向 AI 输出 path 数据，未读取 Gym visual 媒体内容。
- 依据 lead 转述的最新全部授权，复制只读来源的人体路径几何到本区，保留 MuscleMap / Melih Colpan 版权、MIT 完整文本与 source revision。没有复制 openGym 的状态逻辑或 UI 组件。
- `MuscleExplorer` 默认收起，入口名称为“探索肌肉 / Explore muscles”；展开后正背人体 SVG、18 个等效原生计数按钮、悬停名称、选中高亮、再次点击清空、单独清除按钮均已实现。SVG 分区支持 Tab、Enter 和 Space，原生按钮最小高度 44px；CSS 全部以 muscle-explorer 前缀隔离并尊重减少动态。
- 采用 source18 的实际人体区域，不将上背部和臀部图形伪拆成不对应的区域。`matchesMuscle` 优先使用 lead 生成的精修 sourceId 元数据（只含正权重），原始或合成无精修项才按规范名别名匹配。
- 导出 `MUSCLE_KEYS`、`MuscleKey`、`isMuscleKey`、`muscleName`、`muscleRole`、`matchesMuscle` 和 `muscleCounts`。计数按动作 ID 去重；同一动作主/辅助命中只计一次。`muscleRole` 主参与优先于辅助参与，未知区域返回 undefined。

## 实际验证

- `npx tsc --noEmit`：exit 0。首轮只发现 QA 正在编辑的浏览器脚本中的 JSON 空数组推断诊断，QA 修正后复跑通过；没有修改 QA 所有文件。
- `git diff --check -- src/components/MuscleExplorer.tsx src/components/MuscleExplorer.css src/catalog/muscle-explorer.ts src/catalog/body-paths.ts docs/collaboration/status/muscle_ui.md`：exit 0。
- 通过 tsx 实际加载 5,632 条动画条目执行 `muscleCounts`：18 个区域，胸部 905、肩部 2348、上背部 1197、腹部 2474；其余计数与 inspect_library 独立来源核对一致。
- 本角色尚未运行完整构建或浏览器检查，统一由 lead / QA 串行进行。未修改后端、API、数据库、参考来源、全局 CSS 或 Library；未新增依赖或运行安装；未提交或推送。

## 阻塞与请求

- 无阻塞。lead 已决定使用 source18 区域和精修主要/辅助元数据，并负责最终构建、浏览器验收与提交。

## 待用户决定

- 无。
