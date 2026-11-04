# Forma员工对话Prompt

2026-11-03。保留00–06七身份。Windows主目录D:\Forma\source，Mac使用实际checkout，Prompt中的文件均为仓库相对路径。生成命令只写适配文本，不创建对话/启动员工/安装技能。

| 编号 | 身份 | 新会话只读接手 | 已有身份日常任务 |
|---|---|---|---|
| 00 | Forma 00｜Dot总协调 | [首次接手](agent-prompts/launch/00-dot.prompt.md) | [日常接续](agent-prompts/resume/00-dot.prompt.md) |
| 01 | Forma 01｜Codex项目主管 | [首次接手](agent-prompts/launch/01-codex-lead.prompt.md) | [日常接续](agent-prompts/resume/01-codex-lead.prompt.md) |
| 02 | Forma 02｜Claude Code项目主管 | [首次接手](agent-prompts/launch/02-claude-lead.prompt.md) | [日常接续](agent-prompts/resume/02-claude-lead.prompt.md) |
| 03 | Forma 03｜产品经理 | [首次接手](agent-prompts/launch/03-product.prompt.md) | [日常接续](agent-prompts/resume/03-product.prompt.md) |
| 04 | Forma 04｜前端工程师 | [首次接手](agent-prompts/launch/04-frontend.prompt.md) | [日常接续](agent-prompts/resume/04-frontend.prompt.md) |
| 05 | Forma 05｜后端工程师 | [首次接手](agent-prompts/launch/05-backend.prompt.md) | [日常接续](agent-prompts/resume/05-backend.prompt.md) |
| 06 | Forma 06｜独立审查员 | [首次接手](agent-prompts/launch/06-reviewer.prompt.md) | [日常接续](agent-prompts/resume/06-reviewer.prompt.md) |

复制对应文件的text代码块。01优先复用现有lead；新会话未确认原writer交接前不能接管。首次接手与已有正式任务执行分开，最新用户范围优先。00的Dot连接、Claude Code/Codex原生触发及Mac配置均须实测，不能从文件存在推断。

唯一职责定义见各员工MD，共享流程见[SUPERPOWERS](skills/SUPERPOWERS.md)，任务与路径仅见[TASKS](TASKS.md)。历史启动文本保留在archive，本入口不重复嵌入七份全文。
