# 本机 API

`npm run dev` 由项目启动器同时启动前端和 API。`npm start` 直接运行 `server/index.ts`，绑定 `127.0.0.1:3001`；已有 `dist/index.html` 时同时提供网站文件。SQLite 和私有附件保存在工作区 `data/`，该目录已被 Git 忽略。照片分析仅在服务端读取已配置的 OpenAI 环境变量，不读取用户端凭据；不连接 Apple/HealthKit/邮箱服务。

这是本机测试服务，未生产发布。SQLite 与附件未做应用层静态加密，依赖本机操作系统权限和磁盘保护。本机邮箱账号尚未验证邮箱所有权，不发验证邮件，没有密码找回。

## 接口

所有路径有 `/api` 前缀。账号和状态响应与 `src/api.ts` 一致。

| 方法与路径            | 行为                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `POST /auth/register` | `{email,password,name}`；密码 10–128 字符；email 大小写归一；创建随机会话 |
| `POST /auth/login`    | `{email,password}`；更新随机会话并废止当前浏览器旧会话                    |
| `GET /auth/me`        | `{user:null}` 或公开的 `{id,email,name}`                                  |
| `POST /auth/logout`   | `{}`；有效会话须账户hint匹配；废止会话并清cookie，无会话仍幂等            |
| `GET /state`          | 当前账户的 `{state,revision}`                                             |
| `PUT /state`          | `{state,revision}`；校验后 compare-and-swap；过期 revision 返回 409       |
| `GET /sync`           | 当前账户 `{state,revision,entityVersions}`；包含删除墓碑版本              |
| `POST /sync`          | `{mutationId,changes}`；最多1000项实体CAS；原子提交、SHA256幂等，冲突返回409 |
| `POST /assets`        | `{name,mime,base64}`；最多 10 MB；PNG/JPEG/WebP/GIF/PDF 及对应文件头      |
| `GET /assets/:id`     | 当前账户附件；其他账户返回 404；PDF 作为附件下载                          |
| `DELETE /assets/:id`  | 删除尚未被记录引用的附件；被引用时返回 409                                |
| `GET /export`         | 真实账户公开信息、完整 AppState/revision、附件元数据；不含密码或会话      |
| `DELETE /account`     | `{password}`；确认后移除账户、状态、全部会话和附件目录                    |
| `GET /capabilities`   | 增加 foodPhoto 配置状态；ai/available 仅表示有效配置存在，不证明供应商连通 |
| `POST /food-photo-drafts` | `{assetId,consent:true,language:'zh'或'en'}`；返回独立 FoodPhotoDraft，不自动保存 Meal |

写入只接受 JSON 及可信 Origin（本机 localhost/127.0.0.1 的 5173/3001 端口）。跨站请求被拒绝。API 不提供宽松 CORS；生产 Secure cookie 模式仅供配置了真正 HTTPS 的环境。生产托管、反向代理信任与域名 allowlist 不属于此次本机版本。

状态与同步读写、导出、删除账号、附件 POST/DELETE、照片草稿接口，以及有有效会话的退出必须携带 `X-Forma-Account`，与 cookie 会话的 account UUID 一致；缺失/不匹配为 401 `ACCOUNT_CHANGED`，避免另一个标签换账号后误保存或误注销新账户。图片/PDF 的 GET 可不带自定义 header，但继续检查账户所有权。

会话 token 是随机 32 字节，数据库只保存 SHA-256 token hash；cookie 为 HttpOnly、SameSite Strict。密码使用独立随机盐和异步 scrypt（N=32768、r=8、p=1）。认证有地址限流，普通 JSON 2 MB、附件 JSON 14 MB 上限。SQL 使用绑定参数。请求正文、健康值、密码与 token 不进入日志。

## 状态边界

