# PET-04 伙伴测试（QA）

2026-10-19。只使用合成账户、独立临时数据库与注入服务器时钟；不读真实 data/.env，不启停 3001/5173，不启动自动化浏览器。

## 已交付

- 独立 HTTP 测试 16 案已编写并实际运行。
- 覆盖账户/Origin、禁止注入、三项日奖励、防重、编辑删除重建、UTC 与本地日、防时区刷、失败原子性、工作台投影、固定宝箱/并发重放、双人挑战隐私与导出删除。
- `--serve-only` 合成 UI 验收服务已编写；仅由 lead 启动并在现有 IAB 操作。以启动时真实 Date.now 与主机时区建档，外部记录 UTC/本地/档案日期；包含 fresh 0、grown 180XP/6日/2箱、friend 0 三个合成账户。未启动此服务。

## 验证

- 初次 HTTP：15/16；HTTPS 单例因 Fetch 控制 Host 请求头导致 403。改 node:http 发送真实 Host，产品无改动。
- 第二次 HTTP：`node --import tsx --test --test-concurrency=1 tests/companion.test.ts`，exit 0，16/16，0 skipped。已测奖励 DB 写失败时事实/收据共同回滚。
- 补充同一 UTC 日第二条不重叠睡眠、工作台删除/次日编辑重建原 ID 两个断言后，最终专项再次 exit 0，16/16，0 skipped。中间一次新增睡眠复制相同区间触发既有重叠校验 400，改为合法不重叠区间；未修改产品或降低奖励断言。
- 最终 `npx tsc --noEmit` exit 0。首次检查当时 UI 未落盘、backend 测试缺 stamped 的诊断均由各 owner 完成；QA 两文件无诊断。
- `git diff --check` exit 0（仅已有 LF/CRLF 提示）。
- lead 随后报告真实 CUA 桌面/390px/双语、0XP/rest/宝箱/装备/邀请加入退出通过，warn/error 0；此项由 lead 操作，非 QA 重新执行。lead 统一完整 build 与 281/281 已通过，无需重复。

## 请求与边界

- 已与 backend 确认 companionNow、strict body、宝箱/邀请错误与 export shape，验证其 first-observed 修复防止时区/旧历史回填。
- 跨账户异步与真实手机/键盘/错误重试界面需 lead 的真实 CUA 验收；HTTP 不能替代 UI 结论。
- 没有新增依赖、没有修改产品。首个 QA 提交 `43d1545` 只含当时四个所有权路径。

## 生产容器窄验收

- 新独占文件 `tests/companion-container.mjs`。命令 `node tests/companion-container.mjs`。仅使用本机已构建镜像 `forma-companion:20261019`、随机 UUID 命名与双 label 的自建容器/卷、loopback 随机映射；不读宿主 data/.env，不启停现有服务，不启动浏览器。
- 第二轮实际 exit 0。镜像 `sha256:c152a82db6aa6e84a092505fa856d5e22c9f01c36c9afea6979d08ed1aa523fd`，Node v24.22.0，UID 1000，NODE_ENV production，数据目录 `/var/lib/forma`，trust proxy 1；镜像内 `/app/data` 不存在、根目录无 .env 文件。
- 实际 Docker 初始及 restart 健康状态均 healthy，末次检查 exit 0。真实 node:http Host/Origin/Forwarded-Proto 模拟受信 TLS 代理，注册/档案/rest 10XP；restart 后原 cookie 有效、10XP 持久、rest 重放仍10，导出仅一条本人 movement 奖励；删除合成账户后旧 cookie 401。
- 初轮失败保留：Docker 随机 HostPort 在 restart 后重新分配，脚本沿用旧端口而 readiness 超时。第二轮真实记录 62439→51773，改为每次 inspect 实际端口，未弱化健康或持久性断言。
- 第二轮证据：`C:/Users/devin/AppData/Local/Temp/forma-companion-20261019/container-OW7ZHi/report.json`；初轮：同父目录 `container-nBIfb7/report.json`。日志不写 cookie、密码或健康导出原文。
- 两轮退出前均 inspect 精确 name/label 归属后删除自建容器/卷，cleanup 两项 true。未删改任何既有资源。
- 这是本机生产镜像验收，未证明公网 TLS/证书、正式服务器代理、备份恢复或远程部署上线。
