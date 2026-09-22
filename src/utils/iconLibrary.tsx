import React from 'react'

export type IconName =
  | 'sun' | 'cloudSun' | 'briefcase' | 'moon' | 'home' | 'book' | 'bed'
  | 'trendingUp' | 'dumbbell' | 'heart' | 'star' | 'leaf' | 'coffee'
  | 'music' | 'droplet' | 'flame' | 'target' | 'calendar' | 'check'
  | 'clock' | 'smile' | 'zap' | 'camera' | 'plane' | 'gift' | 'shield'
  | 'bell' | 'pencil' | 'globe' | 'sparkles' | 'flower' | 'gamepad'
  | 'shopping' | 'palette' | 'rocket' | 'cat' | 'food' | 'run'
  // 可爱小动物
  | 'dog' | 'rabbit' | 'panda' | 'fox' | 'pig' | 'frog' | 'bird'
  | 'fish' | 'butterfly' | 'bear' | 'koala' | 'duck' | 'owl'
  // 食物
  | 'cake' | 'cookie' | 'iceCream' | 'donut' | 'fries' | 'pizza'
  | 'apple' | 'banana' | 'grape' | 'strawberry' | 'watermelon' | 'cherry'
  | 'milk' | 'tea' | 'lollipop'
  // 物件 / 植物
  | 'tree' | 'cactus' | 'mushroom' | 'rainbow' | 'cloud' | 'snow'
  | 'fire' | 'sun2' | 'moon2' | 'umbrella' | 'balloon' | 'key'
  | 'lock' | 'tag' | 'flag' | 'pin' | 'bookmark' | 'link'
  | 'eye' | 'ear' | 'lightbulb' | 'magic' | 'crown' | 'gem'
  | 'scissors' | 'paperclip' | 'paintbrush' | 'telescope' | 'soccer'
  | 'basketball' | 'tennis' | 'swim' | 'yoga' | 'meditate' | 'sleep'
  | 'sunrise' | 'sunset' | 'rain' | 'wind' | 'mountain' | 'beach'
  | 'tent' | 'bus' | 'train' | 'ship' | 'bike' | 'walk'

type IconProps = { size?: number; color?: string; className?: string }
type IconFC = (p: IconProps) => JSX.Element

const base = (size: number, color?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: color || 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

const Sun: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.5" y1="4.5" x2="6.5" y2="6.5" />
    <line x1="17.5" y1="17.5" x2="19.5" y2="19.5" />
    <line x1="4.5" y1="19.5" x2="6.5" y2="17.5" />
    <line x1="17.5" y1="6.5" x2="19.5" y2="4.5" />
  </svg>
)

const CloudSun: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="8" cy="8" r="3" />
    <line x1="8" y1="2" x2="8" y2="4" />
    <line x1="2" y1="8" x2="4" y2="8" />
    <line x1="4" y1="4" x2="5.5" y2="5.5" />
    <path d="M17 18H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18z" />
  </svg>
)

const Briefcase: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
)

const Moon: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

const Home: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const Book: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M4 4h11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" />
    <path d="M20 4h0a2 2 0 0 1 2 2v12" />
  </svg>
)

const Bed: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 14h18" />
    <path d="M3 18v2M21 18v2" />
    <path d="M7 10V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
  </svg>
)

const TrendingUp: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
)

const Dumbbell: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M6.5 6.5l11 11" />
    <path d="M3 7l3-3 3 3-3 3z" />
    <path d="M21 17l-3 3-3-3 3-3z" />
    <path d="M9 9l6 6" />
  </svg>
)

const Heart: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

const Star: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
  </svg>
)

const Leaf: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 8-4 13-9 13z" />
    <line x1="4" y1="20" x2="11" y2="13" />
  </svg>
)

const Coffee: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
    <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
    <line x1="7" y1="2" x2="7" y2="5" />
    <line x1="11" y1="2" x2="11" y2="5" />
  </svg>
)

