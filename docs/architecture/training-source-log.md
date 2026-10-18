# 动作文字来源与原创教学

## 2026-10-18：用户授权 openGym 指定动作与媒体导入

用户在本项目聊天明确要求把 openGym 的“5632 个带动画的动作”加入 Forma，并说明已取得 openGym 授权；随后对“是否也明确包含 Gym visual 动画/图片，以及在 Forma 中复制、展示和随网站分发”回复“是的”。本次依用户确认的具体范围实施，不把上游 AGPL 或公开仓库本身解释为 Gym visual 对 Forma 的许可；不向其他人授予素材权利，不公开私人授权文件，不将媒体输入 AI。

- 只读来源：`C:\Users\devin\健康网站\reference-sources\openGym\catalogue`，固定 Git SHA `e348fc17c42c7e9a211c5972e573ad3698190ee2`。未修改来源文件，也未复制 openGym 应用代码、UI、API schema 或动作库实现代码。
- 6,554 个源条目中，5,632 项为独立主动作，922 项有 `variantOf`，是关联图示变体，不重复当作独立动作导入。主动作全量导入，采用 `opengym-<source ID>` 稳定命名空间；原有 884 条 ID 与教学内容保持不变，不按同名删除旧项目。合计 6,516 项。
- 数据按 Forma 自有 CatalogExercise 映射；缺失难度为 `unspecified`，有氧系统不虚构为肌群。肌群/器械别名规范到现有筛选键。所有主动作有中文名称，1,324 项有来源中文步骤；4,308 项保持英文步骤并在中文界面说明，没有生成或伪称全部中文翻译。
- 5,632 个 MP4 和 5,632 张 WebP 完整复制到本工作区 `public/exercise-media/opengym/`，共 173,092,762 bytes。所有文件核验签名与复制后 SHA-256；未下载或热链。`src/catalog/opengym-manifest.json` 记录精确字节数和摘要。媒体目录被 Git 忽略，避免把单独授权媒体混入公开源码；文本和清单可追溯，部署必须另行带入有授权的素材。
- 步骤与简介分成 64 个按需读取的静态 JSON 桶，索引仅带检索字段。视频 `preload=none`、默认暂停、静音、内联播放，用户手动播放/暂停/拖动；手机减少动态模式下仍不自动播放。仅展开的动作挂载媒体，失败时显示文字和重试入口。公共动作素材与私有用户附件完全分开，不接触真实健康数据。
- 保留 `public/licenses/opengym-NOTICE.txt` 和 `opengym-AGPL-3.0.txt`；视频逐项显示 `© Aliaksandr Makatserchyk / Gym visual`。来源原 NOTICE 的默认限制和本次用户确认的指定授权分别记录，不将前者伪写为允许任何人复用。
- 原创 importer：`node scripts/import-opengym-catalog.mjs <有授权的源码目录>`；核验：`node scripts/import-opengym-catalog.mjs --check`。prebuild 自动执行完整校验，缺少或改动素材明确失败；不使用空文件、远程热链或减少动作数掩盖缺件。生成步骤 JSON 固定 LF，保证跨 checkout 的摘要可复现。
- 本轮实际验证：完整 build 通过；`npm test` 220/220；新浏览器回归 6/6（完整筛选/分页；首/中/末样本实际视频解码、播放/暂停与HTTP Range；中文搜索/英文步骤回退；步骤/视频失败重试；新动作保存计划并启动训练；390px与减少动态、原8+876回归）。未把文件全量核验称为逐个播放完全部动画。浏览器证据仅保存遮罩素材区域的界面截图，不将授权图像送入 AI。

## 2026-10-14 历史：原文字来源及原创示意

2026-10-14，lead批准文字数据源。完整收录 yuhonas/free-exercise-db 的 dist/exercises.json，固定 commit f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5，876 项且 ID 唯一。公开声明为 Unlicense/public domain；源 README 的上游是 wrkout/exercises.json（同样声明 Unlicense）。依据发布者的许可引入文字，不将此视为对第三方权利的法律保证。

- [固定许可证](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/LICENSE.md)
- [固定数据](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json)
- [固定 README](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/README.md)

scripts/build-exercise-catalog.mjs 实际运行成功，只保留 id/name/primaryMuscles/secondaryMuscles/equipment/category/level/instructions。所有 images 字段被删除，没有下载、热链、训练或使用媒体。源 schema 和 Vue UI 均不采用。许可证全文 public/licenses/free-exercise-db-Unlicense.txt 随网站提供。来源英文说明保留英文，5项无说明为空；未知器械保留 null。没有伪称全中文或覆盖世界全部动作。

另有8项 Forma 原创中英基础动作：深蹲、俯卧撑、支撑划船、推举、弯举、罗马尼亚硬拉、分腿蹲、平板支撑。说明、SVG点位及播放/暂停/逐帧控制独立创作，源于一般动作知识；未引用其他品牌图片、录像、关节坐标或 UI。图为简化二维教学路径，默认暂停，减少动态时手动逐帧。仅这8项标记可用示意，其他文字动作明确显示暂无动画。当前884条包含原始完整876+原创8，不能宣称拥有openGym的5,632个动画动作。

openGym 官网/API 仅用作功能调查，既有项目规则禁止复制其代码/schema/UI/媒体。没有调用对方账户/健康数据API。
