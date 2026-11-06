# FORMA-INVOICE-PAGINATION-STATIC-20261105

执行者：既有01 Codex项目主管，角色ID lead；未创建第二主管。实际记录日期2026-11-04，America/Los_Angeles；任务ID中的20261105沿用用户交接，不作为执行日期。范围仅静态代码/文档复核和合成测试设计。

**结论：已核的本机版本和最新远端main仍缺账单分页遍历；可构成沙盒权益误降为Free的条件性风险，未运行复现，不能推断真实用户受影响。所有下列验收均为NOT RUN。**

## 接单、去重和写入范围

- 已读D:/Forma/source的AGENTS、FORMA、TASKS、01员工MD及本人PROFILE/MEMORY/HANDOFF/status。源文件仅静态读取，没有import或实例化服务、Store、计费客户端。
- 本机TASKS、已知requests/deliverables/reviews及billing测试中未找到本任务或已完成的账单分页专项；已有分页命中属于动作库/健康接入。GitHub仓库索引查询本ID和invoice pagination无结果；远端main任务板的新任务是PR2/PR3、日期/旧base冲突，不是本问题。可见会话索引也无同名任务。本次没有重复派发产品修复；未查询到不等于所有外部/未提交工作均不存在。
- 远端main已有另一Mac上01的近期任务记录，是否仍在写未知；不猜测原writer已停。由于本机规则/任务板分支与最新main不同，本轮不fetch/切换/整合、不改共享TASKS/他人或本人旧交接，只在用户获准的新本人交付路径写此报告。不是第二套任务板或接管Mac工作区。
- 本轮禁止运行应用、测试、构建、CI、真实Lago/API、SQL、真实支付/AI/邮件；不读.env/健康记录、不登录/安装/建凭据/改权限配置、不修业务代码、不Git推送/合并/部署/公开发布、不接触iPhone或视频/其他项目。读取GitHub仓库静态文件不调用运行中的Forma或Lago服务。

## 精确版本记录

| 对象 | 本轮只读核实结果 |
|---|---|
| 本机实际checkout | D:/Forma/source |
| 本机分支 / HEAD | codex/team-superpowers-20261103 / 754fd2409164d06f52d66b004131eedeb64b5735 |
| 开工dirty | 空，工作区干净；没有覆盖已有改动 |
| 该配置分支远端 | 754fd2409164d06f52d66b004131eedeb64b5735 |
| 当前远端main | 33853944a954d861aa6838187cfdad42c63cf338，git ls-remote核实；不能继续把7017064称为最新main |
| 用户原线索main | 70170640b74c9067291eb2195aef17ca4a6a9fb3，仅用作历史比较 |
| service.ts Git blob | 2901cee31bd730f46d289a98fa678769f9d32a73；本机HEAD、历史7017064及远端3385394相同 |
| tests/billing.test.ts blob | 307cda512eb66f2954843e41b76657f38f03a1d9；本机与所读远端3385394相同 |

远端最新提交题名为关闭已独立审查的PR2和PR3，涉及日期/冲突与文档，不含账单分页修复；不能把其测试/合并结果当成本任务证据。本报告版本范围仅上述固定提交；之后或其他分支/未提交的修复未知。未访问运行网站，浏览器旧release参数不证明运行版本。

## 静态调用链和实际位置

以下行号对service.ts的三个相同blob均适用。

