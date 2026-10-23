# Forma · 训练、饮食与长期习惯

Forma 提供中英双语网站：饮食记录、训练、手动睡眠、趋势与周回顾，以及独立的 SwiftUI iPhone 工程。

## 当前版本

- **5,632 个动画动作**：中文/英文/编号搜索、器械与肌群筛选、18区正背面人体探索、动作教学和动画播放；保留旧记录ID兼容。
- **完整训练工作台**：计划/轮转、收藏、自定义动作与器械、逐组训练与计时、历史统计、围度/体重/进步照、备份导入导出，复用Forma账户。
- **6位实时3D伙伴**：按用户要求参考妙蛙种子、皮卡丘、杰尼龟、胖丁、卡比兽与伊布重建立体造型，保留胖嘟嘟的比例。主形象可拖动旋转、摸摸、呼吸和眨眼，支持暂停与减少动态效果；1/3/5/10级解锁基础、叶翼、星星与花瓣光环。每100XP升一级，沿用服务器记录结算与账户隔离；成长外观预览不增加经验。衣橱配饰具有3D形态，头像从同一模型导出。选择按账户保存，切换保留XP与装扮；免费里程碑宝箱及自愿双人挑战。XP仅为游戏进度。
- 饮食拍照/文字/手动草稿审核、份量与宏量编辑、训练和睡眠记录、可解释计划调整及版本历史、数据导出和账户删除。识图密钥未配置时保留手动流程。
- [独立iPhone工程](ios/README.md)：原生五页与同一后端，详细训练工作台由同源WebView复用。历史Mac CI构建与合成测试已通过；用户真机签名、TestFlight、HealthKit和Apple登录尚未完成。

## 安装与完整动作库

要求 Node.js 22.13+ 或 24。源码包含完整索引/步骤、伙伴图片和工作台；约173MB独立授权的动作视频/缩略图保存在配套GitHub Release附件，避免遗漏资源或把大批二进制加入Git历史。

1. 克隆本仓库main并执行 `npm ci`。
2. 从 [2026-10-22 完整发布](https://github.com/Devinshen123/forma-health/releases/tag/forma-20261022) 下载 `forma-exercise-library-20261022.zip` 和 `SHA256SUMS.txt`，核对ZIP的SHA-256后解压到仓库根目录，保留其中的 `public/`、`src/` 相对路径。
3. 执行以下命令。构建前会逐一校验5,632视频、5,632缩略图和64步骤文件的SHA-256；缺件会明确失败。

```powershell
npm run build
npm start
```

打开 http://127.0.0.1:3001/ 。开发模式为 `npm run dev`（API3001，Vite5173），同一端口只运行一份服务。

数据默认保存在私有 `data/`；可用 `FORMA_DATA_DIR` 指向现有数据目录，更新网站不需要替换账户数据。环境示例见 [.env.example](.env.example)。真实密钥、账户记录和上传附件不进入Git或发布资源包。

## 验证与部署

```powershell
npm test
npm run build
```

本机网站与公网部署是不同目标；localhost不是手机可直接访问的公网网址。共享HTTPS服务须使用持久数据目录和正确的反向代理设置，见 [部署说明](docs/architecture/companion-deployment-20261019.md) 与 Dockerfile。仓库默认分支和Release提供当前代码/素材，不代表已创建公网服务器。

构建生成 `/release-info.json`，可核对运行网站的 Git 提交、5,632 动作和六位伙伴是否与发布一致。Git源码包没有提交信息时明确显示 unavailable；镜像构建可显式提供 `FORMA_BUILD_COMMIT`。

来源：[动作来源记录](docs/architecture/training-source-log.md)、[当前伙伴造型与头像生成记录](docs/architecture/companion-pokemon-reference-20261022.md)。宝可梦名称与角色设计属于各自权利人，本项目按用户要求重建参考造型；此前的原创伙伴生图记录保留为历史资料。动作素材沿用用户已确认的授权，并保留Gym visual/openGym归属。

## Mac 与协作交接

[FORMA.md](FORMA.md) · [团队配置](docs/collaboration/TEAM-ROSTER.md) · [工作区说明](docs/collaboration/WORKSPACES.md) · [技能说明](docs/collaboration/SKILLS-MATRIX.md)。保留2026-10-21配置和Mac交接历史，避免旧功能说明覆盖本次完整产品。用户已撤销此前AGENTS.md规则，历史任务表仅保留可追溯记录。