每个状态都经过 Zod strict schema：真实日期、带 Z/offset 的时间、有效 IANA timezone、有限的数值及字符串、全局唯一实体 UUID、存在的附件 owner 和计划引用。睡眠归属于结束时间在记录时区的日期；跨度须大于 0 且不超过 24 小时，记录之间不可重叠。营养是基于 referenceGrams 的值；未知营养值须由用户补充，不能将 null 当作零保存。AI 来源只接受本账户真实草稿的 aiDraftId/aiItemIndex/assetId 且 referenceGrams=100；手工/标签来源不得附 AI provenance。报告必须有附件或至少一个具备名称和值的手动指标。

餐、训练、睡眠和报告可修改删除。删除记录时移除其不再被任何记录引用的附件。计划与建议历史保持不可改写：accept 添加一条与 patch 一致的子版本；undo 添加一条补偿版本，其 parent 是已接受的当前版本、所有目标恢复到建议的 baseVersion。只有最新的已接受调整能被撤销。不能移除旧版本、改写旧目标或直接移动 currentPlanId 到旧版本。

`/export` 包含真实记录、实体版本/删除墓碑、附件元数据、独立 aiDrafts、账户 aiUsage 和 aiReservations，不含图片/PDF bytes；附件需单独下载，当前没有完整附件备份导入流程。全局预算只保留无账户信息的 UTC 日金额，不导出其他账户数据。训练导入在客户端审核后走相同同步校验，不信任外部身份或附件来源。

## 训练记录与实体同步

原 Workout 摘要仍可读，服务端不会把组数摘要伪造成逐组完成。新 setLogs 明确保存 work/warmup/drop、未知 null、完成状态及时间；完成证据是正次数加已记录重量（显式0允许），或正时长，只有距离不能算完成。drop 引用同动作前置组，可比较时递减重量不高于父组。详细 Workout 至少一组真实完成；旧摘要没有 setLogs 时次数仍必须正数。ActiveWorkout 可保存未完成组、ISO 休息截止时间和暂停剩余秒数。重量固定 kg。

Routine 只追加版本，supersedesId 指已存在版本，允许分支；已有版本不可编辑或删除。Schedule 可编辑，星期为0=Sunday到6=Saturday且不重复，循环模式仅按槽顺序，不含 weekday。所有 routine 引用必须在该账户状态中存在。

同步变化是 `{collection,id,baseVersion,kind:'upsert'|'delete',value?}`，版本键为 `collection:id`，未知为0。所有原集合及 routines/schedules/activeWorkouts 均可同步；profile/currentPlanId 的 id 必须等于字段名，completedActions 的 id 为有效日期。不同实体可在当前状态上合并；任一 baseVersion 不一致返回 `409 {code:'SYNC_CONFLICT',snapshot,conflicts}`，整批零提交。删除提升并保留墓碑版本，旧设备不能复活记录。每项成功触及实体版本加1；相同 mutationId 同内容重放返回当前 snapshot，不再次加账，同ID不同内容409。SQLite只保存幂等内容哈希，不保存被删除记录的历史响应。

旧 PUT/state 仍使用整份 revision CAS，并更新同一实体版本账；确实省略新集合时保留服务端值，显式空集合按删除规则处理。既有详细组不能被旧编辑器同ID默默剥离。同步保存仍执行完整 state、历史版本、所有权及真实AI草稿校验；接受/撤销计划须同批追加版本并修改指针，不能绕过原约束。

服务端持久化协议支持同一实例的多个客户端；网页 outbox/账户私有离线缓存由 src/sync 实现并由 lead 验收。当前服务仅绑定本机，不据此宣称已实现公网跨设备部署。409必须由用户审核冲突，不能静默覆写；401禁止跨账户重放。退出/删除的离线缓存清理由客户端负责，服务器删除账户会清除同步版本/幂等账及其他私有数据。

离线私有缓存使用 IndexedDB 事务合并稳定mutation IDs，incoming队列依赖顺序优先，settled账防旧标签恢复已确认/已放弃项。每账户同意epoch是随机generation；撤回/清除轮换epoch，旧标签的迟到写入被拒绝。普通关闭离线存储会在同一事务检查最新pending，不能误删另一标签待同步记录。明确重新开启才授予新epoch；仅保存无健康内容的撤回标记以拦截旧writer。

