/**
 * /api/generate 的前端调用封装。
 *
 * 边界：只负责「发请求 + 把响应归一化成前端可用的结果」，**不含任何业务规则**。
 * 类型直接复用 app/shared，不重新定义 Note。
 */

import type { GenerateInput, GenerateResponse } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { getMockGenerateResponse } from './mockGenerate'
import { isMockEnabled } from './mockMode'

export type GenerateApiResult =
  | { ok: true; value: GenerateResponse }
  | { ok: false; error: FrontendApiError }

/** 轻量形状校验：只确认响应里有 notes 与 information，不重复 Schema 校验 */
function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as { notes?: unknown; information?: unknown }
  return Array.isArray(candidate.notes) && typeof candidate.information === 'object'
}

export async function requestGenerate(input: GenerateInput): Promise<GenerateApiResult> {
  // 【仅开发视觉验收】显式开关开启时，直接用本地 Mock 数据短路，不发任何请求。
  // 开关默认关闭；关闭时下面的真实请求路径与之前**完全一致**，契约未变。
  if (isMockEnabled()) {
    console.info(
      '[dev] VITE_USE_MOCK_DATA=true：本次使用本地 Mock 数据，未调用 /api/generate',
    )
    return { ok: true, value: getMockGenerateResponse(input) }
  }

  // V2：请求体必须与后端 validateGenerateInput 的认识一致。
  // 可选项为 undefined 时 JSON.stringify 会省略该键，正好符合契约（这些字段均为可选）。
  const result = await postJson('/api/generate', {
    product: input.product,
    selling_points: input.selling_points,
    styles: input.styles,
    count: input.count,
    product_category: input.product_category,
    additional_info: input.additional_info,
    target_users: input.target_users,
    scenarios: input.scenarios,
    goal: input.goal,
    reference_text: input.reference_text,
    content_directions_preference: input.content_directions_preference,
  })
  if (!result.ok) {
    return result
  }
  if (isGenerateResponse(result.payload)) {
    return { ok: true, value: result.payload }
  }
  return { ok: false, error: unexpectedError() }
}
