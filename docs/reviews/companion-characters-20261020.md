# 原创 3D 风格伙伴验收

QA 范围为 CHAR-04。只使用临时数据库与合成账户，不读取真实 `data/`、`.env`、私人健康记录；HTTP 随机 loopback 端口，未启停用户服务。生图、Claude Code 合作及实际界面浏览器操作由 lead 负责，本报告不把这些操作记为 QA 亲自执行。

## 已实际验证

`node --import tsx --test --test-concurrency=1 tests/companion.test.ts`：exit 0，21/21，0 failed、0 skipped。

- 新账户默认芽芽，0XP；全部六个角色免费可选，不依赖箱子、XP 或档案完整度。
- 选择后独立 GET 及同账户第二次登录会话读取本人选择；另一账户保留自己的默认角色。
- 新 PUT 与旧端点同样要求有效 cookie、`X-Forma-Account` 及可信写入 Origin。缺绑定或跨账户返回401；无 Origin/外站 Origin 写入返回403。
- 非法类型、空值、缺字段、未知角色、大小写变体、路径值及额外 XP/装备/owner 字段返回400，拒绝后整份快照不变。
- 已赚60XP、6参与天、已开箱/未开箱、叶子装备、今日任务及双人挑战同意记录在多次换角色后完全保留；另一成员快照与健康事实快照均不变。
- 导出含本人所选 `seal`；删号后原会话401，所有带本人归属列的 companion 表行均被删除，另一账户不受影响。
- 原18项奖励原子性、防重、历史/时区刷取、装备/宝箱、挑战隐私、到期48h与导出删除回归继续通过。

资源落盘后最终专项：`node --import tsx --test --test-concurrency=1 tests/companion-art.test.ts tests/companion.test.ts`：exit 0，22/22，0 failed、0 skipped。

`npx tsc --noEmit`：exit 0；资源与 HTTP 最终专项同时复核。`git diff --check --` 后接本任务五个所有权文件：exit 0，仅 Git 本机 LF/CRLF 提示。最终 UI 整合构建由 lead 统一运行。

## 合成浏览器夹具

`tests/browser/companion.mts --serve-only` 保留外置证据与独立合成数据目录，仅由 lead 在确认5173可用后启动。

- fresh：`companion-fresh@example.test`，Sprout/芽芽，0XP。
- grown：`companion-qa@example.test`，Peach/桃桃，180XP、6参与天、2未开箱。
- friend：`companion-friend@example.test`，Mochi/糯糯，0XP。
- ended：保留当日UTC午夜结束、48h结果窗内本人1参与天的挑战。

本轮 QA 仅扩展并静态检查夹具，未启动固定端口或自动化浏览器。真实凭据沿用夹具中的合成专用密码，不用于任何真实账户。

## 实际资源与待界面验收

资产测试 `tests/companion-art.test.ts` 已实际通过：六套 full/thumb WebP、双语身份、正方形尺寸、alpha0/255、图像完整解码、颜色非空、单图及总移动端体积预算。六张主图运行时摘要互异，不是同一文件换名字；无固定hash锁死。

实际12张文件总计229,968 bytes；主图25,882–37,966 bytes、缩略图5,700–8,142 bytes。资源检查证明格式、alpha、尺寸与编码可用；角色是否可爱、配件对齐及浏览器显示仍由实际视觉验收判断。

静态审查发现原离线壳白名单未包含新 public/companions 图片，已通知 lead。lead 正将这些公共静态图片加入白名单与内容hash；本 QA 不修改该脚本，也不把尚未执行的最终离线浏览器行为记为通过。

lead 的真实 CUA 检查清单：

1. 演示模式逐一预览六个原创角色，明确仅预览；无私人 API 写入，离开/切身份后预览复位。
2. 合成账户更换角色，刷新及重新登录仍保持；切换到另一个合成账户恢复其个人选择，不泄漏上一账户的头像或通知。
3. 首页卡、成长页与衣橱预览使用同一选择；装备/换下仍可用，配件不遮住眼睛或漂到角色外；角色选择不改 XP/任务/箱子/挑战。
4. 请求失败时保留既有角色并允许重试；繁忙/账户切换时迟到响应不能覆盖新账户。
5. 390px 宽度无横向溢出，角色选择触控区域可用，键盘焦点/读屏选择状态清楚；中英文姓名/简介/成功错误提示一致；减少动态设置无持续动画。
6. 全部图片真实加载且 alpha 正确，没有棋盘格背景、缺图或巨大资源。当前交付是 3D 风格渲染图，不宣称实时3D模型。

未验边界：真实 iPhone Safari、设备 GPU/低内存、弱网完整体验、实际公网部署均不能由上述 HTTP 或静态检查代替。
