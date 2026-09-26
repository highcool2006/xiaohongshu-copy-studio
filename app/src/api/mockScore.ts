/**
 * 【仅用于开发与 UI 验收】Mock：/api/score。
 *
 * 确定性生成一个符合六维契约的评分（不是随机数、也不是复制旧分数）：
 * 由文案长度与风格决定偏移量，因此**同一份文案永远得到同一个分数**，
 * 且**内容变化后分数会变化** —— 便于验证「编辑 → scoreStale → 重新评分」链路。
 */

import { SCORE_DIMENSION_MAX } from '../../shared/constants'
import type { Score } from '../../shared/types'

/** 依据文本长度与风格名做一个稳定的偏移（0～3） */
function stableOffset(text: string, salt: string): number {
  let hash = 0
  const source = `${text.length}:${salt}`
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 997
  }
  return hash % 4
}

export function getMockScore(input: { title: string; body: string; style: string }): Score {
  const text = `${input.title}${input.body}`
  const offset = (dimension: string): number => stableOffset(text, `${dimension}:${input.style}`)

  // 各维度的基准值（均明显低于上限，避免越界），再叠加稳定偏移
  const content_value = Math.min(SCORE_DIMENSION_MAX.content_value, 19 + offset('cv'))
  const specificity = Math.min(SCORE_DIMENSION_MAX.specificity, 14 + offset('sp'))
  const native_feel = Math.min(SCORE_DIMENSION_MAX.native_feel, 15 + offset('nf'))
  const differentiation = Math.min(SCORE_DIMENSION_MAX.differentiation, 11 + offset('df'))
  const structure = Math.min(SCORE_DIMENSION_MAX.structure, 7 + offset('st'))
  const authenticity = Math.min(SCORE_DIMENSION_MAX.authenticity, 8 + offset('au'))

  const total =
    content_value + specificity + native_feel + differentiation + structure + authenticity

  return {
    total,
    content_value,
    specificity,
    native_feel,
    differentiation,
    structure,
    authenticity,
    strength: '（Mock）结构与表达完整，未出现明显的编造信息。',
    improvement: '（Mock）可再补一个更具体的使用条件，让内容更落地。',
  }
}
