# MUS-03：动画动作库与探索肌肉测试

更新：2026-10-18，America/Los_Angeles。Owner：qa 子任务，当前仅写 `tests/browser/opengym-catalog.mts`、`tests/muscle-explorer.test.ts` 和本状态，不提交、不启动服务、不停止进程。

## 正在做什么

- 已读当前 AGENTS、TASKS 顶部所有权、既有 qa 状态、请求目录与原动作库浏览器脚本。没有新的待处理 qa 请求。
- 已读 frontend-testing-debugging 技能。Browser plugin not available；继续采用仓库已有 Playwright + 系统 Edge，最终浏览器运行由 lead 串行处理固定 5173 端口。
- 验证流程：训练动作库 → 仅动画动作、搜索/分页/筛选 → 正背人体肌群选择 → 结果及主要/辅助计数同步 → 加入计划与训练中教学；覆盖中英文、键盘、空结果恢复及手机布局。
- 已与 muscle_ui 协调 18 个源人体区域、默认收起、正背图、`data-muscle-key/count`、`aria-pressed`、双语名称，测试代码已交付 lead 进行最终集成浏览器验证。

## 已完成与验证

- `tests/muscle-explorer.test.ts` 已新增 4 个测试：主要/辅助匹配与未知值、每动作/每 ID 去重、5,632 条精修源元数据的 18 组独立计数、双语可读标签；固定核对斜方肌 525 / 肩部 2,348 / 胸部 905 / 上背部 1,197 / 前锯肌 35。
- 浏览器脚本由 6 扩为 8 组：去来源且默认仅动画；历史 884 ID 可解析；分页与筛选；正背人体选择及主要/辅助匹配；键盘、清除、中英状态；空结果恢复；视频真实解码/Range/播放暂停；步骤中英回退；故障后重试；保存计划/训练教学；手机 390×844、减少动态、图形点击/键盘及无横向溢出。截图继续遮罩动作图片和视频，人体图可显示。
- 实际 `node --import tsx --test tests/muscle-explorer.test.ts`：**4/4 通过**、0 fail/skip/cancel，exit 0，248.5642 ms。
- 实际 `npx tsc --noEmit`：exit 0；`git diff --check -- tests/browser/opengym-catalog.mts tests/muscle-explorer.test.ts docs/collaboration/status/qa-muscle.md`：exit 0（仅既有 Windows 换行提示）。
- 静态协调修正了测试对 JSON union 的类型推断与清除按钮所属区域；muscle_ui 同步补充主入口精确可访问名称。没有将静态检查当作浏览器通过。
- 本子任务未运行浏览器、完整 build 或全套 tests，仍由 lead 在组件集成后串行执行；未停止或启动任何服务，未提交。

## 阻塞与请求

- 无产品阻塞；组件与精修元数据已就绪。
- 浏览器脚本只交付给 lead 执行，本子任务不占用固定端口。

## 待用户决定

- 无新增事项。
