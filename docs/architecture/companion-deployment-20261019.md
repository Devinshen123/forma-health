# 伙伴版本部署交接

用户授权上线；现有仓库没有已配置的公网项目、域名或服务器。已询问用户现有服务商，不购买资源、不把临时隧道当正式部署。此文档是可执行准备，不是已上线证明。

## 运行条件

Node 24、单进程 Express、HTTPS 反向代理与持久私有目录。FORMA_DATA_DIR 同时保存 SQLite/WAL、附件和训练工作台媒体，必须位于持久卷且只能应用用户读写；不能在会随发布销毁的实例磁盘或静态网页托管上运行。先采用单实例，不能让多个复制实例共用普通网络文件系统上的 SQLite。定期使用 SQLite 在线备份 API 或停服后复制完整数据目录，恢复演练时保留附件。不要只复制活跃 WAL 数据库主文件。

PORT（1..65535，默认3001）、HOST（默认127.0.0.1）、FORMA_DATA_DIR（默认本地data）、FORMA_TRUST_PROXY_HOPS（0..3，默认0）由服务器启动读取；生产NODE_ENV=production启用Secure会话Cookie。仅在应用端口对公网封闭、所有请求必经确定数量的可信代理时将TRUST_PROXY_HOPS设置为对应数量，否则伪造转发头可能绕过来源判断。代理必须传递正确Host和X-Forwarded-Proto，并提供TLS，不使用宽松跨域策略。

## 本地构建容器

先在本机将授权的 openGym 媒体按README放入 public/exercise-media/opengym，运行 npm run build 校验SHA。Dockerfile的构建也会再次完整校验，不用占位图片跳过。媒体独立授权、不进入公开Git，也不上传公共容器仓库。只向用户指定的私有部署环境传送。

```
docker build -t forma-companion:local .
docker volume create forma-private-data
docker run --name forma-companion --restart unless-stopped -p 127.0.0.1:3001:3001 -e FORMA_TRUST_PROXY_HOPS=1 -v forma-private-data:/var/lib/forma forma-companion:local
```

以上发布命令需要在用户选定的主机执行；不要覆盖已经监听3001的本地网站。容器以非root用户运行，默认不包含任何真实账户/密钥/数据库；.dockerignore排除data、.env、Git、依赖和测试证据。付费识图密钥可留空，手动记录仍可用。

## 发布验收与回退

切换前备份指定服务器的数据目录，部署已测试Git SHA，应用启动创建增量伙伴表、不改既有健康事实。迁移仅新增伙伴独立表/索引，旧代码回退时可以保留新增表；不能删除健康事实来撤销奖励。部署后以合成账号通过HTTPS验证注册/登录、私有记录、奖励防重、开箱换装、邀请码加入退出、导出删除，确认媒体与对应源代码下载可用；关进程重启后记录/奖励仍存在。未实测的步骤不要标已完成。正式公网URL及部署SHA将在真实部署成功后补入。