## 照片分析与配置

每张照片的 API 请求都要显式 `consent:true`，不自动开启 profile.aiConsent。只发送照片重编码内容与请求语言，不发送账户、训练、睡眠、过敏偏好或其他健康资料。成功草稿有服务端开始时间的 `consent:{acceptedAt,version:'food-photo-v1',language}`。原始照片保持本机私有；分析图仅接受 JPEG/PNG/WebP、5 MiB、20MP，Sharp 旋转、最长1024、JPEG 重编码去元数据、处理上限10秒。图片中的可见信息仍会发送给供应商。

固定 OpenAI Responses 模型 `gpt-5.4-mini-2026-03-17`，`store:false`、reasoning none、image high、最多2000输出 tokens。请求 JSON Schema structured text.format；原始 HTTP envelope、JSON和营养边界全部验证后才能持久化不可变草稿。最多8项；未知为 null，非食物没有候选。只有用户审核的 Meal 才进入 AppState。

按 `.env.example` 在服务端环境配置。缺 key 为 `AI_NOT_CONFIGURED`，无效限额配置为 `AI_CONFIG_INVALID`；服务不会崩溃或伪造结果。Key 不进入 VITE 环境、响应、数据库或日志。`store:false` 不是供应商零保留承诺，应查看其政策。

默认每账户1个在途、每分钟5次、UTC日10次。每次真实供应商尝试先在同一 SQLite 事务预留 US$0.02；账户每日 US$0.40、项目全局每日 US$2。重启不清账，失败/超时不退款；删账户也不退无身份信息的全局金额。单用户请求可配1–100、每尝试 US$0.02–1、账户每日 US$0.02–10、全局每日 US$0.02–100，后两者须至少覆盖一次预留。金额是整数 microUSD 的保守应用账，不是供应商实收或已获批准的运营预算。

默认每尝试20秒，超时/网络/429/5xx最多重试一次；认证、拒绝、无效输出不重试。供应商错误正文不会回显或记录。stable code包括 AI_NOT_CONFIGURED、AI_CONFIG_INVALID、AI_CONSENT_REQUIRED、AI_RATE_LIMIT、AI_BUDGET_LIMIT、AI_TIMEOUT、AI_UNAVAILABLE、AI_INVALID_OUTPUT、AI_REFUSED、AI_IMAGE_INVALID。取消私有附件或删除账户会终止本进程在途分析，且在新尝试和保存前重新检查文件，防止复活孤儿草稿。

测试可使用 `createApp({ai,aiFetch,aiNow})`；ai:{}完全覆盖环境配置，aiFetch 只注入原始 Response，仍走实际解析、Sharp和Zod。此版本实现未运行真实密钥或真实供应商调用。

## 验证

训练增量验证：`npm test` 116项通过，包含原账户/AI/领域规则以及10项新增同步HTTP测试；覆盖不同记录合并、同记录原子冲突、墓碑、跨重启幂等、旧PUT互操作、旧库兼容、逐组/递减/暂停、Routine不变性、原计划/AI来源和删账户隔离。测试使用临时目录和随机本机端口，不写真实账户的数据目录，不联系供应商。Vite最终构建由 lead 串行执行，避免并发清理 dist。

客户端审查修复后最终 `npm test` 155/155通过，`npx tsc --noEmit`通过；包含独立真实engine/HTTP/原子IDB夹具测试，对失联响应重试、多标签队列合并、冲突审核、缓存失败、账户换切、撤回保护和超时有验证。服务端额外证明cookie B+hint A或缺hint退出不会注销B。此证据不替代lead的真实浏览器离线壳验收。

框架参考：[Node SQLite 官方 API](https://nodejs.org/api/sqlite.html)、[Zod API](https://zod.dev/api)、[Express 5 API](https://expressjs.com/en/5x/api/)。

供应商参考：[Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)、[图像输入](https://developers.openai.com/api/docs/guides/images-vision)、[固定模型官方说明](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。
