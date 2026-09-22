# 打卡工作台 · 移动端 APP 重构建议

> 基于当前代码现状给出可落地的架构、交互、同步与 MVP 方案。
> 当前项目：`React 18 + TS + Vite 5 + Tailwind`，已具备 PWA（`manifest.webmanifest` / `sw.js` / 图标）与 **Capacitor 依赖**（`@capacitor/core/android/cli` + `capacitor.config.json`，`appId=com.workbench.checkin`，`webDir=dist`）。数据层为纯客户端 `localStorage` + 零依赖 `useSyncExternalStore` store，**无任何后端**。

---

## 1. 整体架构方向

**结论：以「Capacitor 包裹现有 React PWA」为唯一推荐路径，不要重写。**

理由（锚定现状）：

- 代码 90% 以上可直接复用——`src/screens`、`src/components`、`src/store`、`src/utils` 全部是标准 React，Capacitor 只是在外面套一层原生壳，把 `dist/` 当 WebView 内容加载（`capacitor.config.json` 已配 `webDir: "dist"`）。
- Capacitor 依赖和配置**已经装好**，等于只差 `npx cap add ios && npx cap add android` 两步就能出原生工程。
- 已存在的 `widget.html` + `widget-manifest.webmanifest` 说明你已经在探索主屏小组件，Capacitor 的 Widget/插件机制正好承接它。
- 设置里 `notificationEnabled / hapticsEnabled / reminderEnabled` 已是原生能力的语义占位，升级为真实原生能力是自然延伸。

目标分层（见架构图）：

| 层 | 技术 | 说明 |
|---|---|---|
| Native Shell | Capacitor 8 + 官方插件 | iOS/Android 桥接：Push、Biometric、Haptics、Camera、Widget |
| Web App | 现有 React 18 + Vite（不动） | 全部 UI / 业务逻辑 / 图表复用 |
| Local Store | SQLite（Capacitor）或 IndexedDB（PWA 双形态共用） | 离线优先，唯一真相源 |
| Cloud Sync | Supabase / Firebase（**可选层**） | 仅在需要多设备/多端时接入 |

**关键原则**：本地存储永远是真相源，云端是"尽力同步的副本"。即使永远不接云端，APP 也能完整离线使用——这与你当前单机 localStorage 的体验一致，零回归。

---

## 2. 核心功能在手机端的呈现方式

把现有 5 大业务域映射到手机原生体验：

### 2.1 打卡（CheckIn / 补卡）
- **今日视图**：现有 `HomeScreen` 的 `DayTab`（today/week/month/year/pending/quick）保留为顶部分段控件，但「今日」应成为开锁默认页。
- **一键打卡**：桌面端需进弹窗选时间；手机端主操作应降级为**大按钮即时打卡**（用当前时间），时间选择改为"高级/补卡"的次级入口——对应你刚做的"补卡可选完成日期"逻辑保留在次级弹窗。
- **提醒**：`reminderEnabled` 从"页面内提示"升级为 **Capacitor LocalNotifications / 系统通知**，到点真正弹通知（需 `notificationEnabled` 授权）。
- **补卡**：现有 `CheckInTimeModal` 已含日期选择，手机端直接用即可。

### 2.2 时间线（TimelineNote）
- 现有 `TodayTimeline` 按时间轴排布打卡记录 + 手动记事，天然适配手机竖向滚动。
- 记一笔的 `TimelineNoteModal`（含时间输入）已修好深色文字，直接复用。
- 增强点：长按时间轴条目进入编辑/删除（手势替代桌面 hover）。

### 2.3 记账（Accounting）
- 现有 `AccountingScreen` 已是移动友好的列表 + 底部 Tab（账户/流水/统计）。
- 加一笔：底部中央 **FAB（悬浮 + 按钮）** 展开「支出 / 收入 / 转账」三项，对应 `TransactionModal` / `TransferModal`。
- 转账（`Transfer`）已独立实体，统计不污染——逻辑完全复用，无需改。
- CSV 导出：手机端改为"导出到文件 / 分享给微信"而非下载到磁盘。

### 2.4 回顾 / 趋势 / 热力图
- `WeeklyReview / MonthlyReview / AnnualReview / TrendsScreen` + `recharts` 图表（环形、折线、日历热力图）直接复用，竖屏重排即可。
- 性能注意：`recharts` 在低端机首屏可能掉帧，建议 MVP 仅保留周/月两图，年回顾与趋势图放到 v2。

