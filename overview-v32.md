# v32 概览 · 新增「咨询」栏目 + 每日 08:00 自动推送

## 交付内容
1. **底部导航新增「咨询」Tab**（5 Tab：Do · 记账 · 回顾 · 咨询 · 更多）
   - `ConsultScreen` 读取站点 `consult-data.json`，按三板块渲染，每条附**原始来源链接**（可点击溯源）与来源/时间标签。
   - 含加载中 / 离线 / 空数据三态，UI 与现有 light 风格一致。
2. **每日 08:00 自动推送**（已建自动化 `automation-1787479650625`，状态 ACTIVE）
   - 复用 `pet-pharma-intel` expert skill 抓国内官方源；WebFetch 抓 FDA/EMA 国际监管源；编译 `consult-data.json` → 构建 → 部署到稳定链接，每日自动刷新。
3. **信源清单**（`consult-sources.md`，按三板块分类）
   - 行业动态：中国兽药信息网（行业动态/综合要闻）、中国兽药协会、国际动保龙头（Yahoo Finance RSS）
   - 药品信息：农业农村部公告（注册审批）、公示、通知、国家兽药基础数据库、FDA CVM 动物药品
   - 监管动态：法规规章、农业农村部公告、协会团体标准、**FDA CVM**（CVM Updates/召回/指南）、**EMA**（新闻/兽医药品）

## 关键文件
- `src/screens/ConsultScreen.tsx` — 咨询页
- `src/App.tsx` — 新增 consult Tab 与路由
- `src/components/common/Icons.tsx` — 新增 Newspaper/Pill/Shield/ArrowUpRight/CloudOff
- `scripts/gen_consult.py` — 国内源抓取 + 编译
- `scripts/merge_international.py` — FDA/EMA 合并去重
- `public/consult-data.json` — 每日生成的内容数据
- `consult-sources.md` — 信源清单与抓取说明

## 验证
- 线上 `consult-data.json`：行业 16 / 药品 6 / 监管 8 = 30 条，无垃圾项。
- 稳定链接复用：`https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link`

## 已知限制
- 本沙箱 urllib 直连 `fda.gov` 被拦截（404），国际监管源由自动化经 WebFetch（不同 egress）补齐；脚本侧 FDA/EMA 多为空，国内监管由 `flfg` 顶上。
- 国内企业「融资/合同」类动态因公开接口不可达，暂仅来自官方兽医监管源反查企业名。
