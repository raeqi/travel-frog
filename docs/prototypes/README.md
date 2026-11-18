# 原型图

定稿原型为设计依据，实现中的视觉皮肤仍是占位，尚未按图替换。

- `screens/`：地图优先 v3 的整条流程，1440px 宽。原型数据为 9 国 / 12 趟，只用于确认结构与文案。
- `character/`、`growth/`、`home/`、`map/`、`collection/`、`wish/`：按主题归档的设计板与场景主图。
- 动图与视频在 `docs/assets/`，清单见 `docs/assets/README.md`。

## 设计板与场景主图

| 文件 | 尺寸 | 是什么 | 状态 | 生成日期 |
| --- | --- | --- | --- | --- |
| `character/35-青蛙形象规范-1440.png` | 1440 × 810 | 青蛙三视图、六姿态、色号，按 1/4 椅高比例标注 | 定稿 | 2026-11-18 |
| `growth/29-backpack-three-tiers.png` | 1440 × 810 | 背包三档：布囊、皮挎包、登山包，按出行天数分档 | 定稿 | 2026-11-18 |
| `growth/31-home-three-stages.png` | 1440 × 810 | 家的三个阶段：初到、添置、齐全，同一房间三种陈设密度 | 定稿 | 2026-11-18 |
| `growth/32-行李三档-1440.png` | 1440 × 810 | 小手提箱、标准旅行箱、大衣柜箱三档行李 | 定稿 | 2026-11-18 |
| `home/27-青蛙的家-1440.png` | 1440 × 810 | 定稿：写实暗调，世界地图为真实数据合成 | 定稿 | 2026-11-18 |
| `home/27-青蛙的家-1200.png` | 1200 × 675 | 同一主图的 1200 版，供窄屏引用 | 定稿 | 2026-11-18 |
| `map/00-地图墙-基准.png` | 840 × 526 | 用户提供的现网地图墙截图，作为地图墙视觉基准 | 定稿 | 2026-11-18 |
| `map/world-map-paper.png` | 1792 × 1024 | 世界地图合成稿：纸面世界地图 + 点位 + 照片堆，供地图墙取构成与配色 | 存档参考 | 2026-11-18 |
| `collection/30-eight-souvenirs.png` | 1440 × 900 | 多宝阁八件特产：扇、明信片、葫芦、茶、塔、相机、海图、行李牌，各附来历 | 定稿 | 2026-11-18 |
| `wish/postcards-five-states.png` | 1440 × 900 | 明信片五态状态板：托付待回复、新到、掀开、已想去、兑现 | 定稿 | 2026-11-18 |
| `wish/postcard-storyboard.png` | 1828 × 1080 | 青蛙寄明信片故事板：从挑照片到盖上邮戳的分镜 | 定稿 | 2026-11-18 |
| `wish/frog-action-bar-2.5x.png` | 1440 × 900 | 青蛙动作条 2.5 倍放大图，含图标与文案 | 定稿 | 2026-11-18 |

## 流程截图（1440）

