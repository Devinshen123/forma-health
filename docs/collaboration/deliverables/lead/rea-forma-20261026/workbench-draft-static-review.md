# REA-FORMA-20261026：iOS工作台草稿恢复静态审查

执行者：01 / lead。日期：2026-10-26（America/Los_Angeles）。正式归属：[唯一任务板](../../../TASKS.md)。

**结论：旧失败已有测试修补候选，当前本机集成线尚未纳入它；剩余问题是修补移植与固定候选验收缺口，不能重新登记成未经调查的产品丢草稿缺陷。** 本轮只完成静态诊断、最小修复设计及未来验收计划，没有改业务或测试源码，没有运行网站、合成服务、测试、构建、CI或部署。

## 范围、归属与基线

- 本人文档checkout：`C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`，分支`codex/fud-food-photo-20261022`，开工HEAD为`2cc01d5f86c25d31508666d48c84004f30deb02c`，开工时干净。只写本目录、任务板及本人status/HANDOFF。
- 原主目录：`C:/Users/devin/健康网站`，`main` / `ba4822b7dc54f95950ddf7814ae93b6b5a3b2a61`，存在他人未跟踪文件及`public/demo-meal.png`删除，保持原状；没有接管。
- TASKS现有IOS-01/05及HEALTH-IOS记录技术助手已交回lead，但这不证明另一个Mac或Claude现在没有写者。本轮未派发、接管或修改iOS路径。以后实施前由01重新确认实际写者。
- Codex应用元数据仅确认`01Codex项目主管`为active、`Forma 前端开发`为notLoaded。原主目录02的status/dispatch最后可见活动为2026-10-24；Claude当前是否活跃、Mac当前checkout及未推送改动均**未知**。未读取内部会话、启动新员工或对外发消息。
- Apple申请是另一任务，仍待用户本人登录及选择个人/公司身份。本轮没有操作任何浏览器，也未沿用Apple待答卡作为静态审查前置条件。

| 用途 | 固定SHA / 对象 | 本轮核实范围 |
|---|---|---|
| 集成源码 | `0aa698db7d066655a2f1e10b8a0e156988529773` | 本机保留的`origin/main`；与本人HEAD的整个`ios/`无差异 |
| 既有修补 | `cf2224d2b963c93d2d3d54e0ee4b058b9286acef` | 仅改`ios/FormaNativeTests/WorkbenchSessionTests.swift`，19增3删 |
| 保留修补的分支 | `548fd62b38440ce17ba374063b6c6933910257c4` | 本机`origin/codex/forma-iphone-app-20261022`；目标测试与cf2224d无差异 |
| 集成线测试blob | `caecf91c7ba63299b74ca5d57edf44b22e6193db` | 0aa698d、本人HEAD及历史Health候选6e02aa0一致 |
| 修补后测试blob | `185bc8ecf6139a1157175d30c3657af0b1e386f4` | cf2224d中的目标测试 |

上述remote-tracking refs仅为本机保留值；本轮没有fetch、查询GitHub实时分支或最新Actions，不能据此宣称GitHub今天仍未合并。cf2224d的本机包含分支清单只有上述iOS远端跟踪分支，未包含集成线。产品`WorkbenchSession.swift`及工作流在两条保留分支之间无差异。

## REA技能使用与证据口径

已完整读取`C:/Users/devin/.codex/skills/reverse-engineer-anything/SKILL.md`，metadata版本39。入口明确要求完整源码仓库使用普通仓库工具，且不运行REA readiness/provider命令。因此本轮使用Git、rg及有界文件读取，不调用REA引擎、运行时或安装；下列编号是**普通源码观察编号，不是REA Evidence ID**。

## 旧失败是否已经修过

