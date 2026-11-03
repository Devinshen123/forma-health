# Casdoor / Lago 专项独立审查

编号06 / qa；2026-11-03；任务 AUTH-BILLING-REVIEW-06。实际执行者为独立 Codex QA 子会话，独立于01实现者与上轮辅助审查者；不接管历史06记忆。

- checkout：`D:/Forma/worktrees/qa-auth-billing-20261103`
- 初审分支：`codex/qa-auth-billing-20261103`；按01正式交接，修复复验时安全切换为detached固定SHA，未stash或覆盖报告。
- 基线：`76dcbe26ad56f20dee08110ff9b6f4657d2106d0`
- 初审固定候选：`0bf5b88c55cc65749732b425e044c4cf11880a32`（含 Casdoor `4105532`、Lago `f41b4cd`）
- 最终复验固定候选：`4f98d4a3d32f5de9dcd5ff2c92fcf760fab35bbd`（包含第一轮修复`861feed`及持久删除标记加固）。
- 本人独立回归提交：`8f259a2`、`2ec201b`、`52b4cc7`；初审时这些提交仅修改专属测试，产品源码仍是0bf候选。
- 开始时工作树干净。仅读取规则、正式派工、本人历史入口/记忆/status、请求、设计、ADR及本次完整产品差异；旧结果只作为历史来源，不当作本次执行。

最终结论：**4f98d4在本报告明确的本地测试范围内通过，无未解决的合并阻塞。** 初始候选不通过的三项发现（含QA-F1的超时晚提交延伸）均已独立复验关闭。可由01按既有集成协议合并main并同步GitHub。本06未自行push/merge，不授权生产、真实收费或真实供应商联调。

## 发现与修复要求

| ID | 严重度 | 证据与影响 | 初审状态 |
|---|---|---|---|
| QA-F1 | P1 | `server/billing/service.ts` customer/sub/refresh 的 await 后没有账户存活检查；flush 删除成功后立即清除删除意图，不等待在途 refresh/mutation。外部客户/订阅可在删号后复活，且以后没有清理重试。 | 4f98d4关闭，含超时晚commit/数据库重启 |
| QA-F2 | P2 | 同文件 scheduleDeletion 只在 billing enabled 时入队。临时关闭计费期间删除已有账户，重新启用后不会再清理此前的外部客户。 | 4f98d4独立回归通过 |
| QA-F3 | P2 | `src/components/Auth.tsx:231` 的 Casdoor 主入口分支不渲染 error；唯一 alert 在原表单内（初始候选247行）。取消授权/启动失败没有可见反馈。 | 最终构建的中英回调/503启动错误均通过 |

QA-F1：独立测试先将首次 customer GET 挂起，删除本地账户并完成远端 DELETE，再释放404响应。旧 refresh 随后 POST customer/subscription，最后本地保存因外键失败；外部记录已经复活。第二反例将 POST customer 本身挂起，证明删除意图不能在请求尚未排空时清掉。初始候选两项断言分别是 `true !== false`（外部复活）、`false !== true`（删除意图被清除）。要求01在外部写前及 await 后检查账户，且在途写排空前保留持久删除意图；仅在 refresh 最后检查不足。

第一轮修复`861feedb58dfef1ec395f85040a8774fc2bc260b`加入存活检查与在途map保护，前三项独立删除反例已绿，认证/导航/计费/CLI共84项本人实跑通过。但第四独立反例仍红：远端接受POST后，本地50ms超时并abort；Promise已reject、refreshes排空；第二次flush清掉意图；远端随后晚commit；第三次flush再无清理。此处假transport遵守abort并拒绝本地Promise，明确模拟远端事务继续，未调用真实服务。证据`late-commit-861feed.log`为3绿1红、exit1；反例提交`3ee5ce79142b944255a2552dc7d24471bd8db7db`，不能以本地Promise完成等同远端不再写入。后续`fcee06f`增强为推进fake clock后关闭并重开磁盘SQLite/服务；`f44ade3`修正本人测试的Windows句柄释放顺序。隐私断言一直保留，未跳过或改成宽松断言。

QA-F2：在 off 模式调用 scheduleDeletion 后删号，重新实例化启用的 BillingService 并 flush，实际 DELETE 为0，预期1。要求关掉功能时仍保留最少不透明编号的外部清理意图。

