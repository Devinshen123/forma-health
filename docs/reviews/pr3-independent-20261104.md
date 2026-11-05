# PR #3 独立审查（2026-11-04）

执行者：专项06 / qa-pr3；独立于01实现。初始候选 `2dc5d1e320c76c6669abc7ce1fdc88f8ab20871b`，基线 `70170640b74c9067291eb2195aef17ca4a6a9fb3`。最终验收候选 **`6d2114ae63c15d0e0ed67c858be9217afbeb7742`：本次独立审查通过**；F1/F2及F2跨标签页延伸均修复并本人复验关闭。下文均区分本人实测与实现者修复，不以01历史测试为本报告证据。

## 边界

本地独立review checkout：`/Users/shendejun/.codex/worktrees/forma-web-date-fix/运动健康网站-GitHub最新版/.forma-local/reviews/pr3`。仅新增自有测试和本报告；产品只读。使用合成账户、随机loopback监听端口、独立临时SQLite。自有测试临时数据写本checkout `.forma-local/review-evidence/` 并清理。不读 `.env` / 真实data / 健康附件，不访问真实模型、付费服务，不占3001或5173监听端口，不push或merge。

## 已确认发现

### PR3-F1 / P2：语义409提前覆盖草稿和附件400

初始候选 `server/app.ts:342-344` 在 `validateTransition` 返回合法旧base冲突后立即抛异常，跳过后续 genuine AI draft / asset ownership 校验。

独立真实HTTP反例：合法旧base建议接受，同时新增schema合法但assetId不存在的report；以及新增schema合法但aiDraftId/assetId伪造的AI meal。两种反例在PUT和sync均返回409 `PLAN_BASE_CONFLICT`，应保持400。四项红例全部独立复现；失败snapshot/revision/entityVersions保持，未观察到非法数据写入。

### PR3-F2 / P2：后台refresh持续重发被拒绝的接受

初始候选 `src/sync/engine.ts:100-109` catch保留失败queue但不阻止后续refresh；`src/App.tsx:176` 每15秒及online事件调用refresh。与本PR API契约和ADR“不自动重试接受”不符。

独立真实HTTP SyncEngine反例：save返回409且保留1批待同步，export保留原接受，无CAS dialog，resolve(true)未重基。模拟两次后台refresh后POST从1次变为3次。状态仍未写入，但后台重复发送被拒绝的接受。测试未使用完整浏览器计时器，而是直接调用同一refresh入口。

01初次修复候选 `a7af4f1aab55596b1707b6d94528e1e8c0bdc4b0` 将语义409后移到draft/ownership校验之后，并持久化本地planBaseBlocks。本人独立组合专项40/40通过。继续延伸发现同一F2的跨标签页遗漏：`src/sync/engine.ts:141` discardInvalid的persist(settle已观察批次)可能合并另一标签页新增的暂停批次，但其后无条件clear暂停集合，再refresh导致该未被放弃的失败批重新POST。合成cache模拟另一标签页的未知mutationId/blocks，真实HTTP观测POST由3变4，预期保持3。新增独立红例提交 `b85fc73a0fcd2959b7724aaee1932221a6684d61`；留给01修复，不在06改产品。

## 初始本人实测

- `node --import tsx --test server/pr3-independent-review.test.ts`：8项，4通过、4失败，均为F1。
- `node --import tsx --test server/plan-base-conflict.test.ts server/pr3-independent-review.test.ts`：17项，12通过、5失败；作者专项8/8，独立专项4/9。第五个红例为F2。
- 自有HTTP控制组通过：不合法status/acceptedVersionId/新增accepted suggestion/child parent/patch均400；混合删除已引用附件与新增completedAction的合法旧base接受409且snapshot/revision/entityVersions、资产、cleanup intent和receipt无变化；PUT与sync一致。
- 扩展持久暂停测试后，旧候选独立专项10项4通过6失败；新增失败为没有持久暂停字段。缓存transport为测试内合成IndexedDB事件实现，调用真实storage合并和consent代码，并通过真实HTTP发送同步请求。
- 初始完整test/build未跑：先等待独立审查者完整验证时段，并在01修复后对新固定SHA一次验证。

