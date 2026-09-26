/**
 * AI 结构化结果处理层。
 *
 * 位置：Prompt 层 → **本层** → AI endpoint
 *
 * 职责：
 *   1. 最小预处理（仅剥离 code fence）后解析 JSON
 *   2. 调用 app/shared 的既有校验（notes 结构校验 + 风格分配校验）
 *   3. 失败时执行 **D8：最多重试一次**
 *   4. 提取 `information`（辅助字段）：不合法时降级，**不触发重试**
 *
 * 三种信息严格分离（本层只产出「给模型的」与「给开发的」）：
 *   - `retryReason`：仅用于 D8 重试时反馈给 AI，可含详细失败原因，**不返回前端**
 *   - `detail`     ：面向开发/排障，可含结构化失败原因（不含 token / API Key）
 *   - `message`    ：面向用户的固定文案，由 HTTP 层按契约（13.1 节）填充
 *
 * D8 依据：docs/技术架构决策.md 第 4.2、10.2、10.3 节
 */

import type { Allocation } from '../../shared/allocation.js'
import { describeAllocationMismatch } from '../../shared/allocation.js'
import { INFORMATION_FALLBACK, INFORMATION_STATUS_VALUES } from '../../shared/constants.js'
import type { InformationStatus } from '../../shared/constants.js'
import type { Style } from '../../shared/enums.js'
import type { Information, Note } from '../../shared/types.js'
import { validateNotesResult } from '../../shared/validation.js'

/** 结构化处理后的产出（对应成功响应体） */
export interface StructuredNotes {
  information: Information
  notes: Note[]
}

/**
 * 结构化失败。
 *
 * ⚠️ 故意**不含** `message`：用户文案属于 API 契约，由 HTTP 层按 13.1 节填充。
 */
export interface StructuredFailure {
  type: 'PARSE_FAILED' | 'SCHEMA_FAILED'
  /** 给模型的详细原因（D8 重试时反馈） */
  retryReason: string
  /** 给开发的排障信息（不含凭据） */
  detail: string
}

export type StructuredNotesResult =
  | { ok: true; value: StructuredNotes }
  | { ok: false; failure: StructuredFailure }

export interface StructuredNotesOptions {
  /** 期望篇数（= 校验归一化后的 count） */
  expectedCount: number
  /** 用户选中的风格（已按固定枚举顺序重排） */
  allowedStyles: readonly Style[]
  /** 程序计算的风格分配表 */
  allocation: Allocation
}

/**
 * 请求第二次原始文本的回调。
 *
 * 由 route 层提供（它才知道 system / 原始 user），本层只负责「何时」重试、
 * 以及把 retryReason 传出去；「怎么重试」由 Prompt 层决定。
 */
export type RetryRequester = (retryReason: string) => Promise<string>

/**
 * 处理一批 notes 的原始文本。
 *
 * 成功 → { information, notes }
 * 失败 → PARSE_FAILED 或 SCHEMA_FAILED（此时已用尽 D8 的重试额度）
 *
 * 注意：若 `retry` 自身抛出异常（例如第二次调用遇到限流），异常会向上抛出，
 * 由 route 层映射为 AI_CALL_FAILED —— 不会被误报成 SCHEMA_FAILED。
 */
export async function processNotesResult(
  rawText: string,
  options: StructuredNotesOptions,
  retry: RetryRequester,
): Promise<StructuredNotesResult> {
  const first = interpretNotesText(rawText, options)
  if (first.ok) {
    return first
  }

  // D8：最多重试一次（唯一的业务层重试点；SDK 自带重试已关闭）
  const retriedText = await retry(first.failure.retryReason)
  return interpretNotesText(retriedText, options)
}

/**
 * 单次解释：预处理 → 解析 → Schema 校验 → 分配校验 → 提取 information。
 * 不包含任何重试逻辑。
 */
