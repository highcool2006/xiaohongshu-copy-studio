/**
 * POST /api/compliance/check —— 发布前合规检查（用户主动触发）
 *
 * 契约：docs/V2产品决策.md 第 3、7 节
 *
 * 语义：只对**当前文案**做风险检查，不改写内容；返回 { compliance }。
 * 注意：普通生成已在 /api/generate 内完成合规自检，本端点是用户主动复查时才会调用的一次 AI 请求。
 */

import type { Express, Request, Response } from 'express'

import { buildCompliancePrompt, buildRetryUserMessage } from '../../prompts/index.js'
import { validateComplianceCheckInput } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processComplianceResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface ComplianceRouteDeps {
  aiClient: AiClient
}

export function registerComplianceRoute(app: Express, deps: ComplianceRouteDeps): void {
  app.post('/api/compliance/check', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（复用 shared 规则）
    const input = validateComplianceCheckInput(req.body)
    if (!input.ok) {
      sendApiError(res, input.error)
      return
    }

    // 2. Prompt 组装（本层只传数据）
    const { system, user } = buildCompliancePrompt(input.value)

    try {
      // 3. 第一次调用
      const rawText = await deps.aiClient.generateText({ system, user })

      // 4. 结构化处理：解析 + 校验 + D8 最多一次重试
      const result = await processComplianceResult(rawText, (retryReason) =>
        deps.aiClient.generateText({
          system,
          user: buildRetryUserMessage(user, retryReason),
        }),
      )

      if (!result.ok) {
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 5. 成功响应：{ compliance } —— 不含 notes、不含改写后的文案
      res.json({ compliance: result.value })
    } catch (error) {
      sendApiError(res, toApiError(error))
    }
  })
}
