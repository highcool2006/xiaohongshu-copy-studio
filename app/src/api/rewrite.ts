/**
 * /api/rewrite 的前端调用封装（单篇换风格重写）。
 *
 * 契约：请求带 product / selling_points / target_style / current_note / angle_id（可选）；
 *       成功响应 { notes: [note] } —— 长度固定为 1。
 *
 * ⚠️ 本类型是 shared `RewriteRequest` 的前端侧精简版，字段必须与之一致：
 *    后端用 validateRewriteInput 做权威校验，多传/少传都会导致契约不一致。
 */

import type { ContentDirection, Style } from '../../shared/enums'
import type { Note } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { isMockEnabled } from './mockMode'
import { getMockRewriteResponse } from './mockRewrite'

export interface RewritePayload {
  product: string
  selling_points: string[]
  target_style: Style
  current_note: {
    title: string
    body: string
    hashtags: string[]
    content_directions: ContentDirection[]
    style: Style
  }
  /**
   * 原笔记的创作角度 id（对应 shared `RewriteRequest.angle_id`）。
   *
   * 重写要保持「这一篇讲的是哪一件事」不变，因此前端传当前 note 的 angle_id；
   * 后端以程序传入的值为准，并用它回填重写后的 note。
   */
  angle_id?: string
}

export type RewriteApiResult =
  | { ok: true; value: Note }
  | { ok: false; error: FrontendApiError }

export async function requestRewrite(payload: RewritePayload): Promise<RewriteApiResult> {
  // 【仅开发验收】开关开启时短路，不发请求；生产路径不受影响
  if (isMockEnabled()) {
    console.info('[dev] VITE_USE_MOCK_DATA=true：本次重写使用本地 Mock 数据，未调用 /api/rewrite')
    return { ok: true, value: getMockRewriteResponse(payload)[0]! }
  }

  const result = await postJson('/api/rewrite', payload)
  if (!result.ok) {
    return result
  }

  const notes = (result.payload as { notes?: unknown } | null)?.notes
  if (Array.isArray(notes) && notes.length === 1) {
    return { ok: true, value: notes[0] as Note }
  }
  return { ok: false, error: unexpectedError() }
}
