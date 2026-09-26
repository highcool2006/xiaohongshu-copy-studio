/**
 * POST /api/reference/analyze —— 参考文案分析（用户主动触发）
 *
 * 契约：docs/V2产品决策.md 第 3、4 节
 *
 * 语义：只分析用户提供的参考文案的**写法与结构**，返回 { analysis }。
 *   - 不产出文案、不改写原文、不做仿写
 *   - 一次调用 = 1 次 AI 请求（用户主动提交时才调用）
 *
 * 本层只做编排：
 *   输入校验（shared）→ Prompt 组装（prompts）→ AI 调用（ai/client）
 *   → 结构化处理（ai/structured）→ HTTP 响应
 *
 * 这里**不得**出现：分析规则、Prompt 文本、Schema 定义。
 */

import type { Express, Request, Response } from 'express'

import { buildReferenceAnalyzePrompt, buildRetryUserMessage } from '../../prompts/index.js'
import { validateReferenceText } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processReferenceAnalysisResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface ReferenceRouteDeps {
  aiClient: AiClient
}

export function registerReferenceRoute(app: Express, deps: ReferenceRouteDeps): void {
  app.post('/api/reference/analyze', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（复用 shared 规则：必填、去空、长度上限）
    const referenceText = validateReferenceText((req.body as { reference_text?: unknown } | null)?.reference_text)
    if (!referenceText.ok) {
      sendApiError(res, referenceText.error)
      return
    }

    // 2. Prompt 组装（本层只传数据）
    const { system, user } = buildReferenceAnalyzePrompt({ reference_text: referenceText.value })

    try {
      // 3. 第一次调用
      const rawText = await deps.aiClient.generateText({ system, user })

      // 4. 结构化处理：解析 + 校验 + D8 最多一次重试
      const result = await processReferenceAnalysisResult(rawText, (retryReason) =>
        deps.aiClient.generateText({
          system,
          user: buildRetryUserMessage(user, retryReason),
        }),
      )

      if (!result.ok) {
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 5. 成功响应：{ analysis } —— 不含任何文案内容
      res.json({ analysis: result.value })
    } catch (error) {
      sendApiError(res, toApiError(error))
    }
  })
}
