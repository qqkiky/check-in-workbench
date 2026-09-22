import type { Task, CheckInRecord } from '@/types'

// 示例数据生成
export function generateSeedData(): { tasks: Task[]; records: CheckInRecord[] } {
  const now = Date.now()
  const dayMs = 86400000
  const tasks: Task[] = [
    {
      id: 't-1',
      title: '睡觉 8 小时',
      description: '每晚 10 点睡觉，6 点起，养成好习惯',
      categoryId: 'rest',
      scheduledTime: '22:00',
      recurrence: 'weekly',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now - 90 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-2',
      title: '规整纳指盘写',
      description: '小投资',
      categoryId: 'invest',
      scheduledTime: '11:00',
      recurrence: 'weekly',
      weekdays: [1, 2, 3, 4, 5],
      createdAt: now - 60 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-3',
      title: '全家打扫卫生',
      description: '打扫顺序：卧室-客厅-阳台-厕所',
      categoryId: 'life',
      scheduledTime: '15:00',
      recurrence: 'weekly',
      weekdays: [0, 6],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-4',
      title: '阅读',
      description: '本月目标 1000 页',
      categoryId: 'study',
      scheduledTime: '17:00',
      recurrence: 'weekly',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      target: 1000,
      unit: '页',
      createdAt: now - 30 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-5',
      title: '简单锻炼',
      description: '跳绳、俯卧撑、仰卧起坐',
      categoryId: 'evening',
      scheduledTime: '20:00',
      recurrence: 'weekly',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      target: 22,
      unit: '个',
      createdAt: now - 30 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-6',
      title: '成长提升',
      description: '学习新知识，反思总结',
      categoryId: 'morning',
      scheduledTime: '23:30',
      recurrence: 'weekly',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
    },
    {
      id: 't-7',
      title: '工作 - 文档撰写',
      description: '每日工作日报',
      categoryId: 'work',
      scheduledTime: '09:00',
      recurrence: 'weekly',
      weekdays: [1, 2, 3, 4, 5],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
    },
  ]

  // 生成过去 90 天的打卡记录（部分完成）
  const records: CheckInRecord[] = []
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now - i * dayMs)
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().slice(0, 10)

    tasks.forEach((task) => {
      if (task.weekdays && !task.weekdays.includes(dayOfWeek)) return
      // 80% 概率完成
      if (Math.random() < 0.8) {
        const completedAt = new Date(date)
        const [hh, mm] = (task.scheduledTime || '09:00').split(':').map(Number)
        completedAt.setHours(hh + Math.floor(Math.random() * 3), mm, Math.floor(Math.random() * 60))
        const duration = 60 + Math.floor(Math.random() * 300)
        records.push({
          id: `r-${task.id}-${i}`,
          taskId: task.id,
          taskTitle: task.title,
          categoryId: task.categoryId,
          date: dateStr,
          completedAt: completedAt.getTime(),
          durationSeconds: duration,
          progress: task.target ? Math.floor(Math.random() * (task.target / 30)) + 1 : undefined,
          progressTotal: task.target,
        })
      }
    })
  }

  return { tasks, records }
}