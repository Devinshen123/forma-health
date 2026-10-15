# Forma 本机 API 契约

版本：本机网页 0.1。本文件对应 `server/app.ts`、`server/store.ts`、`server/validation.ts` 与 `src/types.ts` 的实际实现；不是未来云 API 的承诺。

## 运行与数据位置

- 开发前端：`http://127.0.0.1:5173`，Vite 将 `/api` 代理至 API。
- API：`http://127.0.0.1:3001/api`，`server/index.ts` 只绑定本机回环地址。
- `npm start` 启动 API；如果已有 `dist/index.html`，同一个服务也提供构建后的网站。
- 真实账户：SQLite `data/forma.sqlite`；WAL/SHM 是 SQLite 的伴随文件。
- 私有附件：`data/uploads/<account UUID>/<asset UUID>`；原文件名不是磁盘路径，上传目录不作为静态资源提供。
- `data/` 不纳入 Git。本机 SQLite 未做应用层磁盘加密；备份、操作系统账户权限和磁盘保护由本机环境负责。
- 账号、记录和附件保存在运行服务的这台电脑。已有同一服务的多客户端实体同步与浏览器离线队列，当前未托管公用云服务。没有发信、Apple登录或HealthKit；配置密钥后可逐张同意调用 AI 食物识图。

`GET /api/capabilities` 返回 ai/apple/healthkit/mode 与 foodPhoto 配置状态；未配置时 ai=false、foodPhoto.available=false、reason=not_configured。没有暴露密钥或验证供应商账户。无会话 `/api/state` 返回401，不可信Origin写入返回403。

## 通用请求与错误

所有接口都有 `/api` 前缀。所有写入使用 `Content-Type: application/json`，必须具有可信 Origin。开发 allowlist 为 `http://localhost:5173`、`http://127.0.0.1:5173`、`http://localhost:3001`、`http://127.0.0.1:3001`。浏览器自动添加 Origin；命令行写入须显式提供。跨站 `Sec-Fetch-Site: cross-site` 也被拒绝。没有开放 CORS。