1. **已观察到的历史失败**：本地保存的`C:/Users/devin/健康网站/.forma-local/deliverables/health-integrations-20261023/ios-run-40061328110-failed.log`第1287行记录目标用例在`WorkbenchSessionTests.swift:47`比较`missing`与`synthetic-completed-set`失败，第1291行记录同一用例失败。日志SHA-256为`A8C2636D9C654F0022E95FE32AC791A90F4DD37334926150D04A18847F51DB24`。这是旧日志，不是本轮运行。
2. **已有修补源码**：cf2224d第45行改为调用`eventually`；第206–214行按100ms间隔、最多约5秒重新读取；第230及244行将两处导航等待20秒改为45秒。恢复值比较仍在第48行，内存变量应消失的比较仍在第49行。没有修改产品源码。
3. **作者说明与独立观察分开**：cf2224d提交说明称曾5次运行中2次成功，失败既有`missing`也有首次导航超过20秒，并判断为WebKit写盘/启动时序。本轮只核实到提交文字及补丁，未独立核实这5次结果，也未证明“全部只是时序”这一因果判断。
4. **另一旧超时报告**：外部既有草稿`C:/Users/devin/Documents/Codex/2026-10-22/task/task-briefs-20261024/FORMA-DRAFT.md`引述run39745031559 attempt2 / ecb9ac49在第214/218行超时和`navigationFailed`。本轮未获得该次原始xcresult/日志，不把它与40061328110的`missing`断言混为一个已证实原因。
5. **仍未闭合之处**：本机集成线第45行仍单次读取、第214/228行仍20秒等待；没有本轮可用的修补后完整验收证据。已有候选不能标“全新待开发”，也不能仅凭增加等待标“已修好”。

## 固定源码定位与状态路径

除明确标注cf2224d外，以下行号均以固定集成源码0aa698d为准，可用`git show <SHA>:<path>`复核。

| 编号 | 精确源码位置 | 已观察到的机制及限制 |
|---|---|---|
| O1 | `ios/Forma/Infrastructure/WorkbenchView.swift:36–53` | 调用`/api/auth/me`，比较账户ID及webSessionID，再按账户、语言和路由attach；结果过期不授权页面 |
| O2 | `ios/Forma/App/AppStore.swift:282–288`；`WorkbenchSession.swift:28–37,40–68` | 按账户/profile准备会话，校验entry/cookie，串行写cookie并在lock后拒绝晚到任务；本轮未读取任何真实cookie |
| O3 | `WorkbenchSession.swift:69–88,91–92`；`WorkbenchView.swift:71–74` | 已存在视图复用；关闭sheet仅detach回调，保留页面/内存。不是每次关闭都销毁WebView |
| O4 | `WorkbenchSession.swift:95–115,192–223` | lock使会话无效、停载并解除引用；didFinish更新hash后才报告ready；失败/进程终止标记needsReload |
| O5 | `ios/FormaNativeTests/WorkbenchSessionTests.swift:23–48,201–218` | 测试写合成localStorage及JS变量，detach后验证同一视图，再销毁并用相同profile新建视图，最终只读一次；ready超时可映射navigationFailed |
| O6 | 同测试`:59–99,102–135,138–159` | 已有同源不同profile隔离、清理后cookie/草稿消失、lock拒绝排队attach三个用例；存在源码不代表本轮通过 |
| O7 | `ios/Forma/App/AppStore.swift:41–62,87–99,164–169,193–208,265–278` | 暂时无法确认会话时保留隔离草稿；同服务器同账户复用profile；换账户先清理旧profile；明确退出先lock并排队清理，清理失败阻止后续使用 |
| O8 | `WorkbenchSession.swift:253–256,276–305` | profile绑定origin/account，待清理profile拒绝claim；清理失败保留持久队列，不能靠换profile掩盖失败 |
| O9 | `scripts/ios-contract-server.mts:7–18` | 测试服务用临时目录及固定合成HTML，3002不是实际训练工作台UI。该测试验证WebKit储存原语，不能独自证明完整训练草稿业务恢复 |
| O10 | `.github/workflows/ios.yml:3–8,35–46` | push自动触发仅匹配iPhone分支及限定路径；main本身不在该push分支名单。存在PR/手动入口不等于已执行或有分支保护 |

状态链：账户确认 → generation核对 → 同账户profile → cookie写入 → 首次HTTP文档完成 → 写入合成草稿 → sheet关闭detach → 同视图hash切换 → lock/释放 → 同profile新视图 → 读取持久草稿。另一条边界是明确退出/换账户 → lock → 排队清理 → 清理成功后允许新账户；不能为了让恢复测试通过而保留已退出账户数据。

