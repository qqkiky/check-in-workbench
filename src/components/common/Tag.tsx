import { ReactNode } from 'react'

interface TagProps {
  children: ReactNode
  color?: string
  bg?: string
  size?: 'xs' | 'sm'
  className?: string
}

export function Tag({ children, color = '#1C1C1E', bg = '#F2F2F7', size = 'xs', className = '' }: TagProps) {
  const sizes = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${sizes} ${className}`}
      style={{ color, background: bg }}
    >
      {children}
    </span>
  )
}