GET 可以没有 Origin，以便本机只读工具使用；受保护接口仍需会话。API 响应设置 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`。JSON 请求普通上限为 2 MB，附件 JSON 上限为 14 MB，解码后的单附件上限为 10 MiB。

`/sync`（GET/POST）、`/state`（GET/PUT）、`/export`、`/account`、有效会话的 `/auth/logout` 和附件 POST/DELETE 还必须带 `X-Forma-Account:<当前页面所持 User.id>`。服务器将该标记与 cookie 会话的账户 ID 比对；缺失或不匹配返回 401 `{error:"Account changed. Sign in again before saving.",code:"ACCOUNT_CHANGED"}`。这防止另一个标签页换账号后，旧页面的健康状态落到新 cookie 所属账号。该标记不替代 cookie 认证。`GET /assets/:id` 用于图片和下载导航，可不带此 header，但仍以会话账户检查文件 owner，其他账户返回 404。

失败响应都是 JSON，主体至少包含 `error:string`。字段校验错误还可包含 `issues:[{path:string,message:string}]`；路径与描述不回显健康值、密码或 token。

| HTTP 状态 | 实际含义 |
|---|---|
| 400 | Zod 字段/结构校验失败、无效 JSON、非法状态变更、不可用/非本账户附件、文件内容与 MIME 不符 |
| 401 | 需要登录、登录凭据错误、删账号确认密码错误，或页面账户标记与会话账户不匹配（`ACCOUNT_CHANGED`） |
| 403 | Origin 缺失/不可信，或跨站请求 |
| 404 | API 路径不存在；附件不存在、ID 非法或属于别的账户 |
| 409 | 邮箱重复、状态 revision 过期、附件仍被记录引用，或实体同步冲突 |
| 413 | JSON 请求或解码后的文件超过相应大小上限；编码字段本身超出 schema 上限也可能是 400 |
| 415 | 写入没有采用 JSON 内容类型 |
| 429 | 认证地址限流（60 次 / 15 分钟），响应带 `Retry-After` 秒数 |
| 500 | 本机服务未能完成请求；不返回内部 SQL、堆栈或请求内容 |

客户端处理依据 HTTP 状态。`ApiError` 保留status/code和受保护冲突snapshot。网站使用下述实体同步；同一记录409必须审核，不能静默覆写。旧PUT调用方仍使用整份revision CAS。离线outbox只在用户明确启用后持久化，关闭离线时未确认写仅留在页面并提示导出。请求15秒超时（识图90秒）保留稳定mutationId重试，不把丢响应当作未提交。

## 训练与实体同步（2026-10-14）

`GET /sync` 返回 `{state,revision,entityVersions}`；`POST /sync` 请求 `{mutationId:UUID,changes:[{collection,id,baseVersion,kind:'upsert'|'delete',value?}]}`，最多1000项，仍受JSON大小限制（客户端提前检查1.8MB）。版本键 `collection:id`，未知=0，触及+1，删除保留墓碑。成功重放同ID同内容无二次写入，返回当前snapshot；同ID异内容拒绝。不同实体合并，相同实体baseVersion不符返回409 `{code:'SYNC_CONFLICT',snapshot,conflicts:string[]}`，整批无部分提交。会话决定owner，固定 `X-Forma-Account` 仅用于匹配当前页面账户。所有合并执行原计划transition、真实AI草稿和资产归属校验。

collections：meals/workouts/sleeps/reports/planVersions/suggestions/routines/schedules/activeWorkouts；profile id=`profile`，currentPlanId id=`currentPlanId`，completedActions id=日期。旧PUT同步更新同一版本账，真缺新集合时保留服务器新集合，不能剥离已存在详细组。Routine追加版本supersedesId，不编辑/删除旧版本；Schedule可编辑、weekday为0周日–6周六、rotation按anchorDate连续日循环。时区/缺失/单位由代码校验。

Workout保留旧summary兼容，新setLogs包含UUID、work/warmup/drop、nullable reps/weightKg/durationSeconds/distanceMeters/RPE/RIR、completed与可选完成时间/dropParentId。完成证据要求次数+明确负重（可0）或正时长。drop引用前置已完成父组且负重不增加；详细记录至少一真实完成组。旧summary不得伪造成详细事实。ActiveWorkout保存restEndsAt和restRemainingSeconds，完成训练沿用稳定ID、移除草稿并添加事实原子保存。全部字段以src/types.ts及server/training-validation.ts为准。

客户端IndexedDB按账户分区，同意generation约束写入/原子清理；稳定队列事务合并及已处理ID防旧标签复活；账号失效保留待同步记录，重新登录原账号恢复。离线启动仅恢复上次明确激活账户的缓存，不跟随其它标签更新的lastAccount指针。Service Worker只缓存公开静态壳/动作数据，API/私有附件不缓存；新worker等待旧客户端关闭，避免中断未保存会话。

导入是浏览器预览，不存在任意账户或完整数据库恢复接口。Strong/Hevy/FitNotes CSV及Forma训练切片仅经审核转成workouts变更；日期/DST歧义、单位、缺失、未知header、重复、大小与行数限制有独立测试。供应商真实文件版本未全部验证。

## 身份和会话

`User` 的公开响应只有 `{id,email,name}`。email trim 后转小写、格式有效且长度不超过 254。name 非空且最长 160。新账号和登录的密码长度为 10–128；密码 hash 使用随机盐和异步 scrypt，数据库不存明文密码。

会话是随机 32 字节 token；数据库只保存 SHA-256 token hash。cookie 名为 `forma_session`，HttpOnly、SameSite Strict、Path `/`，有效期七天。本机 HTTP 开发不加 Secure；`NODE_ENV=production` 或测试注入的 `secureCookies:true` 加 Secure。登录/注册会废止当前请求浏览器的旧会话；其他浏览器的合法会话可继续使用，删账号会移除全部会话。

| 方法与路径 | JSON 请求 | 成功响应 |
|---|---|---|
| `POST /auth/register` | `{email,password,name}` | 201 `{user:User}`，设置 cookie；初始状态为 `emptyState()`、revision 0 |
| `POST /auth/login` | `{email,password}` | 200 `{user:User}`，设置新 cookie |
| `GET /auth/me` | 无 | 200 `{user:User|null}`；未登录也是 200 |
| `POST /auth/logout` | `{}` | 200 `{ok:true}`；账户标记匹配后废止会话并清 cookie；已退出可幂等调用，错配不能注销另一个账户 |
| `DELETE /account` | `{password}` | 200 `{ok:true}`；移除账户、state、全部 session、附件元数据及本账户附件目录，并清 cookie |

本机邮箱只是账号标识，没有验证邮件、邮箱所有权证明、找回密码或密码重置。确认删除账号使用其现有密码，不调用外部身份服务。

## 状态读写

`GET /state` 返回 `{state:AppState,revision:number}`，只读取会话账户的状态。

`PUT /state` 请求为 `{state:AppState,revision:number}`。这是一次完整文档保存，而不是部分 patch。未知字段被拒绝，不会静默 strip。服务端先校验，再对当前账号执行 `WHERE revision=?` 的条件更新；成功返回 `{state,revision:旧值+1}`。过期 revision 返回 409 和当前 revision（若在初始检查阶段发现）。初始 AppState：

```json
{
  "profile": null,
  "meals": [],
  "workouts": [],
  "sleeps": [],
  "reports": [],
  "planVersions": [],
  "currentPlanId": null,
  "suggestions": [],
  "completedActions": {},
  "routines": [],
  "schedules": [],
  "activeWorkouts": []
}
```

实际结构以 `src/types.ts` 为准；服务端的主要边界如下。

| 数据 | 必须满足的条件 |
|---|---|
| 全部实体 | UUID；各数组实体 ID 全局唯一；`createdAt` 为带 Z/offset 的 ISO 时间 |
| 日历日期 | 真实 `YYYY-MM-DD`，例如 2 月 30 日被拒绝 |
| Profile | 非空名字、固定 enum、trainingDays 1–7、timeMinutes 1–1440、sleepGoal 1–16、有效 IANA timezone、明确 boolean consent flags |
| Meal | `grams/referenceGrams` 均 >0 且 ≤10000；能量/宏量非负；宏量和 ≤ referenceGrams×1.1＋1，能量 ≤ referenceGrams×12；source为manual/label，或具有已验证草稿来源的ai_estimate |
| Workout | duration 整数 1–1440，RPE null或1–10；至少一项 exercise；旧摘要sets 1–100、reps 1–1000、weight 0–2000（kg）。新setLogs按上方真实完成证据校验，兼容占位不作统计 |
| Sleep | 手动来源；quality/energy 整数 1–5；起止为带 offset/Z 的 ISO；跨度 (0,24h]；各段不重叠；date 必须等于 end 在其 timezone 中的醒来日期 |
| Report | 手动 extractionStatus；附件或至少一个 marker；marker 名称和值非空，unit/range/notes 可空；不做 OCR 或医学解释 |
| completedActions | 真实日期 key；当天 action 字符串唯一；只表示用户勾选，不冒充训练完成记录 |
| 附件引用 | 引用 UUID 必须属于当前账户；Meal 附件须为图片；Report 可为图片或 PDF |

服务端允许的数值范围是结构和资源边界，不是个人健康建议。UI可采用更窄范围。AI来源另受下方草稿provenance验证约束，不接受凭空声明的`ai_estimate`。

餐、训练、睡眠和报告可以通过 PUT 编辑或删除。移除旧状态中已被记录引用、且在新状态中已无任何引用的附件时，服务端同时删除该附件。上传完成但尚未被记录引用的文件不会随普通 PUT 自动删除；用户取消草稿时客户端应调用附件 DELETE，删账号也会清理它们。

## 计划与调整的版本契约

`planVersions` append-only。首版 `parentId:null`，后续版本 parent 必须指向此前已有版本。只要存在 plan，currentPlanId 必须指向某个已存在版本。旧版本不能删除、修改或重排，一次保存最多追加一个版本，其 parent 必须是此前的 currentPlanId。

建议 `Suggestion` 只有 `trainingMinutes`、`trainingDays`、`sleepHours` 的非空 patch。新增建议只能是 proposed 并基于保存后的当前 plan。建议已有的 ID/baseVersionId/createdAt/reason/patch 不能修改或删除；一旦产生 acceptedVersionId，它也不能改写。

| 操作 | 实际保存方式 |
|---|---|
| 初始计划 / 手动改目标 | 追加 version；parent 为旧 current（首版为 null）；current 指向新增版本 |
| 接受建议 | 仅旧状态中的 proposed 可转 accepted；base 必须仍是旧 current；追加一个子 version，其所有目标等于 base 加 patch；acceptedVersionId/current 均指向该新增版本 |
| 拒绝建议 | proposed → rejected；不更改计划目标或删除历史 |
| 撤销已接受建议 | 仅当前 accepted version 可撤销；追加一个 parent=accepted version 的补偿 version，所有目标恢复 base 的值；current 指向补偿版，status 转 undone，acceptedVersionId 保留 |
| 重新接受 rejected/undone | 被拒绝；应由用户基于当前 plan 提出新的建议 |

一次保存至多处理一个接受或撤销决定。撤销不将 currentPlanId 直接挪回旧 ID、不改写已接受版本，也不改写实际饮食、训练、睡眠记录。服务端检查目标一致性，但不替客户端生成建议或版本。

## 附件

`POST /assets` 请求 `{name,mime,base64}`；base64 为 FileReader data URL 逗号后的内容，不包含 `data:...` 前缀。name 控制字符被拒绝，斜杠替换成下划线，且永不作为磁盘文件名。允许 MIME：`image/png`、`image/jpeg`、`image/webp`、`image/gif`、`application/pdf`。服务端检查 canonical base64、解码大小以及文件签名（PNG 另检查 IHDR，PDF 检查 header/EOF），不只相信扩展名或浏览器 MIME。

成功：201 `{id,name,mime}`。

`GET /assets/:id` 需当前账户会话。成功响应是文件 bytes，以其 MIME 返回；图片 inline，PDF attachment。响应有 CSP sandbox，且不能由其他账户凭 asset UUID 读取。文件头检查不是完整媒体解码、PDF 消毒、恶意软件扫描或 OCR。

`DELETE /assets/:id` 需可信 Origin、JSON 类型和会话，可发送 `{}`。未引用的本账户文件删除后返回 `{ok:true}`；仍被任何 Meal/Report 引用返回 409；非本账户返回 404。

网页营养图片输入当前限制 JPEG/PNG/WebP ≤5 MB，这是 UI 的较窄选择；服务器图片/PDF支持上限是 10 MiB。没有 HEIC/HEIF 支持。

## 导出

`GET /export` 需会话，返回 JSON：

```text
{
  format: "forma-export",
  schemaVersion: 1,
  exportedAt: ISO,
  user: {id,email,name},
  state: AppState,
  revision: number,
  assets: [{id,name,mime,size,createdAt}]
}
```

内容来自真实 SQLite 状态，不含 password hash、盐、session 或演示记录。**此 JSON 包含附件元数据，尚不包含图片/PDF bytes**；它不是完整可离线恢复的附件备份，没有完整数据库恢复接口；新增训练切片在浏览器预览后导入。附件当前应通过受保护 GET 单独下载。演示模式由前端直接导出演示 state，而不访问账户 export。

## 本机验证与云端迁移差异

2026-10-14全仓155项测试通过，包含HTTP/SQLite、AI安全与预算、独立rules、训练领域/导入与真实同步客户端测试。跨标签使用B真实cookie和A页面标记，在两账户revision=0时验证401且B状态空白。规则层尚未接入网页API；测试不等于真实模型识别质量、生产发布、Apple登录或HealthKit运行。

生产前必须完成以下与实际差距对应的工作：

1. 固定云端域名、HTTPS、Secure cookie、明确反向代理信任及 Origin allowlist；当前 index 是本机 HTTP，并未配置生产代理或 TLS。
2. 邮箱验证/恢复、Apple identity 验证和账号合并策略；多用户监控、分布式限流与会话生命周期策略。
3. 数据库迁移版本、备份/恢复演练、文件与数据库一致性、容量配额、上传扫描/媒体解码，以及可包含附件的完整导出/迁移格式。
4. 共享HTTPS部署、云账号和设备接入、分页/增量下载与长期容量方案；当前已实现实体版本/幂等/冲突审核，但仍以整份snapshot下载及2MB请求为界，不是大规模历史同步协议。
5. 独立的云同步和 AI 处理同意流程、地区存储与保留政策、删除与备份过期机制；profile 的 consent boolean 在本机只保存用户偏好，不会触发实际云传输。
6. iPhone HealthKit 按数据来源、UUID/anchor、修改/删除、权限缺失及睡眠重叠聚合接入；本机 Sleep 只是手动时间区间。
7. AI供应商真实凭据、可用性和识别质量评估、价格复核、服务地区与保留政策；现有食物照片接口未做真实在线推理验收。OCR仍未实现。
8. 订阅/支付与 US$20/月权益策略；当前没有收费、试用扣款、收据验证或支付接口。

不得把数据从本机移到云端而仍称“只在这台电脑”，也不得因为提前存了 consent flag 而认为用户已同意尚未说明的第三方健康处理。

## AI 食物照片草稿

`POST /food-photo-drafts` 请求 `{assetId,consent:true,language:'zh'|'en'}`，需要当前会话、匹配的`X-Forma-Account`、可信Origin；assetId必须为当前账户私有JPEG/PNG/WebP（原图≤5MiB、20MP）。拒绝外部URL、user_id等额外字段。服务端解码、去EXIF、旋转并缩到最长1024像素，送OpenAI固定模型，不发送用户健康资料。

返回独立`FoodPhotoDraft`：`{id,assetId,provider:'openai',model,createdAt,isFood,consent:{acceptedAt,version:'food-photo-v1',language},items:[{name,grams,per100g:{kcal,protein,carbs,fat}}],warnings}`。同意时间由服务端记，最多8项，未知=null，非食物items=[]。不写meals或改变state revision。Zod与营养边界检查不能替代用户审核。

用户审核后通过实体同步保存（兼容旧PUT /state）：每项Meal.source=ai_estimate、referenceGrams=100，并附aiDraftId、aiItemIndex、同一assetId；服务器验证草稿owner与item索引。用户能改名称/份量/营养，但原始草稿不改。普通manual/label不允许AI字段。任何缺失数字需手动补全，不能把未知当零。

安全错误码及资源限制见 [ADR-AI-food-photo](collaboration/decisions/ADR-AI-food-photo.md)。超时/网络/429/5xx最多重试一次，最多2000输出token。每次调用前SQLite原子检查账户/项目预算，失败不退，重启不重置。一账户一次在途、5次/分钟、10次/UTC日；账户US$0.40/日、项目US$2/日、每尝试US$0.02。全局只有匿名日聚合，删除账户不退款；不是供应商实际账单。客户端中止不保证供应商停止计费。

JSON导出新增独立`aiDrafts`、AI预算预留记录；不含凭据。取消未保存照片可DELETE assets清理其草稿；被Meal引用的附件不删除。账户删除级联清理草稿和预算。
