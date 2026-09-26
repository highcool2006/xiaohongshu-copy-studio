/**
 * POST /api/rewrite
 *
 * 契约：docs/技术架构决策.md 第 4.3 节
 *
 * 语义：把**当前文案**改写为 `target_style`——是「同一篇文案的另一种风格版本」，
 *       不是重新生成一篇无关文案。输出为**恰好 1 篇完整 Note**（含 style 与重新生成的 score）。
 *
 * 本层只做编排：
 *   输入校验（shared）→ Prompt 组装（prompts）→ AI 调用（ai/client）
 *   → 结构化处理（ai/structured）→ HTTP 响应
 *
 * 这里**不得**出现：业务 Prompt 文本、校验规则、模型调用细节。
 * 与 generate 共用同一套 D8 重试 / 解析 / Schema 校验实现 —— 不复制第二套。
 */

import type { Express, Request, Response } from 'express'

import { buildRetryUserMessage, buildRewritePrompt } from '../../prompts/index.js'
import { allocateStyles } from '../../shared/allocation.js'
import { validateRewriteInput } from '../../shared/validation.js'
import type { AiClient } from '../ai/client.js'
import { processNotesResult } from '../ai/structured.js'
import {
  sendApiError,
  toApiError,
  toApiErrorFromStructuredFailure,
} from '../http/api-error.js'

export interface RewriteRouteDeps {
  aiClient: AiClient
}

export function registerRewriteRoute(app: Express, deps: RewriteRouteDeps): void {
  app.post('/api/rewrite', async (req: Request, res: Response) => {
    // 1. 确定性输入检查（后端权威校验，复用 shared 规则，不复制枚举）
    const input = validateRewriteInput(req.body)
    if (!input.ok) {
      sendApiError(res, input.error)
      return
    }

    // 2. Prompt 组装（本层只传数据，不拼提示词）
    const { system, user } = buildRewritePrompt(input.value)

    // 3. 只有 1 篇，且风格必须是 target_style ——
    //    复用与 generate 相同的分配表机制来表达这个约束：
    //    allocation = { target_style: 1 }，由结构化层校验「实际分布 == 分配表」。
    const allocation = allocateStyles([input.value.target_style], 1)

    try {
      // 4. 第一次调用
      const rawText = await deps.aiClient.generateText({ system, user })

      // 5. 结构化处理：解析 + Schema 校验 + D8 最多一次重试
      //    重写没有 strategy；角度归属由**程序**决定（见第 6 步），因此不校验 AI 回填的 angle_id
      const result = await processNotesResult(
        rawText,
        {
          expectedCount: 1,
          allowedStyles: [input.value.target_style],
          allocation,
        },
        (retryReason) =>
          deps.aiClient.generateText({
            system,
            user: buildRetryUserMessage(user, retryReason),
          }),
      )

      if (!result.ok) {
        sendApiError(res, toApiErrorFromStructuredFailure(result.failure))
        return
      }

      // 6. 程序补齐 id / stale；角度以请求传入的为准（程序负责 ID 与归属）
      const note = result.value.notes[0]
      if (note === undefined) {
        sendApiError(res, { type: 'SCHEMA_FAILED', message: '生成结果格式异常，请重试或调整输入后重试' })
        return
      }

      res.json({
        notes: [
          {
            ...note,
            id: 'note-1',
            angle_id: input.value.angle_id ?? note.angle_id,
            stale: false,
          },
        ],
      })
    } catch (error) {
      sendApiError(res, toApiError(error))
    }
  })
}