const Music: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M9 18V5l10-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="16" cy="16" r="3" />
  </svg>
)

const Droplet: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 2.5C12 2.5 5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.5-7-11.5z" />
  </svg>
)

const Flame: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 2c1 3-2 5-2 8a2 2 0 0 0 4 0c0-1 0-2-1-3 3 2 5 5 5 8a5 5 0 0 1-10 0c0-4 4-6 4-13z" />
  </svg>
)

const Target: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
)

const Calendar: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const Check: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const Clock: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const Smile: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <line x1="9" y1="10" x2="9" y2="10.01" />
    <line x1="15" y1="10" x2="15" y2="10.01" />
    <path d="M8.5 14.5a4 4 0 0 0 7 0" />
  </svg>
)

const Zap: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2" />
  </svg>
)

const Camera: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

const Plane: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M21 15l-9-3-4 5-2-1 2-6-6-2 1-2 6 2 1-4 3 9 1 1z" />
  </svg>
)

const Gift: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="3" y="8" width="18" height="13" rx="1" />
    <line x1="12" y1="8" x2="12" y2="21" />
    <path d="M12 8C12 4 9 4 8 6s1 2 4 2zM12 8c0-4 3-4 4-2s-1 2-4 2z" />
  </svg>
)

const Shield: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" />
  </svg>
)

const Bell: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

const Pencil: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

const Globe: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
  </svg>
)

const Sparkles: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18" />
  </svg>
)

const Flower: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 9.5c0-3 2-5 0-6.5-2 1.5 0 3.5 0 6.5zM14.5 12c3 0 5 2 6.5 0-1.5-2-3.5 0-6.5 0zM12 14.5c0 3-2 5 0 6.5 2-1.5 0-3.5 0-6.5zM9.5 12c-3 0-5-2-6.5 0 1.5 2 3.5 0 6.5 0z" />
  </svg>
)

const Gamepad: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.5 1.6L15 15H9l-1.5 1.6A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z" />
    <line x1="7" y1="11" x2="7" y2="13" />
    <line x1="6" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="18" y2="12" />
  </svg>
)

const Shopping: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 4h2l2.5 12h11l2-8H6" />
  </svg>
)

const Palette: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 2a10 10 0 0 0 0 20c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a4 4 0 0 0 4-4 9 9 0 0 0-12-10z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="11" cy="7" r="1" />
    <circle cx="15.5" cy="8" r="1" />
  </svg>
)

const Rocket: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2" />
    <path d="M12 2c4 2 6 6 6 11l-3 3H9L6 13c0-5 2-9 6-11z" />
    <circle cx="12" cy="9" r="2" />
  </svg>
)

const Cat: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 11a7 7 0 0 1 14 0v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <path d="M5 11l-2-3 3 1M19 11l2-3-3 1" />
    <line x1="10" y1="14" x2="10" y2="14.01" />
    <line x1="14" y1="14" x2="14" y2="14.01" />
  </svg>
)

const Food: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 3v8a3 3 0 0 0 6 0V3M8 11v10" />
    <path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5zM16 16v5" />
  </svg>
)

const Run: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="15" cy="5" r="1.5" />
    <path d="M13 9l-2 3 2 2 1 5M11 12l-4 2-2 4M13 9l4-1 3 2" />
  </svg>
)

