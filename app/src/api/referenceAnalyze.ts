/**
 * /api/reference/analyze 的前端调用封装（参考文案分析，**用户主动触发**）。
 *
 * 契约：请求 { reference_text }；成功响应 { analysis }。
 * 语义：只分析参考文案的写法与结构，**不产出文案、不改写原文、不做仿写**。
 *
 * 一次分析 = 1 次请求（Mock 模式下为本地确定性分析，不触网）。
 */

import type { ReferenceAnalysis, ReferenceAnalyzeRequest } from '../../shared/types'
import { postJson, unexpectedError } from './http'
import type { FrontendApiError } from './http'
import { isMockEnabled } from './mockMode'
import { getMockReferenceAnalysis } from './mockReferenceAnalyze'

export type ReferenceAnalyzeApiResult =
  | { ok: true; value: ReferenceAnalysis }
  | { ok: false; error: FrontendApiError }

export async function requestReferenceAnalyze(
  payload: ReferenceAnalyzeRequest,
): Promise<ReferenceAnalyzeApiResult> {
  // 【仅开发验收】开关开启时短路，不发请求；生产路径不受影响
  if (isMockEnabled()) {
    console.info(
      '[dev] VITE_USE_MOCK_DATA=true：本次参考文案分析使用本地确定性分析，未调用 /api/reference/analyze',
    )
    return { ok: true, value: getMockReferenceAnalysis(payload) }
  }

  const result = await postJson('/api/reference/analyze', payload)
  if (!result.ok) {
    return result
  }

  const analysis = (result.payload as { analysis?: unknown } | null)?.analysis
  if (typeof analysis === 'object' && analysis !== null) {
    return { ok: true, value: analysis as ReferenceAnalysis }
  }
  return { ok: false, error: unexpectedError() }
}