QA-F3：使用构建后的网页、独立合成数据库和假 Casdoor 配置，访问 `/#auth=error&code=AUTH_CONSENT_DENIED`。统一入口的 alert 数0；仅切换“使用原有邮箱和密码登录”后，alert 数1，显示“你已取消平台授权，可以重新选择登录方式。”无登录、授权跳转或供应商请求。要求将 error/notice 放到所有相关分支共享位置且不重复显示；复验同一路径及中英内容。

## 实际执行

以下由本06本人执行。所有工程命令显式使用本D盘checkout；测试/构建进程设置 `TEMP=TMP=D:/Forma/cache/tmp`、`npm_config_cache=D:/Forma/cache/npm`。合成临时库使用 `tmpdir()`，Windows本次实际落D盘；未在Mac运行。

| 命令 / 操作 | 初审实际结果 |
|---|---|
| `npm test`（新增QA测试前） | exit0；464/464，fail/cancel/skip/todo均0，24,182.9499ms |
| `node --import tsx --test tests/authentication.test.ts tests/auth-destination.test.ts tests/billing.test.ts` | exit0；79/79，fail/cancel/skip/todo均0，9,241.9694ms |
| `node --import tsx --test tests/auth-billing-review-20261103.test.ts` | 初始两项0/2；新增off删除反例后0/3，exit1。红例保留，没有跳过或改断言掩盖。 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit0（初审阶段，包含当时的独立测试） |
| 第一次 `npm run build` | exit1；prebuild缺工作区忽略的授权训练媒体 `0001.mp4`；未声称通过 |
| 第二次 `npm run build` | 补齐既有公开授权媒体junction后，tsc+Vite成功，后续training-workbench缺既有vendor依赖，exit1 |
| 第三次 `npm run build` | 01为本工作区补齐相同锁文件的既有vendor依赖junction后exit0；主网页、训练工作台、岛、源码包、release-info、离线壳均完成。既有大chunk警告保留。无安装/依赖更改。构建结束release identity为仅含本人测试增量的`2ec201b`，产品仍0bf。 |
| `git diff --check`（本人测试） | exit0 |

本机日志均在 `.forma-local/qa-auth-billing-20261103/`：`npm-test-initial.log`、`auth-billing-initial.log`、`independent-all-initial.log`、`tsc-initial.log`、`build-initial.log`、`build-with-assets.log`、`build-complete-initial.log`。均为D盘专属、未提交的验证产物。

## 检查矩阵

| 范围 | 本人证据与边界 |
|---|---|
| Casdoor / 旧账户 | 静态核对issuer+sub命名空间、固定端点/应用JWKS、RS256/nonce/aud/时间/tokenType、PKCE、原密码显式绑定、邮箱冲突和原owner保留；独立执行认证/导航套件。没有真实登录供应商。 |
| 会话 / 账户隔离 | 实跑既有HTTP测试：X-Forma-Account、换号、过期/退出、跨账户绑定；不信任客户端owner/金额/额度。 |
| Lago身份与权益 | 静态核对当前内部订阅、当前账期的finalized+succeeded付款与正订阅费；同subscription响应读取权益；既有计费套件通过。 |
| 额度 / 并发 / 账期 | 原子最后一槽、过期租约、预留失败、同period_end套餐切换、跨期校验；79项专项及全套已执行。 |
| 成功结果与用量 | 草稿/成功操作/唯一outbox同SQLite事务；丢回执/重启、已有回执核对、毫秒时间、冲突保留pending；非食物/失败不扣用户额度。 |
| 通知与沙盒边界 | raw精确路径、大小、固定RSA签名、issuer/data完整字节、body摘要去重、权威重读；loopback配置/Origin/Host、客户支付商为空、没有POST/payments。静态及离线HTTP测试通过。没有真实扣款。 |
| 导出 / 删除 | 本人执行安全导出/级联及既有清理测试；额外反例实际发现QA-F1/F2；最终四项独立删除回归全绿。未读取真实健康库、附件或私有服务state。 |
| 脚本 | 读取本次setup/provision/verify变化与私有路径/端口/官方版本约束；未运行带真实服务凭据的verify脚本。 |
| 新UI | 下列隔离页面检查及最终QA-F3复验通过。完整登录后账户中心/账单浏览器流程未测。 |

## 本人UI验证与限制

主3001的IAB新标签显示已有会话状态后立即停止并关闭，未点设置、读取记录、登录或退出；没有将该页面当公开演示继续操作。

随后本人用本checkout已生成dist、独立D盘合成SQLite、生成RSA与注入假套餐 transport，监听 `localhost:61067`。只GET公开演示/选项，切换语言、打开关闭弹窗；没有注册、登录、生成绑定、Set-Cookie或外部AI/支付请求。自有标签/fixture服务已关闭，临时viewport已reset。

