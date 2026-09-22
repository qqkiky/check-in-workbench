import { useEffect, useRef, useState } from 'react'
import type { Task, CheckInRecord, Category, AppSettings } from '@/types'
import { useStore } from '@/store'
import { storage } from '@/services/storage'
import { testConnection, syncNow, onSyncingChange, isSyncing } from '@/services/cloudSync'
import { Icons } from '@/components/common/Icons'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { showToast, showActionToast } from '@/components/common/Toast'
import { CategoryIcon } from '@/utils/iconLibrary'
import { CategoryFormModal } from '@/components/tasks/CategoryFormModal'
import { onInstallable, isInstallable, installApp, isIOS, isStandalone, getInstallPlatform, isInAppBrowser, isMiuiBrowser } from '@/utils/pwa'
import { requestNotificationPermission } from '@/utils/reminder'
import { syncTasksToCalendar, isCalendarAvailable } from '@/capacitor/task-calendar'
import { APP_NAME } from '@/types'
import { THEME_PRESETS } from '@/utils/theme'

export function MoreScreen({ onOpenNotes, onOpenList }: { onOpenNotes?: () => void; onOpenList?: () => void }) {
  const { settings, updateSettings, reset, reload, restoreSnapshot, records, tasks, categories } = useStore()
  const [showAbout, setShowAbout] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<null | string>(null)
  const [importText, setImportText] = useState('')
  const [showImportText, setShowImportText] = useState(false)
  const [showSync, setShowSync] = useState(false)

  // 安装相关状态
  const platform = getInstallPlatform()
  const isIOSDevice = isIOS()
  const isInStandalone = isStandalone()

  useEffect(() => {
    setCanInstall(isInstallable())
    return onInstallable(setCanInstall)
  }, [])

  const handleInstall = async () => {
    const ok = await installApp()
    if (ok) showToast('已添加到主屏幕')
    else if (!isInstallable()) showToast('请使用浏览器菜单「添加到主屏幕」')
  }

  const handleExport = () => {
    const json = storage.exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `do-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast('已下载全部数据备份')
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选择同一文件
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        if (!text) {
          showToast('文件为空')
          return
        }
        parseAndStageImport(text)
      } catch (err) {
        showToast('备份文件解析失败')
      }
    }
    reader.onerror = () => showToast('读取文件失败')
    reader.onabort = () => showToast('读取已取消')
    reader.readAsText(file, 'utf-8')
  }

  // 解析并预览备份文件（仅校验，不写入）。校验通过后弹出确认对话框，
  // 由 applyImport 在用户确认时才真正写回，避免误覆盖当前数据。
  function parseAndStageImport(text: string) {
    if (!text.trim()) {
      showToast('内容为空')
      return
    }
    const preview = storage.previewBackup(text)
    if (!preview.ok) {
      showToast(preview.error || '备份文件解析失败')
      return
    }
    setPendingImport(text)
    setShowImportText(false) // 解析成功，关闭输入面板，弹确认对话框
    setImportText('')
  }

  const handleImportFromText = () => {
    parseAndStageImport(importText)
  }

  const applyImport = () => {
    if (!pendingImport) return
    try {
      // 导入前自动留存当前数据快照，便于一键撤销
      const before = storage.exportAllData()
      const result = storage.importAllData(pendingImport)
      reload() // 刷新内存状态，立即体现导入的数据
      setPendingImport(null)
      showActionToast({
        message: `已恢复 ${result.keys} 项数据`,
        actionText: '撤销',
        duration: 8000,
        onAction: () => {
          storage.importAllData(before)
          reload()
        },
      })
    } catch (err) {
      setPendingImport(null)
      showToast(err instanceof Error ? err.message : '导入失败')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <h1 className="text-2xl font-bold text-gray-900">更多</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-3 space-y-3">
        {/* 只要尚未以 PWA 独立模式运行就显示安装入口。
            注意：小米/红米浏览器（MiuiBrowser）几乎不触发 beforeinstallprompt，
            此前 canInstall 恒为 false 导致整个安装入口在 MIUI 上「消失」，
            所以这里不依赖 canInstall，仅在已安装（standalone）时隐藏。 */}
        {!isInStandalone && (
          <div className="bg-primary rounded-2xl shadow-card overflow-hidden">
            <button
              onClick={() => {
                if (canInstall) {
                  handleInstall()
                } else {
                  setShowInstallGuide(true)
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-white active:scale-[0.98] transition-transform"
            >
              <span className="shrink-0"><Icons.Download size={18} /></span>
              <span className="flex-1 text-left">
                <span className="block text-sm font-medium">安装到手机</span>
                <span className="block text-[11px] text-white/70">
                  {isIOSDevice
                    ? '添加到主屏幕，离线也能用'
                    : '一键安装到桌面 / 主屏幕'}
                </span>
              </span>
              <Icons.ChevronRight size={14} className="text-white/60" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <Item icon={<Icons.Sparkles size={16} />} label="坚持打卡" value={`${streak(records)} 天`} />
          <Item icon={<Icons.Database size={16} />} label="数据统计" value={`${records.length} 条记录 / ${tasks.length} 项任务`} />
          <Item icon={<Icons.FileText size={16} />} label="导出数据" onClick={() => setShowExport(true)} />
          <Item icon={<Icons.RotateCcw size={16} />} label="导入恢复" onClick={() => setShowImportText(true)} />
          <Item icon={<Icons.Filter size={16} />} label="分类管理" value={`${categories.length} 个`} onClick={() => setShowCatManager(true)} />
          <Item icon={<Icons.List size={16} />} label="任务管理" onClick={onOpenList} />
          <Item icon={<Icons.FileText size={16} />} label="记事本" onClick={onOpenNotes} />
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <Item
            icon={<Icons.Settings size={16} />}
            label="一周起始日"
            value={settings.weekStartDay === 1 ? '周一' : '周日'}
            onClick={() => updateSettings({ weekStartDay: settings.weekStartDay === 1 ? 0 : 1 })}
          />
          <Item
            icon={<Icons.Settings size={16} />}
            label="震动反馈"
            value={settings.hapticsEnabled ? '开启' : '关闭'}
            onClick={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
          />
          <Item
            icon={<Icons.Wallet size={16} />}
            label="月度预算"
            value={settings.budget && settings.budget > 0 ? `¥${settings.budget} / 月` : '未设置'}
            onClick={() => {
              setBudgetInput(settings.budget && settings.budget > 0 ? String(settings.budget) : '')
              setShowBudget(true)
            }}
          />
        </div>

        {/* 外观：主题色（驱动全站强调色） */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="shrink-0 text-gray-400"><Icons.Settings size={16} /></span>
            <span className="text-sm font-medium text-gray-900">主题色</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {THEME_PRESETS.map((p) => {
              const active = (settings.themeColor || '#4F6EF7') === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => updateSettings({ themeColor: p.value })}
                  title={p.name}
                  aria-label={p.name}
                  className={`w-9 h-9 rounded-full transition ${active ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-90 active:scale-95'}`}
                  style={{ background: p.value }}
                />
              )
            })}
          </div>
        </div>

        {/* 数据同步（Supabase，本地优先） */}
        <button
          onClick={() => setShowSync(true)}
          className="w-full bg-white rounded-2xl shadow-card overflow-hidden p-4 text-left active:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-primary"><Icons.Cloud size={16} /></span>
              <span className="text-sm font-medium text-gray-900">数据同步</span>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                settings.cloudSyncEnabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {settings.cloudSyncEnabled ? '已启用' : '未配置'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed pl-7">
            {settings.cloudSyncEnabled
              ? `本地优先，多设备镜像同步 · 上次：${settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString('zh-CN') : '尚未同步'}`
              : '本地数据离线可用，配置 Supabase 后可多设备同步（Android 与未来 iOS 通用）。'}
          </p>
        </button>

        {/* 待办提醒总开关 */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50">
            <span className="shrink-0 text-gray-400"><Icons.Bell size={16} /></span>
            <span className="flex-1 text-sm text-gray-900">待办提醒</span>
            <button
              onClick={async () => {
                if (!settings.notificationEnabled) {
                  // 开启：请求系统通知权限（若浏览器支持）
                  const perm = await requestNotificationPermission()
                  updateSettings({ notificationEnabled: true })
                  if (perm === 'denied') {
                    showToast('已开启应用内提醒；系统通知被拒绝，可在浏览器设置中允许')
                  } else if (perm === 'unsupported') {
                    showToast('已开启应用内提醒（当前浏览器不支持系统通知，iOS 仅应用内提示）')
                  } else if (perm === 'granted') {
                    showToast('提醒已开启，到点会弹通知 🔔')
                  }
                } else {
                  updateSettings({ notificationEnabled: false })
                  showToast('已关闭待办提醒')
                }
              }}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                settings.notificationEnabled ? 'bg-primary' : 'bg-gray-300'
              }`}
              aria-label="待办提醒总开关"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  settings.notificationEnabled ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <div className="px-4 py-2.5 text-[11px] text-gray-400 leading-relaxed">
            开启后，到点会在应用内弹出提醒；已授权系统通知的浏览器（Android / 桌面 Chrome）还会弹系统通知。
            iOS Safari 不支持网页通知，仅应用内提示。应用需处于打开状态。
          </div>
        </div>

        {/* 系统日历提醒：把开启「到点提醒」的待办写入手机系统日历（MIUI 原生弹提醒） */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <button
            onClick={async () => {
              if (!isCalendarAvailable) {
                showToast('请在手机 App 中打开，以同步到系统日历')
                return
              }
              void syncTasksToCalendar(tasks)
              showToast('已同步到系统日历 📅')
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
          >
            <span className="shrink-0 text-primary"><Icons.Calendar size={16} /></span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-gray-900">同步到系统日历</span>
              <span className="block text-[11px] text-gray-400">
                把开启「到点提醒」的待办写入手机日历，到点弹系统提醒
              </span>
            </span>
            <Icons.ChevronRight size={14} className="text-gray-300" />
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <Item icon={<Icons.Info size={16} />} label="关于 Do" onClick={() => setShowAbout(true)} />
          <Item icon={<Icons.Trash size={16} />} label="重置数据" danger onClick={() => setShowReset(true)} />
        </div>

        <div className="text-center text-xs text-gray-400 pt-4">
          {APP_NAME} v1.0
        </div>
      </div>

      <Modal open={showAbout} onClose={() => setShowAbout(false)} title={`关于 ${APP_NAME}`}>
        <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
          <p>
            <strong className="text-gray-900">{APP_NAME}</strong> 是一款轻量级的日常打卡工作台，
            通过时间线、分类追踪与可视化图表，帮助你建立稳定的生活节奏。
          </p>
          <p>核心功能：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>每日任务时间线（上午/下午/晚上）</li>
            <li>分类追踪 + 农历日历</li>
            <li>年度热力图、月度日历、分类环形图</li>
            <li>任务增删改查 + 量化目标</li>
            <li>本地离线存储，数据私密</li>
          </ul>
          <p className="text-xs text-gray-400">数据存储于本地浏览器/设备，不上传服务器。建议定期用「更多 → 导出数据」备份，防止换设备 / 清缓存导致数据丢失。</p>
        </div>
      </Modal>

      <Modal
        open={showReset}
        onClose={() => setShowReset(false)}
        title="重置数据"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setShowReset(false)}
              className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-sm active:scale-95"
            >
              取消
            </button>
            <button
              onClick={() => {
                const snapshot = { tasks, records, categories, settings }
                reset()
                setShowReset(false)
                showActionToast({
                  message: '数据已重置',
                  actionText: '撤销',
                  duration: 8000,
                  onAction: () => restoreSnapshot(snapshot),
                })
              }}
              className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-95"
            >
              确认重置
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          重置会清空全部任务与打卡记录，应用恢复为空白状态（不再生成示例数据）。
        </p>
        <p className="text-xs text-amber-600 mt-2">
          提示：重置后底部会弹出「撤销」按钮，8 秒内可一键恢复当前数据。
        </p>
      </Modal>

      <Modal open={showExport} onClose={() => setShowExport(false)} title="导出数据">
        <div className="text-sm space-y-3">
          <p className="text-gray-600">
            将全部数据（打卡、记账、账户、转账、分类、笔记、时间线、设置等所有模块）导出为 JSON 文件，保存到你设备或云盘，作为长期备份。换手机、清缓存或迁移到新链接前，建议先导出一份。
          </p>
          <button
            onClick={handleExport}
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-medium active:scale-95 flex items-center justify-center gap-2"
          >
            <Icons.Download size={16} /> 下载备份文件 (.json)
          </button>
          <p className="text-xs text-gray-400">
            文件命名格式：do-backup-YYYY-MM-DD.json。换手机或清缓存前，建议先导出一份。
          </p>
        </div>
      </Modal>

      <Modal
        open={showImportText}
        onClose={() => {
          setShowImportText(false)
          setImportText('')
        }}
        title="导入恢复"
      >
        <div className="text-sm space-y-3">
          <p className="text-gray-600">
            从备份文件还原数据。iOS 系统中若文件选择器无法弹出，可直接粘贴导出的 JSON 文本。
          </p>

          {/* 选文件：用 label 关联 input，点击 label 即原生点击 input。
              小米/QQ 等国产浏览器禁止 JS 间接触发 file input，必须用 label 直连 */}
          <label
            htmlFor="importFile"
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-medium active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icons.FileText size={16} /> 选择备份文件
          </label>

          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="flex-1 h-px bg-gray-200" />
            <span>或粘贴 JSON 文本</span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="把导出的 JSON 内容粘贴到这里…"
            className="w-full h-32 px-3 py-2 bg-gray-100 rounded-lg text-[11px] font-mono outline-none resize-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => {
              handleImportFromText()
            }}
            disabled={!importText.trim()}
            className="w-full h-10 rounded-xl bg-gray-900 text-white text-sm font-medium active:scale-95 disabled:bg-gray-300"
          >
            解析并预览导入
          </button>
        </div>
      </Modal>

      <Modal open={showInstallGuide} onClose={() => setShowInstallGuide(false)} title="添加到主屏幕">
        <InstallGuide platform={platform} />
      </Modal>

      <Modal open={showCatManager} onClose={() => setShowCatManager(false)} title="分类管理">
        <div className="space-y-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setEditingCatId(cat.id)
                setShowCatForm(true)
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl text-left active:scale-[0.98] transition-transform"
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: cat.color + '22', color: cat.color }}
              >
                <CategoryIcon category={cat} size={18} color={cat.color} />
              </span>
              <span className="flex-1 text-sm text-gray-900 truncate">{cat.name}</span>
              <Icons.ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
          <button
            onClick={() => {
              setEditingCatId(null)
              setShowCatForm(true)
            }}
            className="w-full h-10 mt-1 rounded-xl bg-primary text-white text-sm font-medium active:scale-95 flex items-center justify-center gap-2"
          >
            <Icons.Plus size={16} /> 新建分类
          </button>
        </div>
      </Modal>

      <CategoryFormModal
        open={showCatForm}
        categoryId={editingCatId}
        onClose={() => setShowCatForm(false)}
        onSaved={() => setEditingCatId(null)}
      />

      <Modal open={showBudget} onClose={() => setShowBudget(false)} title="月度预算">
        <div className="text-sm space-y-4">
          <p className="text-gray-600">
            设置每月支出预算。开启后，记账页当月支出接近或超出预算时，会以横幅提醒你。
          </p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">每月预算（元）</label>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 focus-within:ring-2 focus-within:ring-primary/30">
              <span className="text-gray-400 text-base">¥</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="例如 3000"
                className="flex-1 bg-transparent outline-none text-base"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">留空或填 0 表示不启用预算提醒。</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBudget(false)}
              className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:scale-95"
            >
              取消
            </button>
            <button
              onClick={() => {
                const v = parseFloat(budgetInput)
                updateSettings({ budget: !isNaN(v) && v > 0 ? Math.round(v * 100) / 100 : 0 })
                setShowBudget(false)
                showToast(v && v > 0 ? '预算已设置' : '已关闭预算提醒')
              }}
              className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-medium active:scale-95"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingImport}
        title="导入备份"
        message="导入将覆盖当前全部数据（含打卡、记账、账户、转账、笔记、时间线、设置等全部模块）。如需保留现有数据，请先导出备份。"
        confirmText="导入并覆盖"
        danger
        onConfirm={applyImport}
        onCancel={() => setPendingImport(null)}
      />

      <SyncModal
        open={showSync}
        onClose={() => setShowSync(false)}
        settings={settings}
        onSettingsChange={(patch) => updateSettings(patch)}
        onReload={() => reload()}
      />

      {/* iOS PWA 中 display:none 的 file input 不会触发文件选择，改为绝对定位 1px 透明。
          通过 <label htmlFor="importFile"> 原生关联，规避小米等浏览器禁止 JS 触发 file input 的限制 */}
      <input
        id="importFile"
        ref={fileRef}
        type="file"
        accept="application/json,.json,text/plain"
        onChange={handleImportFile}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
        }}
      />
    </div>
  )
}

function Item({
  icon,
  label,
  value,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onClick?: () => void
  danger?: boolean
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors text-left ${
        danger ? 'text-red-500' : 'text-gray-900'
      }`}
    >
      <span className={`shrink-0 ${danger ? 'text-red-500' : 'text-gray-400'}`}>{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {value && <span className="text-xs text-gray-400">{value}</span>}
      {onClick && <Icons.ChevronRight size={14} className="text-gray-300" />}
    </Wrapper>
  )
}

