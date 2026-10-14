# 参考与工具核查

2026-10-13（America/Los_Angeles）。研究记录区分已观察事实、源码证据、设计建议与未验证能力。

## Cal AI 与 Apple + 健身方向

已通过 agent-reach 的 Exa 搜索以及可用官方网页读取找到正确的 [Cal AI 官网](https://www.calai.app/) 与 [App Store 条目 id6480417616](https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616)。官网宣传拍照、条码与文字录入、营养汇总、Apple Health连接、深色模式；App Store说明问卷→拍照→营养结果，扫描分析需订阅。这些是公开产品说明，未验证实际识别精度，也没有把体积估算宣传当成我们可复用的技术。

搜索出现多个同名应用，未把其它CalAI网站当成本产品。内置浏览器尝试打开www.calai.app被拒，返回该站权限被用户拒绝；停止该浏览动作，没有换浏览器绕过。因此没有Cal AI当前界面的浏览器截图、付费后页面或App实测。LADDER官网与问卷公开文字可读，但未逐步填写/验证整个动态问卷。

本项目的设计建议：Apple系统字体、清晰层级、用户可撤销操作、原生sheet与无障碍；健身感来自训练进度与克制的薄荷绿色，避免伪造健康分数。Cal AI启发的是快速记录与少步骤，不复制品牌/图片/私人接口。自有Forma概念图保存在 [设计规格](design/design-system.md)，是真正生成的原创设计，产品临时名称尚未做商标检索。

## 源码证据

- [FudAI/openGym审计](research/fudai-opengym-audit.md)：FudAI MIT，自有SwiftUI/HealthKit模块候选；web是营销网站、无共同账户云同步。openGym AGPL与专有动作媒体不能直接并入闭源商用产品。
- [SparkyFitness/Mealie审计](research/sparky-mealie-audit.md)：Sparky根许可非商业；Mealie AGPL且计划是规则随机选菜，不是营养优化。独立API边界不自动豁免许可要求。
- [HealthKit官方研究](research/healthkit-architecture.md)：读取权限拒绝不可识别、缺失≠0、睡眠重叠、anchor增删/前台补偿、独立云端与AI同意、真机依赖。

固定SHA、源码路径、依赖与许可证直链在各审计内。参考clone位于reference-sources且被本仓库忽略；本机网站为独立实现，没有复制受限制源码/素材。FudAI的原生模块在iPhone阶段按快照、目录和第三方资产逐项记录复用，当前Web没有使用这些原生代码。

## 当前环境与实际协作

Windows，Node 26.1.0，npm 11.13.0，Git，gh，Python，agent-reach 1.5.0已可调用。项目开始为空，现在已创建独立本地Git仓库。未修改Showroom AI；未创建远端仓库或购买服务。

Claude Code 2.1.293已安装且登录；确实通过CLI禁用工具单轮咨询，成功返回评审。需求简报与真实返回在 [协作评审](collaboration/claude-review.md)。这次CLI仅评审简报，不声称做过源码审查。另一本机交互Claude会话在共享目录提交了 [独立源码与规划评审](reviews/2026-10-13-claude-planning-review.md) 和给lead的请求；root已经阅读并实际在请求末尾回复，统一网站授权与后续契约改造，见TASKS和ADR-M0。独立会话声称的浏览观察不等于本会话完成了被拒的Cal AI浏览。网站由Codex协调的实现代理分目录完成；后续Claude rules/qa属于明确列出的候选而非已派发代码。

REA技能及工具列表已检查：有浏览器/JavaScript/原生/包分析入口，但实际provider及Cal AI iPhone artifact没有验证。本轮完整仓库优先源码工具；没有用REA猜测隐藏后端或恢复私有API。

## Skills 使用记录

| Skill | 来源与用途 | 状态 |
|---|---|---|
| agent-reach | 已安装本地skill，Exa/GitHub/官方资料路由 | 已使用；部分代理Exa遇429后使用可用官方web读取；check-update确认最新 |
| apple-design | 已安装本地skill，原生交互、字体与可撤销体验 | 已使用 |
| frontend-app-builder | build-web-apps插件，设计图先于UI实施、视觉验收 | 已使用 |
| imagegen | 内置系统skill，原创桌面/移动/表单设计及食物示例图 | 已使用；图已复制进项目 |
| security-review | 已安装本地skill，账户/上传/数据API审查 | 已使用 |
| supabase | 已安装供应商skill，仅候选价格与安全评估 | 已阅读，未连接项目 |
| openai-docs | 系统skill，仅官方模型与成本说明 | 已阅读，未使用产品API密钥 |
| built-in-browser | 已安装skill，浏览器研究入口 | 已阅读，Cal AI浏览权限拒绝 |
| reverse-engineer-anything | 已安装skill，判断源码与artifact路由边界 | 已阅读，本轮不做二进制分析 |
| frontend-testing-debugging / playwright | 已安装skill，IAB交互与失败后的本机截图替代 | 已使用，仅访问本机产品 |

root本轮未额外安装Skills；并行Claude会话在项目内安装了healthkit（dpearson2699/swift-ios-skills）、i18n-expert（daymade/claude-code-skills）、swiftui-pro（twostraws/swiftui-agent-skill）、vercel-react-best-practices（vercel-labs/agent-skills），实际清单在skills-lock.json。保留其文件所有权；本轮部分页面代理阅读React技能，其他原生/i18n技能未由root应用或执行安装脚本。开发Skills不是产品健康知识库，后续使用前按需阅读和检查。正式上线仍需专业内容与地区审核。
