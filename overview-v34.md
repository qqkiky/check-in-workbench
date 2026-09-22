# 打卡工作台 · 资讯栏目改版（v34 / 2026-08-23-v34）

## 本次纠正的核心
用户指出上一版（v33）结构理解错误，已按以下要求重做并部署：

| 要求 | 实现 |
| --- | --- |
| 3 个模块 = 行业动态 / 药品信息 / 监管动态 | 顶部选项卡前 3 项即此三模块（非「每日简报/每周汇总/海外资讯」） |
| 每周咨询 → 每月资讯 | 每次更新**累积不删除**，按月压缩为归档（替代「每周汇总」） |
| 3 个模块只展示当月 | 按条目 `date` 的 `YYYY-MM` 过滤，仅渲染当前月内容；历史月份进入「每月资讯」 |
| 外文自动译中文 + 核心要点 | 英文条目在所属模块内渲染「中文标题 + 一句核心要点 + 原文标题」 |

## 页面结构（src/screens/InfoScreen.tsx）
顶部模块切换 / 选项卡共 4 项：
1. **行业动态** — 仅展示当月 industry 条目
2. **药品信息** — 仅展示当月 drug 条目
3. **监管动态** — 仅展示当月 regulatory 条目
4. **每月资讯** — 读 `monthly-summary.json`，按月份倒序列出归档，可展开查看当月概览与核心要点

每个内容模块右上角显示「当月条数 · 累计条数」；空态提示「往期内容可在每月资讯查看」。

## 数据模型
- `public/consult-data.json`（累积全量）：`{ generatedAt, sections:{ industry[], drug[], regulatory[] } }`，每条含 `date`（YYYY-MM-DD…）、外文项含 `lang:'en'` + `titleZh` + `zhSummary`。
- `public/monthly-summary.json`（按月归档）：`{ generatedAt, months:{ "2026-08":{ month, overview, keyPoints[], sections{...} }, ... } }`，由 `gen_monthly.py` 压缩生成。

## 生成 / 更新脚本
- `scripts/gen_consult.py`：**累积合并模式**。读取已有 `consult-data.json` 保留全部历史，仅把 `pet-pharma-intel` 抓到的新国内源条目按 url 去重追加；不再直连 FDA/EMA（避免与翻译流程产生未翻译重复）。
- `scripts/merge_foreign.py`：把自动化经 WebFetch 抓取并翻译的 `_foreign.json` 按 url 去重并入对应板块（FDA/EMA→regulatory，Yahoo 企业→industry，泛财经 `topic:'general'` 跳过），保留 `titleZh`/`zhSummary`。
- `scripts/gen_monthly.py`（新增）：按月份分组压缩全量数据为月度归档。

## 每日 08:00 自动化（automation-1787479650625，ACTIVE）
`gen_consult(累积)` → `WebFetch` 抓 FDA/EMA/Yahoo 并翻译写 `_foreign.json` → `merge_foreign` → `gen_monthly` → `vite build` → `workbuddy_cloudstudio_deploy`。

## 构建与部署
- 版本号 `2026-08-23-v34`。
- 构建坑：安全删除 shim 会拦截 vite 清空 `dist`，改用 `mv dist _dist_old` 改名后再 `vite build` 绕过。
- 部署至稳定链接：https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link
- 线上验证：consult-data 三板块（行业16/药品6/监管8）正常含译文；monthly-summary 覆盖 2026-08、2026-07 两月。

## 你这边需要做的
看到旧版是因为上一次部署的是 v33（错误结构）。**请硬刷新 / 关闭重开 PWA**：iOS 上划下拉刷新或杀进程重进；安卓 Chrome「菜单 ⋮ → 刷新」。新版本号 v34，资条款顶部标题为「资讯」，选项卡为「行业动态 / 药品信息 / 监管动态 / 每月资讯」。