function streak(records: { date: string }[]): number {
  if (records.length === 0) return 0
  const set = new Set(records.map((r) => r.date))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    if (set.has(k)) streak++
    else {
      if (i === 0) continue
      break
    }
  }
  return streak
}

// ===================== 数据同步弹层 =====================
/**
 * Supabase 云同步配置与操作：
 * - 填写 Project URL 与 anon key（仅 anon，不含 service_role，无 PII）
 * - 测试连接：匿名登录 + 读 sync_rows，验证 URL/key/schema 全链路
 * - 启用开关：开启后 App 启动静默 pull、本地写操作防抖自动 push
 * - 立即同步：完整 Pull（增量）→ Push（全量），同步本地数据到云端
 */
function SyncModal({
  open,
  onClose,
  settings,
  onSettingsChange,
  onReload,
}: {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onReload: () => void
}) {
  // URL / key 输入：先存本地草稿，用户点「保存并启用」或「测试连接」时才写回 settings
  const [urlDraft, setUrlDraft] = useState(settings.supabaseUrl || '')
  const [keyDraft, setKeyDraft] = useState(settings.supabaseAnonKey || '')
  const [busy, setBusy] = useState<null | 'test' | 'sync'>(null)
  const [, force] = useState(0) // 触发 isSyncing 变化重渲

  useEffect(() => {
    if (open) {
      setUrlDraft(settings.supabaseUrl || '')
      setKeyDraft(settings.supabaseAnonKey || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 订阅全局 syncing 状态（立即同步时显示转圈）
  useEffect(() => {
    const unsub = onSyncingChange(() => force((n) => n + 1))
    return unsub
  }, [])

  const configured = !!(settings.supabaseUrl && settings.supabaseAnonKey)
  const enabled = !!settings.cloudSyncEnabled
  const syncing = isSyncing()

  const handleTest = async () => {
    const url = urlDraft.trim()
    const key = keyDraft.trim()
    if (!url || !key) {
      showToast('请先填写 URL 和 anon key')
      return
    }
    setBusy('test')
    const r = await testConnection(url, key)
    setBusy(null)
    if (r.ok) {
      // 测试通过即把草稿写回，方便后续直接启用
      onSettingsChange({ supabaseUrl: url, supabaseAnonKey: key })
      showToast('连接成功，已记住配置')
    } else {
      showToast(r.error || '连接失败')
    }
  }

  const handleSaveAndToggle = async (on: boolean) => {
    const url = urlDraft.trim()
    const key = keyDraft.trim()
    if (on && (!url || !key)) {
      showToast('启用前请先填写 URL 和 anon key')
      return
    }
    // 先存配置
    onSettingsChange({ supabaseUrl: url, supabaseAnonKey: key, cloudSyncEnabled: on })
    showToast(on ? '云同步已开启，后台将自动同步' : '云同步已关闭')
  }

  const handleSyncNow = async () => {
    const url = urlDraft.trim()
    const key = keyDraft.trim()
    if (!url || !key) {
      showToast('请先填写 URL 和 anon key')
      return
    }
    // 把草稿写回，确保同步用的是最新配置
    onSettingsChange({ supabaseUrl: url, supabaseAnonKey: key })
    setBusy('sync')
    const r = await syncNow({ ...settings, supabaseUrl: url, supabaseAnonKey: key })
    setBusy(null)
    if (r.ok) {
      onSettingsChange({ lastSyncAt: Date.now() })
      if (r.needReload) onReload()
      const parts: string[] = []
      if (r.pulled) parts.push(`拉取 ${r.pulled}`)
      if (r.pushed) parts.push(`上传 ${r.pushed}`)
      if (r.deleted) parts.push(`删除 ${r.deleted}`)
      showToast(parts.length ? `同步完成：${parts.join(' · ')}` : '同步完成（无变更）')
    } else {
      showToast(r.error || '同步失败')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="数据同步">
      <div className="text-sm space-y-4">
        {/* 状态徽标 */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">同步状态</span>
          {syncing ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
              <Icons.RefreshCw size={11} className="animate-spin" /> 同步中
            </span>
          ) : enabled ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">已启用</span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">未启用</span>
          )}
        </div>

        {/* URL */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Supabase Project URL</label>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full h-10 px-3 py-2 bg-gray-100 rounded-xl text-[12px] font-mono outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-gray-400 mt-1">控制台 → Project Settings → API → Project URL</p>
        </div>

        {/* anon key */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">anon public key</label>
          <textarea
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="eyJhbGciOi…（只填 anon，不要填 service_role）"
            className="w-full h-20 px-3 py-2 bg-gray-100 rounded-xl text-[11px] font-mono outline-none resize-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            同上页 → Project API keys → <span className="text-gray-500">anon public</span>（已受 RLS 限制，无 PII 风险）
          </p>
        </div>

        {/* 测试连接 */}
        <button
          onClick={handleTest}
          disabled={busy !== null}
          className="w-full h-10 rounded-xl bg-gray-100 text-gray-800 text-sm font-medium active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy === 'test' ? <Icons.RefreshCw size={14} className="animate-spin" /> : <Icons.Cloud size={14} />}
          测试连接
        </button>

        {/* 启用开关 */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-sm text-gray-900">启用云同步</p>
            <p className="text-[11px] text-gray-400">开启后：启动静默拉取 · 写操作后自动上传</p>
          </div>
          <button
            onClick={() => handleSaveAndToggle(!enabled)}
            className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-primary' : 'bg-gray-300'}`}
            aria-label="云同步开关"
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`}
            />
          </button>
        </div>

        {/* 立即同步 */}
        <button
          onClick={handleSyncNow}
          disabled={!configured || busy !== null || syncing}
          className="w-full h-11 rounded-xl bg-primary text-white text-sm font-medium active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-2"
        >
          {busy === 'sync' || syncing ? <Icons.RefreshCw size={16} className="animate-spin" /> : <Icons.RefreshCw size={16} />}
          立即同步
        </button>

        {/* 上次同步时间 */}
        <p className="text-[11px] text-gray-400 text-center">
          {settings.lastSyncAt ? `上次同步：${new Date(settings.lastSyncAt).toLocaleString('zh-CN')}` : '尚未同步过'}
        </p>

        {/* 帮助 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 leading-relaxed space-y-1">
          <p><b>首次配置三步：</b></p>
          <p>1. 已在 supabase.com 建项目（你已完成 ✓）</p>
          <p>2. 控制台 → <b>SQL Editor</b> → 粘贴执行项目根目录 <b>supabase/schema.sql</b></p>
          <p>3. 控制台 → <b>Authentication → Providers → Anonymous</b> → 开启匿名登录</p>
          <p>完成后填上面 URL 与 anon key，点「测试连接」，通过即可启用。</p>
        </div>
      </div>
    </Modal>
  )
}

/** 安装引导：按平台给出 iOS / Android / 桌面 三端清晰的步骤 */
function CopyLinkButton() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('已复制链接，去系统浏览器打开')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = window.location.href
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        showToast('已复制链接，去系统浏览器打开')
      } catch {
        showToast('复制失败，请手动复制地址栏链接')
      }
      document.body.removeChild(ta)
    }
  }
  return (
    <button
      onClick={copy}
      className="w-full h-10 rounded-xl bg-primary text-white text-sm font-medium active:scale-95"
    >
      复制当前页面链接
    </button>
  )
}

function InstallGuide({ platform }: { platform: ReturnType<typeof getInstallPlatform> }) {
  if (isInAppBrowser()) {
    return (
      <div className="text-sm space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800">
          <p className="font-semibold mb-1">⚠️ 当前在微信 / QQ 等内置浏览器中</p>
          <p className="text-xs leading-relaxed">
            这类内置浏览器会屏蔽「添加到主屏幕」，所以此处无法直接安装。请把本页面链接用系统浏览器（Safari / Chrome）打开后再添加。
          </p>
        </div>
        <ol className="space-y-2 list-decimal pl-5 text-gray-700">
          <li>点右上角 <strong>「···」</strong> → <strong>「在浏览器打开」</strong>（或「复制链接」后粘贴到系统浏览器）</li>
          <li>在系统浏览器打开后，按你的设备按下方步骤添加：</li>
        </ol>
        <CopyLinkButton />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800">
          {isIOS()
            ? 'iOS：系统浏览器即 Safari，打开后点底部「分享 → 添加到主屏幕」。'
            : 'Android：用 Chrome 打开后点「菜单 ⋮ → 添加到主屏幕 / 安装应用」。'}
        </div>
      </div>
    )
  }
  if (isMiuiBrowser()) {
    return (
      <div className="text-sm text-gray-700 space-y-3">
        <p className="text-gray-600">小米 / 红米自带浏览器（MiuiBrowser）添加到桌面的步骤：</p>
        <ol className="space-y-2 list-decimal pl-5">
          <li>点击浏览器底部或右上角的 <strong>「菜单 ⋮」</strong></li>
          <li>在菜单中找到 <strong>「添加至主屏」</strong> / 「添加到桌面」/「桌面快捷方式」（不同版本叫法略有差异，认「主屏 / 桌面」字样即可）</li>
          <li>确认后桌面会出现「{APP_NAME}」图标，从图标打开即可全屏离线使用</li>
        </ol>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-xs text-orange-800">
          ⚠️ 若点了「添加至主屏」<b>没有任何反应</b>，多半是「桌面快捷方式」权限没开：
          去 <b>系统设置 → 应用设置 → 小米浏览器 → 权限 → 桌面快捷方式</b> 开启后再重试。
          更稳妥的做法是复制下面链接，用 <b>Chrome</b> 打开后点「菜单 ⋮ → 添加到主屏幕」安装。
        </div>
        <CopyLinkButton />
      </div>
    )
  }
  if (platform === 'ios-safari') {
    return (
      <div className="text-sm text-gray-700 space-y-3">
        <p className="text-gray-600">
          iOS Safari 出于隐私策略不会自动弹出安装提示。按以下 3 步把「{APP_NAME}」加到主屏幕，下次从桌面图标打开即可离线使用：
        </p>
        <ol className="space-y-2 list-decimal pl-5">
          <li>点击 Safari 底部的 <strong>分享按钮</strong>（方框加向上箭头 ⬆️）</li>
          <li>在弹出菜单中选择 <strong>「添加到主屏幕」</strong></li>
          <li>确认名称后点击右上角 <strong>「添加」</strong></li>
        </ol>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800">
          小提示：不要从微信 / 浏览器内嵌页打开，需要先在 Safari 中打开本页面再操作。
        </div>
      </div>
    )
  }
  if (platform === 'android-chrome') {
    return (
      <div className="text-sm text-gray-700 space-y-3">
        <p className="text-gray-600">
          Android Chrome 支持一键安装到桌面：
        </p>
        <ol className="space-y-2 list-decimal pl-5">
          <li>点击右上角 <strong>菜单 ⋮</strong></li>
          <li>选择 <strong>「添加到主屏幕」</strong> 或「安装应用」</li>
          <li>确认后桌面会出现「{APP_NAME}」图标</li>
        </ol>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-800">
          小提示：安装后从桌面图标打开，可全屏使用并离线访问。
        </div>
        {isMiuiBrowser() && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-xs text-orange-800">
            检测到小米 / 红米浏览器：若点了「添加到主屏」<b>没反应</b>，请先到
            <b>系统设置 → 应用 → 小米浏览器 → 权限</b> 开启「桌面快捷方式」，再重试。
            或直接复制本链接到 <b>Chrome</b> 打开安装，更稳定。
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="text-sm text-gray-700 space-y-3">
      <p className="text-gray-600">桌面 Chrome / Edge 同样支持 PWA 安装：</p>
      <ol className="space-y-2 list-decimal pl-5">
        <li>点击地址栏右侧的 <strong>「安装」</strong> 图标（电脑 / 加号符号）</li>
        <li>在弹窗中点「安装」即可</li>
        <li>之后可从桌面 / 开始菜单直接打开，离线使用</li>
      </ol>
    </div>
  )
}