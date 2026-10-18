# ADR：指定授权的 openGym 动作目录与本地媒体

2026-10-18，当前聊天按用户直接要求实施；分支 `codex/forma-opengym-catalog-20261018`，基于已整合的 `85912f2`。

用户确认授权包括 Gym visual 图片/动画和在 Forma 复制、展示、随网站分发，因此仅对本次数据/媒体采用做例外；不复制 openGym 应用代码、UI 或后端模型。具体来源、数量和用户确认记录见 `docs/architecture/training-source-log.md`；此前“完全不用 openGym 媒体”规则已按最新明确指令在本工作区 AGENTS 中收窄。

主动作以 `opengym-<source ID>` 添加到原 catalog，原 884 个 ID 不变。922 个 `variantOf` 不是新增主动作，本轮不导入其另一份图示。现有 RoutineExercise/SessionExercise/历史 workout 的 exerciseId 仍用现有字符串字段，不迁移已保存记录，不改服务端 API 或数据库。CatalogExercise 仅新增可选 source/sourceId/instructionUrl/video；旧调用方保持可用。

5632个视频与缩略图由有授权的本地源只读复制，不热链。173MB媒体独立于公开Git源码暂存，清单摘要记录于源码；64个按需步骤桶可复现。prebuild验证全部媒体/步骤文件，缺少授权包不能得到假成功的构建。视频不整包预取或放入静态离线安装，按用户播放加载；步骤失败可重试，中文缺失明确显示来源英文。

素材授权不等同给公开仓库访问者的新许可。本轮没有推送这些素材到GitHub、部署公网或调用AI；浏览器回归只用合成账户/临时数据库，素材区域遮罩后才保存审阅截图。
