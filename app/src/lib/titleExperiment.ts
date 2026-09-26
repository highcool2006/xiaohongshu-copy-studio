/**
 * 标题 A/B 的槽位标签（前端展示层唯一来源）。
 *
 * 「原标题 / 变体 A / 变体 B / 变体 C」这套标记同时出现在
 * 笔记卡片与资产库两处，因此抽到这里共用，避免两边各写一份。
 */

/** 除原标题外的三个变体槽位 */
export const VARIANT_SLOTS = ['变体 A', '变体 B', '变体 C'] as const

/** 第 index 个变体的槽位标签（超出预设范围时退化为「变体 N」） */
export function variantSlotLabel(index: number): string {
  return VARIANT_SLOTS[index] ?? `变体 ${index + 1}`
}
