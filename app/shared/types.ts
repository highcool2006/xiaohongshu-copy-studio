/**
 * 核心数据类型。
 *
 * 契约依据：docs/技术架构决策.md 第 4、5、6 节
 *
 * 约定：
 *   - hashtags 的值不含前导 #（# 由程序在展示与复制时渲染）
 *   - 不存在 persona 字段（本系统不设「人设」概念）
 *   - localId 由前端生成，不属于本文件的任何契约类型
 */

import type { ErrorType, InformationStatus } from './constants.js'
import type { ContentDirection, Style } from './enums.js'

/* ---------- 领域数据 ---------- */

/** 单篇笔记的「爆款潜力自评」。仅为辅助参考，不预测真实流量、点赞、转化或爆款概率。 */
export interface Score {
  total: number
  title_attractiveness: number
  readability: number
  identification: number
  style_match: number
  information_completeness: number
  /** 一句具体优势 */
  strength: string
  /** 一句具体改进建议 */
  improvement: string
}

/** AI 返回的单篇笔记 */
export interface Note {
  title: string
  body: string
  /** 话题标签，值不含前导 # */
  hashtags: string[]
  content_directions: ContentDirection[]
  style: Style
  score: Score
}

/** 当前文案（重写输入使用，即不含评分的 Note） */
export type CurrentNote = Omit<Note, 'score'>

/* ---------- /api/generate ---------- */

/** 客户端 → 服务端 的生成请求（count 省略时使用 COUNT_DEFAULT） */
export interface GenerateRequest {
  product: string
  selling_points: string[]
  styles: Style[]
  count?: number
}

/** 校验并归一化之后的生成输入：count 保证存在，styles 已按固定枚举顺序重排 */
export interface GenerateInput {
  product: string
  selling_points: string[]
  styles: Style[]
  count: number
}

/**
 * 「提供的信息是否足够丰富」的提示。**辅助字段**。
 *
 * 由 AI 在 generate 时给出；缺失或非法时降级为 INFORMATION_FALLBACK，
 * **不参与严格 Schema 校验、不触发 D8 重试**。
 */
export interface Information {
  status: InformationStatus
  message: string
}

export interface GenerateResponse {
  /** 辅助提示（前端展示位置：结果区信息条） */
  information: Information
  notes: Note[]
}

/* ---------- /api/rewrite ---------- */

export interface RewriteRequest {
  product: string
  selling_points: string[]
  /** 目标新风格；与 current_note.style（当前风格）区分 */
  target_style: Style
  current_note: CurrentNote
}

export interface RewriteResponse {
  /** 长度固定为 1 */
  notes: Note[]
}

/* ---------- /api/score ---------- */

export interface ScoreRequest {
  title: string
  body: string
  style: Style
  content_directions: ContentDirection[]
  /** 原始产品：information_completeness 的对照基准 */
  product: string
  /** 原始卖点：information_completeness 的对照基准 */
  selling_points: string[]
}

export interface ScoreResponse {
  score: Score
}

/* ---------- 统一错误 ---------- */

/** 可出现在 INVALID_INPUT 上的字段名 */
export type ErrorField =
  | 'product'
  | 'selling_points'
  /** /api/generate 的所选风格（多个） */
  | 'styles'
  /** /api/score 的当前风格（单个） */
  | 'style'
  | 'count'
  | 'target_style'
  | 'current_note'
  | 'title'
  | 'body'
  | 'content_directions'

export interface ApiError {
  type: ErrorType
  /** 可选；仅 INVALID_INPUT 提供，用于前端行内定位 */
  field?: ErrorField
  /** 给用户看，中文 */
  message: string
  /** 仅给开发/排障使用，界面永不渲染 */
  detail?: string
}

export interface ApiErrorResponse {
  error: ApiError
}

/* ---------- 校验结果 ---------- */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ApiError }