1. `BillingService.invoices(owner)`：[service.ts:62](../../../../../server/billing/service.ts#L62)至68。63只发一次`GET /invoices?external_customer_id=<owner>&per_page=30`，不带page；64只解析`list.invoices`且每次最多30行，未读`list.meta`。66对这批ID分组、并发5个详情请求；该offset循环只是**详情分批**，不是列表分页。67直接返回，第二页无任何读取路径。
2. `paidForPeriod`：service.ts:21–25。要求owner相同、finalized、payment_status=succeeded、币种匹配；同一订阅lago_id及external_id；正金额subscription费用且plan_code相同；账期覆盖now、结束时间与当前订阅结束相差小于1000ms。这些过滤应保留。不能只凭“有已付账单”或创建时间授予Pro。
3. `refresh`：service.ts:74–88。76读取上述截断列表；78校验active及当前账期；79通过列表some判paid，未匹配则effectivePlanCode变为free_test。82在有效套餐相同时取**同一订阅响应**的entitlements，否则取Free计划额度；87形成`available:true / reason:ready`的快照，88才保存。本地测试模板Free=3、Pro=100来自注入fixture/既有文档，不是生产价格或当前实机配置核实。
4. `analyze`：service.ts:108–115。111先await snapshot，112才按快照额度reserve；ledger.ts:26–34会在used+reserved达到limit时拒绝。因此在条件满足时，误判不仅影响显示，还可能按Free额度拒绝新增识别。此为静态推断，未调用AI或SQL验证。
5. `LagoClient.request`：client.ts:6–19，只负责一次请求、JSON读取、1MiB响应限制、超时及错误映射；没有自动翻页。router.ts:9及14 await snapshot；本机app.ts:527将BillingError按status/code返回。刷新中的账单请求异常不会被转换成确认未付款；只有service.ts:84对异步current_usage有独立catch，该catch不包围账单读取。
6. 失败持久化/显示：refresh账单阶段抛错时到不了88的ledger.save；本机ledger.ts:48只在被调用时更新快照，未见snapshot错误时读旧数据库快照作为授权fallback。Billing组件:12–18错误仅设置error，不自动生成Free快照；可能保留既有UI state并显示错误（静态结构，不是浏览器实测）。

### 条件性风险F1（建议P2：沙盒正确性，未复现）

条件：计费按代码支持的sandbox模式有效启用；订阅为当前active pro_test；第一页30张均不满足paidForPeriod；第二页存在唯一符合全部条件的已付款当前账期Pro账单。

当前静态路径：只读第一页 → some=false → paid=false → effectivePlanCode=free_test → 使用Free entitlement；在设计fixture中是3而非100。问题在于把**不完整扫描中的“未找到”当作确认未付款**。没有证据证明当前运行实例有此类账单排列、超过30张、功能已启用或真实用户受影响；本轮没有运行该用例。

### 分页元数据契约的静态参考

按项目既有说明所用Lago OSS v1.56.0参考上游源码，不核实本机容器或实际部署版本：

- [InvoicesController#index](https://github.com/getlago/lago-api/blob/v1.56.0/app/controllers/api/v1/invoices_controller.rb#L57)将external_customer_id交InvoiceIndex。
- [InvoiceIndex](https://github.com/getlago/lago-api/blob/v1.56.0/app/controllers/concerns/invoice_index.rb#L30)传pagination.page/limit，并用CollectionSerializer输出invoices及meta。
- [Pagination](https://github.com/getlago/lago-api/blob/v1.56.0/app/controllers/concerns/pagination.rb#L21)的metadata含current_page、next_page、prev_page、total_pages、total_count；page缺省为1，next_page在末页为null。空集合合法返回current_page=0、total_pages=0、total_count=0、next_page=null，不能一概只允许正数。总数可能经缓存且数据会变，不代表多页原子快照。
- [CollectionSerializer](https://github.com/getlago/lago-api/blob/v1.56.0/app/serializers/collection_serializer.rb#L15)保留meta。当前Forma的client不会丢弃它，但invoices函数未消费它。

所读上游blob：invoice_index.rb=882a76dc6da5099ffcc825159cadf64717a406d2；pagination.rb=824e527d939cd738443592d6fe88e7107274f650；collection_serializer.rb=6c0ec72bb442265acbadb1ae608f84303cb2c48f。v1.56.0为参考tag，不声称已验证运行镜像或tag永不变。

## 已有测试覆盖与缺口（仅阅读，NOT RUN）

- tests/billing.test.ts:111–117直接测paidForPeriod，含已付款、未付款、owner/订阅/费用缺失和旧账期；没有列表翻页。
- 同文件:119–139通过假transport测订阅切换、未付Pro只给3、同响应entitlements及账期结束后拒绝；128的账单列表始终为空，且没有meta。新分页契约实施时需将这类fixture明确补为合法空集合元数据，不能靠忽略元数据掩盖问题。
- tests/auth-billing-review-20261103.test.ts:77的假账单列表也为空，关注删除竞态，并非分页验收。
- scripts/verify-lago-local.mjs:44–58有单笔账单模拟结算与100额度断言，但未构造第二页；本轮仅阅读，**未运行该脚本**。
- 旧471项、86专项或其他PR的通过记录均不证明本任务分页正确；本报告不复用为当前通过结论。

## 最小修复建议（未实施）

1. 在原invoices函数内部显式从page=1迭代，保留owner过滤、per_page=30、每页最多30行校验、详情owner/schema校验及最多5个并发；不要简单增大30或解除全局限制。保留现有paidForPeriod及同订阅entitlements规则，不改支付/账期权限定义。
2. 校验并消费metadata：非空页current_page应与请求一致，next_page需正常前进；空首集合允许上游0/0/null形态。到有效末页才可确认“完整且未匹配”。按受控数字page构造同源路径，不跟随meta提供的任意URL。
3. 按lago_id去重，检测回指/重复页、不前进或矛盾元数据，设置总页数/唯一账单数及总耗时预算。预算值为后续待明确的实现常量，当前不改配置。达到限制或无法证明遍历完整时应报“无法核对”，不能当作已确认未付款。total_count缓存/并发增删造成不一致时保守失败或按明确策略重试，不承诺原子多页快照。
4. 不吞第二页/详情错误：保留BillingError路径，终止本次refresh，不调用ledger.save或新reserve/AI。操作层以抛错表示unknown即可，最小方案不必扩大BillingSnapshot公开类型或为不完整结果保存Free。
5. 维持现有账期开始/结束及最终checkedAt复核，分页变慢不能延长已过期授权。不扩展为真实收费或后台同步重构。

这里建议完整、受预算的扫描，是为了保持现有invoices同时服务显示与授权的形状。以后如需分离“账单列表分页显示”和“付款证据查询”，须另定契约，不属于本次静态任务。

## 合成验收设计：全部NOT RUN

未来只有获得执行授权后才将下表转为测试。不能在本轮import BillingService/Store/createApp：构造可能初始化SQLite或定时器。未来transport只返回预设JSON、不转发fetch，不连3442/3001；固定owner/订阅/账单UUID和假时钟，禁止每请求随机更换订阅ID。若未来框架需合成SQLite，须在后续授权下使用独立D盘临时库；本轮不创建、不查询数据库。

共同fixture：同一owner、active pro_test、账期包含固定T，订阅entitlements.monthly_limit=100；Free计划monthly_limit=3。每页30，所有列表ID及详情符合当前schema。第一页30张为本owner但旧账期/其他不符合条件账单；第二页第31张是同订阅、本期、finalized/succeeded、USD、正subscription费用的Pro账单。meta第一页1/next2/total2/count31，第二页2/nextnull/total2/count31。路径断言必须检查query.page和external_customer_id，不可仅判断pathname后对每页返回相同内容。

| ID | 合成输入/步骤 | 待执行预期 | 状态 |
|---|---|---|---|
| T01 核心反例 | 第一页30不符合，第二页符合；调用snapshot，不调用真实transport | 实际请求page=2；paid=true、effectivePlanCode=pro_test、usage.limit=100；旧实现预期不能满足，但未运行证明 | NOT RUN |
| T02 首页面等价 | 当前符合账单在唯一第一页、meta.next_page=null | paid=true、limit=100；无多余下一页请求，原正确行为保留 | NOT RUN |
| T03 旧账期不授予 | 完整两页只有旧账期已付款账单 | 完整扫描后paid=false、effective=free_test、limit=3 | NOT RUN |
| T04 未付款/草稿/费用不符 | 两页逐一替换为pending、draft/voided、无正subscription费用/错误plan | 不授予Pro；保留全部原paidForPeriod规则 | NOT RUN |
| T05 第二页失败 | 第一页成功、page2抛错/超时/HTTP5xx/无效JSON，分别设计 | snapshot拒绝、受控不可核对；不返回paid=false的ready快照，不保存Free，不新reserve/发AI | NOT RUN |
| T06 第二页详情失败 | page2列表成功但目标详情请求失败/schema无效 | 同T05；不能跳过详情后当确认未付款 | NOT RUN |
| T07 合法空集合 | 首请求返回[]，meta为current0/total0/count0/nextnull | 正常结束；Pro无付款证据则false/3，无page2；不因空页0元数据误报非法 | NOT RUN |
| T08 满30末页 | 唯一页恰好30，nextnull | 正常终止；不能仅按length===30无限请求下一页 | NOT RUN |
| T09 短页仍有next | 第一页少于30但有效meta指向下一页、后页有证据 | 按有效元数据继续，不能仅按length<30提前结束 | NOT RUN |
| T10 页边界 | 30/31/60/61张，合格证据位于最后页；另单页返回31行 | 合法多页均可定位，页请求准确；超每页上限受控失败，不静默截断 | NOT RUN |
| T11 跨页重复ID | 相邻页部分重叠，且随后有新的合格ID | 去重详情及输出；不因重复重复计数或丢失后续证据 | NOT RUN |
| T12 回指/循环/不前进 | next回到本页/旧页，重复页或current与请求不符 | 有界失败，不循环、不将部分结果存为确认未付款 | NOT RUN |
| T13 缺失/非法元数据 | meta缺失、next非整数、非同源URL、负数或矛盾页数 | 不跟随任意URL，按无效/不完整响应失败；不得默认为遍历完成 | NOT RUN |
| T14 资源预算 | 正常页前进但超过未来MAX_PAGES/MAX_IDS/总时限；分别等于界限及超过 | 界限内正确终止；超限明确无法核对，不以false/Free成功返回 | NOT RUN |
| T15 账期/账号边界 | 翻页期间假时钟越过periodEnd；或详情owner不符、订阅ID不符 | 过期拒绝；跨owner保持现有403；错误订阅不授予，不能放宽校验 | NOT RUN |
| T16 失败后恢复 | T05失败后恢复正常的完整两页并重试 | 不残留rejected refresh promise；新请求可成功true/100；失败阶段不提交部分Free | NOT RUN |
| T17 元数据随增删变化 | 分页过程中count/total_pages变化或空页仍宣称有后页 | 按已明确的保守一致性/重试策略有界结束；不以不完整数据确认未付款 | NOT RUN |

T05/T06的“不保存/不reserve/不发AI”是未来合成观察点，不是本轮SQL或运行结果。当前源码未读page2，不能把从未发出的第二页错误当作已正确处理。验收设计须经后续授权与固定修复候选复验后才能标PASS。

## 未知、阻塞与下一步

- 未知：运行网站对应SHA、账单真实数量/顺序、实际功能是否启用、部署Lago版本/自定义分页上限和元数据形态、并发增删频率、原Mac 01是否仍写入、其他未公开分支/未提交工作。
- 静态报告可交付，不以这些未知阻塞本轮；它们阻止“已复现/已修复/真实受影响/已通过验收”的结论。新修复任务需先协调原writer和最新基线，不能在此配置分支直接修业务。
- 本轮不修改共享任务板或旧交接以免覆盖远端Mac更新；仅此获准本人新文档，未提交/未推送。可由已有06岗位仅静态复核此报告及测试设计，禁止借复核运行测试/应用/构建/真实服务。未取得具名复核前不自称独审通过。

固定源码链接：[远端service.ts](https://github.com/Devinshen123/forma-health/blob/33853944a954d861aa6838187cfdad42c63cf338/server/billing/service.ts#L62)、[billing.test.ts](https://github.com/Devinshen123/forma-health/blob/33853944a954d861aa6838187cfdad42c63cf338/tests/billing.test.ts#L111)、[远端TASKS](https://github.com/Devinshen123/forma-health/blob/33853944a954d861aa6838187cfdad42c63cf338/docs/collaboration/TASKS.md)。

## 具名静态复核回执

既有06岗位 `/root/team_config_independent`（Codex，独立于本报告撰写者）在本会话返回：**静态报告与测试设计复核通过，无阻断发现**。复核对象为追加本回执前的报告Git blob `9c63d1ffdee891b344343eea26190f4da93557c6`，raw SHA256 `E1DA2B89138801506ED3121B0CF81D868C3BE5F8F343F10221CEC629AE06358D`；本节仅由01追加具名来源，不改原分析或设计。

该岗位自行只读核对固定远端main/本机blob、调用链/行号、失败传播、既有测试缺口和上游三份分页源码，确认T01–T17全部保持NOT RUN。没有替01改文件，没有运行应用、测试、构建、CI、真实Lago/Forma API或SQL。此结论仅为**静态报告/设计复核**，不是漏洞运行复现、修复关闭、付款权益或产品/测试验收通过；本报告仍未提交/推送。
