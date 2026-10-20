# 伙伴养成独立 QA — 2026-10-19

只使用合成资料。接口测试通过真实 HTTP 注册、HttpOnly cookie 与账户请求头，在独立临时 SQLite 数据库、随机监听端口上执行。未读取真实 data/.env，未接触既有 3001/5173/8080 服务。

## 已验证的接口范围

`node --import tsx --test --test-concurrency=1 tests/companion.test.ts`

最终实际 16/16 通过，0 skipped；`npx tsc --noEmit` exit 0。16 个用例覆盖：

- GET 和所有修改需要有效会话及匹配的账户头；写请求需要可信 Origin；可显式信任的 HTTPS 代理与未信任代理分别允许/拒绝。
- 新账户 0 XP、一级、空装备与宝箱；禁止请求体注入 owner/XP/日期/背包，未知外观与未拥有外观失败。
- 当日三类各 10 XP、每天最多 30；数量和时长不增加 XP；并发 claim/rest、重复 mutation、新 mutation、编辑、删除及重建不能重复奖励。
- 休息与训练共用 movement；UTC 和本地日双重防重；旧历史、未来记录、日期编辑、时区变化、新 UTC 日及旧工作台记录的重建不回填奖励。
- sync、旧快照、工作台保存使用真实接口；验证/版本冲突不发奖励；注入仅测试数据库的奖励插入失败，证实事实与奖励共同回滚，随后原 mutation 可干净重试一次。
- 三天解锁宝箱、并发开启结果稳定、固定目录轮换与装备所有权；他人无法开启。
- 双人邀请需要主动加入，参与天数不包括加入前奖励；第三人、失效和过期邀请拒绝；退出双方失效；失败猜码按账户限流。
- 挑战响应仅 self/days，不含另一参与者邮箱、账户 ID、健康记录或数值。导出仅本人账本/本人参与资料；删除账户撤销挑战并清除其伙伴表记录。

首轮 15/16 的 HTTPS 失败来自 Fetch 对 Host 请求头的控制；测试改用真实 node:http Host 请求，未修改产品来满足该测试。最终结果写入 QA 状态。

## 浏览器验收交接

`tests/browser/companion.mts --serve-only` 是合成服务夹具，不启动浏览器。必须由 lead 先安排空闲 5173 与完整 dist，再指定仓库外的 `FORMA_TEST_OUTPUT` 执行。三个合成账号凭据写入外部 synthetic-accounts.json，也明确打印为 synthetic login。包含空账户、六个奖励日 180 XP/两个未开宝箱账户、空好友账户。

夹具采用启动时实际时间和主机时区，记录 serverUTC、hostLocal、profileTimezone、profileDay 与 rewardDayUTC。只有种子构建阶段临时前移服务器时钟，之后冻结在启动时刻。手动日期需与 profileDay 对照；此时钟仅供验收，不是生产设置。

lead 可用现有 IAB CUA 验证首页入口、演示不调用私人接口/禁领奖、空账户、休息与真实记录保存、开箱与装备、双人创建加入退出、切换账户、双语、键盘、390px、减少动态、断网重试。截图中的健康图片/视频需遮罩；植物 SVG 可见。

本 QA 未启动夹具或自动化浏览器，不把上述 UI 项目称为已通过。HTTP 不能证明跨账户迟到响应、布局、键盘焦点或减少动态正确；实际 UI 结论由 lead 的 CUA 证据补充。未验证真实 iPhone/Safari、生产代理/正式托管环境、负载与备份恢复。

lead 后续报告已实际通过 CUA 桌面/390px/中英、空账户0XP、休息、宝箱/装备、邀请加入退出，控制台 warn/error 0。统一完整 build 和 281/281 测试通过。本 QA 不把该转交结果称为自己重复操作。

## 本机生产镜像验收

实际执行 `node tests/companion-container.mjs`，最终 exit 0。只启动本次 UUID 名称/双 label 的容器与卷，外露端口限制在 127.0.0.1 随机端口；现有 3001/5173/openGym 服务均未改动。

本机镜像 `forma-companion:20261019`（c152a82db6aa…）实际运行 Node v24.22.0、UID 1000，production 与独立持久卷 `/var/lib/forma`、trust proxy 1。镜像 `/app` 无 .env 文件且无 `/app/data`。初始和 restart 后 Docker health 均 healthy、末次检查 exit 0。真实请求模拟可信 TLS 终结代理的 Host/Origin/Forwarded-Proto，安全 cookie 注册和当前时区档案保存成功；休息获得10XP；restart 原 cookie 继续有效且10XP持久，再次休息仍10；导出本人恰一条 movement 奖励；删号后旧 cookie 401。

证据外置 `C:/Users/devin/AppData/Local/Temp/forma-companion-20261019/container-OW7ZHi/report.json`。初轮随机 HostPort 重启变化导致 readiness 失败的记录保留在同目录 `container-nBIfb7/report.json`；修复测试读取重启后实际映射端口，第二轮可见62439→51773。两轮 finally 均先核对 name/label 后删除仅本次自建容器与数据卷，report cleanup 两项 true。未输出密码、cookie 或健康记录原文。

上述结果证明本机镜像运行与卷持久性，不代表实际公网 HTTPS/证书、正式托管商代理配置、远程部署或备份恢复已验收。没有重跑全套测试或浏览器。
