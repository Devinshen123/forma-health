# Google / Apple 登录实际开通记录

2026-10-24，01 lead。当前实现checkout `C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`，分支`codex/fud-food-photo-20261022`，本轮起点完整SHA `0aa698db7d066655a2f1e10b8a0e156988529773`；实际本机产品为`5e6b34ccb90d3554cf0a01ef1ca59e0ef5d9d55c`。本轮不改认证业务实现，不重跑CI，不启动其他员工或Claude桌面任务。

## 已核实

### 2026-10-25 本机配置推进（最新）

- 用户报告替换值已显示，并主动提供该值、明确要求继续配置。页面未能再次读取完整值后，按用户此次明确授权使用其提供的凭证；值不写本文档或Git，不在检查结果回显。由于用户已将该值发入聊天，上线前仍建议另行轮换为未出现在聊天中的密钥并停用旧密钥；不因此循环阻断本机验证。
- 已将Google client ID、替换secret与`http://127.0.0.1:3001` public base写入原C盘被Git忽略且未跟踪的`.env`。在内存解析前后配置，确认其他配置值保持；未创建含密钥的仓库脚本/文档。未修改产品源码或数据库记录。
- 核对运行版本与拥有进程后，仅重启原本机服务：63520→95536，仍为5e6b34c。本人两次实际GET auth/options确认Google available=true/reason=ready，Apple not_configured、邮件未配置；capabilities确认Fud AI/OpenAI拍照仍ready。代码未变，不把历史429项当本轮重跑。
- 外部Chrome实际演示页打开登录，Google按钮已启用；真实到达Google账号选择与`Sign in to Forma`授权页，实际仅姓名/头像/邮箱。用户明确确认后点击Continue；首个久置流程返回静态“授权失效或浏览器不匹配”错误。未改代码或降低校验，重新从本站发起→选择同一账号→按已确认资料授权Continue，本次立即返回“完成快捷登录”，无错误且URL fragment已清除。源码state/PKCE/binding有效期10分钟，与久置失效一致；未进一步证明首个失败的唯一根因。
- 本人点击本站“完成登录或绑定”后，实际新Google账户进入“先认识你，再安排今天”的引导页，头像由演示A变为真实账户首字母，出现同步状态。再次刷新仍保留认证状态；没有填写问卷或确认健康计划/记录。当前站点按无计划时的引导流程呈现，设置与账户入口仍显示引导页，未为了检查安全页代填计划。成功截图google-live-success-20261025.png保存在原C本机忽略交付，不把私人账户资料、OAuth query/fragment/cookie写入仓库。
- 实际Google授权码交换、官方签名身份验证、双阶段同源完成与会话刷新保留已走通；未另行测试真实取消、原有邮箱账户显式绑定、Safari/iPhone、其他Google账号、正式公网或Apple。历史429项是产品代码验收，本轮只执行真实配置/浏览器验证，没有重跑全套或改认证实现。

### 2026-10-24 创建阶段（历史）

- 配置前本人请求实际`/api/auth/options`：邮箱密码可用；Google、Apple与邮件服务均未配置，现Google状态已由上方替代。
- 用户已确认：还没有正式域名；Apple Developer Program尚未加入或不确定。
- 初始站内和外部Chrome均被Google两步验证拦截；用户回复“已开启”后，本人刷新外部Chrome，已实际解除拦截。项目选择器All只见原Default Gemini Project，没有已有Forma项目；已创建独立`Forma Development`开发项目，实际ID为`forma-development-512704`，未启用付费资源。新项目首次页面加载停留转圈，重新加载后正常进入初始化。
- 用户已明确同意资料、当前邮箱用途和Google用户数据政策；本人随后勾选、Continue、Create，实际显示`OAuth configuration created!`。应用名Forma、External且测试模式；具体邮箱不写仓库。
- 用户另行明确确认创建Web登录凭证并配置到本机。本人已创建`Forma Web Local Development`客户端，实际成功窗口和客户端列表均确认存在；类型Web application，唯一回调为`http://127.0.0.1:3001/auth/callback/google`，未填写JavaScript origins，未勾选AI代理客户端。本站源码仅请求`openid email profile`。
- 创建结果读取时，复制按钮的ARIA标签把首份secret带入工具记录，因此该份不应接入。新secret生成/确认按浏览器规则交给用户本人操作；当前刷新后台仍只有一条旧密钥，未见新完整值，已再次明确指向右侧Client secrets的Add secret。未写.env、未重启服务、未调用真实OAuth。
- JSON下载事件等待超时导致浏览器REPL重置，下载是否已落盘未知；旧标签恢复后仍Debugger unattached。用户确认恢复连接后，在同一Chrome新开官方客户端列表成功，当前客户端详情标签可读。未改用其他浏览器或读取浏览器私有文件，不用接口超时当作下载成功。旧标签关闭也失败，未冒称清理完成。
- 已打开`https://developer.apple.com/account/`，实际为Apple Developer登录页。未登录、未检查实际会员状态、未创建App/Services ID/密钥或同意条款。
- 用户本人操作Google两步验证与Apple登录；不在聊天收集密码、验证码或私钥。缺域名不阻塞Google本机开发验证；Apple网站登录尚不能在当前HTTP回环地址开通。

## Google：先完成本机真实验证

