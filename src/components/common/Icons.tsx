// 通用内联 SVG 图标 - 避免引入图标库

type IconProps = { size?: number; className?: string; color?: string }

const baseProps = (size: number, color?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color || 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Icons = {
  Check: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Bell: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Calendar: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Edit: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Plus: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Search: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Filter: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  X: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ArrowLeft: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  MoreHorizontal: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
  Trash: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  BarChart: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  List: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Home: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Settings: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  ChevronRight: ({ size = 14, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronLeft: ({ size = 14, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronDown: ({ size = 14, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Sparkles: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  ),
  Database: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  Info: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  FileText: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Repeat: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  Download: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Archive: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  RotateCcw: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" />
    </svg>
  ),
  Wallet: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7v10" />
      <path d="M16 12h3a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1h-3z" />
      <line x1="16" y1="10" x2="21" y2="10" />
    </svg>
  ),
  // 账户间转账：上下两条反向箭头
  Transfer: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="17 4 21 8 17 12" />
      <line x1="21" y1="8" x2="3" y2="8" />
      <polyline points="7 12 3 16 7 20" />
      <line x1="3" y1="16" x2="21" y2="16" />
    </svg>
  ),
  // 上下对调（交换转出/转入账户）
  SwapVertical: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="7 4 7 20" />
      <polyline points="4 17 7 20 10 17" />
      <polyline points="17 20 17 4" />
      <polyline points="14 7 17 4 20 7" />
    </svg>
  ),
  ArrowDown: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="6 14 12 20 18 14" />
    </svg>
  ),
  // 云同步：云朵图标
  Cloud: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  // 刷新（同步）：双箭头环形
  RefreshCw: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  // 上传
  Upload: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  // 咨询（报纸/资讯）
  Newspaper: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 22h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v15a1 1 0 0 1-1 1z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  ),
  // 药品（胶囊）
  Pill: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z" />
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
    </svg>
  ),
  // 监管（盾牌）
  Shield: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  // 右上角箭头（来源外链）
  ArrowUpRight: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  // 离线（云斜杠）
  CloudOff: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M5.7 5.7A4 4 0 0 0 4 9a5 5 0 0 0 7.5 4.3M9.9 5.2A5 5 0 0 1 19 9a4 4 0 0 1-.3 1.6M17 17H7a4 4 0 0 1-1-7.9" />
      <path d="M22 17a4 4 0 0 1-1 7.9" />
    </svg>
  ),
  // 海外资讯（地球）
  Globe: ({ size = 16, className = '' }: IconProps) => (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
}