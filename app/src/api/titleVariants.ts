/**
 * /api/title-variants 的前端调用封装（标题优化，**用户主动触发**）。
 *
 * 一次调用生成 3 个标题变体；不预测"哪个会爆"，只给出切入方式与内容层面的说明。
 *
 * ⚠️ 本类型必须与 shared `TitleVariantsRequest` 保持一致：
 *    `angle` 是可选字段 —— 有创作角度时传入，变体会贴合"这一篇讲给谁、讲哪一件事"。
 */

import type { ContentDirection, Style } from '../../shared/enums'
import type { ContentAngle, TitleVariant } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { isMockEnabled } from './mockMode'
import { getMockTitleVariants } from './mockTitleVariants'

export interface TitleVariantsPayload {
  title: string
  body: string
  style: Style
  content_directions: ContentDirection[]
  product: string
  selling_points: string[]
  /** 本篇的创作角度（可选）：提供时标题变体应贴合它 */
  angle?: ContentAngle
}

export type TitleVariantsApiResult =
  | { ok: true; value: TitleVariant[] }
  | { ok: false; error: FrontendApiError }

export async function requestTitleVariants(
  payload: TitleVariantsPayload,
): Promise<TitleVariantsApiResult> {
  // 【仅开发验收】开关开启时短路，不发请求；生产路径不受影响
  if (isMockEnabled()) {
    console.info('[dev] VITE_USE_MOCK_DATA=true：本次标题优化使用本地 Mock 数据，未调用 /api/title-variants')
    return { ok: true, value: getMockTitleVariants(payload) }
  }

  const result = await postJson('/api/title-variants', payload)
  if (!result.ok) {
    return result
  }

  const variants = (result.payload as { variants?: unknown } | null)?.variants
  if (Array.isArray(variants)) {
    return { ok: true, value: variants as TitleVariant[] }
  }
  return { ok: false, error: unexpectedError() }
}
