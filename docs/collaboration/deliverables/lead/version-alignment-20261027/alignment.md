# VERSION-ALIGN-01 对齐回执

日期：2026-10-27，America/Los_Angeles。唯一owner：01 lead。范围：用户只批准计划第1项；不启动其他步骤。

## 开工事实

| 位置 | 开工版本 | 已知改动 / 处理 |
|---|---|---|
| GitHub main | `0aa698db7d066655a2f1e10b8a0e156988529773` | 本轮git fetch成功；GitHub连接器读取TASKS也确认旧AUTH切片，缺最新交接文档 |
| Windows 01集成checkout | `7e818628528473236f89f51225a41d24259a2282` | codex/fud-food-photo-20261022，干净，较远端多4次文档提交 |
| Windows原目录 | `ba4822b7dc54f95950ddf7814ae93b6b5a3b2a61` | main较origin/main独有02的3次文档提交；demo-meal.png删除、276个未跟踪文件；原索引无已暂存文件 |
| Mac | 未知 | Desktop Commander仅列出一台离线设备，Codex项目列表没有Mac主机；未连接或执行命令 |

## 已完成的保留式集成

合并提交：`da6cda9c85caa17f5066dc5165d8f79122d0cdd2`。第一父为01的7e81862，第二父为原Windows main的ba4822b；两边独有提交均保留，无冲突、无改写历史。相对01原HEAD仅10项协作文档改变；`server/ src/ ios/ public/ scripts/ package.json package-lock.json .github/`无变化。

已在本人checkout的Git忽略目录保存原目录文件hash清单：`.forma-local/deliverables/version-alignment-20261027/windows-main-before.json`。包含276个未跟踪文件的相对路径、大小、SHA256及原状态，不包含文件正文、环境变量、数据库或凭据。demo-meal.png在新旧提交中的blob相同，原工作区删除不得恢复或顺便提交。

当前统一任务状态已写TASKS顶部；FORMA产品现状纠正为“代码交付、真实开通与验收分别记录”；2026-10-21旧Mac分支入口已标为历史，当前安全步骤见[WORKSPACES](../../../WORKSPACES.md)。

## 同步验收

同步完成必须同时满足：

- GitHub main和01集成分支指向同一最终提交；最终提交包含da6cda9、7e81862和ba4822b三个祖先。
- TASKS的blob在GitHub与Windows共同候选相同。两个正常push须保持快进，不强推；远端有新提交即重新fetch核对。
- Windows原目录更新前确认现有Claude已停写；更新后HEAD一致，276个原未跟踪文件hash逐一不变，原demo删除仍存在，其他本机私有目录原地保留。
- Mac提供其实际checkout、分支、SHA、未提交状态；在不丢本地改动的前提下正常快进到最终提交，TASKS blob一致。没有实际回执即未完成。

### 已执行结果

- `git push --atomic origin HEAD:refs/heads/main HEAD:refs/heads/codex/fud-food-photo-20261022`成功；首轮共同提交为`217a8076be30d5c41ee1211df9ba91a50682bec1`。`git ls-remote`确认两个远端分支相同，Windows主管工作区HEAD相同且干净。
- 首轮TASKS blob为`4ea194fae483af62490421044e57143b5b3270ad`，GitHub连接器按固定217a807读取该文件，返回同一blob与最新任务状态入口。本文及等待状态的后续精确文档提交继续正常同步到两个分支；最终交付SHA以本次最终git log/ls-remote回执为准，不在提交正文中自引用本提交SHA。
- `git merge-base --is-ancestor`确认01与02两个原HEAD均为共同候选祖先；相对7e81862的产品/测试/依赖/工作流差异检查通过，exit0。
- 用户回答“不确定，先保持原目录不动”。已照办，没有更新原C main或任何原文件。再次逐项核验276个原未跟踪文件：变化/缺失0；原git status差异0、HEAD不变、demo原删除仍保留。原目录中的任务板仍为旧副本；当前权威入口是GitHub main和01集成checkout。
- Mac没有在线连接，实际checkout/本地提交仍未知，用户尚未选择第二个问题中的同步方式。本轮不能完成Mac端写入或验收，VERSION-ALIGN-01因此标blocked；不会用Windows/GitHub已完成代替三端完成。
- 文档链接核对、git diff --check及暂存区检查通过。未执行产品测试或构建；无需为本轮纯文档同步启动服务/CI。

## 未执行

未改业务、测试或依赖，未启动/关闭网站或其他进程，未运行测试/build/CI，未部署，未配置域名/邮件/Apple/Google或设备，未触碰真实健康数据。未启动员工或创建新lead写者。Mac凭据、远程连接和本地未推送改动仍未知。
