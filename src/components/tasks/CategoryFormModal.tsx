import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { IconPicker, CATEGORY_COLORS } from '@/components/common/IconPicker'
import { useStore } from '@/store'
import { showToast } from '@/components/common/Toast'
import { CategoryIcon, type IconName } from '@/utils/iconLibrary'

interface Props {
  open: boolean
  categoryId?: string | null
  onClose: () => void
  onSaved?: (id: string) => void
}

// 分类创建 / 编辑：名称自定义输入 + 颜色 + 图标库自由选择
export function CategoryFormModal({ open, categoryId, onClose, onSaved }: Props) {
  const { categories, addCategory, updateCategory, deleteCategory } = useStore()
  const editing = categoryId ? categories.find((c) => c.id === categoryId) : null

  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [icon, setIcon] = useState<IconName>('star')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setColor(editing.color)
      setIcon((editing.icon as IconName) || 'star')
    } else {
      setName('')
      setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)])
      setIcon('star')
    }
  }, [open, editing])

  const handleSave = () => {
    if (!name.trim()) {
      showToast('请填写分类名称')
      return
    }
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), color, icon })
      showToast('已更新分类')
      onSaved?.(editing.id)
    } else {
      const newId = addCategory({ name: name.trim(), emoji: '', icon, color, order: categories.length })
      showToast('已新建分类')
      onSaved?.(newId)
    }
    onClose()
  }

  const handleDelete = () => {
    if (!editing) return
    deleteCategory(editing.id)
    showToast('已删除分类')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑分类' : '新建分类'}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="ghost" onClick={handleDelete} icon={<span>🗑</span>}>
              删除
            </Button>
          )}
          <Button fullWidth onClick={handleSave}>
            {editing ? '保存' : '创建'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">分类名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：健身、学习…"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-2 block">
            选择底色
            <span className="text-gray-400 ml-1.5">（决定图3月视图中显示的色块）</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition active:scale-90 ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-700' : ''
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-2 block">选择图标</label>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>

        {/* 预览：综合展示最终效果 */}
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-gray-500">预览：</span>
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${color}22`, color }}
          >
            <CategoryIcon category={{ icon, emoji: '' }} size={20} color={color} />
          </span>
          <span className="text-sm text-gray-700">{name || '分类名'}</span>
        </div>
      </div>
    </Modal>
  )
}
