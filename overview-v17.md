# 打卡工作台 v17 — 记账模块

## 本次交付
新增独立的**记账模块**，与原有打卡数据完全解耦（独立的 localStorage key、类型、store 字段）。

### 功能范围（核心 v1，按用户确认）
- **记一笔**：收入/支出切换、数字键盘（2 位小数）、分类网格、账户选择、日期时间、备注
- **流水**：本月/全部切换 + 按分类/账户/类型/备注搜索筛选；支持 CSV 导出（带 UTF-8 BOM，Excel 不乱码）
- **统计**：月/年切换；每日/每月收支堆叠柱状图（收入绿/支出红）；支出/收入分类占比环形图
- **账户**：净资产合计、多账户余额、增删改、默认账户标记
- **分类**：支出/收入分组管理、增删改

### 架构要点
- 类型：`src/types/index.ts`（Transaction / AcctCategory / Account + 默认预设 13 分类 / 4 账户）
- 存储：`src/services/storage.ts`（首次加载写入默认预设，不污染 reset）
- 状态：`src/store/index.ts`（3 个字段 + 9 个 action，基于 useSyncExternalStore 零依赖）
- 工具：`src/utils/accounting.ts`（金额格式化、按日分组、分类聚合、筛选、CSV 构建/下载）
- UI：`src/screens/AccountingScreen.tsx` + `components/accounting/{TransactionModal,AccountModal,AcctCategoryModal}.tsx`
- 导航：`src/App.tsx` 底部第 4 位「记账」tab，图标 Icons.Wallet

### 修复项
- `store/index.ts` 漏 import `DEFAULT_ACCT_CATEGORIES / DEFAULT_ACCT_ACCOUNTS` 常量
- `addAcctCategory` 与 `AcctCategoryModal` 类型去掉必填 `order`（由 store 自算 max+1）

### 验证
- `tsc --noEmit` 通过
- `vite build` 成功（877 模块，主包 gzip ~59 kB）
- 部署复用 sandbox，链接不变

## 后续（用户确认延后到 v1.1）
- 预算设置与限额提醒（应用内横幅）
- Excel 导出
