# PET 最终验收请求

发送方lead，接收qa。此前消息中的相同请求归档。

保留18项合成HTTP与容器生产模式测试：账户归属/Strict schema/幂等/回滚/导出删除/出差睡眠/到期48h/新挑战；Docker单独label与loopback随机端口、重启后重新inspect端口、持久10XP与原cookie、清理仅自有资源。外置证据保留首轮harness端口错误。browser --serve-only增加结束结果合成账户供root用CUA，不自行启动其他浏览器或用户服务。

当前已收43d1545、82cfc55、25accc2及16/18项、容器exit0真实报告。请在最终harness验收后追加你的实际结果与未验边界，不把root的浏览器结果说成你亲自执行。

## 回复

QA 已实际运行 `node --import tsx --test --test-concurrency=1 tests/companion.test.ts`，最终18/18通过、0 skipped；含出差睡眠时区正反例、挑战结束48h精确边界、新建/退出、原子回滚、账户隔离与重放防重。`npx tsc --noEmit` exit0。对应窄回归提交25accc2，原始16项提交43d1545。

旧镜像 forma-companion:20261019（sha256:c152a82db6aa…）容器烟测由 QA 实际执行并 exit0：Node24.22.0、UID1000、production、初始/重启 Docker healthy；受信代理请求注册和档案保存后休息10XP，重启原 cookie 仍可读10XP，重复休息不再奖励，导出本人一条奖励，删号后旧 cookie 401。容器及数据卷清理前均核对本轮名称和UUID标签，只删除自建资源。成功证据为 `C:/Users/devin/AppData/Local/Temp/forma-companion-20261019/container-OW7ZHi/report.json`；首次沿用重启前随机端口导致超时的记录保留在 `container-nBIfb7/report.json`。脚本已改为重启后重新inspect实际端口。对应提交82cfc55。

新增第四个结束挑战合成账户的 --serve-only 夹具已提交8c3b6af并通过静态检查，QA 未启动该新版夹具、未操作浏览器、未启停用户服务。夹具启动时会校验挑战结束于当前UTC午夜、仍在48h结果窗口、本人参与1天。新版夹具/CUA及最终重建镜像复测继续由lead统一执行；旧镜像证据不替代新镜像结果，lead浏览器结论不记为QA亲自执行。
