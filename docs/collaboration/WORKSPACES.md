# Forma 工作目录与迁移决定

## 当前跨机器同步入口（2026-10-27 / VERSION-ALIGN-01）

用户本轮只授权代码版本、协作规则和任务板对齐。共同分发入口为`Devinshen123/forma-health`的`main`；01继续沿用`codex/fud-food-photo-20261022`及现有checkout，两者以本轮最终回执SHA为准。下面2026-10-21的旧`codex/mac-handoff-20261021`步骤仅作历史，不能再当最新版本入口，也不要按旧步骤安装依赖、运行测试或启动网站。

### 保留与唯一写者

- 保留所有原目录、分支、未提交文件及本机数据。禁止`reset --hard`、`clean`、强推、自动stash、覆盖目录或恢复`public/demo-meal.png`的原删除。
- 01已在本人checkout以保留父提交的合并集成原Windows main的3次文档提交和01的4次文档提交：合并提交`da6cda9c85caa17f5066dc5165d8f79122d0cdd2`，父提交分别为`7e818628528473236f89f51225a41d24259a2282`及`ba4822b7dc54f95950ddf7814ae93b6b5a3b2a61`。产品、测试、依赖和工作流未因该合并改变。
- Windows原目录`C:/Users/devin/健康网站`仍在原位置。01集成checkout为`C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`。用户本轮已明确“原目录保持不动”，因此原目录停留在ba4822b，不做快进或文件更新；不直接更新另一个已checkout分支的ref来绕过检查。当前最新任务板从GitHub main或01集成checkout读取，冻结原目录中的旧副本不能用于新的派工。
- 同一角色的Windows与Mac不能同时写同一份任务/记忆。当前01写者仍是Windows本会话；Mac本轮只做Git状态核对和接收同步，不另开第二个lead写者，不启动员工。
- `.env`、密钥、数据库、上传照片、健康记录、缓存和本机技能路径不通过此次Git同步复制到Mac。

### Mac先报告实际状态

当前连接目录没有在线Mac；没有远程操作或核实Mac checkout。用户在Mac已存在的Forma目录打开终端，执行以下只读命令；不要先运行旧的启动命令：

```bash
pwd
git status --short --branch
git branch --show-current
git log -1 --format='%H %s'
git remote -v
```

回传目录、分支、SHA及是否有未提交内容即可，不发送`.env`、凭据、照片或数据库。如果remote URL带凭据，先去掉凭据再回传。未确认现有写者停写前不要继续；本会话也不会因收到同步任务自动给其他会话发消息。

### Mac接收共同基线（条件满足后才执行）

以下只适用于**原有main分支、工作区干净、Mac现有写者停写**的情况。任何条件不满足，保留原状，先回传状态；不自动改分支、合并本地业务提交或清理工作区。

```bash
git fetch origin
git log --left-right --oneline HEAD...origin/main
# 只有列表没有以“<”开头的本地独有提交，且工作区仍干净时：
git merge --ff-only origin/main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
git rev-parse HEAD:docs/collaboration/TASKS.md
git rev-parse origin/main:docs/collaboration/TASKS.md
```

预期：Mac HEAD与最终GitHub main SHA完全相同，两次TASKS blob也完全相同，未提交内容不被丢弃。若在iPhone等功能分支，或者有未推送提交/未提交改动，停止在只读核对阶段；由01按实际diff设计保留式整合，不把`--ff-only`失败改成强制更新。

尚未克隆时，等用户明确Mac目标位置及确认不会替代已有目录后，再给出克隆步骤；不假定`~/Developer/forma-health`已经存在。

### 本轮不执行

不执行`npm ci`、测试、build、模拟器、CI、启动网站、部署、Apple/Google申请、凭据轮换或真实设备同步。本轮最终SHA、各端已完成/未知状态及保留核对见[对齐回执](deliverables/lead/version-alignment-20261027/alignment.md)。尚未收到Mac回执前，Mac一栏必须保持未完成。

## Mac接手（2026-10-21）

用户授权将已有工作同步GitHub，在另一台Mac继续操作。Windows原项目保持原位，不复制数据库或本机工具缓存。当前配置候选分支为`codex/mac-handoff-20261021`，包含现有网站代码和七人员工MD/记忆/任务配置；配置仍待独立审查，远端main不因此自动集成。这是源代码同步，不是网站部署，也不是用户健康记录同步。

### 第一次在Mac获取

先准备Git及README要求的Node.js/npm（支持node:sqlite；当前Windows验证使用Node 26.1）。在终端执行：

```bash
mkdir -p ~/Developer
cd ~/Developer
git clone --branch codex/mac-handoff-20261021 https://github.com/Devinshen123/forma-health.git
cd forma-health
git status --short --branch
git log -1 --oneline
npm ci
npm test
npm run build
npm run dev
```

浏览器打开http://127.0.0.1:5173。运行npm脚本前，若5173/3001已有本项目服务就复用，不停止其他进程。新克隆不含本机账户、照片、数据库或.env，使用新建的本机测试账户；AI密钥若需要，只在Mac本机.env配置。此处命令是Mac操作步骤，不代表本轮已在Mac执行。

已经克隆过时，先git status检查未提交工作，确认干净后再运行：

```bash
git fetch origin
git switch codex/mac-handoff-20261021
git pull --ff-only
```

若本地不存在该分支，git switch会尝试从唯一同名远端分支建立跟踪分支；有同名冲突或未提交内容时停下保留，不reset、不覆盖。后续独立审查通过后的正式分支以TASKS为准。

