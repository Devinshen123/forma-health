# 网站M0验收记录

2026-10-13，America/Los_Angeles。地址 [本机网站](http://127.0.0.1:3001/)。构建后的静态前端和真实API在同一个本机服务中运行，只绑定127.0.0.1；不是公开邀请测试部署。

| 项目 | 结果与证据 |
|---|---|
| 构建与类型 | npm run build通过，TypeScript＋Vite；1594模块，bundle约362KB（gzip约112KB） |
| 后端测试 | 11/11通过，server/api.test.ts：账户隔离、跨标签身份错配不落入B账户、修订冲突、私有附件、删除、重启与版本约束 |
| 页面与错误遮罩 | 内置浏览器正常显示Forma；最终3001静态bundle非空，无Vite遮罩 |
| 新账户与问卷 | 初始指标为—、无演示记录；六步继续/跳过/确认、按账户草稿 |
| 饮食审核 | 350g标定、520kcal基准，半份175g实际260kcal、19g蛋白质、27g碳水、8.5g脂肪；真实私有照片保存 |
| 训练 | 实际保存45min/RPE6/3组×10次×16kg，重启后仍存在 |
| 跨午夜睡眠 | LA时区10/12 23:30至10/13 07:00，7.5h，归属10/13；修复datetime-local即时input并复测 |
| 接受与撤销 | 45→30min先看原因/diff，接受新增版本；撤销新增补偿版本回45，原实际记录保留 |
| 复盘与缺失 | 三类各1/7天记录；真实260kcal、45min、7.5h；缺失为—，明确未调用AI |
| 人工报告与英文 | 合成报告保留<0.5、mg/L及原文范围；英文切换标签成功，用户内容不自动翻译 |
| 导出与退出 | IAB点击导出完成，退出恢复演示；导出为记录＋附件元数据，不是完整附件备份 |
| 重启持久化 | 停dev、重建、npm start；IAB及独立Edge上下文登录仍看到260kcal、45min、7h30m和报告<0.5 |
| 最终控制台 | 独立Playwright/Edge的pageerror与console.error均空；早期Vite的WS警告不在最终bundle中 |
| 视口与原尺寸 | 1440×1000、390×844、原概念1505×1045；无页面横向溢出，修复hero断字 |
| 视觉对照 | view_image original检查概念及最新实现；核查布局、字体、配色、图标、容器、间距、图片；允许差异见design/fidelity-ledger.md |

IAB实际闭环：注册→确认计划→饮食份量审核/照片保存→训练保存→手动睡眠→建议差异审核→接受→补偿撤销→复盘→人工报告→英文→导出→退出。没有AI供应商调用或伪造识别。

IAB截图初次展示成功后连续返回 Unable to capture screenshot；按前端验收工作流改用本机Playwright/Edge生成截图，没有绕过本会话Cal AI站点权限拒绝。临时截图脚本已移除，用户要求的参考与最终截图保留。截图禁用有限过渡动画，避免抓取视口变化中半露侧栏。

合成验收账户与私有附件已通过API删除，未删除人类账户或记录；后端测试用独立临时目录。默认页面保持演示模式，可创建自己的本机账户。

未接通/未验证：AI识图、OCR/医学解释、Apple OAuth/邮件验证、HealthKit真机、跨端云同步、离线队列、Safari/真实iPhone浏览器、VoiceOver系统实测、TestFlight、付费、正式合规与公开托管。固定规则不是AI，当前并非完整双端MVP。

[运行说明](../README.md) · [产品计划](PRODUCT-PLAN.md) · [费用](COSTS.md) · [接口](API-CONTRACT.md) · [设计概念](design/dashboard-concept.png) · [原尺寸截图](design/desktop-native.png) · [手机截图](design/mobile-render.png) · [Claude协商回复](collaboration/requests/20261013-2220-claude-to-lead-planning-review.md)
