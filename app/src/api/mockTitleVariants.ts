/**
 * 【仅用于开发与 UI 验收】Mock：/api/title-variants。
 *
 * 诚实说明：这里**不是** AI 取标题，而是**确定性地**在原标题上套三种切入方式，
 * 用于验证 UI 与 reducer。真实标题变体由 Phase 8 的端点 + AI 产出。
 *
 * 输出结构与真实响应一致（TitleVariant[]，固定 3 条），并通过共享校验器。
 */

import { TITLE_MAX_LENGTH, TITLE_VARIANT_COUNT } from '../../shared/constants'
import type { TitleVariant } from '../../shared/types'

/** 保证变体标题不超过契约上限 */
function clamp(text: string): string {
  return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH - 1)}…` : text
}

export function getMockTitleVariants(input: { title: string; body: string; style: string }): TitleVariant[] {
  const base = input.title.trim().replace(/[。！？!?]+$/, '')
  const variants: TitleVariant[] = [
    {
      title: clamp(`下午三点，${base}`),
      type: '场景型',
      analysis: '（Mock）用具体时间点做场景切入，给读者一个"我也在这个时刻"的进入理由。',
    },
    {
      title: clamp(`${base}？先想清楚这一件事`),
      type: '问题型',
      analysis: '（Mock）把标题变成待回答的问题，制造继续读下去的动机。',
    },
    {
      title: clamp(`${base}：3 个判断点`),
      type: '结果型',
      analysis: '（Mock）用数字与结果感收束，适合决策类内容。',
    },
  ]
  return variants.slice(0, TITLE_VARIANT_COUNT)
}