### 2.5 记事本 / 设置
- `NotesScreen`、`MoreScreen` 直接复用；`hapticsEnabled` 接 `Capacitor.Haptics`，`showLunar` 等保留。

---

## 3. Navigation 与交互设计适配要点

### 3.1 导航结构
现有 `src/App.tsx` 是底部 Tab（home / account / notes / more），这是**移动端正确范式**，保留并优化：

```
底部 Tab Bar（5 项，符合手感）
  Do(首页/打卡)  ·  记账  ·  [+ FAB 记一笔]  ·  时间线/回顾  ·  更多
```

- 把"时间线"从 `MoreScreen` 的子页提升为独立 Tab（手机用户高频），`openNotes` 逻辑已存在，只是调整层级。
- 回忆顾（周/月/年）作为首页顶部分段 + 一个"统计"Tab 入口，不要挤进更多。
- 详情页（`TaskDetailScreen`、`ListScreen`）用原生**右滑返回**（Capacitor 可拦截系统返回手势）。

### 3.2 交互适配清单（必须做）
| 项 | 现状问题 | 手机端做法 |
|---|---|---|
| 点击热区 | 桌面小按钮 | 所有可点元素 ≥ 44×44pt |
| 时间/日期选择 | 原生 `type=time` 白字（已修 v22） | 保持 `color-scheme:light` 强制深色字 |
| 下拉刷新 | 无 | 列表接 `pull-to-refresh`（Capacitor 或手势库） |
| 手势 | hover 为主 | 长按编辑/删除、左滑操作、右滑返回 |
| 键盘 | 弹窗键盘 | 金额/时间输入用 `inputmode` + 数字键盘，避免全键盘 |
| 安全区 | 无 | 底部 Tab / FAB 加 `env(safe-area-inset-bottom)`（刘海/灵动岛） |
| 触感 | `hapticsEnabled` 占位 | 接 `Capacitor.Haptics.vibrate()` |
| 深色模式 | `AppSettings.theme` | 接系统 `prefers-color-scheme`，与 `color-scheme` 联动 |

### 3.3 性能红线（来自移动端专家标准）
- 冷启动 < 3s；核心内存 < 100MB；崩溃率 < 0.5%；`recharts` 懒加载、列表虚拟滚动（记账流水长列表必备）。

---

## 4. 离线 / 在线数据同步策略

**现状**：纯 localStorage，零网络。这是最大的架构机会，也是最大风险点——**不要为了"上云"破坏现有单机体验**。

### 4.1 分阶段策略
- **阶段 A（MVP，必做）**：维持离线优先。把 `localStorage` 抽象成 `StorageAdapter` 接口，底层实现可切换为 Capacitor `SQLite`（更稳、可存更大量、支持查询）。业务代码（`store/index.ts`）不感知存储介质。这一步同时解决"localStorage 5MB 上限 + 同浏览器多端冲突"隐患。
- **阶段 B（按需）**：引入 Supabase（Postgres + Auth + Realtime）。用户登录后，本地库与云端按**实体粒度增量同步**。

### 4.2 同步模型（阶段 B 设计）
- **真相源**：本地库。所有写操作先落本地，再入同步队列。断网照常用。
- **变更追踪**：每个实体（`Task/CheckInRecord/Transaction/Transfer/Account/Note`）已有 `createdAt/updatedAt`，再加 `deletedAt`（软删除）即可做增量 diff。
- **冲突解决**：以 `updatedAt` 最新者胜；同一记录双向更新则服务端合并（或标记 `conflict` 让用户裁决）。打卡/记账类数据冲突极少，无需 OT/CRDT。
- **推送**：Supabase Realtime 或 FCM/APNs 推「多端数据已更新」，触发后台拉取。
- **隐私**：记账/打卡属敏感个人数据，默认**不开启云同步**，在"更多→数据同步"里显式授权；提供"仅本机"模式。

### 4.3 为什么不直接用纯云端
你的核心场景是"每天随手打卡/记账"，弱网、地铁、飞机模式是常态。任何强依赖网络的方案都会让产品在这些时刻失效。离线优先 + 可选云端是唯一致命短板最小的路线。

---

## 5. 开发方式选型考量（原生 / 跨平台 / PWA）

