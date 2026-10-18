# WB-backend — Forma 训练工作台后端

日期：2026-10-18，America/Los_Angeles。Owner：muscle_ui（本轮 server 独占，projection 由 qa 独占）。

## 本轮交付

按用户全部训练功能授权，为同源 `/training-workbench/` 自托管客户端接入 Forma 原会话。已读 security-review 技能、本区 AGENTS/TASKS、app.ts、Store、源 API / media 文本契约；未复制源 auth 或改只读来源。既有请求均为历史任务，没有本轮未答复请求。

## 已实施

- 新增私有 `/training-workbench/api/` 适配器：me/config/data/data-rev/media missing/raw PUT/GET/Range/sweep/export。每个私有请求均校验会话、X-Forma-Account，写入另校验可信 Origin；无源注册/远端/设备/AI 服务端入口。
- 独立 SQLite 表保存当前完整训练原始文档、服务器 rev/wid、相同请求回执、追加计划版本、私有媒体、投影归属。原始状态不塞进 Forma state。只追加 routines/week/dayPlan/rotation/queue 计划历史，不保留被删 workouts/customEx/bodyweight/measurements/active/dayNotes 等私人事实的旧快照；导出历史明确标为 planner。
- CAS、完整原始状态、明确投影 warnings 与 Forma workout 投影采用同一 SQLite 事务；保护非工作台原生记录和在 Forma 中另行编辑过的投影。
- 输入上限 8MB / 深度20 / 20万节点 / 单数组1万 / 字符串64KB / 禁 prototype 键；完整文档必须有 workouts/routines 数组，空对象或仅控制字段不能无意清空记录。媒体引用限定形状，上传按 bytes SHA256、magic、格式、体积与账户200MB限额验证。媒体按账户独立文件目录保存，读接口按会话账户查，无跨账户引用读取。
- 图片再经过 sharp 完整解码、格式吻合、总像素4000万、边长16384、GIF最多1000帧限制。视频只验证容器标识、SHA、字节上限与配额，未做转码或完整视频解码。头部看似有效的截断 PNG 已验证会被拒绝。
- 读媒体、missing 检查与重复上传均核对磁盘真实大小与SHA；备份缺文件或文件截断不会虚报同步成功，会返回 media-missing 并允许同账户正确字节修复。Reset 后 sweep 真正移除已删私人图片；计划历史仍保留。
- 当前完整文档、计划版本和媒体完整 base64 纳入显式导出；删账户清理媒体目录及级联所有独立表。媒体下载始终需要当前账户 header。
- 只对同源工作台子页面开放 SAMEORIGIN iframe，主站其他页面仍采用现有策略。
- 根据 lead 批准的最小契约扩展，只有包含实际完成组的详细训练可保留 reps/weight null；未知值不变为0。已知正数小数时长可真实保存，未知时长由 QA 投影 warning 保留原始文档。

## 实际验证（最后一次）

- `node --import tsx --test server/training-workbench.test.ts`：16/16通过，覆盖所有私有路由会话/账户hint、跨户与 stale tab、Origin、JSON大小/深度/prototype、CAS/wid重试与计划历史、投影和同步版本原子提交、已有原生与另行编辑保护、warnings、媒体SHA/magic/Range/配额/恢复/解码、导出与删账户、SQL失败回滚、重启持久、Reset+sweep。
- `npm test`：251/251通过，0失败/跳过，包含 QA projection 专项；最终命令 exit 0。
- `npx tsc --noEmit`：exit 0。
- `git diff --check -- server/app.ts server/store.ts server/training-validation.ts server/training-workbench.ts server/training-workbench-data.ts server/training-workbench.test.ts docs/collaboration/status/workbench-backend.md`：exit 0。
- 发现并修复了投影内容仅对象属性重排被误判409的问题，hash按排序键规范化；该回归已通过。加入完整图片解码后发现旧测试PNG本身不能解码，改用本地生成的合成有效PNG；没有放宽生产验证。
- 所有 HTTP 用合成账户和临时随机端口，测试后清理；没有触碰真实用户数据、5173/3001/8080常驻服务或参考来源。
- 未运行最终完整前端构建或工作台浏览器场景；由 lead / Claude 前端集成后统一进行。未提交或推送。

## 阻塞和请求

- 无后端阻塞。QA projection 已整合并通过全量验证，实际签名 `{ workouts, warnings }`。
- inspect_library 已只读核对当前源 ProgressPhotos 使用 workouts[].media 的哈希引用而非 dataURI；64KB字符串限制不会阻止合法照片。唯一 readAsDataURL 用于二维码临时解码，不进状态，无需猜测性放大字段。
- lead 负责 vendor 客户端 X-Forma-Account header、关闭不支持登录/远端入口、构建与常驻启动；本角色不改前端/配置、不启动常驻服务、不提交。

## 待用户决定

- 无。