// ============== 可爱小动物 ==============
const Dog: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M4 8l-1-4 3 2M20 8l1-4-3 2" />
    <path d="M5 8a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <circle cx="9" cy="12" r="0.8" />
    <circle cx="15" cy="12" r="0.8" />
    <path d="M11 15a1.5 1.5 0 0 0 2 0" />
  </svg>
)
const Rabbit: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M9 5l-1 5M15 5l1 5" />
    <path d="M6 12a6 6 0 0 1 12 0v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    <circle cx="10" cy="13" r="0.7" />
    <circle cx="14" cy="13" r="0.7" />
    <path d="M11 16h2" />
  </svg>
)
const Panda: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="6" cy="7" r="2" />
    <circle cx="18" cy="7" r="2" />
    <circle cx="12" cy="13" r="7" />
    <ellipse cx="9" cy="11" rx="2" ry="2.5" />
    <ellipse cx="15" cy="11" rx="2" ry="2.5" />
    <circle cx="9" cy="11" r="0.6" fill={color || 'currentColor'} />
    <circle cx="15" cy="11" r="0.6" fill={color || 'currentColor'} />
  </svg>
)
const Fox: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M4 5l2 3M20 5l-2 3" />
    <path d="M12 6c-4 0-7 3-7 7 0 3 2 5 5 5h4c3 0 5-2 5-5 0-4-3-7-7-7z" />
    <circle cx="10" cy="13" r="0.8" />
    <circle cx="14" cy="13" r="0.8" />
    <path d="M12 16l-1 1h2z" />
  </svg>
)
const Pig: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="12" cy="13" rx="8" ry="6" />
    <circle cx="9" cy="13" r="0.6" />
    <circle cx="15" cy="13" r="0.6" />
    <ellipse cx="12" cy="14" rx="1.5" ry="1" />
    <path d="M5 9l-1-2M19 9l1-2" />
  </svg>
)
const Frog: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="9" cy="9" r="3" />
    <circle cx="15" cy="9" r="3" />
    <circle cx="9" cy="9" r="1" fill={color || 'currentColor'} />
    <circle cx="15" cy="9" r="1" fill={color || 'currentColor'} />
    <path d="M5 14a7 4 0 0 1 14 0c0 3-3 5-7 5s-7-2-7-5z" />
    <path d="M9 16c1 1 4 1 6 0" />
  </svg>
)
const Bird: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 12c2-2 4-3 7-3l4 1 5-2-1 4-3 2-2 4-2-2-4 1-4-1z" />
    <circle cx="14" cy="11" r="0.6" fill={color || 'currentColor'} />
  </svg>
)
const Fish: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 12c3-5 8-5 13 0-5 5-10 5-13 0z" />
    <path d="M16 12l5-3v6z" />
    <circle cx="6" cy="11" r="0.7" />
  </svg>
)
const Butterfly: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="7" cy="9" rx="4" ry="3" />
    <ellipse cx="17" cy="9" rx="4" ry="3" />
    <ellipse cx="7" cy="15" rx="3" ry="2" />
    <ellipse cx="17" cy="15" rx="3" ry="2" />
    <line x1="12" y1="6" x2="12" y2="18" />
  </svg>
)
const Bear: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="13" r="7" />
    <ellipse cx="12" cy="14" rx="1.5" ry="1" />
    <circle cx="10" cy="12" r="0.6" />
    <circle cx="14" cy="12" r="0.6" />
  </svg>
)
const Koala: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="5" cy="11" rx="2" ry="3" />
    <ellipse cx="19" cy="11" rx="2" ry="3" />
    <circle cx="12" cy="13" r="6" />
    <ellipse cx="12" cy="14" rx="2" ry="1.5" />
    <circle cx="9" cy="12" r="0.6" />
    <circle cx="15" cy="12" r="0.6" />
  </svg>
)
const Duck: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="11" cy="14" rx="6" ry="4" />
    <circle cx="16" cy="9" r="3" />
    <path d="M19 9h2l-1 1.5z" />
    <circle cx="17" cy="8" r="0.5" fill={color || 'currentColor'} />
  </svg>
)
const Owl: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="12" cy="12" rx="6" ry="7" />
    <circle cx="9" cy="10" r="2.5" />
    <circle cx="15" cy="10" r="2.5" />
    <circle cx="9" cy="10" r="0.8" fill={color || 'currentColor'} />
    <circle cx="15" cy="10" r="0.8" fill={color || 'currentColor'} />
    <path d="M11 13l1 1 1-1" />
  </svg>
)

