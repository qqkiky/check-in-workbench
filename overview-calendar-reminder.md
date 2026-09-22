# 待办 → 系统日历提醒（Capacitor 原生插件 TaskCalendar）

## 结论
**可以，而且比桌面 Widget 更简单、更稳。** 通过安卓标准 `CalendarContract` API 把待办写成**系统日历事件 + 到点提醒**，小米 MIUI 日历会据此在设定时间弹出**系统级提醒（锁屏/通知）**。关键点：**提醒由系统日历进程负责，主应用被 MIUI 杀掉后到点照样弹**——比 Widget 更彻底地满足"无需打开主应用"。

## 改动文件清单
**新增（原生安卓）**
- `android/app/src/main/java/com/workbench/checkin/TaskCalendarPlugin.java`
  —— 核心引擎。基于 `CalendarContract` 写入/更新/删除系统日历事件与提醒（闹钟）；用 `Events.SYNC_DATA1 = "checkin:<taskId>"` 做幂等标识（便于更新/删除）；优先复用设备「可写日历」，无则创建本地日历；IO 在后台线程执行。
  - 方法：`syncTask` / `syncAll` / `removeTask`（均做 `READ/WRITE_CALENDAR` 权限校验）。
- `android/app/src/main/java/com/workbench/checkin/MainActivity.java`
  —— 由极简壳改为 `onCreate` 注入插件列表（含 `TaskCalendarPlugin`）。
- `android/app/src/main/AndroidManifest.xml`
  —— 新增 `READ_CALENDAR` / `WRITE_CALENDAR` 权限声明。

**新增（Web 侧封装，原生平台才生效，Web/PWA 为 no-op）**
- `src/capacitor/task-calendar.ts`
  —— `registerPlugin('TaskCalendar')` 封装；`syncTaskToCalendar / removeTaskFromCalendar / syncTasksToCalendar / ensureCalendarPermission / isCalendarAvailable`。时间由 Web 用 JS Date 算成毫秒再传原生，原生不做日期解析（降低出错面）。非原生平台全部静默跳过。

**修改（挂载同步钩子）**
- `src/store/index.ts` —— 在 `addTask / updateTask / deleteTask` 内 fire-and-forget 调用日历同步（任一界面增删改任务都自动同步，一次覆盖全部入口）。
- `src/App.tsx` —— 启动 0.8s 后把现有「开启提醒」的待办批量同步到系统日历（让旧任务也能进日历）。
- `src/screens/MoreScreen.tsx` —— 「更多」页「待办提醒」卡片下新增**「同步到系统日历」**手动按钮（Web 端提示"请在手机 App 中打开"）。

## 数据与提醒映射
复用现有 `Task` 模型：
- `reminderEnabled === true` 且 `scheduledTime` 与 `scheduledDate` 都存在 → 写入系统日历事件。
- 事件时间 = `scheduledDate` + `scheduledTime`；时长缺省 30 分钟（有 `duration` 用其值）。
- 提醒提前量 = `reminderLead`（0=准点 / 5 / 15 / 30 / 60 分钟）。
- 关闭提醒 / 删除任务 → 自动移除对应日历事件，避免残留。

## 本地编译与小米真机验证 Runbook（必须在你本地完成）
> 沙箱无 Android SDK/模拟器，**无法在云端编译或运行安卓**，需你本地 Android Studio 验证。

1. **环境**：安装 Android Studio + Android SDK（API 33/34 平台与对应 build-tools）。首次打开会下载 Capacitor gradle 依赖（需联网）。
2. **打开工程**：Android Studio → Open → 选 `D:\WorkBuddyProjects\打卡工作台\android`。等待 Gradle Sync 完成。
3. **先出 Web 包**：在工程根目录 `npm run build`（已构建出 `dist/`，Capacitor 的 `webDir=dist` 由此读取）。
4. **连小米手机**：设置 → 关于手机 → 连点「MIUI 版本」开启开发者选项；开发者选项开「USB 调试」+「USB 安装」。用数据线连电脑，手机弹「允许 USB 调试」点确定。
5. **运行/安装**：Android Studio 点 Run（▶）选该设备；或 `android/gradlew assembleDebug` 后 `adb install app-debug.apk`。
6. **授权与体验**：
   - 首次打开 App → 更多 → 同步到系统日历 → 系统弹「日历权限」→ 允许。
   - 在任务里给某条开启「到点提醒」并设未来时间 → 自动写入 MIUI 日历 → 到点弹系统提醒。
   - MIUI 注意：系统「设置 → 通知管理 → 日历」需允许通知，否则不弹提醒。日历提醒由**系统日历进程**负责，不依赖本 App 存活。
7. **若编译报错**：把 Android Studio 的报错贴回给我，我据此修正 Java 插件（沙箱未编译，可能存在未预期的类/API 差异）。

## 已知限制 / 待确认
- 沙箱未编译安卓，原生代码未经编译验证；逻辑按 Capacitor 8 + CalendarContract 标准 API 编写。
- 多设备：日历事件写在本机系统日历，不做跨设备云同步（与任务数据的 Supabase 云同步是两条独立通道；如需"换手机日历也同步"，可后续加本地↔云端映射，本次未做）。
- 重复任务（每日/每周/每月）目前是按「单个 scheduledDate 当天」写一条事件；如需把未来 N 天的重复实例批量铺进日历，可后续增强 `syncAll` 的展开逻辑。
