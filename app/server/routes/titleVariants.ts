/**
 * POST /api/title-variants —— 标题变体（用户主动触发）
 *
 * 契约：docs/V2产品决策.md 第 3 节
 *
 * 语义：为一篇已经写好的文案生成 3 个标题变体，用于 A/B 对比。
 *   - 不改写正文、不返回任何改写后的文案
 *   - 一次调用 = 1 次 AI 请求（用户主动点击「标题优化」时才调用）
 *
 * 本层只做编排：
 *   输入校验（shared）→ Prompt 组装（prompts）→ AI 调用（ai/client）
 *   → 结构化处理（ai/structured）→ HTTP 响应
 */

import type { Express, Request, Response } from 'express'

import { buildRetryUserMessage, buildTitleVariantsPrompt } from '../../prompts/index.js'
import type { ContentAngle } from '../../shared/types.js'
import { validateTitleVariantsInput } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processTitleVariantsResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface TitleVariantsRouteDeps {
  aiClient: AiClient
}

export function registerTitleVariantsRoute(app: Express, deps: TitleVariantsRouteDeps): void {
  app.post('/api/title-variants', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（复用 shared 规则）
    const input = validateTitleVariantsInput(req.body)
    if (!input.ok) {
      sendApiError(res, input.error)
      return
    }

    // 2. Prompt 组装（angle 为可选字段：没有策略信息时不硬凑）
    const angle = toOptionalContentAngle((req.body as { angle?: unknown } | null)?.angle)
    const { system, user } = buildTitleVariantsPrompt({
      ...input.value,
      ...(angle === undefined ? {} : { angle }),
    })

    try {
      // 3. 第一次调用
      const rawText = await deps.aiClient.generateText({ system, user })

      // 4. 结构化处理：解析 + 校验 + D8 最多一次重试
      const result = await processTitleVariantsResult(rawText, (retryReason) =>
        deps.aiClient.generateText({
          system,
          user: buildRetryUserMessage(user, retryReason),
        }),
      )

      if (!result.ok) {
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 5. 成功响应：{ variants } —— 不含正文、不含任何改写后的文案
      res.json({ variants: result.value })
    } catch (error) {
      sendApiError(res, toApiError(error))
    }
  })
}

/** 角度的全部字段（与 ContentAngle 契约一致） */
const ANGLE_FIELDS = [
  'id',
  'type',
  'audience',
  'scenario',
  'core_idea',
  'hook_type',
  'structure_type',
  'ending_type',
] as const

/**
 * angle 的轻量形状检查。
 *
 * 完整的字段与枚举校验属于 generate 链路（validateContentAngle）。本端点把它当作
 * **可选上下文**：形态不对就当作没提供，而不是让整个请求失败 ——
 * 标题优化不应因为上游策略数据缺失或过时而不可用。
 */
function toOptionalContentAngle(value: unknown): ContentAngle | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Record<string, unknown>
  const complete = ANGLE_FIELDS.every((field) => typeof candidate[field] === 'string')
  return complete ? (candidate as unknown as ContentAngle) : undefined
}
