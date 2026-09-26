/**
 * /api/score 的前端调用封装（对当前文案重新评分）。
 *
 * 契约：成功响应 { score } —— 不含 notes、不返回任何改写后的文案。
 */

import type { ContentDirection, Style } from '../../shared/enums'
import type { Score } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { isMockEnabled } from './mockMode'
import { getMockScore } from './mockScore'

export interface ScorePayload {
  title: string
  body: string
  style: Style
  content_directions: ContentDirection[]
  product: string
  selling_points: string[]
}

export type ScoreApiResult =
  | { ok: true; value: Score }
  | { ok: false; error: FrontendApiError }

export async function requestScore(payload: ScorePayload): Promise<ScoreApiResult> {
  // 【仅开发验收】开关开启时短路，不发请求；生产路径不受影响
  if (isMockEnabled()) {
    console.info('[dev] VITE_USE_MOCK_DATA=true：本次评分使用本地 Mock 数据，未调用 /api/score')
    return { ok: true, value: getMockScore({ title: payload.title, body: payload.body, style: payload.style }) }
  }

  const result = await postJson('/api/score', payload)
  if (!result.ok) {
    return result
  }

  const score = (result.payload as { score?: unknown } | null)?.score
  if (typeof score === 'object' && score !== null) {
    return { ok: true, value: score as Score }
  }
  return { ok: false, error: unexpectedError() }
}
