/**
 * POST /api/generate
 *
 * 契约：docs/技术架构决策.md 第 4.2 节
 *
 * 本层只做编排：
 *   输入校验（shared）→ 风格分配（shared）→ Prompt 组装（prompts）
 *   → AI 调用（ai/client）→ 结构化处理（ai/structured）→ HTTP 响应
 *
 * 这里**不得**出现：业务 Prompt 文本、风格分配算法、模型调用细节、Schema 校验规则。
 */

import type { Express, Request, Response } from 'express'

import { buildGeneratePrompt, buildRetryUserMessage } from '../../prompts/index.js'
import { allocateStyles } from '../../shared/allocation.js'
import { validateGenerateInput } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processNotesResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface GenerateRouteDeps {
  aiClient: AiClient
}

export function registerGenerateRoute(app: Express, deps: GenerateRouteDeps): void {
  app.post('/api/generate', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（后端必须再次校验，不信任前端）
    const input = validateGenerateInput(req.body)
    if (!input.ok) {
      sendApiError(res, input.error)
      return
    }

    // 2. 风格分配：程序确定性计算，AI 不参与
    const allocation = allocateStyles(input.value.styles, input.value.count)

    // 3. Prompt 组装（本层只传数据，不拼提示词）
    const { system, user } = buildGeneratePrompt(input.value, allocation)

    try {
      // 4. 第一次调用（AI Client 是唯一出口）
      const rawText = await deps.aiClient.generateText({ system, user })

      // 5. 结构化处理：解析 + Schema 校验 + D8 最多一次重试 + information 提取
      const result = await processNotesResult(
        rawText,
        {
          expectedCount: input.value.count,
          allowedStyles: input.value.styles,
          allocation,
        },
        (failureReason) =>
          deps.aiClient.generateText({
            system,
            user: buildRetryUserMessage(user, failureReason),
          }),
      )

      if (!result.ok) {
        // 用户文案由 HTTP 层按契约填充；retryReason 只用于上面那次重试，不外泄
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 6. 成功响应：严格遵守 { information, notes }，不增加额外字段
      res.json({
        information: result.value.information,
        notes: result.value.notes,
      })
    } catch (error) {
      // AiCallError → AI_CALL_FAILED；其它 → INTERNAL
      sendApiError(res, toApiError(error))
    }
  })
}
