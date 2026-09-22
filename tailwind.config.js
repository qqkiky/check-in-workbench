/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题色 - 由 CSS 变量驱动，运行时可由「主题色」设置动态切换
        // 使用 rgb(var(--primary-rgb) / <alpha-value>) 以支持透明度修饰（bg-primary/10 等）
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          light: 'rgb(var(--primary-rgb-light) / <alpha-value>)',
          dark: 'rgb(var(--primary-rgb-dark) / <alpha-value>)',
        },
        accent: {
          red: '#FF3B30',
          pink: '#FF2D55',
          orange: '#FF9500',
          yellow: '#FFCC00',
          green: '#34C759',
          blue: '#5AC8FA',
          purple: '#AF52DE',
        },
        // 分类色板
        cat: {
          morning: '#FF9500',   // 上午 - 橙色
          noon: '#FFCC00',      // 下午 - 黄色
          work: '#FF3B30',      // 工作 - 红色
          evening: '#AF52DE',   // 晚上 - 紫色
          life: '#34C759',      // 生活 - 绿色
          study: '#5AC8FA',     // 阅读 - 蓝色
          rest: '#FF2D55',      // 休息 - 粉色
          invest: '#FF9500',    // 投资 - 橙色
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'tab': '0 -1px 3px rgba(0, 0, 0, 0.04)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}