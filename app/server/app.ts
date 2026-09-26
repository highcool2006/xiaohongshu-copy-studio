/**
 * Express 应用装配。
 *
 * 与 index.ts 分开的原因：`createApp(deps)` 允许注入 AI Client，
 * 使得可以在**不发起真实模型调用**的前提下做 HTTP 级测试。
 *
 * 职责：中间件、路由注册、静态文件、统一错误兜底。
 * 不包含任何业务逻辑。
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import type { Express, NextFunction, Request, Response } from 'express'

import type { ApiError } from '../shared/types.js'
import { MESSAGES } from '../shared/validation.js'
import { aiClient } from './ai/client.js'
import type { AiClient } from './ai/client.js'
import { sendApiError } from './http/api-error.js'
import { registerGenerateRoute } from './routes/generate.js'

export interface AppDeps {
  /** 便于测试注入；默认使用真实 AI Client（懒初始化） */
  aiClient?: AiClient
}

export function createApp(deps: AppDeps = {}): Express {
  const client = deps.aiClient ?? aiClient

  const app = express()

  app.use(express.json())

  // 健康检查（非业务端点）
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
  })

  // 业务路由
  registerGenerateRoute(app, { aiClient: client })

  // 生产环境：由 Express 提供 Vite 构建产物
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web')
  app.use(express.static(webDir))

  // 统一错误兜底（必须放在最后）
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }
    if (isBodyParseError(error)) {
      const apiError: ApiError = {
        type: 'INVALID_INPUT',
        message: MESSAGES.requestInvalid,
        detail: '请求体不是合法 JSON',
      }
      sendApiError(res, apiError)
      return
    }
    const apiError: ApiError = {
      type: 'INTERNAL',
      message: '服务器内部错误，请稍后重试',
      detail: error instanceof Error ? error.message : String(error),
    }
    sendApiError(res, apiError)
  })

  return app
}

/** express.json() 解析失败时抛出的错误带有该标记 */
function isBodyParseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  )
}
