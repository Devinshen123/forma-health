# Casdoor / Lago 独立审查修复与集成

2026-11-03；01 / lead；D:/Forma/source，codex/fud-food-photo-20261022；本轮起点a72d72da0c4ae894f0a536db2edd9d3204f9bb18。用户已授权独立审查、修复、通过后main/GitHub集成，禁止真实收费。当前进行中，不冒称已获独立通过或main合并。

## 独立审查安排

正式派工AUTH-BILLING-REVIEW-06，新的独立子会话qa_auth_billing_independent；独立D盘worktree/codex/qa-auth-billing-20261103，初始0bf5b88c55cc65749732b425e044c4cf11880a32，base76dcbe2。未复用上一轮辅助审查者，不创建第二lead；旧06历史目录/记忆不接管。独立报告及本人运行记录由审查员在其专属报告提交，01不代写其结论。

原账户/库/附件/配置及服务另作本轮before私有备份：D:/Forma/backups/auth-billing-review-20261103/before，77文件，3SQLite在线快照检查通过，Lago归档可列出；未演练完整恢复，不覆盖先前备份。

精确补充：上述77份包括数据库/服务配置/会话，data/uploads当时为空；原data/backups下4份非数据库私有备份文件另存before-data-files并逐项SHA通过。此前将这4份笼统称附件不够准确，本轮按真实类别记录，不声称有4张用户照片。40张本轮初始表中39完全相同，仅已验签通知body摘要增加8项，原账户/健康表、4私有文件与实际.env完全相同，完整性/外键通过；未覆盖或回退用户当前数据。

## 发现与修复（待06复验）

- **QA-F1，P1，06独立动态复现**：本地删号与Lago客户初始化并发，旧异步请求可在远端DELETE后又创建客户/订阅，而清理意图已被删除。06测试提交8f259a2，01精确cherry-pick为12addc7；01在修前重跑2/2失败，分别覆盖GET挂起和POST已在途。修复在客户/订阅/快照/套餐/结算的外部写前与await后检查本地owner；DELETE成功后若该owner仍有refresh/mutation在途，持久清理意图保留，排空后再次DELETE才完成。另保证billing off时删号也排队，重新启用worker可清理。只保留opaque ID，无邮箱、照片或健康事实。
- **LEAD-R1，01发现并复现**：首次复制.env.example后Casdoor setup因其中空配置项拒绝初始化。CLI合成回归先1失败/1通过；现仅将空Casdoor占位项替换为托管区块，保持其他配置、拒绝覆盖非空未托管凭据，重复运行配置不变。2/2通过；只用隔离合成.env，不访问现用配置/服务，需06独立复验修复SHA。
- **QA-F2，P2，06独立动态复现**：计费临时off时删号不排外部清理，重新启用后Lago用户残留。06红例2ec201b精确cherry-pick为1aa49fb，修复无条件保存清理意图；与01先补的同类回归重叠，保留06独立用例、撤除重复测试。06另52b4cc7将专属测试临时根改系统tmpdir；01原billing测试也改为tmpdir，Windows实际命令仍显式D，Mac不要求D路径，不冒称Mac实测。
- **QA-F3，P2，06独立动态复现**：启用Casdoor后登录弹窗默认不渲染旧表单，错误/提示却只在旧表单内，平台取消授权返回时无反馈。06合成隔离浏览器验证`#auth=error&code=AUTH_CONSENT_DENIED`默认alert=0、切原邮箱表单后才alert=1。将error/notice放到所有模式共享位置、各只渲染一次，平台入口失败和回调错误均可直接提示；等待06以相同隔离流程复验。

01本人修复后：专项20/20、最终全套`npm test`469/469（fail/skip/cancel=0、22.46s）、含QA-F3页面的完整`npm run build`通过（既有大chunk提示保留），真实开源Lago隔离联调16/16通过，未扣真实款/请求真实AI/改主健康库。日志D:/Forma/logs/auth-billing-review-fix-tests-20261103.log、auth-billing-review-fix-build-20261103.log、auth-billing-review-real-lago-20261103.log；这是01验证，06仍需独立复验新SHA。

复验时06继续复现QA-F1网络延伸：客户端超时后Promise排空，但远端事务仍能晚commit，原清理意图已丢。第四独立反例3ee5ce7、跨磁盘重启增强fcee06f、测试句柄释放修正f44ade3已精确cherry-pick（d207268/83a27ec/9d03279）；首次增强测试因SQLite句柄after顺序在Windows清理报EPERM，由06修测试后保持同一隐私断言。01新增第6表billing_deleted_owners，原子写opaque删除标记+队列、迁旧pending、持久退避重试（15秒起/上限1小时），本地账户存在时不删除外部客户，不保留个人内容。23项专项已全部通过，包括超时晚commit→关闭/重开SQLite与服务→推进时钟→重新删除，另验证队列/标记原子回滚及旧pending迁移；需06复验最终SHA，不能沿用861feed的中途通过项。

真实付款仍未配置；现有Lago只开源loopback sandbox。本轮不注册商户、不添加支付密钥、不公网部署，原健康库不作回归测试目标。

最终加固候选01验证：23项专项、全套471/471（16.13秒、fail/skip/cancel=0）、完整build及真实OSS Lago隔离16项通过。最后三份日志D:/Forma/logs/auth-billing-review-final-tests-20261103.log、auth-billing-review-final-build-20261103.log、auth-billing-review-final-real-lago-20261103.log。Casdoor已有合成账户真实签名/原会话/PKCE7项也由01本轮重新执行通过（auth-billing-review-real-casdoor-20261103.log），未用主健康库。上述均为01结果，尚不替代06独立新SHA结论。
