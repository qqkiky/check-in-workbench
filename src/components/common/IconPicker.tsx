import { ICONS, ICON_NAMES, type IconName } from '@/utils/iconLibrary'

interface Props {
  value?: string
  onChange: (name: IconName) => void
  /** 底色：让图标预览带上分类色，底色 = 图3 月视图中显示的色块 */
  color?: string
}

// 图标库选择器：用户从图标库中自由选择分类图标
// 可选地传入分类底色，让每个图标的底色都跟随分类，便于预览
export function IconPicker({ value, onChange, color }: Props) {
  // 把 #RRGGBB 转成 #RRGGBB22 这种带透明度的色（用于非选中态的预览）
  const tint = color ? `${color}22` : '#F2F2F7'
  return (
    <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-1">
      {ICON_NAMES.map((name) => {
        const C = ICONS[name]
        const active = value === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={`aspect-square rounded-lg flex items-center justify-center transition active:scale-90 ${
              active ? 'shadow-sm' : ''
            }`}
            style={{
              background: active ? color || '#007AFF' : tint,
              color: active ? '#fff' : color || '#6B7280',
            }}
            aria-label={name}
          >
            <C size={18} color={active ? '#fff' : color || 'currentColor'} />
          </button>
        )
      })}
    </div>
  )
}

export const CATEGORY_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7',
  '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
  '#A2845E', '#8E8E93',
  // 多了几抹柔和糖果色
  '#FFB6C1', '#FFD8A8', '#B5EAD7', '#C7CEEA', '#FFDAC1', '#E0BBE4',
]
