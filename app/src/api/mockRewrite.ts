/**
 * 【仅用于开发与 UI 验收】Mock：/api/rewrite。
 *
 * 诚实说明：这里**不是**真正的风格改写（那需要 AI）。它做的是确定性变换：
 *   保留当前文案的**全部内容与事实**，只在标题上标注目标风格、并按目标风格加一个开头与结尾。
 * 这样既满足「保留事实、改用目标风格」的语义，又能让 UI 与 reducer 在无 Key 环境下验证完整链路。
 *
 * 结构与真实响应完全一致，且通过共享校验器（见测试）。
 */

import type { Style } from '../../shared/enums'
import type { GenerateResponse } from '../../shared/types'
import { getMockGenerateResponse } from './mockGenerate'
import { getMockScore } from './mockScore'
import type { RewritePayload } from './rewrite'

/** 按目标风格给正文加的开头 / 结尾（确定性，不涉及产品事实） */
const STYLE_OPENERS: Record<Style, string> = {
  亲切分享: '说真的，',
  专业测评: '先说结论：',
  搞笑段子: '事情是这样的。\n\n',
  干货攻略: '直接给结论：',
  情绪共鸣: '有些事，得先说情绪。\n\n',
  清单种草: '按条目说清楚：\n\n',
}

const STYLE_CLOSERS: Record<Style, string> = {
  亲切分享: '\n\n就这些，剩下的你自己判断。',
  专业测评: '\n\n以上是判断依据，结论请按自己的需求下。',
  搞笑段子: '\n\n就这。',
  干货攻略: '\n\n提醒一句：以上是判断方式，不是效果承诺。',
  情绪共鸣: '\n\n到这儿就够了。',
  清单种草: '\n\n条目到此，其余按需对照。',
}

/**
 * 生成 Mock 的重写结果（恰好 1 篇）。
 *
 * - `style` 等于 target_style
 * - 保留原文案的正文事实、话题标签、内容方向
 * - 评分由 mockScore 重新生成（不是复制旧分数）
 */
export function getMockRewriteResponse(payload: RewritePayload): GenerateResponse['notes'] {
  const { current_note: current, target_style: targetStyle } = payload

  const title = `[${targetStyle}] ${current.title}`
  const body = `${STYLE_OPENERS[targetStyle]}${current.body}${STYLE_CLOSERS[targetStyle]}`
  // 评分针对**重写后**的内容重新生成（不是复制旧分数）
  const score = getMockScore({ title, body, style: targetStyle })

  // 借一份 Mock 的其它字段（ai_ness / compliance / cover_suggestion），保证结构与真实响应一致
  const base = getMockGenerateResponse({
    product: payload.product,
    selling_points: payload.selling_points,
    styles: [targetStyle],
    count: 5,
    target_users: [],
    scenarios: [],
    goal: '种草',
  }).notes[0]!

  return [
    {
      ...base,
      id: 'note-rewrite-1',
      title,
      body,
      hashtags: [...current.hashtags],
      style: targetStyle,
      content_directions: [...current.content_directions],
      angle_id: base.angle_id,
      score,
      stale: false,
    },
  ]
}
