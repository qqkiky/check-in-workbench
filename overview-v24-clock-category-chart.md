# v24 改动说明：打卡时钟白字修复 + 记账分类柱状图切换

**日期**：2026-08-16
**版本**：`2026-08-16-v24`（APP_VERSION）
**部署链接（新）**：`https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link`

> ⚠️ 旧链接 `https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net` 已失效（停在 v23），请改用上方新链接。

---

## 一、日/周视图打卡页时钟白字 → 黑色

**现象**：在日视图、周视图点打卡弹出的时间选择（原生 `type="time"`）中，时钟字为白色，浅色背景下看不清、无法选择。

**根因**：系统深色模式 / Android WebView 下，原生时间输入的显示值填充色由控件自身决定（白色），仅靠 `color` 无法覆盖，需显式 `-webkit-text-fill-color`。

**修复**：`src/index.css` 全局规则加固，对 `time`/`date`/`datetime-local` 统一：
```css
input[type='time'], input[type='date'], input[type='datetime-local'] {
  color-scheme: light;
  color: #1c1c1e !important;
  -webkit-text-fill-color: #1c1c1e !important; /* 覆盖 WebView 控件填充色，真变黑 */
}
```
覆盖全站所有原生时间/日期输入（打卡、时间线、记账），一并受益。线上 CSS 已验证含该规则。

---

## 二、记账统计页：分类柱状图 + 支出/收入切换

**需求**：统计页柱状图支持分别查看支出或收入数据，按类别独立展示便于对比。

**实现**（`src/screens/AccountingScreen.tsx`）：
- 新增状态 `catView: 'expense' | 'income'`，默认 `'expense'`。
- 「分类统计（按金额排序）」区块：右上角「支出 / 收入」切换按钮（红/绿高亮）。
- 横向柱状图（`layout="vertical"`）：数据取自 `statData.expenseByCat` / `statData.incomeByCat`（按金额降序），每个分类用其本身的颜色（`Cell fill`）。
- 高度随分类数量自适应（`Math.max(180, n*30)`）；无数据时显示「暂无支出/收入数据」。
- 原有「每日/每月收支」图与两个环形图保留，未删减。

**使用**：记账 → 统计 → 点右上「收入」即可只看收入按类别的柱状对比。

---

## 三、验证

| 项 | 结果 |
|---|---|
| `tsc --noEmit` 类型检查 | ✅ 通过 |
| `npm run build` | ✅ 成功（index-CO7VAljO.css / main-ByHmVtxl.js） |
| PWA 线上 | ✅ 新链接 v24，CSS 含 `-webkit-text-fill-color`，JS 含「分类统计（按金额排序）」 |
| Android 原生壳 `cap sync` | ✅ 已注入 v24 产物（本机 Android Studio 打开 `android/` 点 Run 可见） |

## 四、你需要知道的两点
1. **链接变了**：本次部署返回新沙箱，旧 `74a2a90b…bj8` 链接已冻结在 v23，请收藏新链接。
2. **手机端/原生壳**：若仍显示旧版，硬刷新或重装 WebView 缓存一次即可加载 v24。