| 方案 | 复用现有代码 | 上架商店 | 原生能力 | 成本 | 结论 |
|---|---|---|---|---|---|
| **纯原生 Swift/Kotlin** | 0%（重写） | ✅ 最佳 | ✅ 最佳 | 极高（双端 2 套） | ❌ 否决，浪费现有 React 资产 |
| **React Native** | 中（UI 重写，逻辑可搬） | ✅ | ✅ | 高（需重写全部组件） | ⚠️ 不如 Capacitor 省 |
| **Flutter** | 0%（Dart 重写） | ✅ | ✅ | 极高 | ❌ 否决 |
| **PWA（维持现状）** | 100% | ❌ 不能上架（仅"添加到主屏幕"） | ⚠️ 受限（无系统通知/小组件） | 0 | ⚠️ 已够用但能力天花板低 |
| **Capacitor 包裹 PWA（推荐）** | **~90%** | ✅ iOS/Android 商店 | ✅ 通过插件补齐 | 低 | ✅ **采用** |

**为什么选 Capacitor 而非 React Native**：你的价值 90% 在业务逻辑与数据（打卡规则、补卡、转账余额、统计），这些在 Capacitor 下**零重写**；RN 则要重画所有组件。Capacitor 让你用"Web 技术做到 95% 体验 + 原生插件补齐 5% 关键能力（通知/生物识别/小组件/触感）"，性价比最高。

**渐进路线**：
1. 现在就能发：PWA（已上线 `https://...agentos-app.net`）。
2. 一周内能出：Capacitor + Android（你已有 `android` 配置项）。
3. 两周 + 证书：Capacitor + iOS 上架。
4. 可选：Supabase 云同步（阶段 B）。

---

## 6. 功能优先级与 MVP 范围

### 优先级矩阵（业务价值 × 实现成本）
| 功能 | 价值 | 成本 | 优先级 |
|---|---|---|---|
| 打卡 + 提醒（系统通知） | 高 | 低 | P0 |
| 一键即时打卡 + 补卡选日期 | 高 | 低（已有） | P0 |
| 记账（收/支/转账/FAB） | 高 | 低（已有） | P0 |
| 底部 Tab + 安全区 + 触感 | 高 | 低 | P0 |
| 周/月回顾图表 | 中 | 低（已有） | P1 |
| 时间线手势编辑 | 中 | 中 | P1 |
| StorageAdapter → SQLite | 中 | 中 | P1 |
| 主屏 Widget（今日待办） | 中 | 中 | P2 |
| 云同步（Supabase） | 中 | 高 | P2 |
| 年回顾 / 趋势图 | 低 | 中 | P2 |
| 生物识别锁 | 低 | 低 | P3 |

### MVP（最小可行版本）范围定义
**目标**：能上架、能离线、覆盖每天最高频动作。

MVP 必须包含：
1. **Capacitor Android 壳** + 现有 React 应用打包（复用全部代码）。
2. **底部 Tab**：Do（打卡）/ 记账 / 时间线 / 更多；中间 FAB「记一笔」。
3. **打卡**：今日列表、一键即时打卡、补卡选日期（已有逻辑）、到点系统通知。
4. **记账**：收/支/转账（已有 `TransferModal`）、账户余额、流水列表。
5. **周/月回顾**：复用 `WeeklyReview`/`MonthlyReview` + `recharts`（仅两图，保性能）。
6. **离线优先**：维持 localStorage（MVP 不强制上 SQLite，阶段 B 再抽 `StorageAdapter`）。
7. **基础原生体验**：安全区适配、`hapticsEnabled` 接触感、深色模式联动。

MVP 明确不做（放 v2+）：云同步、主屏 Widget、年回顾、趋势图、生物识别、iOS 上架（可并行但不阻塞 MVP）。

### 落地步骤（建议顺序）
1. `npx cap add android` → 在 Android Studio 跑通 `dist` 真机预览（验证 90% 复用）。
2. 导航重构：底部 Tab + FAB + 安全区 + 手势（交互适配 §3）。
3. 接入 `Capacitor.LocalNotifications` + `Haptics`，点亮提醒与触感。
4. 性能体检：启动时间、`recharts` 懒加载、长列表虚拟滚动。
5. 出 MVP 内测包（Android）。
6. （并行）`StorageAdapter` 抽象；评估 Supabase 是否值得做。

---

## 7. 一句话总结
**不要重写，用 Capacitor 把现有 PWA 套原生壳，90% 代码复用；离线优先不变，云同步作为可选第二阶段；MVP = 打卡+记账+回顾+原生导航体验，一周出 Android 内测。**

> 附：可立即验证的下一步——在现有工程执行 `npx cap add android` 并 `npx cap sync`，即可在 Android Studio 打开真机预览，验证复用度。