独立红例提交：`51f1988b69eac759e48246fe939677916b01d68a`（F1/原子性/输入控制）；`84b76fbb3e1a48b1c0f4e11c118c439c51d12b87`（F2）。01负责产品修复，06未修产品。

持久暂停、恢复入口和显式flush本地拒绝控制提交：`a4721e853d5f698046fc43fe1ceb8f3ca15163b4`、`3a7fde5f37cbe7e40383d169553f481a607ed045`。显式flush可在本地抛可识别409，而不得重新HTTP发送；这保留明确失败语义，并未削弱原关键断言。

## 最终本人复验

完整验证时段由01明确GO后执行；顺序运行，不与另一独立审查者全套/build并发。安全切换最终固定SHA，未覆盖本报告或他人内容。工程命令显式使用上述review工作目录；所有最终运行设置 `TMPDIR="$PWD/.forma-local/review-evidence/tmp"`，本地日志位于 `.forma-local/review-evidence/`。

| 命令 | 本人结果 |
| --- | --- |
| `node --import tsx --test server/plan-base-conflict.test.ts server/pr3-independent-review.test.ts tests/sync-client.test.ts` | 40/40，退出0，2.82秒；其中自有测试10项 |
| `npm test` | 496/496，退出0，18.09秒，无跳过/取消 |
| `./node_modules/.bin/tsc --noEmit` | 退出0，无诊断 |
| `npm run build` | 退出0，包含素材hash核验、主站、workbench、companion、source archive、release identity和offline shell；release identity精确为6d2114a完整SHA |
| `git diff --check` | 退出0 |

构建有outDir及大包体积提示，不影响本次完成；未将其冒充失败或本PR新增问题。测试/构建没有改动受版本控制的产品文件；提交前仅本报告未跟踪。

最终独立反例全部转绿：非法附件与伪造AI草稿在PUT/sync保持400；合法旧base接受保持结构化409且响应只有error/code；失败整批snapshot/revision/entityVersions、事实、计划、资产、cleanup intent、receipt均不变。作者专项本人实跑确认正常接受和补偿undo追加历史、拒绝旧建议可保存、手动stale parent仍400、过期revision/CAS仍原409、另一账户不变/错账户401。

客户端独立实跑真实HTTP确认：保留原失败queue/base和可导出状态，不出现CAS自动重基；后台refresh不重发。显式flush在本地抛PLAN_BASE_CONFLICT而无HTTP。持久标记经reload/reauth/reconcile保留，旧缓存空blocks合并不能清除暂停；恢复后status.error非空，符合SyncPanel显示导出/明确放弃入口的条件。明确放弃清理queue/blocks并允许新事实正常保存。跨标签页discard仅移除已观察批次，保留合并进来的未知暂停批次，不重发；之后可明确放弃其余批次。

静态确认sync在事务内validate之前不提交状态，异常rollback；PUT在save/资产清理前validate。F1修复只延后语义冲突，未放宽schema/不可变历史/草稿归属。F2修复将暂停标记限制为本地cache的mutationId集合，未将其上送API或改写base。

最终候选相对 `0b85bd719c514bdde6472915d3ac64a9f54b1f9d` 的合入不改变app/validation/sync engine/storage或自有测试，产品叠加仅PR2日期功能；相对已集成PR2的main `62d8c4c`，除PR3外只有PR2独立测试EOF空行删除。没有产品合并冲突或绕过反例断言。

## 限制与交付

本轮为HTTP、同步引擎、合成IndexedDB事件transport、类型和构建验收；未运行完整浏览器UI/真实浏览器IndexedDB跨标签页，也未声称真实服务、真实账户数据、生产部署或收费验收。SyncPanel恢复入口由实际status.error及只读组件条件核对，不冒称浏览器点击验收。该范围内无未关闭发现，允许01依既有集成流程合入main并同步GitHub；06本人没有push/merge。