- 中文默认桌面：明确演示模式、本地测试不扣款、Free $0/3与Pro $20/100、选择Pro打开登录弹窗；桌面弹窗截图实际查看。
- 英文390×844：会员/测试说明/价格额度及“Sign in to choose”打开英文弹窗正常。
- 中文390×844：两卡同x、垂直排列；`scrollWidth=clientWidth=375`、viewport宽390，未发现水平溢出。
- 本人新标签console warn/error为空。390截图工具两次报告无法捕获；手机结论只依据真实DOM与布局几何，**手机像素外观未验证**。
- 另在 `localhost:63804` 的假Casdoor合成fixture仅用错误hash和本地切换确认QA-F3；服务/标签随后关闭。

未验证：真实本机Casdoor/Lago联调、真实邮件/Google/Apple、服务容器重建、真实网络/跨进程崩溃的远端提交、主真实数据前后SHA、Mac、真实手机、生产/公网或真实支付。客户端超时后远端晚commit已通过合成transport复现并在最终候选修复。01既有真实服务/主数据验证只属于其交付来源，本报告没有冒称本人复跑。

## 修复后复验

本人在detached `4f98d4a3d32f5de9dcd5ff2c92fcf760fab35bbd`读取两轮实际修复diff；核对本人测试内容与本人`f44ade3`完全相同，保留未提交报告。没有修改产品源码。

最终删除方案保留6张计费表中的新增`billing_deleted_owners`：只含external_customer_id、created_ms、next_ms、checks，不含姓名/邮箱/健康内容，无账户外键以便删号后保留。原pending清理迁入标记，scheduleDeletion同事务写队列和标记，DELETE仅针对本地已经不存在的owner。在途操作仍保留pending队列；正常DELETE成功后也保留标记，15秒起指数退避至最多1小时继续幂等清理。该机制提供持续的最终清理，不能承诺远端晚提交后立即不存在。服务关闭时暂停，重启/重新启用后继续。

| 本人最终命令 / 操作 | 实际结果 |
|---|---|
| `node --import tsx --test tests/authentication.test.ts tests/auth-destination.test.ts tests/billing.test.ts tests/auth-billing-review-20261103.test.ts tests/casdoor-setup.test.ts` | exit0，86/86；fail/cancel/skip/todo均0，9,562.5173ms。包含4项本人隐私回归、队列/标记事务回滚与旧pending迁移、01另发现的空.env.example初始化2项CLI；不是借用01执行结果。 |
| 第一次最终 `npm test` | exit1，470/471；唯一失败为既有workbench测试fetch连接`ENOBUFS 127.0.0.1:65531`，没有产品断言失败，日志保留。此次运行尾段与本人build有时间重叠，不称严格串行。 |
| 最终 `npm run build` | exit0，含tsc/Vite/训练工作台/岛/源码包/release-info/离线壳。既有chunk警告保留；没有安装依赖或改锁文件。`dist/release-info.json.sourceCommit`精确为4f98d4完整SHA。 |
| 构建结束、无工程并发后原样重跑 `npm test` | exit0，471/471；fail/cancel/skip/todo均0，22,424.8503ms。未修改并发参数、未跳过用例；首个ENOBUFS记录不抹去。 |
| `git diff --check 0bf5b88..4f98d4` | exit0 |
| QA-F3最终浏览器复验 | 最终dist+独立合成fixture `localhost:51020`：中/英同错误hash均立即有1个可见alert；另在外层fixture拦截POST `/api/auth/casdoor/start`直接503，不设置cookie、不触发身份绑定/外部请求，中英启动失败均有1个可见alert；切换原邮箱表单仍1个，无重复。最终英文桌面错误截图实际查看。标签/自有服务已关闭。 |

最终日志：同一D盘专属目录中的`auth-billing-final.log`、`npm-test-final.log`（首次ENOBUFS）、`npm-test-final-retry.log`、`build-final.log`；反例日志和早期失败也保留。验证产物不入Git。本人没有读取真实.env/服务state/账户健康库/照片，没有真实AI/邮件/支付，也未改变主3001已有会话。

**合并判断：最终4f98d4的本地代码/合成HTTP与SQLite/现有完整回归/构建及上述UI范围通过；三项发现全部关闭。** 01可继续既有main集成；未验证项保持上述边界，尤其不构成生产真实收费通过。常规GitHub同步由01集成执行，本06仅精确提交自有测试及此报告。
