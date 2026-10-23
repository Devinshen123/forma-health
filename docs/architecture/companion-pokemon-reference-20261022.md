# 实时 3D 伙伴与进化

2026-10-22，按用户要求以宝可梦外形重做伙伴并加入实际形态进化。上一版球体拼接模型已替换为带贴图的 GLB；13 个模型带骨骼待机和开心动画，小卡比兽为有骨架的静态模型，配合轻微呼吸与点击弹跳。

数据库保留 sprout / bunny / otter / cloud / bear / seal 六个 ID，继续从服务器保存的 XP 推导等级与形态，不新增经验来源，也不迁移或重置账户。

| 家族 ID | Lv.1 | Lv.3（200 XP） | Lv.5（400 XP） |
|---|---|---|---|
| sprout | 妙蛙种子 | 妙蛙草 | 妙蛙花 |
| bunny | 皮卡丘 | 雷丘 | 保持雷丘 |
| otter | 杰尼龟 | 卡咪龟 | 水箭龟 |
| cloud | 胖丁 | 胖可丁 | 保持胖可丁 |
| bear | 小卡比兽 | 卡比兽 | 保持卡比兽 |
| seal | 伊布 | 火伊布 | 保持火伊布 |

这些是 Forma 的游戏进度门槛，不表示原作中的进化等级、进化石或亲密度条件。伊布的分支固定为火伊布，不将多个分支错误串成连续进化。最终形态后仍积累 XP，但不虚构后续物种。

参考官方图鉴：[妙蛙种子](https://www.pokemon.com/us/pokedex/bulbasaur)、[杰尼龟](https://www.pokemon.com/us/pokedex/squirtle)、[皮卡丘](https://www.pokemon.com/us/pokedex/pikachu)、[胖丁](https://www.pokemon.com/us/pokedex/jigglypuff)、[小卡比兽](https://www.pokemon.com/us/pokedex/munchlax)、[伊布](https://www.pokemon.com/us/pokedex/eevee)。名称、外形和原始素材属于各自权利人，不是 Forma 原创，也不能把 openGym 授权视为这些素材的授权。来源与权利说明随构建提供于 public/licenses/pokemon-models-NOTICE.txt。

13 个动画 GLB 来自 06wj/pokemon 的固定提交 00d96f7f18894055e7f1db44fa0df6462e5e4c8a；小卡比兽来自 Pokemon-3D-api/assets 固定提交 429de1288cea0d43f5b4f56305d2276e94239d65。来源、原始 SHA256、打包 SHA256 与大小见 public/companions/model-manifest.json。下载在运行时之外完成，网站从本站按需加载当前形态，不依赖外部模型服务。

素材准备：将原始 GLB 保存在项目以外的制作目录，用 node scripts/prepare-companion-models.mjs <制作目录> 打包。保留 idle/happy 动画，删除未使用动画和缓冲区，嵌入 WebP 纹理限制为 512px，单模型不足 2 MB、14 份合计不足 16 MB。小卡比兽姿势及双眼图集在模型加载后修正。Draco 解码器来自已安装 Three.js，随站提供 Apache 2.0 文本。

运行 node scripts/companion-portrait-studio.mjs，在本机5191端口选择角色与等级，导出640×640透明PNG。使用 sharp 转换为640和192像素的 WebP，28个形态头像位于 public/companions/forms；12个兼容基础头像保留在 public/companions 根目录。主场景与头像使用相同模型、灯光和取景工厂。

实际升级跨过进化门槛时切换模型、名称和头像并播报；预览明确标示，仅改变本地预览状态，不写入账户。切换家族保留服务器 XP、装备、宝箱和挑战；重新登录按已保存 XP 恢复对应形态。旧卡比兽家族在1–2级显示小卡比兽，3级起显示卡比兽。

静态头像带版本查询绕过旧活动离线缓存。新 worker 预缓存头像与解码器，模型仅在使用后按需存入本版本公开缓存；不在安装时下载全部模型，不缓存私有 API 或用户附件。WebGL/模型加载失败时显示当前形态头像及重试操作。切换或离开页面中止请求，销毁 mixer、骨架、几何、纹理、ImageBitmap、renderer 和事件监听。
