/**
 * 共享校验规则。
 *
 * 前端与后端使用**同一份**实现：
 *   - 前端：点击「生成」时提前拦截，不发请求
 *   - 后端：收到请求后做权威校验（防止前端被绕过或规则不同步）
 *
 * 依据：docs/技术架构决策.md 第 10 节（输入检查）与第 7 节（评分规则）
 *
 * 说明：全部使用手写校验，不引入第三方校验库。
 */

import {
  BODY_MAX_LENGTH,
  CONTENT_DIRECTIONS_MAX_ITEMS,
  COUNT_DEFAULT,
  COUNT_MAX,
  COUNT_MIN,
  HASHTAG_MAX_ITEMS,
  HASHTAG_MAX_LENGTH,
  HASHTAG_MIN_ITEMS,
  IMPROVEMENT_MAX_LENGTH,
  PRODUCT_MAX_LENGTH,
  SCORE_DIMENSION_MAX,
  SCORE_SUM_EPSILON,
  SCORE_TOTAL_MAX,
  SELLING_POINTS_MAX_ITEMS,
  SELLING_POINT_MAX_LENGTH,
  STRENGTH_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from './constants.js'
import { isContentDirection, isStyle, sortStyles } from './enums.js'
import type { Style } from './enums.js'
import type {
  ApiError,
  CurrentNote,
  ErrorField,
  GenerateInput,
  Note,
  RewriteRequest,
  Score,
  ScoreRequest,
  ValidationResult,
} from './types.js'

/* ---------- 面向用户的错误文案（中文，说清「怎么改」） ---------- */

export const MESSAGES = {
  productRequired: '请填写产品名称',
  sellingPointsRequired: '请至少填写 1 个卖点',
  stylesRequired: '至少选择 1 种风格',
  styleInvalid: '风格不在允许范围内',
  countInteger: '篇数需填写整数',
  countRange: `篇数需在 ${COUNT_MIN}～${COUNT_MAX} 之间`,
  countTooSmall: '篇数不能少于已选风格的数量',
  targetStyleInvalid: '目标风格不在允许范围内',
  currentNoteInvalid: '当前文案内容不完整',
  titleRequired: '标题不能为空',
  bodyRequired: '正文不能为空',
  contentDirectionsRequired: '内容方向不正确',
  requestInvalid: '请求内容不正确',
} as const

/* ---------- 内部工具 ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function failure<T>(type: ApiError['type'], message: string, field?: ErrorField): ValidationResult<T> {
  const error: ApiError = { type, message }
  if (field !== undefined) {
    error.field = field
  }
  return { ok: false, error }
}

/* ---------- 输入校验：公共片段 ---------- */

function validateProduct(value: unknown): ValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return failure('INVALID_INPUT', MESSAGES.productRequired, 'product')
  }
  const product = value.trim()
  if (product.length > PRODUCT_MAX_LENGTH) {
    return failure('INVALID_INPUT', `产品名称不超过 ${PRODUCT_MAX_LENGTH} 个字符`, 'product')
  }
  return { ok: true, value: product }
}

/** 卖点：至少 1 个非空条目；空字符串会被丢弃；不做「用户逐个操作」的要求 */
function validateSellingPoints(value: unknown): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return failure('INVALID_INPUT', MESSAGES.sellingPointsRequired, 'selling_points')
  }
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (items.length === 0) {
    return failure('INVALID_INPUT', MESSAGES.sellingPointsRequired, 'selling_points')
  }
  if (items.length > SELLING_POINTS_MAX_ITEMS) {
    return failure('INVALID_INPUT', `卖点最多 ${SELLING_POINTS_MAX_ITEMS} 个`, 'selling_points')
  }
  if (items.some((item) => item.length > SELLING_POINT_MAX_LENGTH)) {
    return failure('INVALID_INPUT', `单个卖点不超过 ${SELLING_POINT_MAX_LENGTH} 个字符`, 'selling_points')
  }
  return { ok: true, value: items }
}

/** 风格：至少 1 个、必须属于 4 个基础风格；并按固定枚举顺序重排 */
function validateStyles(value: unknown): ValidationResult<Style[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return failure('INVALID_INPUT', MESSAGES.stylesRequired, 'styles')
  }
  if (!value.every(isStyle)) {
    return failure('INVALID_INPUT', MESSAGES.styleInvalid, 'styles')
  }
  const styles = sortStyles(value)
  if (styles.length === 0) {
    return failure('INVALID_INPUT', MESSAGES.stylesRequired, 'styles')
  }
  return { ok: true, value: styles }
}

/** 篇数：整数、范围 5～10、不少于风格数；省略时取默认值 6 */
function validateCount(value: unknown, styleCount: number): ValidationResult<number> {
  if (value === undefined || value === null) {
    if (COUNT_DEFAULT < styleCount) {
      return failure('INVALID_INPUT', MESSAGES.countTooSmall, 'count')
    }
    return { ok: true, value: COUNT_DEFAULT }
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return failure('INVALID_INPUT', MESSAGES.countInteger, 'count')
  }
  if (value < COUNT_MIN || value > COUNT_MAX) {
    return failure('INVALID_INPUT', MESSAGES.countRange, 'count')
  }
  if (value < styleCount) {
    return failure('INVALID_INPUT', MESSAGES.countTooSmall, 'count')
  }
  return { ok: true, value }
}