### 员工身份和路径

在Codex/Claude Code中打开Mac实际克隆目录。先读AGENTS.md、FORMA.md、TASKS、TEAM-ROSTER，再读本人员工MD、current、三份记忆、status和请求。Windows启动Prompt中的`C:\Users\devin\健康网站`在Mac解释为当前checkout；Get-Location用pwd替代，Git/Node命令保持一致。team-config.json中的projectRoot/plannedCheckout是Windows登记快照，不是Mac已建目录。

接续01时沿用lead身份，先读取memory/lead/HANDOFF.md。本Windows主管结束本次同步交付后等待，用户切换到Mac接手时不要让两台机器同时写lead文件；Mac核对实际分支/SHA、未提交与原写入者停止情况后才能写。其他角色也按相同单writer原则接手，不因克隆自动启动。

### Skills与配置检查

Git包含Skills矩阵、来源/哈希登记与MIT的team-composition-patterns副本；不包含Windows Desktop/D盘共享库、原有.agents/skills和.claude/skills，也不安装02另行准备的移动端技能。Mac先列出实际状态：

```bash
node scripts/verify-forma-team.cjs --portable
node scripts/forma-skills.cjs list lead
node scripts/forma-skills.cjs read team-composition-patterns
```

--portable只验证跨机器配置结构、仓库内必需资源和归档报告哈希；缺少外置Skills会明确警告，不算技能已安装或原生触发通过。完整技能校验仍用`node scripts/forma-skills.cjs verify`，缺失/哈希变化会失败。不要运行configure-forma-team.cjs、configure-forma-skills.cjs或prepare-forma-chat-prompts.cjs来“恢复配置”：它们是Windows初始化生成器，可能覆盖现有入口或记忆。

需要某个外置技能时，先核对其来源和许可，再在Mac准备相应文件。可创建Git忽略的`.forma-local/skills-paths.json`，只映射本机目录，例如（将路径换成已真实存在的位置）：

```json
{
  "handoff": "/Users/your-name/AI-tools/skills/handoff"
}
```

reader优先使用该映射；不要把本机路径映射、凭据或第三方未知许可正文提交。不同版本与登记哈希不符时保留差异并报告，不能伪称与Windows版本一致。技能缺失只阻塞需要该技能的任务，不阻止读取项目MD或运行网站。

---

2026-10-21最新用户要求：原项目继续留C盘，取消D:\Forma迁移。当前主仓库`C:\Users\devin\健康网站`，main，配置前SHA e4c6a1b98761e88ceda84b89ae9688343610b2c5。软件本体、缓存与D盘技能库不迁移。

| 用途 | 路径/状态 |
|---|---|
| 01集成 | C:\Users\devin\健康网站；复用主仓库，不创建同分支重复worktree |
| 00 Dot | 仓库连接未验证，不创建开发worktree |
| 本机交付 | C:\Users\devin\健康网站\.forma-local\deliverables（已建，Git忽略） |
| 临时验证 | C:\Users\devin\健康网站\.forma-local\runtime（已建，Git忽略） |
| 02—06未来worktree | C:\Users\devin\健康网站\.forma-local\worktrees\<编号名>（仅预留，未创建） |
| 原有worktree | 原地保留；完整登记快照见archive/20261021-seven-role-transition/git-worktrees-before.txt |

工具托管的原前端bdd7、后端7f7e、审查9260，以及claude/frontend、claude/backend、claude/review分支工作目录均不擅自重指。D:\CodexTaskData\claude-forma-docs-20261019只是C盘仓库的linked worktree，不是独立主仓库。

本轮读取git worktree list登记12个目录，其他checkout执行git status返回Permission denied；不能确认其干净或无人写入。Claude Code的`claude agents --json --cwd .`返回[]，仅证明该命令当前查询范围没有活动会话，不能证明所有工具/目录均停止。

新增worktree条件：01核对旧writer、未提交工作与分支占用；先提交并独立审查配置；具有Git写权限时使用不同新分支，例如`git worktree add -b forma/02-claude-lead .forma-local/worktrees/02-claude-lead <reviewed-config-sha>`。占用/不干净即停止，不整目录覆盖、不自动合并冲突。尚未执行此命令。

## 开工前未提交内容处理

- TASKS与lead状态：保留原修改快照，当前文档在其基础上整理。
- public/demo-meal.png删除：保留原删除，不恢复、不丢弃、不顺便提交。
- 员工入口、共享记忆、旧ADR：仅本次明确授权的配置增量整理，保留历史；精确提交需单独审查文件。
- .agents/.claude已有技能、skills-lock、handoff与predevelopment：保持原所有者与内容，不整目录加入索引或迁移。
- node_modules、dist、缓存、data、uploads、.env和凭据：不迁移、不复制进新配置。构建仅更新Git忽略的dist。

完整原始状态见同目录归档git-status-before.txt；不把未逐项审查的文件称为已迁移。

## 配置变量（仅名称，未读取.env）

OPENAI_API_KEY、FORMA_AI_DAILY_REQUEST_LIMIT、FORMA_AI_RESERVED_USD_PER_ATTEMPT、FORMA_AI_DAILY_RESERVED_USD_LIMIT、FORMA_AI_GLOBAL_DAILY_RESERVED_USD_LIMIT、FORMA_AI_TIMEOUT_MS、FORMA_AI_RETRY_DELAY_MS。来自.env.example；本轮不重设其值。