// ============== 食物 ==============
const Cake: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="4" y="11" width="16" height="9" rx="1" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="12" y1="11" x2="12" y2="7" />
    <path d="M11 7c0-2 1-3 1-3s1 1 1 3" />
  </svg>
)
const Cookie: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1" />
    <circle cx="14" cy="14" r="1" />
    <circle cx="15" cy="9" r="0.7" />
    <circle cx="8" cy="15" r="0.7" />
  </svg>
)
const IceCream: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M6 11l6 9 6-9z" />
    <circle cx="12" cy="7" r="4" />
    <circle cx="9" cy="9" r="2.5" />
  </svg>
)
const Donut: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const Fries: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M7 10l-1 9h12l-1-9z" />
    <line x1="9" y1="10" x2="10" y2="3" />
    <line x1="12" y1="10" x2="12" y2="2" />
    <line x1="15" y1="10" x2="14" y2="3" />
  </svg>
)
const Pizza: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 21L21 3c-5-1-10 0-13 3S3 16 3 21z" />
    <circle cx="9" cy="15" r="1" />
    <circle cx="15" cy="9" r="1" />
    <circle cx="13" cy="13" r="0.7" />
  </svg>
)
const Apple: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 7c-2 0-5 1-5 5s1 8 5 8 5-4 5-8-3-5-5-5z" />
    <path d="M12 7c0-2 1-3 2-3" />
  </svg>
)
const Banana: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 5c0 8 4 14 12 14l2-2-2-1-9 0c-1 0-2-1-2-2L5 5z" />
  </svg>
)
const Grape: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="9" cy="9" r="2" />
    <circle cx="15" cy="9" r="2" />
    <circle cx="6" cy="14" r="2" />
    <circle cx="12" cy="14" r="2" />
    <circle cx="18" cy="14" r="2" />
    <circle cx="9" cy="19" r="2" />
    <circle cx="15" cy="19" r="2" />
    <path d="M12 5l2-2" />
  </svg>
)
const Strawberry: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 11c0 5 3 9 7 9s7-4 7-9c0-2-3-4-7-4s-7 2-7 4z" />
    <path d="M9 4l1 2M12 3l0 3M15 4l-1 2" />
    <circle cx="9" cy="13" r="0.5" fill={color || 'currentColor'} />
    <circle cx="14" cy="14" r="0.5" fill={color || 'currentColor'} />
    <circle cx="11" cy="17" r="0.5" fill={color || 'currentColor'} />
  </svg>
)
const Watermelon: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 16a10 6 0 0 1 18 0z" />
    <circle cx="8" cy="14" r="0.6" fill={color || 'currentColor'} />
    <circle cx="12" cy="13" r="0.6" fill={color || 'currentColor'} />
    <circle cx="16" cy="14" r="0.6" fill={color || 'currentColor'} />
  </svg>
)
const Cherry: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M9 4c0 3-1 5-3 7" />
    <path d="M15 4c0 3 1 5 3 7" />
    <circle cx="6" cy="14" r="3" />
    <circle cx="18" cy="14" r="3" />
    <path d="M12 4c-1 1-2 2-3 4M12 4c1 1 2 2 3 4" />
  </svg>
)
const Milk: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M8 3h8l-1 4v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7z" />
    <line x1="7" y1="9" x2="17" y2="9" />
  </svg>
)
const Tea: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 10h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
    <path d="M16 11h2a2 2 0 0 1 0 4h-2" />
    <path d="M8 3l-1 3M12 3l-1 3M8 6c0 1 1 1 1 2" />
  </svg>
)
const Lollipop: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="9" r="6" />
    <line x1="12" y1="15" x2="12" y2="22" />
    <path d="M9 7l1 1M15 11l1-1" />
  </svg>
)

