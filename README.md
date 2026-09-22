# 期待 (Check-in Workbench)

一款基于 React + TypeScript + Vite + Capacitor 的日常打卡应用，支持时间线任务管理、分类追踪、可视化日历热力图与统计图表，最终可打包为 Android APK。应用名已更新为「期待」。

> 参考设计来自小红书"飞行指南"，本工程为完整可运行的现代化复刻版本。

## ✨ 特性

### 核心功能
- 📋 **每日打卡时间线**：按"上午/下午/晚上/工作/生活/阅读…"等分类组织任务，每个任务带计划时间、量化目标
- ✅ **打卡交互**：轻点即可完成，支持量化进度（页面/本/个/分钟）
- 📅 **DO 页四维度**：本日 / 本周 / 当月 / 今年，分别展示对应时间段内的待办任务列表与完成进度
- ⚡ **小事**：轻量临时打卡，无需计划时间/目标，随手记随手勾
- 📝 **记事本**：在「更多 → 记事本」随时记录想保留的临时内容，支持新增与查看
- 🔍 **历史回溯**：日历热力图、月度日历、分类环形图、折线趋势图、专注时段环形图
- 🏷️ **分类管理**：增删改查任务、编辑分类、设置重复规则
- 🖥️ **桌面小组件**：`/widget.html` 可"添加到主屏幕"作为桌面 widget，实时显示今日待办与进度（与 App 共用同一本地数据，离线可用）

### 数据可视化
- 📊 **年度日历热力图**（仿 GitHub Contribution）
- 🎨 **分类追踪网格**（一周内各分类完成情况）
- 📈 **统计折线图**（本月每日打卡数）
- 🍩 **分类占比环形图**
- 🌙 **专注时段环形图**

### 体验设计
- iOS 风格卡片、圆角、模糊背景
- 农历日期显示
- 月度农历小日历
- 流畅动效（纯 CSS 过渡 / keyframes，无第三方动画库）
- 安全区域适配
- 离线运行（localStorage 持久化）

## 🛠️ 技术栈

| 层 | 工具 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| 样式 | TailwindCSS（PostCSS 构建） |
| 状态 | 自研轻量 Store（基于 `useSyncExternalStore`，零额外依赖） |
| 路由 | 基于 hash 的轻量路由 |
| 动画 | 纯 CSS 过渡 / keyframes |
| 图标 | 内联 SVG 组件（无第三方图标库） |
| 日期 | 自实现日期 + 农历工具 |
| 移动端 | Capacitor 8（已生成 `android/` 原生工程，minSdk 24 / compileSdk 36 / targetSdk 36） |
| PWA | manifest.webmanifest + Service Worker（`public/sw.js`），可"添加到主屏幕"离线安装，无需 Android Studio |
| 存储 | localStorage（离线优先） |

## 📁 目录结构

```
check-in-workbench/
├── src/
│   ├── App.tsx                  # 入口
│   ├── main.tsx                 # React 挂载
│   ├── index.css                # 全局样式
│   ├── types/
│   │   └── index.ts             # Task / Category / CheckInRecord 类型
│   ├── store/
│   │   └── index.ts             # 自研轻量 Store（useSyncExternalStore）+ localStorage 持久化
│   ├── services/
│   │   └── storage.ts           # 存储抽象层
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Tag.tsx
│   │   │   └── Toast.tsx
│   │   ├── tasks/
│   │   │   ├── TaskCard.tsx     # 任务卡片
│   │   │   └── TaskFormModal.tsx# 任务表单
│   │   └── charts/
│   │       ├── CalendarHeatmap.tsx  # 年度热力图
│   │       ├── CategoryHeatmap.tsx  # 分类追踪网格
│   │       ├── StatsLineChart.tsx   # 折线图
│   │       └── CategoryDonut.tsx    # 环形图
│   ├── screens/
│   │   ├── HomeScreen.tsx       # Do（首页）
│   │   ├── ListScreen.tsx       # 列表
│   │   ├── TrendsScreen.tsx     # 趋势
│   │   ├── TaskDetailScreen.tsx # 详情
│   │   └── MoreScreen.tsx       # 更多
│   └── utils/
│       ├── date.ts              # 日期 + 农历工具
│       ├── pwa.ts               # PWA 安装引导（beforeinstallprompt）
│       └── seed.ts              # 示例数据
├── public/                      # 静态资源（含 PWA 资源）
│   ├── manifest.webmanifest     # PWA 清单
│   ├── sw.js                    # Service Worker（离线缓存）
│   ├── icon-512.png             # 标准图标
│   ├── icon-maskable-512.png    # Android maskable 图标
│   └── apple-touch-icon.png     # iOS 图标
├── android/                     # 由 `npx cap add android` 生成
├── capacitor.config.json
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🚀 开发

```bash
# 安装依赖
npm install

