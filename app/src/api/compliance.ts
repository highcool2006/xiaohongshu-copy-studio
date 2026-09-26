/**
 * /api/compliance/check 的前端调用封装（发布前检查，**用户主动触发**）。
 *
 * 契约：成功响应 { compliance } —— 不含 notes、不返回改写后的文案。
 */

import type { ComplianceResult } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { getMockCompliance } from './mockCompliance'
import { isMockEnabled } from './mockMode'

export interface CompliancePayload {
  title: string
  body: string
  hashtags: string[]
  product: string
  selling_points: string[]
}

export type ComplianceApiResult =
  | { ok: true; value: ComplianceResult }
  | { ok: false; error: FrontendApiError }

export async function requestCompliance(payload: CompliancePayload): Promise<ComplianceApiResult> {
  // 【仅开发验收】开关开启时短路，不发请求；生产路径不受影响
  if (isMockEnabled()) {
    console.info('[dev] VITE_USE_MOCK_DATA=true：本次发布前检查使用本地 Mock 数据，未调用 /api/compliance/check')
    return { ok: true, value: getMockCompliance(payload) }
  }

  const result = await postJson('/api/compliance/check', payload)
  if (!result.ok) {
    return result
  }

  const compliance = (result.payload as { compliance?: unknown } | null)?.compliance
  if (typeof compliance === 'object' && compliance !== null) {
    return { ok: true, value: compliance as ComplianceResult }
  }
  return { ok: false, error: unexpectedError() }
}