**推断**：集成线继续使用单次持久读取及20秒导航预算，足以解释为什么已有时序修补不能覆盖本机集成候选；这是分支/验收覆盖缺口。异步写盘或冷启动压力是合理假设，尚不是本轮实测根因。若修补后永久读不到值，应继续调查WebKit持久化生命周期，不能继续加等待直到偶然变绿。

**未知**：GitHub实时main是否另有合并、Mac未推送修补、修补后重复运行结果、真实训练业务草稿恢复、真实设备/进程被系统杀死、不同iOS版本表现，以及旧超时的底层错误。报告导航分支仍缺固定候选，未扩展调查。

## 最小修复设计（仅设计，未执行）

1. 01先确认Mac/iOS现有writer及其未提交内容，在允许的干净候选中核实cf2224d是否已经纳入。若实时候选已含相同blob，则跳过移植，直接补齐该候选的验收证据，避免重复提交。
2. 若候选仍是旧blob，仅移植cf2224d的**单个测试文件差异**；不整合iOS分支全量提交，不回退HealthKit、认证或其他产品功能。移植后记录新固定SHA及两个blob身份。
3. 保留恢复值严格相等、旧JS heap消失、同源账户隔离、退出清理及lock竞态断言。5秒/45秒是候选预算，不是已验证的充分上界；不能加入skip、重试到成功的CI包装或把永久缺失当通过。
4. 需要诊断时只给测试添加阶段标识：首次open、复用hash、视图释放、重建open、恢复读取、清理。超时与实际WebKit错误分开记录，仅保留阶段、错误domain/code及用时；不打印URL查询中的账户、cookie、草稿内容或真实数据。
5. 先验收现有修补，再决定是否需要产品改动。该历史合成HTML失败不能直接推出应改真实训练存储；真实业务恢复需另外取得明确范围及固定产品候选。

## 未来失败、恢复与账户边界验收矩阵

全部是未来计划，均未运行。使用随机合成账户/profile及隔离服务，不使用原项目数据库或真实健康记录。

| 场景/触发 | 应有结果 | 失败时恢复/禁止行为 |
|---|---|---|
| 关闭sheet后重新打开stats | 同一WKWebView、JS草稿和存储保留，hash变为stats | 不重新初始化或保存正式训练事实 |
| 销毁后同profile重建 | 持久值最终精确相等；旧window变量为undefined | 超预算明确失败，不改为接受missing |
| 人为永久缺失/错误恢复值 | 恢复断言仍失败 | 证明轮询不会吞掉真正的数据丢失 |
| 初始文档迟于20秒但早于45秒完成 | 修补候选在预算内通过并记录阶段 | 不把首次open与重建open混为同一故障 |
| 文档永不完成/明确导航错误 | 预算到期或收到实际错误时失败 | 不用无限重试、不跳过、不转演示成功 |
| 离线或401，随后同服务器同账户恢复 | 未授权时不展示私有页面，联网确认后保留原隔离profile | 不在验证前展示缓存的账户A数据 |
| 账户A改为B或改服务器 | 不复用A绑定；清理完成后B只能见B | 清理失败时阻止进入，不靠新profile掩盖旧残留 |
| 明确退出及晚到cookie写入 | 立即lock；无新视图复活，cookie和草稿完成清理 | 清理失败可重试，持久队列不能丢 |
| 重建后真实训练业务草稿 | 另行获准后用实际合成业务页面核对组数、编辑、确认保存 | 不以3002空HTML测试替代完整业务验收 |

## 未来可执行命令与预期（现在禁止运行）

前提：执行限制被明确解除、01核实writer、在获准的隔离Mac checkout中准备固定候选及既有依赖；3001/3002无其他服务占用，已有指定iOS模拟器`FORMA_SIM`。端口占用即停止并报告，禁止结束未知进程。下面会启动合成服务和模拟器测试，因此**本轮一条也未执行**；不得以“只是fixture”绕过当前限制，也不通过push/PR间接触发CI。