| 文件 | 尺寸 | 是什么 | 状态 | 生成日期 |
| --- | --- | --- | --- | --- |
| `screens/01-map-wall-world.png` | 1440 × 900 | 地图墙：世界层，年份分组 + 城市张数 | 定稿 | 2026-11-18 |
| `screens/02-archive-empty.png` | 1440 × 900 | 空档案引导 | 定稿 | 2026-11-18 |
| `screens/03-three-postcards.png` | 1440 × 900 | 只有三张时的地图墙密度 | 定稿 | 2026-11-18 |
| `screens/04-many-clusters.png` | 1440 × 900 | 海量聚合与聚合点的照片堆 | 定稿 | 2026-11-18 |
| `screens/05-country-japan.png` | 1440 × 900 | 国家层：日本 | 定稿 | 2026-11-18 |
| `screens/06-city-kyoto.png` | 1440 × 900 | 城市层：京都 | 定稿 | 2026-11-18 |
| `screens/07-memory-overlay.png` | 1440 × 900 | 回忆浮层：一站的照片与一句话 | 定稿 | 2026-11-18 |
| `screens/08-organize-import.png` | 1440 × 900 | 整理：导入照片 | 定稿 | 2026-11-18 |
| `screens/09-organize-candidates.png` | 1440 × 900 | 整理：候选确认与合并/拆分 | 定稿 | 2026-11-18 |
| `screens/10-organize-locate.png` | 1440 × 900 | 整理：补位置 | 定稿 | 2026-11-18 |
| `screens/11-organize-progress.png` | 1440 × 900 | 整理：进度与失败项 | 定稿 | 2026-11-18 |
| `screens/12-frog-send-postcard.png` | 1440 × 900 | 青蛙：寄明信片 | 定稿 | 2026-11-18 |
| `screens/13-frog-packing.png` | 1440 × 900 | 青蛙：收拾行李 | 定稿 | 2026-11-18 |
| `screens/14-frog-route-replay.png` | 1440 × 900 | 青蛙：沿路线回放 | 定稿 | 2026-11-18 |
| `screens/15-long-place-names.png` | 1440 × 900 | 超长地名两行省略 | 定稿 | 2026-11-18 |
| `screens/16-dark-theme.png` | 1440 × 900 | 暗色主题 | 定稿 | 2026-11-18 |
| `screens/17-settings-privacy.png` | 1440 × 900 | 设置与隐私 | 定稿 | 2026-11-18 |
| `screens/18-search.png` | 1440 × 900 | 搜索 | 定稿 | 2026-11-18 |
| `screens/19-poi-list-expanded.png` | 1440 × 900 | 点位清单展开 | 定稿 | 2026-11-18 |
| `screens/20-poi-list-collapsed.png` | 1440 × 900 | 点位清单收起 | 定稿 | 2026-11-18 |
| `screens/21-wish-awaiting-reply.png` | 1440 × 900 | 愿望：托付待回复 | 定稿 | 2026-11-18 |
| `screens/22-wish-new.png` | 1440 × 900 | 愿望：新到 | 定稿 | 2026-11-18 |
| `screens/23-wish-unfolded.png` | 1440 × 900 | 愿望：掀开 | 定稿 | 2026-11-18 |
| `screens/24-wish-wanted.png` | 1440 × 900 | 愿望：已想去 | 定稿 | 2026-11-18 |
| `screens/25-wish-fulfilled.png` | 1440 × 900 | 愿望：兑现 | 定稿 | 2026-11-18 |
| `screens/26-frog-action-bar.png` | 1440 × 900 | 青蛙动作条在页面里的位置 | 定稿 | 2026-11-18 |
| `screens/28-home-entrance.png` | 1440 × 900 | 地图墙上家的入口（绿色小房子标记） | 定稿 | 2026-11-18 |

## 体积

单张超过 1.5 MB 的用 pngquant 量化到 256 色，尺寸不变：

- `growth/29-backpack-three-tiers.png` 2.13 MB → 0.75 MB
- `growth/31-home-three-stages.png` 1.43 MB → 0.54 MB
- `map/world-map-paper.png` 2.68 MB → 0.79 MB
- `growth/32-行李三档-1440.png` 1.54 MB → 0.63 MB
- `home/27-青蛙的家-1440.png` 1.65 MB → 0.64 MB

其余保持原 PNG。全部图片合计约 25 MB。

## 已作废、不入库

- 双人沙发旧版家的图：`room/27`、`room2/27` 与 `frog-home-main` v1–v5 等中间稿，终版是单人扶手椅的 `home/27-青蛙的家`。
- `34-地图墙-纸感样张-1440.png`：重纸纹版，与 9.1「不做重纸纹改版」冲突。
- 旧 `29-背包三档` 设计板与旧 `31-家的三个阶段` 板：已被 `growth/` 下的场景版取代。
- `map-paper-v2`：区域轮廓版，被世界地图版 `map/world-map-paper.png` 取代。
- `refs/D-upload.png`：英国区域放大版，已被世界地图版取代。
- `refs/` 下的 `corner-*`、`c2-*`、`z-*`、`wm*`：生成时用的木纹/纸纹/局部裁切参考，不是设计产物。
- v1 九屏设计稿与运行验证截图：设计已被地图优先版取代；最后一批 preview 运行截图（地图墙、进入家、明信片背面、多宝阁与特产、行李箱、整理抽屉）只用于验证代码跑起来的效果，不是设计素材。
