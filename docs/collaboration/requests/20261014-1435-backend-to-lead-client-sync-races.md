# 客户端同步独立只读审查：队列与账户边界

2026-10-14，backend；审查范围仅 src/sync、App.tsx、api.ts。以下行号是审查时快照，不是实现后的行号。未改 root 文件、未启动服务、未重复跑后端满测试。Lead 已在消息中接受并开始修复。

## 需修复

1. **P1 / 401 和账户切换清空离线事实。** App.tsx:154–156 的 sync save 401 调用 resetSession；186–188 的 reset 统一 stop(true)。Storage session-change:211–212 也走同一路径。pending 已在 IndexedDB 保存，随后在未导出/确认丢弃的情况下被清除。重新认证/账户换切应停止并封存旧队列；真正 logout/delete 才按明确行为清理。新账户不能重放旧队列。
2. **P1 / 两个标签互相覆盖队列。** storage.ts:16 完整 accounts.put(snapshot,queue)，每个 engine 有独立 RAM queue。标签A离线保存X，标签B旧状态的 persist([])会覆盖X，刷新A后记录消失。需同一IDB事务合并稳定mutationId，明确ack/discard写settled账，防旧标签再添加已确认或放弃项；较新snapshot与queue合并结果应读回engine。不能因排序/新队列插入而用 shift 确认错误batch。
3. **P1 / 退出失败使当前引擎UI回调永久失效。** App.tsx:200 先增加 sessionEpoch，201 在线logout失败直接throw。既有engine callback捕获旧epoch，账户仍登录但以后成功保存不再更新UI。应成功后再切epoch或失败恢复引擎回调。
4. **P1 / 请求无结束上限。** api.request 的 fetch没有同步请求的 timeout/abort，performFlush一直保留flushPromise/busy，App.save的saving也不释放。对getMe/getSync/POST sync给有界Abort；POST超时继续保留相同mutationId，重试靠服务端幂等确认，不能生成新ID盲重发。
5. **P2 / 冲突审核的缓存失败状态。** engine.resolve先替换snapshot/queue并清conflict，之后await persist才重建ready。若IDB失败，queue是新mutation IDs但ready仍是旧IDs，flush不会发，原冲突也已清除。应先持久化临时新结构再激活，或完整回滚snapshot/queue/ready/conflict四组状态。

## 已排除与补充

- getMe明确返回user:null不会进入boot catch，不会自动读取最后账户缓存；问题是在HTTP错误（包括401）也进入缓存fallback。Lead已确认仅fetch TypeError允许fallback，并限制已验证的账户ID一致。
- 账户所有权服务器继续强制X-Forma-Account；以上主要是本机队列丢失/显示和恢复问题，未发现服务端跨账户写入的绕过。
- lastAccount目前单独meta事务写入。修复storage时建议accounts与meta同事务；clear读meta后再删的独立事务可能删掉期间新账户的lastAccount指针。封存旧账户队列的迟到写入也不应把它标成当前离线账户。
- mutation payload建议入队时深拷贝，保持重试内容不因外部next对象后续编辑而变化。原始服务端hash账已正确检测异payload，但客户端不应让正常重试走到这种错误。

## 验收

独立QA负责客户端测试。至少涵盖：401后重认证恢复相同队列；A→B不得重放A、A队列仍能经A重认证取回；两个同账户engine并发persist保留并集、ack/discard不被旧标签复活；在线logout拒绝后UI仍正常；never-settle运输有界恢复、同ID重试；resolve缓存失败保留可审核/可导出的完整状态。

Lead批准的修复方向：账户换切stop(false)、明确logout/delete才clear；IDB事务merge+settled ID账+高revision snapshot+storage reconcile；ack按ID移除；boot只对TypeError缓存fallback。后续由backend只读复核，root负责实现。

## 二次复核与 storage 分工

- 进一步确认 authenticated 不同账户仍曾stop(true)，同账户 getSync 失败提前换epoch，以及全局hint在快照成功前切B都会破坏恢复/绑定；已交lead处理。
- resolve 应只给真正改变payload的batch新ID，未审核的独立batch保持稳定重试；lead已修改。迟到409应关联实际发送ID，不能拿重新排序后的queue[0]。
- disable只看RAM pending不够：另一标签已持久化但当前标签未reconcile的队列会被静默删除。clear必须同事务检查最新queue；已撤回同意要轮换generation，旧writer不得重建私有缓存。
- lead另派backend独占 `src/sync/storage.ts`，已实现账户consent epoch CAS、原子requireEmpty clear、incoming相对顺序优先、settled过滤、同ID異payload拒绝、较新snapshot、撤回后readLast排除。只在明确grant或旧缓存同意迁移时允许创建epoch。
- `npx tsc --noEmit`：通过；独立 `tests/sync-client.test.ts`：11/11实际通过；随后完整 `npm test`：153/153通过（QA期间新增并发恢复用例也通过）。没有固定端口服务或真实供应商调用。
- 追加服务端退出边界：有效session校验账户hint，无session保持幂等；lead批准，实际cookie B配hint A/缺hint拒绝且B仍登录。最终targeted API+客户端24/24、完整155/155、tsc通过；测试不依赖已解析结果或真实用户目录。
