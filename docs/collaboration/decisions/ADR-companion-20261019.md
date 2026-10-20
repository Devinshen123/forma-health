# PET 服务器养成契约与评审

2026-10-19 用户要求实现视频功能并上线，允许真实 Claude Code。lead 维护共享 src/companion.ts、src/api.ts；backend维护独立数据库/路由，features维护界面，QA合成验收。新 Page 为 companion，桌面导航及移动更多菜单提供入口，手机原五项底栏保留。

真实Claude Code计划评审会话：57ee7120-a0d2-437c-acdf-08046360d14f；CLI exit0，Read/Grep/Glob只读工具，实际读取AGENTS/TASKS/方案/共享类型/store/app/api/types，未读data/.env、未调用云产品AI。原始prompt和JSON回执位于本机TEMP/forma-companion-20261019，不把Codex子agent冒称Claude。

评审的两个阻塞已转实施：

1. 可变时区＋旧快照可能回填历史：只对保存事务首次观察的新有效当日事实发奖，seen-facts登记旧基线；claim只读已结算数据，server时间用于账本，客户端时间不能获额外额度。同localday与UTCday双去重，rest与训练同movement任务。
2. HTTPS代理/临时盘：显式0..3可信代理跳数、HOST/PORT/FORMA_DATA_DIR，单实例持久盘与TLS；不得把serverless临时文件系统或localhost称上线。实际供应商尚待用户确定。

其余采纳：邀请码64随机bit、单账户持久20次/小时限流（失败也计）、最多2人、对加入前奖励不追溯；表外键/成员级联、自己导出、另一成员退出/删号废止；REST和工作台投影不重奖、游戏账本不依赖健康事实的删除；新账户0 XP与demo不联网。邀请码仅成员可读，保留现有string契约，满员无法再次加入；暂不实现公开排行、消息、付费箱、设备连接或原生UI。

实际测试与最终代码复审在完成后追加，计划评审不等于产品已通过。

同一真实Claude会话最终代码只读评审CLI exit0、无权限拒绝、无子agent，结论没有阻塞；static核实事务/身份/新事实/跨户/HTTPS/移动CSS，不冒称其运行测试。5项非阻塞收口：界面后台15s改静默GET与用户操作优先；代理配置安全默认0且部署必须明确可信跳数；睡眠自身记录时区归日；对应源码包改严格文件类型与固定JSON/通知名单，拒绝落在源码目录的JSON导出、HAR、日志、CSV、PDF；结束挑战保留48h结果、隐藏过期邀请码并可新建。补中文错误码。

最终lead实际 `npm run build` exit0（5632动作/11328文件SHA通过，工作台84文件、对应源码883文件、offline shell edf89e724a325ab6）；串行Node测试288/288、0失败/跳过/取消。旧工作台动态导入/大包提示仍存在，本轮伙伴没有引入新的相关提示。源码白名单2项专测包括误放导出/附件/trace禁止；backend Store9项、QA独立HTTP18项均计入完整测试。最终浏览器和容器实证见状态和QA文档，正式HTTPS公网尚未部署，不能将模拟代理验收等同真实域名上线。