```bash
# 未来：在明确授权的隔离Mac副本中运行；不读取工作区.env或正式data。
set -euo pipefail
: "${FORMA_SIM:?Select an existing authorized iOS simulator first}"
git rev-parse HEAD
git diff --exit-code
git ls-tree HEAD ios/FormaNativeTests/WorkbenchSessionTests.swift
node scripts/ios-generate-project.mjs
FORMA_AUDIT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/forma-draft-audit.XXXXXX")
xcodebuild build-for-testing -project ios/Forma.xcodeproj -scheme Forma \
  -destination "platform=iOS Simulator,id=$FORMA_SIM" \
  -derivedDataPath "$FORMA_AUDIT_DIR/Derived" \
  FORMA_LIVE_API=YES CODE_SIGNING_ALLOWED=NO

node --import tsx scripts/ios-contract-server.mts > "$FORMA_AUDIT_DIR/fixture.log" 2>&1 &
FORMA_AUDIT_FIXTURE_PID=$!
# 此PID仅是本段刚启动的合成子进程；不操作既有网站进程。
trap 'kill "$FORMA_AUDIT_FIXTURE_PID" 2>/dev/null || true' EXIT
node --input-type=module -e 'let ready=false; for(let i=0;i<30;i++){try{const a=await fetch("http://127.0.0.1:3001/api/capabilities"),b=await fetch("http://127.0.0.1:3002/training-workbench/");if(a.ok&&b.ok){ready=true;break}}catch{} await new Promise(r=>setTimeout(r,1000))}if(!ready)throw Error("isolated fixture not ready")'

for attempt in 1 2 3 4 5; do
  xcodebuild test-without-building -project ios/Forma.xcodeproj -scheme Forma \
    -destination "platform=iOS Simulator,id=$FORMA_SIM" \
    -derivedDataPath "$FORMA_AUDIT_DIR/Derived" \
    -resultBundlePath "$FORMA_AUDIT_DIR/restore-$attempt.xcresult" \
    -parallel-testing-enabled NO \
    -only-testing:FormaNativeTests/WorkbenchSessionTests/testDetachKeepsMemoryAndNamedProfileRestoresDraftAfterViewRecreation \
    FORMA_LIVE_API=YES CODE_SIGNING_ALLOWED=NO || exit 1
done

xcodebuild test-without-building -project ios/Forma.xcodeproj -scheme Forma \
  -destination "platform=iOS Simulator,id=$FORMA_SIM" \
  -derivedDataPath "$FORMA_AUDIT_DIR/Derived" \
  -resultBundlePath "$FORMA_AUDIT_DIR/Workbench.xcresult" \
  -parallel-testing-enabled NO -only-testing:FormaNativeTests/WorkbenchSessionTests \
  FORMA_LIVE_API=YES CODE_SIGNING_ALLOWED=NO
xcrun xcresulttool get test-results summary --path "$FORMA_AUDIT_DIR/Workbench.xcresult"
```

预期：候选身份已固定、5次恢复测试逐次成功（任一次失败立即停，不用重跑覆盖失败）、现有4个Workbench用例全部通过且failed/skipped均0。保留每次xcresult和错误阶段。单用例成功不替代负例矩阵；人为永久缺失和导航超时负例应当失败，必须由后续测试owner明确实现后再验收，当前文件没有这些新增用例。完成专项后才在同一候选执行全Native/Core/UI回归；不把unsigned archive成功当作真机/正式发布通过。

## 本轮实际验证、未运行与发布阻塞

- 已执行：Git状态、固定refs/提交补丁/blob/文件差异检查；有界源码和旧日志读取；日志SHA-256；公开协作文件及Codex会话元数据核对。属于静态核实，非产品实测。
- 读取中的纠正：首次猜测的AppStore路径不存在，随后通过`rg --files`定位到`ios/Forma/App/AppStore.swift`；一次PowerShell多范围Select-Object参数错误已改为带行号的有界读取。没有把这些失败当作源码证据。
- 文档检查：交付提交前执行`git diff --check`和新增报告链接/路径核对；实际结果写入本人status/HANDOFF，不声称执行产品测试。
- 未运行：REA引擎/运行时、任何浏览器动作、网络Git同步、产品或合成服务、npm/swift/xcode测试/构建、模拟器、CI、push/PR/部署；未改业务/测试源码、权限或凭据，未访问真实健康数据。
- 发布阻塞：当前仅允许静态交付；实时远端/活跃Mac写者未知；移植尚未实施；固定候选重复运行、负例及完整回归未验收。自动上线意愿不解除这些限制，本轮无可发布的功能变更。
