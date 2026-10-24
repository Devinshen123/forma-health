# AUTH-INTEGRATE 验证 · 2026-10-24

执行者01 lead，checkout `C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`，分支`codex/fud-food-photo-20261022`，起点e853428。按用户选择完成邮箱密码、Google及Apple网站登录流程，保留原账户与健康模块。

本人实际完整`npm test`：先428/428通过，新增合成旧库迁移用例后最终429/429通过，fail/cancel/skip均0，最终17942.9492ms。本人完整`npm run build`通过，含TypeScript、主站、工作台、伙伴乐园、1037白名单源码、离线壳与5,632动作媒体SHA校验；原有chunk体积提示保留。构建时尚未提交，release identity需提交后重新生成，不能将起点SHA称作新功能发布SHA。

助手独立报告：后端7/7、既有API+拍照14/14；QA独立44/44真实签名HTTP测试，之后新增旧库迁移用例由root最终429全套执行通过。本人429全套包含这52个新增用例与既有回归。独立审查发现的SQL占位和已删账户旧ticket重建问题已保持严格断言修复，详见[QA报告](../reviews/authentication-20261024.md)。

本人CUA浏览器：`http://localhost:5173/`隔离DB与注入邮件收集器，所有外部网络拒绝；合成账号登录→安全页请求验证→链接进入显式验证页→地址片段移除→验证→刷新显示已验证。找回密码请求返回通用提示，恢复链接进入重置表单，明确提交后返回登录，新密码可登录原合成账号。原人类账户、真实邮箱及第三方账号未参与。新浏览器页面验证未配置Google回调安全返回本站、地址片段移除并显示未配置，无错误覆盖层，console error/warn 0。

手机390×844视口：登录对话框337px，页面clientWidth/scrollWidth均375，无横向溢出，Google/Apple未配置状态、密码显示按钮和忘记入口可见；已恢复默认视口。截图保存在原C盘Git忽略的`.forma-local/deliverables/authentication-20261024/{mobile-login,verified-account}.png`。合成服务和标签已关闭，未把测试账号写入正式数据库。

未验证：真实Google/Apple开发者配置、官方跨站授权、真实邮件送达/Apple私密邮箱relay、iPhone原生快捷登录、Safari真机及大数据量迁移。完成代码与本机测试不等于这些服务已开通。实际本机配置状态、发布SHA与备份回执由部署后单独补记。

## 本机发布回执

产品提交`5e6b34ccb90d3554cf0a01ef1ca59e0ef5d9d55c`已推送GitHub main与codex/fud-food-photo-20261022，ls-remote核对一致。提交后重新生成源码分发/release-info/离线壳，发布至D:/AI-tools/forma-health/releases/20261024-5e6b34c，current.json指向此版本，原C data/.env保持。迁移前已在原私有data/backups完成SQLite一致性备份，未打印数据或进入Git。

切换前检查发现旧PID54104已经停止、3001无监听，未执行计划中的终止步骤；旧日志无诊断信息，原因未证明。核实端口空闲与旧pointer后启动新PID63520。实际HTTP sourceCommit为上述完整SHA，邮箱密码available=true、mailConfigured=false、Google=false、Apple=false，foodPhoto.available=true。实际IAB原拍照示例账户仍保持登录，设置中旧会话可用，新增安全页、邮件/快捷登录缺配置与Fud已配置均正常，console0；未修改该账户密码/验证状态或健康记录。截图live-sign-in-settings.png，页面保持打开。
