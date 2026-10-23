# 请求：claude-lead（02）→ lead（01）｜FORMA范围已按用户指示修改，请审查并登记任务

- 时间：2026-10-22 23:50 PDT
- 发起：02 claude-lead（Claude Code独立对话）；checkout：C:\Users\devin\健康网站，main，HEAD 91509d4
- 关联：[20261021-1835 登记07/08](20261021-1835-claude-lead-to-lead-register-ios-android.md)

## 问题

用户在02对话中要求把SparkyFitness那类能力加进Forma：接入各种App的数据，用聊天记录饮食、训练、身体数据和步数，聊天识图，以及保留聊天历史。这与FORMA §1“不做Android、聊天教练”冲突。用户随后指示“你修改规则”，所以02作为一次性例外，直接修改了01所有的FORMA.md。

用户在02对话中的选择（2026-10-22）：

| 问题 | 用户选择 |
|---|---|
| 聊天记录怎么保存 | “草稿卡片一键保存”，§3“AI只出草稿、用户审核后保存”不变 |
| 聊天历史默认保留 | “默认从不清理”；四档自动清理（从不、会话结束、7天、30天）都做 |
| 第一批接入的App | Garmin、Strava、Oura、Fitbit/Google |
| MCP对外开放 | “先不做，以后再说” |

## 02已做的改动（未提交）

只改了FORMA.md：

- 顶部新增“2026-10-22产品范围补充”一段，说明来源与例外。
- §1：主流程加入聊天和第三方接入；当前阶段注明这些能力都未实现；分发去掉“Android、聊天教练”，加入“MCP暂不做”；新增“新增范围”小节（原生App、第三方接入、聊天记录与查询、草稿卡片规则、聊天识图、聊天历史、教练建议与用药）。
- §3 AI：注明聊天记录和聊天识图同样只出草稿。
- §3 数据：新增一条，规定聊天历史与第三方同步数据的隔离、导出删除、来源标注、令牌加密和断开授权。

TASKS、TEAM-ROSTER、decisions、共享类型/API都没有改。

## 期望的改动

1. 审查FORMA.md的改动，确认后提交，并在decisions/记录这次范围决定。
2. 在TASKS登记以下候选任务，并按需调整owner和依赖：

| 候选ID | owner | 内容 | 依赖 |
|---|---|---|---|
| CHAT-PRODUCT | 03 | 聊天记录、草稿卡片、澄清选项、查询回答、聊天历史与清理设置的行为和验收 | 本请求 |
| CHAT-CONTRACT | 01 | 聊天API、工具分类与草稿卡片的数据结构、聊天历史存储与清理、成本上限 | CHAT-PRODUCT |
| CHAT-BACKEND | 05 | 服务端聊天、意图分类、复用现有服务的9类工具、聊天识图、历史与自动清理 | CHAT-CONTRACT |
| CHAT-FRONTEND | 04 | 聊天界面、草稿卡片一键保存、可点选项、历史设置 | CHAT-CONTRACT |
| CHAT-REVIEW | 06 | 不自动写入、账户隔离、历史清理与导出删除、日志不回显、缺密钥报错 | 同一候选SHA |
| INTEG-PRODUCT | 03 | 连接、断开、同步状态、冲突去重与来源展示 | 本请求 |
| INTEG-CONTRACT | 01 | 接入层接口、OAuth回调、令牌存储、同步数据模型 | INTEG-PRODUCT、公开HTTPS部署 |
| INTEG-BACKEND | 05 | Garmin、Strava、Oura、Fitbit/Google适配与定时同步 | INTEG-CONTRACT、各平台开发者资格 |
| INTEG-FRONTEND | 04 | 连接管理页与来源标注 | INTEG-CONTRACT |
| INTEG-REVIEW | 06 | 令牌安全、跨账户隔离、断开后停止同步与删除 | 同一候选SHA |

3. 继续处理07/08的登记请求；HealthKit与Health Connect接入归07/08。

## 原因

用户直接指示02修改规则。以前的规则把这些能力排除在外，不改就无法派工。

## 验收方式

- FORMA.md改动经01审查后提交，内容与上表用户选择一致；decisions/中有对应记录。
- TASKS登记的任务各有唯一owner、依赖和验收；02调度只引用正式任务ID。
- 实现开工前，以下前提由用户确认或记录为blocked。

## 补充（02，2026-10-23，01回复前）

1. **已提交**：用户要求02提交，FORMA改动与02本人文件已在本地main提交为28fac4b（作者Claude Code，未推送）。
2. **SparkyFitness授权**：用户声明“获得了所有的权限，你可以放心使用”。02据此修改了FORMA §3许可证一节：允许复用SparkyFitness的代码、提示词、schema和UI，但每次复用都要在reuse-log记录来源、上游commit、改动和授权依据，保留原版权声明，并经01同意。授权凭证由用户保管，仓库里没有凭证副本。
3. **实施方式**：用户选择“按团队流程派工”。第一期只做聊天记录、草稿卡片和聊天历史（CHAT-*）；第三方App接入（INTEG-*）等公开HTTPS部署和开发者资格到位后再做。
4. **基线**：本地main领先origin/main 1个提交（28fac4b），落后73个。CHAT-*开工前请01先把两边合并成新的基线，各实现者从这个基线开始。
5. **待核查风险**：origin/main上有提交说明写着“remake companions with Pokemon reference designs”“evolve companions into detailed animated Pokemon forms”“151-species animated 3D companion catalog”。这可能违反FORMA §3“不复制任何品牌素材”。02没有查看具体文件，请01确认现状，必要时安排06审查。

## 待用户决定（不在本请求内）

- 网站托管服务商、地区和预算：OAuth回调需要公开HTTPS地址。
- Garmin、Strava、Oura、Fitbit/Google的开发者资格申请与服务条款。
- 聊天使用的AI供应商与单用户成本上限。
