# 七身份MD与技能配置交付记录

日期：2026-11-03（America/Los_Angeles）。实施者01 lead；D:/Forma/source，codex/team-superpowers-20261103；BASE为70170640b74c9067291eb2195aef17ca4a6a9fb3。用户已批准方案及独审后上传，仅本配置任务，不改业务或合并main。

## 实施内容

- 00–06七个角色ID、编号、名称、工具建议、协调关系保留；旧12个技能全部保留。其他员工memory/status未改，仅01本人交接更新。
- 登记13个superpowers:流程技能，固定本机现有7.0.2 / 22f0b463e7a5e579904dd6211a520321035526f7；新增50份资源，总25技能/160份资源。只引用上游，不安装、不修改其内容或全局工具配置。
- 公共员工MD新增按需触发和岗位要求；首次接手只读与已有身份正式执行分开。01仍维护唯一TASKS，06独立判断需求符合性和代码质量/安全，不以自测或联署代替独审。
- 生成7份首次接手、7份日常接续模板；START-PROMPTS只做索引，所有文件路径相对实际checkout。新增任务包/审查模板，共享规则仅引用FORMA/AGENTS及SUPERPOWERS适配。
- 配置读取器支持注册名、Superpowers LF规范化hash和本机路径映射；资源缺失或变化时先失败，不输出技能正文。旧技能保留原字节hash语义。配置验证器支持相同host映射，不把Windows默认目录等同于所有工作区。
- 原六份未提交MD来自同一01，已逐文件SHA备份至D:/Forma/backups/team-superpowers-20261103-before；全部纳入79a7ffa候选，没有stash/清理/覆盖未知改动。

## 01实际验证与失败记录

完整日志：D:/Forma/logs/team-superpowers-20261103（私有、本机，不随Git上传）。

- `node --test tests/forma-team-config.test.cjs`：8/8，exit0；实际隔离CLI验证LF/CRLF、正文变化、缺引用、旧字节hash、本机路径映射、非法注册名/hash模式、七身份模板及幂等。
- `node scripts/verify-forma-team.cjs` 及 `--portable`：最终均18/18，exit0。
- `node scripts/forma-skills.cjs verify`：25技能、160资源均通过；既有agent-development缺scripts/test-agent-trigger.sh警告保留，不称原生触发已验证。
- 七身份list、13个新技能read、3个配置脚本syntax、生成器重复执行一致，完整29组exit0。生成器没有创建会话或启动员工。
- 初次结构检查两项失败：共享适配缺“首次”说明，旧Claude验证断言仍查“首轮”措辞；已明确补充首次/日常区别并更新验证断言，再验通过，原失败不冒称成功。
- 独审F1：01套用了共享契约只读/向自己请求通用措辞；7e56e950a842b0b7fe9b033cea3017ce5a79f112改为TASKS本人精确授权内维护契约并加一致性检查，同时使Windows验证器尊重本机映射。该修复后01重跑CLI8/8、Windows18/18、portable18/18，均exit0；是否关闭由独审结论决定。
- `git diff BASE HEAD -- src server ios vendor public package.json package-lock.json` 空；其他员工memory/status无差异。仅配置工具/专项测试/文档变化，不运行业务构建/CI，不读取真实健康数据、.env或凭据，不操作主网站/原Mac/iPhone或视频任务。

## 独立审查与同步

专项审查会话 `/root/team_config_independent`，工具Codex；独立于01实施者，不冒称Claude。独立checkout D:/Forma/worktrees/qa-team-superpowers-20261103，固定候选复验，唯一跟踪写入为本人新审查报告。

正式[独立报告](../../qa/team-superpowers-review-20261103.md)对7e56e950a842b0b7fe9b033cea3017ce5a79f112给出需求符合性、代码质量/安全双通过，F1关闭；审查员另独立检查旧字段/技能、50资源与上游逐项匹配、全部生成输出与HEAD一致及139本地链接，并执行非法映射/篡改资源反例。原报告a619b655f1221b6f09d60097a4c9a73fcd960ad4精确cherry-pick为2fc06c503a1f8d1a7631067c71d589897e9b264b，没有改结论。

配置源树在7e56e95冻结，后续仅独审报告和01交接/状态元数据。原独立审查者另复核收尾至a19d600415561da8bd740313b88aa2e0e6eec0fb：仅5份授权MD变化、配置/业务树和报告blob原样、70本地链接有效、diff检查通过，无未解决阻断。

01随后再次核远端main仍7017064、配置分支尚不存在，正常 `git push --set-upstream origin codex/team-superpowers-20261103` 成功。`git ls-remote --heads` 核实配置分支为a19d600415561da8bd740313b88aa2e0e6eec0fb、main仍70170640b74c9067291eb2195aef17ca4a6a9fb3，本机工作区干净。没有force、main合并、部署或网站重启。后续收尾提交仅更新本回执/任务板/本人交接元数据，也需独立复核后正常上传；最终SHA以该分支HEAD、实际远端及交付回复为准。

## 未验证边界

未验证Mac实机、Dot连接、Codex/Claude原生自动触发或七位员工实际接手；显式读取和portable结构检查不能代替这些结果。两项旧外置专业技能仍需每台机器提供既有合规副本和host映射。没有业务/iOS修复、付费、生产发布或部署结论。
