# Forma 工作目录与迁移决定

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