// ============== 物件 / 植物 / 自然 ==============
const Tree: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 3l5 7H7z" />
    <path d="M12 7l6 8H6z" />
    <line x1="12" y1="15" x2="12" y2="21" />
  </svg>
)
const Cactus: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M10 21V8a2 2 0 0 1 4 0v13z" />
    <path d="M10 12H7v-3a2 2 0 0 1 3 0" />
    <path d="M14 14h3v-3a2 2 0 0 0-3 0" />
  </svg>
)
const Mushroom: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M4 12a8 5 0 0 1 16 0z" />
    <path d="M9 12v8a2 2 0 0 0 6 0v-8" />
    <circle cx="9" cy="9" r="0.6" fill={color || 'currentColor'} />
    <circle cx="14" cy="10" r="0.6" fill={color || 'currentColor'} />
  </svg>
)
const Rainbow: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 16a9 9 0 0 1 18 0" />
    <path d="M5 16a7 7 0 0 1 14 0" />
    <path d="M7 16a5 5 0 0 1 10 0" />
    <line x1="11" y1="16" x2="11" y2="21" />
    <line x1="13" y1="16" x2="13" y2="21" />
  </svg>
)
const Cloud: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M7 17a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 17z" />
  </svg>
)
const Snow: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="5" y1="19" x2="19" y2="5" />
  </svg>
)
const Fire: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 2c1 3-2 5-2 8a2 2 0 0 0 4 0c0-1 0-2-1-3 3 2 5 5 5 8a5 5 0 0 1-10 0c0-4 4-6 4-13z" />
  </svg>
)
const Sun2: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.5 4.5l1.5 1.5M18 18l1.5 1.5M4.5 19.5l1.5-1.5M18 6l1.5-1.5" />
  </svg>
)
const Moon2: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    <circle cx="15" cy="9" r="0.5" fill={color || 'currentColor'} />
    <circle cx="18" cy="13" r="0.5" fill={color || 'currentColor'} />
  </svg>
)
const Umbrella: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 12a9 9 0 0 1 18 0z" />
    <line x1="12" y1="12" x2="12" y2="20" />
    <path d="M12 20a2 2 0 0 1-4 0" />
  </svg>
)
const Balloon: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <ellipse cx="12" cy="9" rx="5" ry="6" />
    <line x1="12" y1="15" x2="12" y2="20" />
  </svg>
)
const Key: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="8" cy="12" r="4" />
    <line x1="12" y1="12" x2="20" y2="12" />
    <line x1="16" y1="12" x2="16" y2="15" />
    <line x1="19" y1="12" x2="19" y2="15" />
  </svg>
)
const Lock: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
const Tag: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 12l9-9h8v8l-9 9z" />
    <circle cx="15" cy="9" r="1.2" />
  </svg>
)
const Flag: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <line x1="6" y1="3" x2="6" y2="21" />
    <path d="M6 4h11l-2 4 2 4H6z" />
  </svg>
)
const Pin: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
)
const Bookmark: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
)
const Link: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1" />
  </svg>
)
const Eye: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const Ear: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M9 21c-3 0-5-2-5-6 0-5 3-12 8-12 4 0 6 3 6 6 0 4-3 5-3 7 0 2-2 5-6 5z" />
  </svg>
)
const Lightbulb: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M9 18h6M10 21h4" />
    <path d="M8 14a4 4 0 1 1 8 0c0 2-1 3-2 4H10c-1-1-2-2-2-4z" />
  </svg>
)
const Magic: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M5 19L19 5M14 5h5v5" />
    <path d="M3 9l2 1-1 2-2-1zM9 3l1 2-2 1-1-2zM3 15l2 1-1 2-2-1zM17 15l2 1-1 2-2-1z" />
  </svg>
)
const Crown: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 8l4 5 5-8 5 8 4-5-2 11H5z" />
  </svg>
)
const Gem: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M6 3h12l3 6-9 12L3 9z" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="12" y1="3" x2="9" y2="9" />
    <line x1="12" y1="3" x2="15" y2="9" />
    <line x1="9" y1="9" x2="12" y2="21" />
    <line x1="15" y1="9" x2="12" y2="21" />
  </svg>
)
const Scissors: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <line x1="8" y1="8" x2="20" y2="16" />
    <line x1="8" y1="16" x2="20" y2="8" />
  </svg>
)
const Paperclip: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M21 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l7-7" />
  </svg>
)
const Paintbrush: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M18 3l3 3-9 9-4 1 1-4z" />
    <path d="M14 9l-8 8a2.5 2.5 0 0 1-3-3l7-7" />
  </svg>
)
const Telescope: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <line x1="12" y1="13" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <path d="M6 11l12-7 3 5-12 7z" />
  </svg>
)
const Soccer: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="12 8 15 10 14 13 10 13 9 10" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="15" y1="10" x2="20" y2="9" />
    <line x1="14" y1="13" x2="17" y2="17" />
    <line x1="10" y1="13" x2="7" y2="17" />
    <line x1="9" y1="10" x2="4" y2="9" />
  </svg>
)
const Basketball: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M12 3a13 13 0 0 1 0 18" />
    <path d="M12 3a13 13 0 0 0 0 18" />
  </svg>
)
const Tennis: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 8.5C7 11 17 13 20.5 15.5" />
    <path d="M3.5 15.5C7 13 17 11 20.5 8.5" />
  </svg>
)
const Swim: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M2 16c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0" />
    <path d="M2 20c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0" />
    <circle cx="16" cy="7" r="3" />
    <path d="M14 9l-3 3 2 2 1 2" />
  </svg>
)
const Yoga: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v6M9 13h6M6 18l6-2 6 2M12 13v4" />
  </svg>
)
const Meditate: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="12" cy="6" r="2" />
    <path d="M12 8c-2 2-2 4 0 6h-3l-3 4M12 8c2 2 2 4 0 6h3l3 4" />
  </svg>
)
const Sleep: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)
const Sunrise: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 18h18" />
    <path d="M7 18a5 5 0 0 1 10 0" />
    <line x1="12" y1="3" x2="12" y2="8" />
    <line x1="5" y1="11" x2="3" y2="13" />
    <line x1="19" y1="11" x2="21" y2="13" />
    <line x1="2" y1="18" x2="22" y2="18" />
  </svg>
)
const Sunset: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 18h18" />
    <path d="M7 18a5 5 0 0 1 10 0" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="5" y1="13" x2="3" y2="11" />
    <line x1="19" y1="13" x2="21" y2="11" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
)
const Rain: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 14z" />
    <line x1="8" y1="17" x2="7" y2="20" />
    <line x1="12" y1="17" x2="11" y2="20" />
    <line x1="16" y1="17" x2="15" y2="20" />
  </svg>
)
const Wind: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 8h12a3 3 0 1 0-3-3" />
    <path d="M3 14h16a3 3 0 1 1-3 3" />
  </svg>
)
const Mountain: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 20l5-9 4 5 3-3 6 7z" />
    <path d="M11 11l-1-1-1 1 1 2z" />
  </svg>
)
const Beach: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 21h18" />
    <circle cx="12" cy="6" r="2" />
    <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </svg>
)
const Tent: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 21l9-18 9 18z" />
    <path d="M12 3v18" />
  </svg>
)
const Bus: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="4" y="4" width="16" height="13" rx="2" />
    <line x1="4" y1="11" x2="20" y2="11" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
  </svg>
)
const Train: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <rect x="5" y="3" width="14" height="14" rx="3" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="19" r="1" />
    <line x1="3" y1="20" x2="21" y2="20" />
  </svg>
)
const Ship: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <path d="M3 17c2 1 4 1 6 0s4-1 6 0 4 1 6 0l-2 4H5z" />
    <path d="M12 3v14M8 7h8l-4 6z" />
  </svg>
)
const Bike: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="6" cy="16" r="4" />
    <circle cx="18" cy="16" r="4" />
    <path d="M6 16l4-8h5l3 8M14 8h3" />
  </svg>
)
const Walk: IconFC = ({ size = 16, color, className }) => (
  <svg {...base(size, color)} className={className}>
    <circle cx="13" cy="4" r="1.5" />
    <path d="M11 9l-2 4 3 2 1 6M12 13l-3 1-2 4M11 9l5 1 3 2" />
  </svg>
)