入口：[Google Auth Platform](https://console.cloud.google.com/auth/overview)。先由用户在已打开页面完成两步验证，回到Cloud刷新；如果仍被拦截，以页面状态为准，按提示等待变更生效。

可填写的方案：

| 项目 | 本次值或准备材料 |
|---|---|
| 项目/应用显示名 | Forma；先检查有无已有专用项目，避免重复创建 |
| OAuth客户端类型 | Web application |
| 客户端名称 | Forma Web Local Development |
| 本机站点 | `http://127.0.0.1:3001` |
| 精确回调 | `http://127.0.0.1:3001/auth/callback/google` |
| 范围 | `openid email profile`；不附加健康、Drive、Gmail等权限 |
| 受众 | 按实际账户类型核对，个人Google账号通常External；本机阶段先测试 |
| 支持/开发者联系邮箱 | 用户提供自己可收信的邮箱；尚未替用户选择 |
| 正式公开资料 | 将来上线需可访问主页、隐私政策/条款地址、授权域名及对应所有权证明 |

本站采用服务端授权码流程，JavaScript origin不是回调地址；控制台若需要填写origin，只填写`http://127.0.0.1:3001`，不带路径。开发回调不加`?release=...`，localhost和127.0.0.1不能混用。按Google生产要求，正式环境与开发/测试使用不同项目；正式项目另配HTTPS回调和品牌核验资料，不能把本机测试成功当作公众已可使用。

创建前把实际项目、客户端类型、回调、权限展示给用户确认，再执行创建凭证。Google客户端secret仅在创建时展示/供下载，立即安全保存到本机，不能发到聊天或进入Git。取得后仅在服务器配置`FORMA_AUTH_GOOGLE_CLIENT_ID`、`FORMA_AUTH_GOOGLE_CLIENT_SECRET`、`FORMA_AUTH_PUBLIC_BASE_URL=http://127.0.0.1:3001`；保留既有OpenAI及健康配置。真实登录用常规受支持浏览器验证，不把合成夹具或内嵌代理结果当作正式Google通过。

## Apple：先确认会员，再准备HTTPS站点

2026-10-25用户明确要求继续Apple申请引导。本人在外部Chrome打开官方`https://developer.apple.com/programs/enroll/`，点击页面实际的`Start your enrollment`，进入Apple官方登录（idmsa.apple.com，标题Sign in to Apple Developer，邮箱/手机号字段为空）。标签953081842已markHandoff；截图原C本机忽略交付apple-enrollment-login-20261025.png。用户本人登录及双重认证，个人/公司申请身份已发问题，尚待选择；未核实会员、填写身份资料、勾选协议、付款或生成Apple凭证。下一步在用户登录后检查实际团队/会员状态，已为会员就避免重复申请，再按本人选择引导。Apple网站正式HTTPS域名仍未有，不因此修改当前可用的Google本机配置。

入口：[Apple Developer账户](https://developer.apple.com/account/)，[会员注册说明](https://developer.apple.com/programs/enroll/)。先由用户登录确认实际团队/会员状态。若确需注册，个人/组织类型、实名资料、协议与付款由用户本人确认；标准会员99美元/年，实际币种、税费和减免以Apple页面为准。组织注册另需法律实体、D-U-N-S及域名相关资料，不能把普通Apple账号当已加入付费计划。

准备清单：

1. 自己控制的正式域名、HTTPS网站与可访问主页/隐私政策，支持邮箱。
2. 可管理能力的Apple Developer团队角色（Account Holder或Admin），开启Sign in with Apple的主App ID。
3. 为Forma网站创建Services ID并关联主App ID，登记域名与`https://实际域名/auth/callback/apple`。当前未有域名，不能填写假值或GitHub仓库地址。
4. 创建Sign in with Apple私钥：Team ID、Key ID、Services ID和`.p8`。密钥只能下载一次，保存在本机安全位置。创建前按实际页面复核权限并确认。
5. 服务器配置`FORMA_AUTH_APPLE_CLIENT_ID`（Services ID）、`FORMA_AUTH_APPLE_TEAM_ID`、`FORMA_AUTH_APPLE_KEY_ID`、`FORMA_AUTH_APPLE_PRIVATE_KEY`及同一HTTPS public base URL。正式托管方案/预算尚未选择，不自动购买域名或部署网站。
6. 实测首次授权、再次登录、取消、隐藏邮箱、已有Forma账户显式绑定。Apple Private Email Relay的发件配置属于邮件投递的后续依赖；本轮尚无真实邮件服务。

## 当前状态与下一步

Google本机登录已真实成功并刷新保留，运行5e6b34c/PID95536。外部Chrome已保留在用户新账户的引导页，证据为原C盘Git忽略的`.forma-local/deliverables/google-live-success-20261025.png`；接下来由用户填写个人计划。旧密钥停用、正式上线前私下轮换、正式域名/Google生产核验仍待处理，Apple仍等登录和会员准备。配置不随GitHub自动同步到Mac；另一台机器须另行私下配置凭证与对应回调，没有付款、公开部署或健康记录操作。

参考（均为官方来源，本轮核对）：[Google Web OAuth与回环地址/secret](https://developers.google.com/identity/protocols/oauth2/web-server)、[Google生产与品牌核验](https://developers.google.com/identity/verification/authentication-policy-compliance)、[Apple网站配置](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)、[Apple私钥](https://developer.apple.com/help/account/keys/create-a-private-key/)、[Apple会员](https://developer.apple.com/programs/enroll/)。