export function interpretNotesText(
  rawText: string,
  options: StructuredNotesOptions,
): StructuredNotesResult {
  const parsed = parseJsonObject(rawText)
  if (!parsed.ok) {
    return parsed
  }

  const notes = validateNotesResult(parsed.value.notes, {
    expectedCount: options.expectedCount,
    allowedStyles: options.allowedStyles,
  })
  if (!notes.ok) {
    const reason = notes.error.message
    return {
      ok: false,
      failure: {
        type: 'SCHEMA_FAILED',
        retryReason: `${reason}。请严格按输出契约重新生成完整的 notes 数组。`,
        detail: reason,
      },
    }
  }

  const mismatch = describeAllocationMismatch(notes.value, options.allocation)
  if (mismatch !== null) {
    const reason = `各风格的篇数与分配要求不符：${mismatch}`
    return {
      ok: false,
      failure: {
        type: 'SCHEMA_FAILED',
        retryReason: `${reason}。请严格按 style_allocation 给定的每种风格篇数重新生成。`,
        detail: reason,
      },
    }
  }

  return {
    ok: true,
    value: {
      information: extractInformation(parsed.value),
      notes: notes.value,
    },
  }
}

/* ---------- 预处理与解析 ---------- */

/**
 * 最小预处理：仅剥离首尾的 code fence。
 *
 * 允许的形式（且要求围栏之外没有其他文字）：
 *   ```json\n{...}\n```
 *   ```\n{...}\n```
 *
 * **只做这一件事**：不修复 JSON、不补括号、不补引号、不改内容、不猜字段。
 * 剥离后的文本仍必须经过完整的 JSON 解析与 Schema 校验。
 * 任何不符合上述形式的输入都原样返回（随后由解析阶段判失败并走 D8 重试）。
 */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const afterOpenFence = trimmed.slice(3)
  const firstNewline = afterOpenFence.indexOf('\n')
  if (firstNewline === -1) {
    return trimmed
  }

  const header = afterOpenFence.slice(0, firstNewline).trim().toLowerCase()
  if (header !== '' && header !== 'json') {
    return trimmed
  }

  const rest = afterOpenFence.slice(firstNewline + 1)
  const closingIndex = rest.lastIndexOf('```')
  if (closingIndex === -1) {
    return trimmed
  }
  if (rest.slice(closingIndex + 3).trim().length > 0) {
    return trimmed
  }

  return rest.slice(0, closingIndex).trim()
}

/** detail 中保留的原始异常信息长度上限（避免响应体过大） */
const DETAIL_MAX_LENGTH = 200

export type ParsedJsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; failure: StructuredFailure }

/**
 * 把（预处理后的）原始文本解析为 JSON 对象。
 *
 * 失败 → PARSE_FAILED。`retryReason` 是给模型的修正指令；`detail` 是给开发的原始异常。
 */
export function parseJsonObject(rawText: string): ParsedJsonResult {
  const cleaned = stripCodeFence(rawText)

  let value: unknown
  try {
    value = JSON.parse(cleaned)
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const detail = raw.slice(0, DETAIL_MAX_LENGTH)
    return {
      ok: false,
      failure: {
        type: 'PARSE_FAILED',
        retryReason:
          '上一次的输出不是合法 JSON。请只输出一个 JSON 对象：不要使用 Markdown 代码块标记，不要在 JSON 之外添加任何解释文字，不要有尾随逗号或注释。',
        detail: `JSON.parse 失败：${detail}`,
      },
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      failure: {
        type: 'PARSE_FAILED',
        retryReason: '上一次的输出不是 JSON 对象。请输出一个以 { 开头、以 } 结尾的 JSON 对象。',
        detail: `解析结果不是对象：${Array.isArray(value) ? 'array' : typeof value}`,
      },
    }
  }

  return { ok: true, value: value as Record<string, unknown> }
}

/* ---------- information（辅助字段） ---------- */

/**
 * 提取 information。
 *
 * AI 原始字段：information_status / information_message
 * 对外字段：   information.status / information.message（4.2 节，方案 A2）
 *
 * 规则（本阶段确认）：
 *   - status = sufficient → message 可为空或非空
 *   - status = limited    → message 必须是非空字符串；否则降级
 *   - status 缺失 / 非法、message 非字符串 → 降级
 *
 * **一律降级，绝不触发 D8 重试**；notes 的严格校验不受影响。
 */
export function extractInformation(parsed: Record<string, unknown>): Information {
  const status = parsed.information_status
  const message = parsed.information_message

  const fallback: Information = {
    status: INFORMATION_FALLBACK.status,
    message: INFORMATION_FALLBACK.message,
  }

  if (typeof status !== 'string' || !(INFORMATION_STATUS_VALUES as readonly string[]).includes(status)) {
    return fallback
  }
  if (typeof message !== 'string') {
    return fallback
  }

  const trimmed = message.trim()
  if (status === 'limited' && trimmed.length === 0) {
    return fallback
  }

  return { status: status as InformationStatus, message: trimmed }
}