export const ICONS: Record<IconName, IconFC> = {
  sun: Sun, cloudSun: CloudSun, briefcase: Briefcase, moon: Moon, home: Home,
  book: Book, bed: Bed, trendingUp: TrendingUp, dumbbell: Dumbbell, heart: Heart,
  star: Star, leaf: Leaf, coffee: Coffee, music: Music, droplet: Droplet,
  flame: Flame, target: Target, calendar: Calendar, check: Check, clock: Clock,
  smile: Smile, zap: Zap, camera: Camera, plane: Plane, gift: Gift, shield: Shield,
  bell: Bell, pencil: Pencil, globe: Globe, sparkles: Sparkles, flower: Flower,
  gamepad: Gamepad, shopping: Shopping, palette: Palette, rocket: Rocket,
  cat: Cat, food: Food, run: Run,
  // 可爱小动物
  dog: Dog, rabbit: Rabbit, panda: Panda, fox: Fox, pig: Pig, frog: Frog, bird: Bird,
  fish: Fish, butterfly: Butterfly, bear: Bear, koala: Koala, duck: Duck, owl: Owl,
  // 食物
  cake: Cake, cookie: Cookie, iceCream: IceCream, donut: Donut, fries: Fries, pizza: Pizza,
  apple: Apple, banana: Banana, grape: Grape, strawberry: Strawberry, watermelon: Watermelon,
  cherry: Cherry, milk: Milk, tea: Tea, lollipop: Lollipop,
  // 物件 / 植物 / 自然 / 运动
  tree: Tree, cactus: Cactus, mushroom: Mushroom, rainbow: Rainbow, cloud: Cloud, snow: Snow,
  fire: Fire, sun2: Sun2, moon2: Moon2, umbrella: Umbrella, balloon: Balloon, key: Key,
  lock: Lock, tag: Tag, flag: Flag, pin: Pin, bookmark: Bookmark, link: Link,
  eye: Eye, ear: Ear, lightbulb: Lightbulb, magic: Magic, crown: Crown, gem: Gem,
  scissors: Scissors, paperclip: Paperclip, paintbrush: Paintbrush, telescope: Telescope,
  soccer: Soccer, basketball: Basketball, tennis: Tennis, swim: Swim, yoga: Yoga,
  meditate: Meditate, sleep: Sleep, sunrise: Sunrise, sunset: Sunset, rain: Rain,
  wind: Wind, mountain: Mountain, beach: Beach, tent: Tent, bus: Bus, train: Train,
  ship: Ship, bike: Bike, walk: Walk,
}

export const ICON_NAMES: IconName[] = Object.keys(ICONS) as IconName[]

const DEFAULT_EMOJI = '📌'

/** 渲染分类图标：优先用图标库图标，回退 emoji */
export function CategoryIcon({
  category,
  size = 16,
  color,
}: {
  category: { icon?: string; emoji?: string }
  size?: number
  color?: string
}) {
  const key = category.icon as IconName | undefined
  if (key && ICONS[key]) {
    const C = ICONS[key]
    return (
      <span className={color ? '' : ''} style={{ color: color || 'currentColor', display: 'inline-flex' }}>
        <C size={size} color={color || 'currentColor'} />
      </span>
    )
  }
  return (
    <span style={{ fontSize: size, lineHeight: 1, display: 'inline-flex' }}>
      {category.emoji || DEFAULT_EMOJI}
    </span>
  )
}
