# 原创训练领域与导入验收

2026-10-14。Owner：qa/domain。实现仅为 `src/training/domain.ts`、`src/training/import.ts` 与独立测试；没有复制 openGym/GymVisual/独立 Claude 的规则实现，没有下载第三方动作图片。

## 动作文字来源

通过 agent-reach 的 GitHub 官方 `gh api` 核对 yuhonas/free-exercise-db：固定 commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`（2026-09-27）。[LICENSE.md](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/LICENSE.md) 为 Unlicense；[README](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/README.md) 声明公共领域并指出原始重构来源 wrkout/exercises.json；原来源也核对为 Unlicense。许可是仓库提供的声明，不是对第三方权利的独立法律保证。

固定 [dist/exercises.json](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json) 共 876 个动作、零重复 id。可用文字字段为 id/name/force/level/mechanic/equipment/primaryMuscles/secondaryMuscles/instructions/category；不导入 images。5 项无 instructions，30 项 force=null，87 项 mechanic=null，77 项 equipment=null。无中文翻译、个人推荐剂量或禁忌证明。未知器械保持未知。

lead 已批准文字复用，并负责全文字库导入及来源日志。产品另有 8 个独立原创基础动作，合计 884；这不等于 openGym 的动作数量或世界全部动作。只读取 catalog 已识别的主肌群，未识别动作单独计数，不从动作名猜肌群，也不把次要肌群当主肌群完成组。

## 确定性领域行为

- 完成证据为实际 reps>0 且负重非 null（显式自重 0 允许），或实际 durationSeconds>0。仅距离或重量不能证明完成。热身与未完成组排除，递减组有真实证据才计数。
- 旧摘要只计 legacyWorkouts，不生成逐组事实/PR。训练量为已知负重×实际次数；没有可计算组为 null，有明确自重组可为 0，并显示 unknownLoadSets。
- e1RM 使用有界 Epley 算术：1 次为原负重，2–10 次为 weight×(1+reps/30)，未知、自重 0、非整数或范围外返回 null。它是产品估算，不是实测最大能力或测试最大重量的建议。
- 进阶仅生成候选：两次不同日期的最近同动作训练满足完整工作组数/目标最高次数/至少目标负重，且有已记录的低 RPE 或足够 RIR。最新未达标、未知、未完成、高强度不会从更旧成功中挑选证据。返回理由码和两次训练 id，不修改 routine 或事实。
- 排程采用公历日期，不依赖浏览器时区或 DST。星期 0 为 Sunday；循环按 anchor 起的民用日期步进，null 槽为休息；无效/冲突槽返回 null。

## 导入边界

官方来源核对：[Strong 导出说明](https://help.strongapp.io/article/235-export-workout-data)、[Hevy 导入/导出说明](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)、[FitNotes 设置与 Spreadsheet Export](https://www.fitnotesapp.com/settings/#spreadsheet-export)。这些页面确认 CSV 导出，但未公开可下载的完整 header/sample；Hevy 提及联系客服索取样例。本轮未发送消息、未取得真实供应商导出，不能声称兼容所有版本/语言。

兼容测试使用合成英文字段档案：Strong 的 Date/Workout Name/Exercise Name/Set Order（支持显式单位列、秒时长列、W/D/F 类型与 Rest Timer 元数据）；Hevy 的 title/start_time/exercise_title/set_index/set_type；FitNotes 的 Date/Exercise 及明确 Weight/Distance/Time 单位列。未知列、错误宽度、重复索引或未知组类型会让整份预览报错；不跳过坏行。CSV 支持引号转义、多行字段、逗号及 Strong 常见分号分隔。最大 UTF-8 5 MiB、20,000 数据行/组。

负重优先明确列/行单位；缺少单位使用用户选择的 kg/lb，不推断。距离非零且单位不明确时报错。无偏移本地时间使用用户的 IANA timezone，DST 重复时间/不存在时间报错，要求修正或补偏移 ISO；不默默选 UTC。带偏移时间正确处理跨午夜。FitNotes 只有日期时按当地中午构造记录时间元数据，不声称知道训练开始时间。已知训练时长存整分钟（四舍五入，正值最小 1）；缺时长为 0，必须 UI 人工补齐。缺次数、重量、RPE 保持 null；缺证据不能标完成。注释保留到 Workout.notes。

Forma 读取正常原生导出中的 state.workouts 或训练专用 {workouts}，忽略原生 envelope 的其他数据；不导入账户、附件或 AI 输出。workout/exercise/set 内超出训练白名单的字段拒绝。所有身份重新生成，递减组引用重新映射；原始 null/legacy 保留，不伪造 completion。来源元数据由本地 parser 重建。稳定 fingerprint 排除随机 id，按规范化训练内容检测重复；保存过的原 fingerprint 仍可阻止重复导入，即使用户随后校正时长或备注。不覆盖既有记录。

## 实际验证

- `node --import tsx --test tests/training-domain.test.ts tests/training-import.test.ts`：22/22 通过，0 fail/skip/cancel，约 0.18 秒。
- `npx tsc --noEmit`：通过。
- lead 通知完整 `npm run build` 成功（8.4 秒、1598 modules、离线静态壳）；为避免并发清理 dist，qa 未重复执行 Vite。
- 本轮测试验证确定性计算、导入结构和边界；不是健身建议有效性试验，不是官方导出版本认证。网页最终流程/浏览器与同步独立验收仍在下一步。
