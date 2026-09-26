/**
 * 前端 HTTP 公共层：三个业务端点共用。
 *
 * 只做两件事：发 POST、把响应归一化成前端可用的结果。
 * **不含任何业务规则**；也不重复实现后端已有的 Schema 校验。
 */

import type { ApiError, ApiErrorResponse } from '../../shared/types'

/**
 * 前端持有的错误信息。
 *
 * ⚠️ **刻意不含 `detail`**：`detail` 只给开发排障，绝不进入界面。
 * 在这里就丢弃它，可以保证它没有任何路径流到 UI。
 */
export interface FrontendApiError {
  type: ApiError['type']
  field?: ApiError['field']
  message: string
}

export const NETWORK_ERROR_MESSAGE = '网络请求失败，请检查网络后重试'
export const UNEXPECTED_ERROR_MESSAGE = '请求失败，请稍后重试'

function toFrontendError(error: ApiError): FrontendApiError {
  const result: FrontendApiError = { type: error.type, message: error.message }
  if (error.field !== undefined) {
    result.field = error.field
  }
  return result
}

export type PostResult =
  | { ok: true; payload: unknown }
  | { ok: false; error: FrontendApiError }

/** 统一的 POST：网络异常与后端错误都归一化为 FrontendApiError */
export async function postJson(path: string, body: unknown): Promise<PostResult> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: { type: 'INTERNAL', message: NETWORK_ERROR_MESSAGE } }
  }

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (response.ok) {
    return { ok: true, payload: parsed }
  }

  const apiError = (parsed as ApiErrorResponse | null)?.error
  if (apiError !== undefined && typeof apiError.message === 'string' && apiError.message.length > 0) {
    return { ok: false, error: toFrontendError(apiError) }
  }
  return { ok: false, error: { type: 'INTERNAL', message: UNEXPECTED_ERROR_MESSAGE } }
}

export function unexpectedError(): FrontendApiError {
  return { type: 'INTERNAL', message: UNEXPECTED_ERROR_MESSAGE }
}