/* ---------- /api/generate 输入校验 ---------- */

export function validateGenerateInput(raw: unknown): ValidationResult<GenerateInput> {
  if (!isRecord(raw)) {
    return failure('INVALID_INPUT', MESSAGES.requestInvalid)
  }

  const product = validateProduct(raw.product)
  if (!product.ok) return product

  const sellingPoints = validateSellingPoints(raw.selling_points)
  if (!sellingPoints.ok) return sellingPoints

  const styles = validateStyles(raw.styles)
  if (!styles.ok) return styles

  const count = validateCount(raw.count, styles.value.length)
  if (!count.ok) return count

  return {
    ok: true,
    value: {
      product: product.value,
      selling_points: sellingPoints.value,
      styles: styles.value,
      count: count.value,
    },
  }
}

/* ---------- /api/rewrite 输入校验 ---------- */

function validateCurrentNote(value: unknown): ValidationResult<CurrentNote> {
  if (!isRecord(value)) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  const title = value.title
  if (!isNonEmptyString(title) || title.trim().length > TITLE_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  const body = value.body
  if (!isNonEmptyString(body) || body.trim().length > BODY_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  const hashtags = validateHashtags(value.hashtags)
  if (!hashtags.ok) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  const directions = validateContentDirections(value.content_directions, 'INVALID_INPUT')
  if (!directions.ok) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  if (!isStyle(value.style)) {
    return failure('INVALID_INPUT', MESSAGES.currentNoteInvalid, 'current_note')
  }

  return {
    ok: true,
    value: {
      title: title.trim(),
      body: body.trim(),
      hashtags: hashtags.value,
      content_directions: directions.value,
      style: value.style,
    },
  }
}

export function validateRewriteInput(raw: unknown): ValidationResult<RewriteRequest> {
  if (!isRecord(raw)) {
    return failure('INVALID_INPUT', MESSAGES.requestInvalid)
  }

  const product = validateProduct(raw.product)
  if (!product.ok) return product

  const sellingPoints = validateSellingPoints(raw.selling_points)
  if (!sellingPoints.ok) return sellingPoints

  if (!isStyle(raw.target_style)) {
    return failure('INVALID_INPUT', MESSAGES.targetStyleInvalid, 'target_style')
  }

  const currentNote = validateCurrentNote(raw.current_note)
  if (!currentNote.ok) return currentNote

  return {
    ok: true,
    value: {
      product: product.value,
      selling_points: sellingPoints.value,
      target_style: raw.target_style,
      current_note: currentNote.value,
    },
  }
}

/* ---------- /api/score 输入校验 ---------- */

export function validateScoreInput(raw: unknown): ValidationResult<ScoreRequest> {
  if (!isRecord(raw)) {
    return failure('INVALID_INPUT', MESSAGES.requestInvalid)
  }

  if (!isNonEmptyString(raw.title) || raw.title.trim().length > TITLE_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.titleRequired, 'title')
  }
  if (!isNonEmptyString(raw.body) || raw.body.trim().length > BODY_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.bodyRequired, 'body')
  }
  if (!isStyle(raw.style)) {
    // /api/score 的字段名是单数 style（与 generate 的 styles 不同）
    return failure('INVALID_INPUT', MESSAGES.styleInvalid, 'style')
  }

  const directions = validateContentDirections(raw.content_directions, 'INVALID_INPUT')
  if (!directions.ok) return directions

  // product 与 selling_points 为必带：information_completeness 的对照基准
  const product = validateProduct(raw.product)
  if (!product.ok) return product

  const sellingPoints = validateSellingPoints(raw.selling_points)
  if (!sellingPoints.ok) return sellingPoints

  return {
    ok: true,
    value: {
      title: raw.title.trim(),
      body: raw.body.trim(),
      style: raw.style,
      content_directions: directions.value,
      product: product.value,
      selling_points: sellingPoints.value,
    },
  }
}

/* ---------- 结果结构校验（D8：AI 返回内容的校验） ---------- */

function validateHashtags(value: unknown): ValidationResult<string[]> {
  if (
    !Array.isArray(value) ||
    value.length < HASHTAG_MIN_ITEMS ||
    value.length > HASHTAG_MAX_ITEMS
  ) {
    return failure('SCHEMA_FAILED', `话题标签数量需在 ${HASHTAG_MIN_ITEMS}～${HASHTAG_MAX_ITEMS} 个`)
  }
  const hashtags: string[] = []
  for (const item of value) {
    if (!isNonEmptyString(item) || item.length > HASHTAG_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', '话题标签格式不正确')
    }
    const tag = item.trim()
    // 契约要求：值不含前导 #（# 由程序渲染）
    if (tag.startsWith('#')) {
      return failure('SCHEMA_FAILED', '话题标签不应包含 # 号')
    }
    hashtags.push(tag)
  }
  return { ok: true, value: hashtags }
}

