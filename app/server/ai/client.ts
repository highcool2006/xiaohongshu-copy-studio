/**
 * AI Client —— 与模型服务通信的唯一入口。
 *
 * 职责（**只做这些**）：
 *   1. 初始化 Anthropic SDK
 *   2. 读取环境变量（ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_MODEL）
 *   3. 统一调用模型（system + user，非流式）
 *   4. 返回**原始文本**
 *   5. 把 SDK 异常归一化为 AiCallError
 *
 * 明确**不**负责：产品输入校验、Prompt 组装、JSON 解析、Note Schema 校验、
 *                D8 重试、HTTP 请求/响应、前端状态。这些都在其它层。
 *
 * 关于重试：SDK 自带重试被**显式关闭**（maxRetries: 0）。
 * D8 的「最多重试一次」属于后续结构化结果处理层，两者不得混在一起。
 *
 * 关于鉴权：使用 ANTHROPIC_AUTH_TOKEN 走 Bearer 认证，
 * 以兼容 DeepSeek 等 Anthropic-compatible endpoint。
 * Auth Token 只存在于服务端进程内，**绝不下发到浏览器、绝不写入日志**。
 */

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  Anthropic,
} from '@anthropic-ai/sdk'

/** 单次调用的输出上限（模型服务的硬性参数，MVP 阶段固定） */
export const AI_MAX_OUTPUT_TOKENS = 8192

/* ---------- 配置 ---------- */

export interface AiConfig {
  /** 为空表示使用 Anthropic 官方地址 */
  baseURL?: string
  authToken: string
  model: string
}

const ENV_KEYS = {
  baseURL: 'ANTHROPIC_BASE_URL',
  authToken: 'ANTHROPIC_AUTH_TOKEN',
  model: 'ANTHROPIC_MODEL',
} as const

/**
 * 读取并校验 AI 相关环境变量。
 *
 * 不读取 .env 文件（本层不做文件加载），只读进程环境。
 * 缺失必需变量时抛出 AiCallError('CONFIG')，**错误信息中不含任何凭据**。
 */
export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const authToken = env[ENV_KEYS.authToken]?.trim() ?? ''
  const model = env[ENV_KEYS.model]?.trim() ?? ''
  const baseURL = env[ENV_KEYS.baseURL]?.trim() ?? ''

  const missing: string[] = []
  if (authToken.length === 0) missing.push(ENV_KEYS.authToken)
  if (model.length === 0) missing.push(ENV_KEYS.model)
  if (missing.length > 0) {
    throw new AiCallError('CONFIG', `缺少必需的环境变量：${missing.join('、')}`)
  }

  return {
    authToken,
    model,
    baseURL: baseURL.length > 0 ? baseURL : undefined,
  }
}

/* ---------- 归一化异常 ---------- */

/**
 * 归一化后的调用层错误原因。
 *
 * 注意：这里只是**分类**，不决定对外 HTTP 状态码。
 * `AI_CALL_FAILED` 的具体判定规则仍属推迟项（docs/技术架构决策.md 第 16 节）。
 */
export type AiCallErrorReason =
  | 'CONFIG' // 环境变量缺失
  | 'AUTH' // 401 / 403
  | 'RATE_LIMIT' // 429
  | 'TIMEOUT' // 连接超时
  | 'CONNECTION' // 无法连接
  | 'UPSTREAM' // 上游返回错误
  | 'INVALID_RESPONSE' // 返回内容不可用（如无文本块）
  | 'UNKNOWN'

export class AiCallError extends Error {
  readonly reason: AiCallErrorReason
  /** HTTP 状态码（仅当上游返回了响应时存在） */
  readonly status?: number

  constructor(
    reason: AiCallErrorReason,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AiCallError'
    this.reason = reason
    if (options?.status !== undefined) {
      this.status = options.status
    }
  }
}

/** 把任意异常归一化为 AiCallError（原始异常保留在 cause 中，供服务端排障） */
export function normalizeAiError(error: unknown): AiCallError {
  if (error instanceof AiCallError) {
    return error
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new AiCallError('TIMEOUT', '请求模型服务超时', { cause: error })
  }
  if (error instanceof APIConnectionError) {
    return new AiCallError('CONNECTION', '无法连接模型服务', { cause: error })
  }
  if (error instanceof APIError) {
    const status = typeof error.status === 'number' ? error.status : undefined
    if (status === 401 || status === 403) {
      return new AiCallError('AUTH', '模型服务认证失败', { status, cause: error })
    }
    if (status === 429) {
      return new AiCallError('RATE_LIMIT', '模型服务限流或额度不足', { status, cause: error })
    }
    if (status !== undefined && status >= 500) {
      return new AiCallError('UPSTREAM', '模型服务返回服务端错误', { status, cause: error })
    }
    return new AiCallError('UPSTREAM', `模型服务返回错误（HTTP ${status ?? '未知'}）`, {
      status,
      cause: error,
    })
  }
  return new AiCallError('UNKNOWN', '调用模型服务时发生未知错误', { cause: error })
}

/* ---------- 调用 ---------- */

export interface AiTextRequest {
  /** Prompt 层提供的 system */
  system: string
  /** Prompt 层提供的 user */
  user: string
}

export interface AiClient {
  /** 调用模型并返回**原始文本**（非流式，不做任何解析） */
  generateText(request: AiTextRequest): Promise<string>
}

export interface AiClientDeps {
  /** 便于测试注入；默认使用全局 fetch */
  fetch?: typeof fetch
  /** 便于测试注入；默认使用 process.env */
  env?: NodeJS.ProcessEnv
}

/**
 * 创建 AI Client。
 *
 * SDK 实例**懒初始化**：只有真正发起调用时才读取环境变量，
 * 因此缺少配置不会导致服务启动失败（服务仍可提供 /api/health 等）。
 */
export function createAiClient(deps: AiClientDeps = {}): AiClient {
  let sdk: Anthropic | null = null
  let config: AiConfig | null = null

  function resolve(): { sdk: Anthropic; config: AiConfig } {
    if (sdk === null || config === null) {
      const resolved = readAiConfig(deps.env)
      sdk = new Anthropic({
        authToken: resolved.authToken,
        // 显式置空：避免环境中若存在 ANTHROPIC_API_KEY 时被 SDK 优先当作 x-api-key 使用，
        // 从而绕过我们既定的 Bearer（authToken）认证方式。
        apiKey: null,
        maxRetries: 0, // 关闭 SDK 自带重试，重试策略由 D8 统一负责
        ...(resolved.baseURL === undefined ? {} : { baseURL: resolved.baseURL }),
        ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
      })
      config = resolved
    }
    return { sdk, config }
  }

  return {
    async generateText(request: AiTextRequest): Promise<string> {
      const { sdk: client, config: cfg } = resolve()

      let message
      try {
        message = await client.messages.create({
          model: cfg.model,
          max_tokens: AI_MAX_OUTPUT_TOKENS,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
        })
      } catch (error) {
        throw normalizeAiError(error)
      }

      const parts: string[] = []
      for (const block of message.content) {
        if (block.type === 'text') {
          parts.push(block.text)
        }
      }

      const text = parts.join('').trim()
      if (text.length === 0) {
        throw new AiCallError('INVALID_RESPONSE', '模型未返回任何文本内容')
      }
      return text
    },
  }
}

/** 默认单例（懒初始化，供 API 层直接使用） */
export const aiClient: AiClient = createAiClient()
