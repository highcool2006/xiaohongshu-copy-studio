/**
 * 【仅用于开发与 UI 验收】Mock：/api/title-variants。
 *
 * 诚实说明：这里**不是** AI 取标题，而是**确定性地**在原标题上套三种切入方式，
 * 用于验证 UI 与 reducer。真实标题变体由 Phase 8 的端点 + AI 产出。
 *
 * 输出结构与真实响应一致（TitleVariant[]，固定 3 条），并通过共享校验器。
 */

import { TITLE_MAX_LENGTH, TITLE_VARIANT_COUNT } from '../../shared/constants'
import type { ContentAngle, TitleVariant } from '../../shared/types'
import type { TitleVariantsPayload } from './titleVariants'

/** 保证变体标题不超过契约上限 */
function clamp(text: string): string {
  return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH - 1)}…` : text
}

/** 标题里能容纳的角度线索长度上限（超出会让标题被截断，失去可读性） */
const HINT_MAX_LENGTH = 12

/**
 * 从创作角度里取一个可用于标题的**短**线索。
 *
 * 优先取 core_idea 中引号内的短语（通常就是那一件事的关键词，最凝练）；
 * 没有引号时退回第一个分句。都取不到时用角度类型。
 */
function angleHint(angle: ContentAngle | undefined): string | null {
  if (angle === undefined) return null

  const idea = angle.core_idea.trim()
  if (idea.length === 0) return angle.type

  const quoted = idea.match(/[「『“"]([^」』”"]{2,12})[」』”"]/)?.[1]?.trim()
  if (quoted !== undefined && quoted.length > 0) return quoted

  const firstClause = idea.split(/[，。；、,;]/)[0]?.trim() ?? ''
  if (firstClause.length === 0) return angle.type
  return firstClause.length > HINT_MAX_LENGTH ? firstClause.slice(0, HINT_MAX_LENGTH) : firstClause
}

/**
 * 生成 Mock 的标题变体（固定 3 条）。
 *
 * 传入创作角度时，第二条变体改用「本篇要讲的那一件事」做切入 ——
 * 这样同一篇文案在不同角度下的变体是不同的，符合"输入相关"的要求。
 */
export function getMockTitleVariants(input: TitleVariantsPayload): TitleVariant[] {
  const base = input.title.trim().replace(/[。！？!?]+$/, '')
  const hint = angleHint(input.angle)
  const angleType = input.angle?.type

  const variants: TitleVariant[] = [
    {
      title: clamp(`下午三点，${base}`),
      type: '场景型',
      analysis: '（Mock）用具体时间点做场景切入，给读者一个"我也在这个时刻"的进入理由。',
    },
    {
      title: clamp(hint === null ? `${base}？先想清楚这一件事` : `${base}？${hint}`),
      type: '问题型',
      analysis:
        hint === null
          ? '（Mock）把标题变成待回答的问题，制造继续读下去的动机。'
          : `（Mock）把标题变成一个待回答的问题，并指向本篇的创作角度（${hint}），让读者知道这一篇具体在讲什么。`,
    },
    {
      title: clamp(
        angleType === undefined ? `${base}：3 个判断点` : `${base}：从${angleType}说起`,
      ),
      type: '结果型',
      analysis:
        angleType === undefined
          ? '（Mock）用数字与结果感收束，适合决策类内容。'
          : `（Mock）用判断感收束，并点出本篇的角度类型（${angleType}）。`,
    },
  ]
  return variants.slice(0, TITLE_VARIANT_COUNT)
}
