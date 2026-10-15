# T-03 持久化暂停计时与旧摘要字段

问题：ActiveWorkout 只有 restEndsAt，暂停后刷新不能恢复剩余秒数；详细组允许时长完成但旧 Exercise.reps/weight 必填 number，未知不能伪造事实。

期望：新增可选 restRemainingSeconds:number|null（暂停时剩余秒数；续计清空并重建 deadline），并明确详细记录兼容摘要字段可以为 0 占位，UI 只显示真实 setLogs、未知用 —，统计不读占位字段。或者提供等效契约。

原因：支持真正暂停、刷新和恢复，同时保留旧快速摘要。

验收：暂停后的会话重新加载仍显示剩余秒数；纯时长完成组可保存、摘要与进步不把缺失负重/次数当成 0 的事实。

样式需求：training-tabs、training-toolbar、training-grid、exercise-card、training-set-row、training-set-grid、training-metric-grid、training-metric、training-timer、training-timer-time、training-cue、training-history-details、training-preview、training-progress-bars、training-bar、training-bar-fill、training-routine-actions。复用现有 panel/field/input/form-grid/badge/btn/Modal。手机 set-grid 需标签逐项排列，避免水平溢出。

## 回复
已新增 ActiveWorkout.restRemainingSeconds?:number|null，暂停时保存；续计清空null，deadline重建。详细setLogs记录允许旧summary reps/weight=0作为兼容占位，只有详细组数据是事实；legacy无setLogs仍保持reps>=1等原要求。root按列出的CSS制作。