/**
 * 内容方向数组校验。
 *
 * errorType 由调用方决定：输入校验场景为 INVALID_INPUT，AI 结果校验场景为 SCHEMA_FAILED。
 * 只有 INVALID_INPUT 才携带 field（契约规定）。
 */
function validateContentDirections(
  value: unknown,
  errorType: 'INVALID_INPUT' | 'SCHEMA_FAILED',
): ValidationResult<Note['content_directions']> {
  const field: ErrorField | undefined = errorType === 'INVALID_INPUT' ? 'content_directions' : undefined
  if (!Array.isArray(value) || value.length === 0 || value.length > CONTENT_DIRECTIONS_MAX_ITEMS) {
    return failure(errorType, MESSAGES.contentDirectionsRequired, field)
  }
  if (!value.every(isContentDirection)) {
    return failure(errorType, MESSAGES.contentDirectionsRequired, field)
  }
  return { ok: true, value: [...value] }
}

/**
 * Score 结构约束：
 *   - 五个维度均为**整数**且在各自区间内（title_attractiveness 0～25、readability 0～25、
 *     identification 0～20、style_match 0～15、information_completeness 0～15）
 *   - total 为整数，必须等于五项之和
 *   - total 范围 0～100
 *   - strength / improvement 为非空字符串
 */
export function validateScore(value: unknown): ValidationResult<Score> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '评分结构不正确')
  }

  let sum = 0
  for (const [dimension, max] of Object.entries(SCORE_DIMENSION_MAX)) {
    const raw = value[dimension]
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > max) {
      return failure('SCHEMA_FAILED', `评分维度 ${dimension} 必须是 0～${max} 的整数`)
    }
    sum += raw
  }

  const total = value.total
  if (
    typeof total !== 'number' ||
    !Number.isInteger(total) ||
    total < 0 ||
    total > SCORE_TOTAL_MAX
  ) {
    return failure('SCHEMA_FAILED', `总分必须是 0～${SCORE_TOTAL_MAX} 的整数`)
  }
  if (Math.abs(total - sum) > SCORE_SUM_EPSILON) {
    return failure('SCHEMA_FAILED', `总分应等于各维度之和（期望 ${sum}，实际 ${total}）`)
  }

  if (!isNonEmptyString(value.strength) || value.strength.trim().length > STRENGTH_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', 'strength 必须是非空字符串')
  }
  if (!isNonEmptyString(value.improvement) || value.improvement.trim().length > IMPROVEMENT_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', 'improvement 必须是非空字符串')
  }

  return {
    ok: true,
    value: {
      total,
      title_attractiveness: value.title_attractiveness as number,
      readability: value.readability as number,
      identification: value.identification as number,
      style_match: value.style_match as number,
      information_completeness: value.information_completeness as number,
      strength: value.strength.trim(),
      improvement: value.improvement.trim(),
    },
  }
}

/** 单篇 Note 的结构校验 */
export function validateNote(value: unknown): ValidationResult<Note> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '笔记结构不正确')
  }

  const title = value.title
  if (!isNonEmptyString(title) || title.trim().length > TITLE_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '标题不能为空且不超过长度上限')
  }

  const body = value.body
  if (!isNonEmptyString(body) || body.trim().length > BODY_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '正文不能为空且不超过长度上限')
  }

  const hashtags = validateHashtags(value.hashtags)
  if (!hashtags.ok) return hashtags

  const directions = validateContentDirections(value.content_directions, 'SCHEMA_FAILED')
  if (!directions.ok) return directions

  if (!isStyle(value.style)) {
    return failure('SCHEMA_FAILED', MESSAGES.styleInvalid)
  }

  const score = validateScore(value.score)
  if (!score.ok) return score

  return {
    ok: true,
    value: {
      title: title.trim(),
      body: body.trim(),
      hashtags: hashtags.value,
      content_directions: directions.value,
      style: value.style,
      score: score.value,
    },
  }
}

/**
 * 批量结果校验（generate / rewrite 共用）。
 *
 * 校验项（docs/技术架构决策.md 第 10.3 节）：
 *   1. 每篇的 style 必须属于 allowedStyles
 *   2. notes.length 必须等于 expectedCount
 *   （按 style 分组的篇数是否等于分配表，由 allocation.ts 负责比对）
 */
export function validateNotesResult(
  value: unknown,
  options: { expectedCount: number; allowedStyles: readonly Style[] },
): ValidationResult<Note[]> {
  if (!Array.isArray(value)) {
    return failure('SCHEMA_FAILED', 'notes 必须是数组')
  }
  if (value.length !== options.expectedCount) {
    return failure('SCHEMA_FAILED', `篇数不符合要求（期望 ${options.expectedCount} 篇，实际 ${value.length} 篇）`)
  }

  const notes: Note[] = []
  for (const item of value) {
    const note = validateNote(item)
    if (!note.ok) return note
    if (!options.allowedStyles.includes(note.value.style)) {
      return failure('SCHEMA_FAILED', `出现了未选择的风格：${note.value.style}`)
    }
    notes.push(note.value)
  }

  return { ok: true, value: notes }
}
