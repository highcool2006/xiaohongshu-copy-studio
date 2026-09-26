/**
 * 风格分配规则（程序预分配，AI 不决定各风格生成几篇）。
 *
 * 规则：先每个选中风格各 1 篇，剩余篇数按「固定枚举顺序」round-robin 分配。
 * 顺序 = STYLES 的数组顺序：亲切分享 → 专业测评 → 搞笑段子 → 干货攻略
 * **不使用用户勾选顺序。**
 *
 * 依据：docs/技术架构决策.md 第 9、10.3 节
 */

import { STYLES } from './enums.js'
import type { Style } from './enums.js'

/** 分配表：只包含用户选中的风格 */
export type Allocation = Partial<Record<Style, number>>

/** 只要带 style 的笔记都能参与分配比对（Note 与 AI 原始输出的 AiNote 均适用） */
type StyledNote = { style: Style }

/**
 * 计算分配表。
 *
 * 前提：count >= styles.length（该条件由 validateGenerateInput 在输入阶段保证）。
 *
 * @param styles 用户选中的风格（顺序无关，内部会按固定枚举顺序重排）
 * @param count  总篇数
 */
export function allocateStyles(styles: readonly Style[], count: number): Allocation {
  const ordered = STYLES.filter((style) => styles.includes(style))
  if (ordered.length === 0) {
    return {}
  }

  const allocation: Allocation = {}
  for (const style of ordered) {
    allocation[style] = 1
  }

  let remaining = count - ordered.length
  let index = 0
  while (remaining > 0) {
    const style = ordered[index % ordered.length] as Style
    allocation[style] = (allocation[style] ?? 0) + 1
    index += 1
    remaining -= 1
  }

  return allocation
}

/** 统计实际结果中各风格的篇数（只需 style 字段，Note 与 AiNote 都适用） */
export function countByStyle(notes: readonly StyledNote[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const note of notes) {
    counts[note.style] = (counts[note.style] ?? 0) + 1
  }
  return counts
}

/**
 * 比对「实际分布」与「分配表」。
 *
 * @returns 完全一致时返回 null；否则返回中文差异描述。
 *          该描述可用于 D8 的「重试时把失败原因反馈给模型」。
 */
export function describeAllocationMismatch(
  notes: readonly StyledNote[],
  allocation: Allocation,
): string | null {
  const actual = countByStyle(notes)
  const problems: string[] = []

  for (const style of Object.keys(allocation) as Style[]) {
    const expected = allocation[style] ?? 0
    const got = actual[style] ?? 0
    if (got !== expected) {
      problems.push(`${style} 期望 ${expected} 篇、实际 ${got} 篇`)
    }
  }

  for (const style of Object.keys(actual)) {
    if (!(style in allocation)) {
      problems.push(`出现了未选择的风格 ${style}`)
    }
  }

  return problems.length > 0 ? problems.join('；') : null
}

/** 将分配表渲染为可读文本，用于写入提示词 */
export function formatAllocation(allocation: Allocation): string {
  return (Object.keys(allocation) as Style[])
    .map((style) => `${style} ${allocation[style] ?? 0} 篇`)
    .join('、')
}
