# 地图、导入、POI与自主旅行整合

2026-11-18。以远端main `e9be4a7`（已合并自主旅行PR #6）为第一父线，合入PR #4的完整草稿 `e76b0cc`，保留原v4与已验收地图修复历史，不回退主线。此前分镜审查、39张PNG和视频/GIF取样、统一形象与材质方向见 [v4 PRD](PRD-v4-growth-space.md)；旧bundle报告是历史快照。

## 本轮完成

- 保留main已有的顺滑直接拖拽、短促惯性、指针锚定缩放、键盘操作、边界和拖动后新点击恢复。保留照片、愿望、回放/地图状态及世界入口；POI标签位于照片/明信片操作层之下。
- 解决房间合并冲突：PR #6出门后，插画和空间视角均不显示家中角色；空间角色、影子、移动标记随away变化隐藏，椅子/键盘移动控件停用。回家后仍用同一移动控制器，不新增自主旅行或来信计时器。3D切换标明预览。
- 接回目录递归、文件预览后显式导入、2048预览请求、候选切分预览、全部收藏与目的地纪念品扩展；墙上来信与桌面地图入口遵循用户已确认要求。
- 新增可实际返回的Wikipedia地理检索；保留OSM为用户主动选择的另一来源。两者的名字、坐标和来源链接都来自真实数据，失败时不生成假地点。
- 不改PR #6的domain/frog、旅行服务、IndexedDB v7数据库和迁移逻辑。真实用户Trip/照片与虚构蛙蛙日程仍分开，已有来信/照片不重写。

## 真实地点的具体边界

在城市或街区放大后，打开“真实地点”，选来源并明确点击“查询当前区域”。不会随拖动联网。

- 默认Wikipedia：英语百科GeoData检索，最多50条，优先用响应中的中文标题。它提供地名、景点、建筑及一些历史地点/事件，**不是完整商户目录，也不是实测街道底图**。详情显示原始标题、坐标和原文链接，无评分、评论或实时营业承诺。
- 可选OSM：Private.coffee Overpass，命名景点/历史建筑/部分公共地点/车站，最多80条。本环境请求仍超时，因此OSM成功响应及地区覆盖未验收；没有自动换服务或静默填充预置标签。
- 地图最多24个避让标签，其余在视野清单中可点击。照片、明信片保留更高操作层级。
- 只发送舍入至0.001度的地图中心、1.5公里范围和连接IP，不读取设备定位或上传照片。Wikipedia请求使用Api-User-Agent，omit credentials、no-referrer；来源选择决定请求目的地，设置页与面板有隐私说明和署名链接。
- 单请求、10秒点击节流、15分钟且最多12区域的内存缓存，客户端25秒超时。请求会在离开地图时中止。没有新建服务账户或承诺付费。

来源与政策：[MediaWiki地理检索API](https://www.mediawiki.org/wiki/API:Geosearch)、[Wikimedia API使用指南](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines)、[Wikipedia署名](https://en.wikipedia.org/wiki/Wikipedia:Copyrights)、[OSM署名](https://www.openstreetmap.org/copyright)、[Private.coffee服务政策](https://overpass.private.coffee/)。

## 实际验证与证据强度

### 真实网络接口

从云端执行正式Wikipedia查询，巴黎 `48.858,2.295`、半径1500米：HTTP200，50个条目均返回坐标；含原文Eiffel Tower及响应中的中文标题“艾菲爾鐵塔”。修复API默认只返回10项坐标的问题，显式设置colimit=50。该真实响应保存为测试fixture，非生成地名。另以私人演示Origin发起正式CORS OPTIONS，HTTP200，Allow-Origin为*，Allow-Headers包含api-user-agent。它证明本环境的接口与跨域配置可用，**不等于已在真实浏览器里走通整页联网链路**。

### 应用和DOM集成

- 三张QA合成JPEG含真实EXIF时间和巴黎GPS，无用户照片；经实际BrowserExifReader、指纹、城市识别、importFiles与confirmCandidate写入IndexedDB适配层。关闭连接、重新打开数据库并创建新服务后，照片/坐标/拍摄时间/Trip/已确认候选恢复；保留已兑现卡与PR #6日程；重导入判重3张。
- jsdom内实际Drawer文件输入→所选文件预览（此时档案仍为0张）→明确导入3个文件→候选确认→销毁组件/关闭连接→新连接新服务重挂载，恢复1趟/3张，照片与自主旅行状态一致。
- 2048参数传至预览生成器有测试；Node/jsdom没有浏览器createImageBitmap，本轮预览解码回退null。因此不能宣称实际生成并查看了2048像素图片。
- jsdom内真实地点只有明确查询才发请求。以真实HTTP响应作为隔离传输fixture，地图返回名称可点，展示原始坐标与对应Wikipedia pageid来源；无请求前伪造内容。此为DOM点击测试，不伪称浏览器联网实测。
- jsdom内从照片按钮发出拖拽事件后相机移动，尾随click被拦截，新pointerdown/up后的click正常打开。服务重开及迁移测试覆盖main原有旅行与数据兼容。
- SSR验证插画房间出门后不显示蛙蛙，空间移动控件禁用；它不证明实际GPU可见性。

### 自动检查

138项测试／20文件通过，TypeScript与生产构建通过，lint无错误、仍为10项原有警告，git diff --check通过。主包约575KB、空间懒加载包约605KB，仍有500KB分包警告；未做低端设备帧率基准。

## 明确未验收

本轮托管预览启动两次均报 `relay could not open browser port 4173: timed out waiting for relay readiness`。浏览器本身可连接，但托管页面路由未启动；没有另起受限预览通路或冒称界面已打开。

因此，真实浏览器文件选择/图片解码与刷新链路、真实触屏/多指触控板、WebGL设备、OSM成功链路、全球覆盖、完整无障碍审计仍未完成。本次所称“导入→确认→重开”是实际应用/DOM/fake-indexeddb集成证据，不是上述设备级验收。

空间仍是可切换有限视角的第一阶段几何代理，默认插画不变；没有宣称完成写实模型、多视角骨骼蛙蛙、360度房间或扩大导航空间。普通城市仍是离线国家轮廓/坐标网格，京都/关西为注明的插画示意层。

## 私人演示交接

沿用现有“旅行青蛙 · 私人预览”，不新建项目、不扩大访问。检查时为owner-only、无外部访客，发布版本4。当前环境缺少Sites source workflow打包助手且托管预览中继不可用；需由持有演示源工作区的主任务将验证后的main同步并部署，记录实际返回的版本/部署状态后才能称已更新。GitHub main的提交与演示版本必须分别核对。
