/**
 * POST /api/score
 *
 * 契约：docs/技术架构决策.md 第 4.4 节
 *
 * 语义：只对「当前文案」评分——**不重写、不改写、不补充**，只返回新的 `score`。
 *
 * 本层只做编排：
 *   输入校验（shared）→ Prompt 组装（prompts）→ AI 调用（ai/client）
 *   → 结构化处理（ai/structured）→ HTTP 响应
 *
 * 这里**不得**出现：评分规则、Prompt 文本、Schema 定义。
 */

import type { Express, Request, Response } from 'express'

import { buildRetryUserMessage, buildScorePrompt } from '../../prompts/index.js'
import { validateScoreInput } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processScoreResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface ScoreRouteDeps {
  aiClient: AiClient
}

export function registerScoreRoute(app: Express, deps: ScoreRouteDeps): void {
  app.post('/api/score', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（后端权威校验，复用 shared 规则）
    const input = validateScoreInput(req.body)
    if (!input.ok) {
      sendApiError(res, input.error)
      return
    }

    // 2. Prompt 组装（本层只传数据）
    const { system, user } = buildScorePrompt(input.value)

    try {
      // 3. 第一次调用
      const rawText = await deps.aiClient.generateText({ system, user })

      // 4. 结构化处理：解析 + Score 校验 + D8 最多一次重试
      const result = await processScoreResult(rawText, (retryReason) =>
        deps.aiClient.generateText({
          system,
          user: buildRetryUserMessage(user, retryReason),
        }),
      )

      if (!result.ok) {
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 5. 成功响应：{ score } —— 不含 notes、不含 information、无额外字段
      res.json({ score: result.value })
    } catch (error) {
      sendApiError(res, toApiError(error))
    }
  })
}
