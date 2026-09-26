/**
 * HTTP 层错误处理。
 *
 * 职责：
 *   1. 把 ApiError 按契约规定的 HTTP 状态码写回响应
 *   2. 把 AI Client 抛出的 AiCallError 统一映射为 API 错误类型
 *
 * 契约依据：docs/技术架构决策.md 第 5 节
 *   - type 给程序使用；message 给用户使用；detail 只给开发/排障
 *   - 界面只展示 message，永不展示 detail
 *   - 不把上游错误细节、token、API Key 暴露给前端
 */

import type { Response } from 'express'

import { ERROR_HTTP_STATUS } from '../../shared/constants.js'
import type { ApiError } from '../../shared/types.js'
import { AiCallError } from '../ai/client.js'
import type { StructuredFailure } from '../ai/structured.js'

/**
 * 结构化失败的**固定用户文案**（docs/技术架构决策.md 第 13.1 节）。
 *
 * 用户文案属于 API 契约，因此在这里统一填充 —— 结构化层只管
 * 「给模型的 retryReason」与「给开发的 detail」，不产出用户文案。
 */
const STRUCTURED_FAILURE_MESSAGE = {
  PARSE_FAILED: '生成结果格式异常，请重试或调整输入后重试',
  SCHEMA_FAILED: '生成结果格式异常，请重试或调整输入后重试',
} as const satisfies Record<StructuredFailure['type'], string>

/** 把结构化失败映射为对外 ApiError：message 用固定文案，detail 保留排障信息 */
export function toApiErrorFromStructuredFailure(failure: StructuredFailure): ApiError {
  return {
    type: failure.type,
    message: STRUCTURED_FAILURE_MESSAGE[failure.type],
    detail: failure.detail,
  }
}

/** 对用户的统一文案（对应技术架构决策 13.1 节中 AI_CALL_FAILED 的文案） */
const AI_CALL_FAILED_MESSAGE = 'AI 服务暂时不可用，请稍后重试'

/** 兜底文案 */
const INTERNAL_MESSAGE = '服务器内部错误，请稍后重试'

/** 按契约把错误写回响应 */
export function sendApiError(res: Response, error: ApiError): void {
  res.status(ERROR_HTTP_STATUS[error.type]).json({ error })
}

/**
 * 把任意异常映射为 ApiError。
 *
 * AiCallError 的全部 reason（AUTH / RATE_LIMIT / TIMEOUT / CONNECTION /
 * UPSTREAM / INVALID_RESPONSE / CONFIG / UNKNOWN）都归为 `AI_CALL_FAILED`——
 * 其「判定规则」仍是推迟项（技术架构决策第 16 节），因此这里只做归并。
 *
 * detail 中只写入**分类与状态码**，不含上游返回的原文、不含任何凭据。
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof AiCallError) {
    const status = error.status === undefined ? '' : `; status=${error.status}`
    return {
      type: 'AI_CALL_FAILED',
      message: AI_CALL_FAILED_MESSAGE,
      detail: `reason=${error.reason}${status}`,
    }
  }

  return {
    type: 'INTERNAL',
    message: INTERNAL_MESSAGE,
    detail: error instanceof Error ? error.message : String(error),
  }
}