# 本地启动
npm run dev
# → 访问 http://localhost:5173
```

## 📲 手机安装（推荐 · 免 Android Studio）

本工程已做成 **PWA（渐进式 Web 应用）**，可以直接在手机上"安装"成桌面图标 App，**完全离线运行**，而且**不需要 Android Studio 或任何编译环境**。

### 方式 A：打开已部署的在线地址（最快）

应用已部署到公开 HTTPS 地址：

```
https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net
```

在**手机浏览器（推荐 Chrome / Edge / 手机系统浏览器）**中打开该地址，然后：

- **Android（Chrome）**：点右上角 `⋮` 菜单 → **"添加到主屏幕" / "安装应用"** → 确认。桌面上会出现「打卡」图标，点开就是全屏 App。
- **iOS（Safari）**：点底部中间的 **分享按钮** → **"添加到主屏幕"** → 添加。桌面上会出现图标。

> 已内置 Service Worker 离线缓存，安装后断网也能正常使用，数据存在本机。

### 方式 B：自己部署一份（任选其一）

任意静态托管平台把 `dist/` 目录传上去即可（需要 HTTPS，PWA 安装才会生效）：

- **GitHub Pages / Netlify / Vercel / Cloudflare Pages**：上传 `dist/` 内容，开启 HTTPS。
- 本地起服务后用内网穿透（如 `npx localtunnel --port 4173`）也能临时获得 HTTPS 地址。

### 方式 C：本机构建后部署

```bash
npm install
npm run build          # 生成 dist/
# 把 dist/ 部署到任意支持 HTTPS 的静态托管
```

## 📦 构建 & 打包 APK

> **关于"生成 APK"**：本工程已通过 `npx cap add android` 生成完整的原生安卓工程（`android/` 目录，含 Gradle Wrapper，无需预装 Gradle）。但 APK 的最终编译必须在**装有 Android Studio（含 Android SDK + JDK 17）的本地机器**上完成——CI/沙箱环境通常没有 Android SDK，因此这里交付的是"可一键打包的工程"而非已编译的 `.apk` 文件。

### 准备环境（一次性）

1. **Node.js 18+**（推荐 22）
2. **Java 17+**（Android Gradle Plugin 8 要求；注意 Capacitor 8 不再支持 Java 8）
3. **Android Studio** + **Android SDK**
   - 安装 **SDK Platform 36** 与 **Build-Tools 36+**
   - 设置环境变量 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`）指向 SDK 路径
4. 安装依赖并构建 Web 资源：
   ```bash
   npm install
   npm run build          # 输出到 dist/
   npm run sync           # 把 dist/ 同步进 android/ 工程
   ```

### 构建调试 APK（无签名，可直接装手机）

```bash
# Windows
cd android && gradlew.bat assembleDebug
# macOS / Linux
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### 构建发布 APK（需签名）

1. 生成签名 keystore（仅首次）：
   ```bash
   keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key
   ```
2. 在 `android/app/build.gradle` 的 `buildTypes.release` 中配置 `signingConfigs`：
   ```gradle
   signingConfigs {
       release {
           storeFile file('../my-release-key.jks')
           storePassword '你的store密码'
           keyAlias 'my-key'
           keyPassword '你的key密码'
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled true
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```
3. 执行：
   ```bash
   cd android && ./gradlew assembleRelease   # Windows 用 gradlew.bat
   # → android/app/build/outputs/apk/release/app-release.apk
   ```

### 用 Android Studio 打开并运行

```bash
npm run android        # 等价于 npx cap sync android && npx cap open android
```
打开后点 ▶ Run 即可在模拟器或真机（USB 调试）上运行。

## 📱 安装到手机

1. 把生成的 `app-debug.apk` / `app-release.apk` 传到手机（USB / 网盘 / 邮件）
2. 手机开启"允许安装未知来源应用"权限
3. 点击 APK 文件安装即可使用（完全离线）

## 🔧 数据备份 / 迁移

在"更多"页 → "导出数据"可复制 JSON 全部数据，可用于备份或在新设备恢复（粘贴回去即可，或改造 store 支持导入）。

## 🎨 设计规范

| 项 | 值 |
|---|---|
| 主色 | `#3B82F6`（蓝） |
| 卡片圆角 | `16px` |
| 页面背景 | `#F2F2F7`（iOS 系统灰） |
| 字体 | PingFang SC / 苹方优先，回退 Helvetica |
| 卡片阴影 | `0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)` |
| 按下反馈 | `scale(0.97)` 过渡 100ms |
| 完成动画 | 弹性 cubic-bezier `0.34, 1.56, 0.64, 1` |

## 📜 License

MIT