# IOS-01 独立 iPhone App

用户已明确授权；Mac可用未连接，Developer会员未确认。Windows XcodeBuildMCP list_sims真实失败 spawn xcrun ENOENT，远端设备离线；不把Web窄屏截图当原生App证明。

当前：SwiftUI iOS17原生五页、邮箱账户连接、私有URLSession/Keychain会话、同源训练工作台、导出与删除。原生模拟器编译已成功；工作台草稿持久化修复正待下一轮Mac验证。未签名IPA、未安装iPhone、未发TestFlight。没有HealthKit/Apple/支付扩围。

已验证：根 npx tsc --noEmit exit0；node --import tsx --test tests/ios-contract.test.ts root复跑4/4，实际临时HTTP/DB并关闭。生成器node --check和运行成功，差异空白检查通过。Node契约不等同Swift传输已执行。

审查修复：bootstrap迟到失败必须同generation才清状态；WebKit同时拦导航动作及响应下载/跨源/不可展示MIME；会话cookie仅Keychain不可迁移、密码不持久保存；表单失败保留同UUID。Swift URLProtocol测试已加入Mac测试target。

待用户决定：接入可用Mac进行真机签名/安装；Developer会员与未来TestFlight；最终Bundle ID及生产HTTPS地址。此轮不代选供应商或支出。

首次Mac CI 39189719339：Core单测步骤成功，Xcode16.4/iPhone16Pro iOS18.5构建失败，原因Debug工程试图编译arm64+x86_64但本地Swift Package只有当前arm64；设置Debug ONLY_ACTIVE_ARCH=YES后重试。尚未执行UI，失败不计通过。额外修正原生小正数显示避免按一位小数四舍五入成0，并加测试；Release也另行编译核验。

第二次Mac CI 39189998438：Core21/21通过；架构问题已解决，SwiftUI SleepHistoryCard长表达式触发type-check超时。页面owner已拆为显式String属性，保留相同行为后重试。增加真正Swift URLSession→临时Express API的注册/cookie/me/新增/精确重试/账户隔离/退出测试；CI仅新VM本地3001+独立临时DB，无付费AI，不触本机服务。状态仍待实际运行。

第三次Mac CI 39190242113：App和测试build-for-testing成功。Core21通过；Native4通过，但真实HTTP case因环境未在build-for-testing展开而skip（不能计通过），现已设置TestAction独立环境/MacroExpansion、构建阶段传参并对生成xctestrun预检，结果强制无skip。UI2/4通过（五页原生及训练三gate）；数值两项在AX文本解析处失败，QA改为优先StaticText、忽略空/非数字value后读取label，保留所有原数值断言且增加截图和AX树；不修改生产数值来配合测试。新增cookie恢复的HttpOnly/Secure/域范围测试，另以真实iphoneos SDK生成无签名Release archive。下一轮待实跑。

第五次Mac CI 39191189690（第四次因新提交取消，不计结果）：Core21通过；Native6/6，无skip，包括真实Swift URLSession注册→cookie/me→同步/精确重试/隔离/退出。UI数值场景已通过，五页原生通过；另外两项在滚动Button的isHittable上抛AX activation point invalid，交QA修复正常滚动定位，不能计整体通过。原生合成PNG已下载实际检查，未用Web截图替代；设备archive在当时默认条件下被UI失败跳过，截图sim已关机，下一轮改为独立执行archive并启动sim后截图。

IOS-05 review发现非持久工作台丢active草稿，已采用账户/服务命名持久profile+保留WKWebView，同账户重登沿用Keychain UUID；退出/删除/换账户lock+持久清理队列，失败阻止进入。agent交回4项真实WebKit合成测试，待Mac执行。Library排除备份；Root窗口级遮罩覆盖sheet，取代只覆盖底层SwiftUI页面。Windows仅生成器/差异检查实际通过，不宣称Swift已编译。

追加只读安全复审：Keychain删除失败原来未检查，现先持久保存仅UUID的退出标记，凭据恢复/保存均拒绝；删除仅success/notFound算通过，全部profile清理后移除标记。崩溃重启会按同一标记恢复清理。原生未确认保存遇401时，按server+account暂存原UUID/mutation；相同账户重新验证并核对sync后才恢复重试，换户或显式退出丢弃。未把原生内存pending宣称为跨重启离线队列。UI交互改精确Button/可见frame后定向滚动；卡片纯装饰边框禁hit-testing；下一轮Mac验收。

第六次Mac CI 39192510261 / 376832a：Core21、原生编译、NativeAPI6全部通过；设备Release unsigned archive也实际成功。WK第一测试memory/localStorage断言通过，但模拟HTML的真实location=about:blank，hash导航被正确同源策略拦截；其后首次profile purge报cleanupPending，后3测试开头drain均受影响，不能计4项WK通过；UI当时因Native失败跳过。agent按官方WebKit源码确认：锁定后新启blank导航与clearData helper持有store均会挡remove profile，正在修复释放顺序；真实HTTP fixture改用CI-only 127.0.0.1:3002。后续UI与native独立执行，保留无skip门槛；去掉额外启动父模拟器截图步骤，直接导出原生UI测试keepAlways截图。用户已确认Xcode还未安装或不确定，Mac仍未连接。

## 最终交付验证

Mac CI 39193436826 / a5b65f3，2026-10-19 UTC（当地10月18日），结论success。Xcode16.4/iPhone16Pro/iOS18.5：Core21/21，Native10/10（6网络/格式＋4真实HTTP WebKit生命周期），UI4/4，0fail/skip；build-for-testing与iphoneos无签名Release archive都成功。真实原生PNG已检查，附件位于本聊天visualizations/ios-20261018/final-7，包含xcresult、simulator.app和unsigned.xcarchive；不是Web窄屏截图，不是可直接安装iPhone的IPA。此前失败和skip不隐藏，不按重试次数累加通过数。

Windows本轮已有完整Web build、类型检查、Node iOS HTTP契约4/4成功；后端未改，不重报旧255为新执行。最终文档提交只更新交付记录，不改变a5b65f3已通过的Swift/工程/脚本/CI。GitHub分支codex/forma-iphone-app-20261018，保留main/其它worktree/5173既有预览/源8080服务。没有付费AI、真实数据库或签名资料纳入提交。

仍需本人/可用Mac：安装并首次打开Xcode、设备信任/Developer Mode、选择本人团队和唯一Bundle ID后真机签名运行；自己的设备可先用免费Personal Team，TestFlight/分发会员未确认。尚未接用户Mac或iPhone、未签名安装、未发布TestFlight/App Store、未配置实际完整HTTPS服务。HealthKit/Apple登录未接入；Web下载阻止，原生设置可导出服务端JSON，未同步内容除外；文件上传/导入/相机未真机验证。后续凭据和付费决定仍由用户本人处理。
