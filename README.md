# Forma · 训练、饮食与长期习惯

Forma 提供中英双语网站：饮食记录、训练、手动睡眠、趋势与周回顾，以及独立的 SwiftUI iPhone 工程。

## 当前版本

- **5,632 个动画动作**：中文/英文/编号搜索、器械与肌群筛选、18区正背面人体探索、动作教学和动画播放；保留旧记录ID兼容。
- **完整训练工作台**：计划/轮转、收藏、自定义动作与器械、逐组训练与计时、历史统计、围度/体重/进步照、备份导入导出，复用Forma账户。
- **151种实时3D宝可梦与869段原始动画**：完整关都图鉴支持中文、英文、编号搜索、17种属性筛选和分页选择；全部GLB与贴图保存在本地，仅加载当前选择的模型。支持旋转、缩放、软阴影、目光跟随、摸摸和原始动画切换，缺少的动作不冒充已有动画。保留原来的六位伙伴（包括额外的小卡比兽），每100XP升一级，关都后续形态按Forma的3/5级里程碑进化；模型、名字和头像一起改变。支持暂停及减少动态效果，预览与账户等级明确区分。单模型不足3MB，保留账户XP、装备、宝箱与挑战。来源、迁移及导入方式见 [151图鉴说明](docs/architecture/companion-pokedex-151-20261023.md)。
- **完整3D伙伴乐园**：在伙伴页点击进入，原有20位居民与当前伙伴在同一座小岛生活。接入自主探索、交流、吃果/等候/让食、点火/围炉、取水浇花、赏花/闻花喷嚏、电火花、邻居回应、避雨赏雪、午睡与醒来；支持投果、摇树、备柴、拨花、摸摸、跟随、晨昏天气、声音、暂停、拍照和发现手记。全部代码和场景由本机提供，复用现有模型。虚拟相册按账户保存在浏览器，演示使用会话存储，不产生健康记录或XP。见 [乐园接入说明](docs/architecture/companion-island-20261023.md)。
- **Fud AI 拍照饮食识别**：采用MIT许可的Fud AI照片/食材分析逻辑，适配到Forma后端；识别后可修改食物、克重、份数与营养，确认后才保存。Fud AI是实现来源，实际模型仍由后端OpenAI提供；配置`OPENAI_API_KEY`后可调用，密钥未配置时明确提示并保留手动流程。见[适配与后续平台计划](docs/architecture/fud-food-photo-20261022.md)、[复用记录](docs/architecture/reuse-log.md)及[MIT许可](public/licenses/fud-ai-MIT.txt)。
- **设备与健康数据**：WHOOP、Oura、Google Health v4 已实现服务端OAuth回调、加密凭证、刷新与最近窗口轮询；设置页可连接、同步、查看按来源保存的导入记录、断开和删除导入记录。尚需各平台开发者凭证、合适的HTTPS网站/回调及真实账户联调，不能把代码或合成测试当作设备已经连接。华为/小米/Keep仍是后续接入计划。
- 保留饮食文字/手动记录、训练和睡眠记录、可解释计划调整及版本历史、数据导出和账户删除。导入的设备数据独立于手动事实，不自动送往AI，不简单相加跨平台步数、能量或睡眠。
- [独立iPhone工程](ios/README.md)：原生五页与同一后端，详细训练工作台由同源WebView复用；新增只读HealthKit、逐条本机预览与单独确认上传，Apple Watch数据经Apple Health导入。用户真机签名、HealthKit权限/设备联调、TestFlight与Apple登录尚未完成。

## 安装与完整动作库

要求 Node.js 22.13+ 或 24。源码包含完整索引/步骤、伙伴图片和工作台；约173MB独立授权的动作视频/缩略图保存在配套GitHub Release附件，避免遗漏资源或把大批二进制加入Git历史。

