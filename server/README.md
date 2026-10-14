# 本机 API

`npm run dev` 由项目启动器同时启动前端和 API。`npm start` 直接运行 `server/index.ts`，绑定 `127.0.0.1:3001`；已有 `dist/index.html` 时同时提供网站文件。SQLite 和私有附件保存在工作区 `data/`，该目录已被 Git 忽略。不会读取 AI、Apple、邮箱服务商凭据或连接第三方健康服务。

这是本机测试服务，未生产发布。SQLite 与附件未做应用层静态加密，依赖本机操作系统权限和磁盘保护。本机邮箱账号尚未验证邮箱所有权，不发验证邮件，没有密码找回。

## 接口

所有路径有 `/api` 前缀。账号和状态响应与 `src/api.ts` 一致。

| 方法与路径            | 行为                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `POST /auth/register` | `{email,password,name}`；密码 10–128 字符；email 大小写归一；创建随机会话 |
| `POST /auth/login`    | `{email,password}`；更新随机会话并废止当前浏览器旧会话                    |
| `GET /auth/me`        | `{user:null}` 或公开的 `{id,email,name}`                                  |
| `POST /auth/logout`   | `{}`；废止当前会话并清除 cookie                                           |
| `GET /state`          | 当前账户的 `{state,revision}`                                             |
| `PUT /state`          | `{state,revision}`；校验后 compare-and-swap；过期 revision 返回 409       |
| `POST /assets`        | `{name,mime,base64}`；最多 10 MB；PNG/JPEG/WebP/GIF/PDF 及对应文件头      |
| `GET /assets/:id`     | 当前账户附件；其他账户返回 404；PDF 作为附件下载                          |
| `DELETE /assets/:id`  | 删除尚未被记录引用的附件；被引用时返回 409                                |
| `GET /export`         | 真实账户公开信息、完整 AppState/revision、附件元数据；不含密码或会话      |
| `DELETE /account`     | `{password}`；确认后移除账户、状态、全部会话和附件目录                    |
| `GET /capabilities`   | `{ai:false,apple:false,healthkit:false,mode:'local'}`                     |

写入只接受 JSON 及可信 Origin（本机 localhost/127.0.0.1 的 5173/3001 端口）。跨站请求被拒绝。API 不提供宽松 CORS；生产 Secure cookie 模式仅供配置了真正 HTTPS 的环境。生产托管、反向代理信任与域名 allowlist 不属于此次本机版本。

状态读写、导出、删除账号、附件 POST/DELETE 必须携带 `X-Forma-Account`，与 cookie 会话的 account UUID 一致；缺失/不匹配为 401 `ACCOUNT_CHANGED`，避免另一个标签换账号后误保存。图片/PDF 的 GET 可不带自定义 header，但继续检查账户所有权。

会话 token 是随机 32 字节，数据库只保存 SHA-256 token hash；cookie 为 HttpOnly、SameSite Strict。密码使用独立随机盐和异步 scrypt（N=32768、r=8、p=1）。认证有地址限流，普通 JSON 2 MB、附件 JSON 14 MB 上限。SQL 使用绑定参数。请求正文、健康值、密码与 token 不进入日志。

## 状态边界

每个状态都经过 Zod strict schema：真实日期、带 Z/offset 的时间、有效 IANA timezone、有限的数值及字符串、全局唯一实体 UUID、存在的附件 owner 和计划引用。睡眠归属于结束时间在记录时区的日期；跨度须大于 0 且不超过 24 小时，记录之间不可重叠。营养是基于 referenceGrams 的值；未知/AI 估计来源在此版本不能保存。报告必须有附件或至少一个具备名称和值的手动指标。

餐、训练、睡眠和报告可修改删除。删除记录时移除其不再被任何记录引用的附件。计划与建议历史保持不可改写：accept 添加一条与 patch 一致的子版本；undo 添加一条补偿版本，其 parent 是已接受的当前版本、所有目标恢复到建议的 baseVersion。只有最新的已接受调整能被撤销。不能移除旧版本、改写旧目标或直接移动 currentPlanId 到旧版本。

`/export` 包含真实记录与附件元数据，不含图片/PDF bytes；附件需单独下载，当前没有完整备份导入流程。网页断网时没有 outbox，失败保存不在后台排队。HTTP 409 后客户端重载服务端状态，供用户确认后重新保存，不自动用新 revision 覆盖另一窗口的更改。

## 验证

`npm test` 运行 11 项 node:test HTTP/SQLite 集成测试，覆盖盐化密码和会话轮换、大小写重复邮箱、账户隔离、跨标签页账号标记、revision 冲突、非法日期/营养/睡眠/AI 来源、附件伪装/私有权限/10 MB 大小/PDF、删除记录与账户、数据库重新加载、计划接受与补偿撤销、CSRF 和限流。测试使用临时目录和随机本机端口，不写真实账户的数据目录。

框架参考：[Node SQLite 官方 API](https://nodejs.org/api/sqlite.html)、[Zod API](https://zod.dev/api)、[Express 5 API](https://expressjs.com/en/5x/api/)。
