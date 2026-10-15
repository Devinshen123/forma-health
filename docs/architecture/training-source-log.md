# 动作文字来源与原创教学

2026-10-14，lead批准文字数据源。完整收录 yuhonas/free-exercise-db 的 dist/exercises.json，固定 commit f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5，876 项且 ID 唯一。公开声明为 Unlicense/public domain；源 README 的上游是 wrkout/exercises.json（同样声明 Unlicense）。依据发布者的许可引入文字，不将此视为对第三方权利的法律保证。

- [固定许可证](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/LICENSE.md)
- [固定数据](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json)
- [固定 README](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/README.md)

scripts/build-exercise-catalog.mjs 实际运行成功，只保留 id/name/primaryMuscles/secondaryMuscles/equipment/category/level/instructions。所有 images 字段被删除，没有下载、热链、训练或使用媒体。源 schema 和 Vue UI 均不采用。许可证全文 public/licenses/free-exercise-db-Unlicense.txt 随网站提供。来源英文说明保留英文，5项无说明为空；未知器械保留 null。没有伪称全中文或覆盖世界全部动作。

另有8项 Forma 原创中英基础动作：深蹲、俯卧撑、支撑划船、推举、弯举、罗马尼亚硬拉、分腿蹲、平板支撑。说明、SVG点位及播放/暂停/逐帧控制独立创作，源于一般动作知识；未引用其他品牌图片、录像、关节坐标或 UI。图为简化二维教学路径，默认暂停，减少动态时手动逐帧。仅这8项标记可用示意，其他文字动作明确显示暂无动画。当前884条包含原始完整876+原创8，不能宣称拥有openGym的5,632个动画动作。

openGym 官网/API 仅用作功能调查，既有项目规则禁止复制其代码/schema/UI/媒体。没有调用对方账户/健康数据API。