1. 克隆本仓库main，依次执行 `npm ci`、`npm ci --prefix vendor/opengym/frontend` 和 `npm ci --prefix vendor/pokemon-island`。训练工作台与伙伴乐园分别使用锁定的前端构建依赖。
2. 从 [2026-10-22 完整发布](https://github.com/Devinshen123/forma-health/releases/tag/forma-20261022) 下载 `forma-exercise-library-20261022.zip` 和 `SHA256SUMS.txt`，核对ZIP的SHA-256后解压到仓库根目录，保留其中的 `public/`、`src/` 相对路径。
3. 执行以下命令。构建前会逐一校验5,632视频、5,632缩略图和64步骤文件的SHA-256；缺件会明确失败。

```powershell
npm run build
npm start
```

打开 http://127.0.0.1:3001/ 。开发模式为 `npm run dev`（API3001，Vite5173），同一端口只运行一份服务。

数据默认保存在私有 `data/`；可用 `FORMA_DATA_DIR` 指向现有数据目录，更新网站不需要替换账户数据。环境示例见 [.env.example](.env.example)。真实密钥、账户记录和上传附件不进入Git或发布资源包。

## 登录与账户安全

网站支持邮箱密码，并增加邮箱验证、找回密码和Google/Apple快捷登录流程。原账户保持兼容；相同邮箱不会自动合并，需先登录原账户再绑定。邮件、Google和Apple需要服务器配置才能真正启用，缺配置会在页面明确显示。网站快捷登录不等同于健康平台授权；iPhone原生快捷登录仍需单独实现。

配置步骤、精确回调和开发者材料见[登录配置](docs/architecture/authentication-setup.md)，契约与安全边界见[认证方案](docs/architecture/authentication-20261024.md)。凭证只保留服务器环境，不随GitHub或Mac克隆同步。

## 连接 WHOOP、Oura、Google 与 Apple Health

在网站设置 → 设备与健康数据中查看真实连接状态。官方注册、需要填写的资料和精确回调路径见[申请指南](docs/health/provider-application-guide.md)，技术与权限边界见[架构说明](docs/architecture/health-integrations-20261023.md)。服务端环境变量见`.env.example`的`FORMA_HEALTH_*`部分，密钥不得加入前端变量或Git。

云端默认每15分钟检查已连接账户，首次拉取最近7天、后续带2天重叠窗口；完整批次成功后才更新同步时间。不会从缺页推断删除，不保证实时通知、任意完整历史或所有设备数据类型。导入保留原始来源、设备当地日期与HRV方法，恢复/准备度保留供应商含义；用户手动记录不会被覆盖。

Apple Health没有网页OAuth凭证。已有iPhone App负责只读授权、预览与显式上传；需要Mac/Xcode签名、真机和安全可达的Forma服务。见[Apple Health安装与验收](docs/health/apple-health-setup.md)。Google Health云端API与Android Health Connect不同，当前未创建Android App。

## 验证与部署

```powershell
npm test
npm run build
```

本机网站与公网部署是不同目标；localhost不是手机可直接访问的公网网址。共享HTTPS服务须使用持久数据目录和正确的反向代理设置，见 [部署说明](docs/architecture/companion-deployment-20261019.md) 与 Dockerfile。仓库默认分支和Release提供当前代码/素材，不代表已创建公网服务器。

构建生成 `/release-info.json`，可核对运行网站的 Git 提交、5,632 动作、151个图鉴模型和869段动画是否与发布一致。Git源码包没有提交信息时明确显示 unavailable；镜像构建可显式提供 `FORMA_BUILD_COMMIT`。

来源：[动作来源记录](docs/architecture/training-source-log.md)、[当前伙伴造型与头像生成记录](docs/architecture/companion-pokemon-reference-20261022.md)。宝可梦名称与角色设计属于各自权利人，本项目按用户要求重建参考造型；此前的原创伙伴生图记录保留为历史资料。动作素材沿用用户已确认的授权，并保留Gym visual/openGym归属。

## Mac 与协作交接

[FORMA.md](FORMA.md) · [团队配置](docs/collaboration/TEAM-ROSTER.md) · [工作区说明](docs/collaboration/WORKSPACES.md) · [技能说明](docs/collaboration/SKILLS-MATRIX.md)。保留2026-10-21配置和Mac交接历史，避免旧功能说明覆盖本次完整产品。用户已撤销此前AGENTS.md规则，历史任务表仅保留可追溯记录。
