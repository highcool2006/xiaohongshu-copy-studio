/**
 * /api/rewrite 的前端调用封装（单篇换风格重写）。
 *
 * 契约：请求带 product / selling_points / target_style / current_note；
 *       成功响应 { notes: [note] } —— 长度固定为 1。
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
