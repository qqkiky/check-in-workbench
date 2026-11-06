import { TextInput } from '@/components/common/TextField'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { IconPicker, CATEGORY_COLORS, CATEGORY_PALETTE } from '@/components/common/IconPicker'
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
  const [icon, setIcon] = useState<IconName|undefined>('star')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setColor(editing.color)
      setIcon(editing.icon as IconName|undefined)
    } else {
      setName('')
      setColor(CATEGORY_COLORS[0])
      setIcon('star')
    }
  }, [open, categoryId])

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
      <div className="category-editor space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">分类名称</label>
          <TextInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：健身、学习…"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
          />
        </div>

        <div>
          <label className="category-editor-label">分类颜色</label>
          <div className="category-palette">
            {CATEGORY_PALETTE.map(p=><button key={p.color} type="button" onClick={()=>setColor(p.color)} aria-pressed={p.color===color}>
              <i style={{background:p.color}}/>{p.name}
            </button>)}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-2 block">选择图标</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div className="category-preview">
          <span className="text-xs text-gray-500">预览</span>
          <CategoryIcon category={{icon,emoji:editing?.emoji}} size={22} color={color} filled/>
          <strong className="text-sm">{name || '分类名'}</strong>
        </div>
      </div>
    </Modal>
  )
}
