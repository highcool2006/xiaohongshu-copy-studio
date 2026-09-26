/**
 * 共享校验规则（V2）。
 *
 * 前端与后端使用**同一份**实现：
 *   - 前端：提交前提前拦截，不发请求
 *   - 后端：收到请求后做权威校验（防止前端被绕过或规则不同步）
 *
 * 依据：docs/技术架构决策.md 第 10 节；docs/V2产品决策.md
 *
 * 说明：全部使用手写校验，不引入第三方校验库。
 */

import {
  ADDITIONAL_INFO_MAX_LENGTH,
  ANGLE_ID_MAX_LENGTH,
  AUDIENCE_MAX_LENGTH,
  BODY_MAX_LENGTH,
  CHECK_ISSUES_MAX_ITEMS,
  CHECK_ITEM_MAX_LENGTH,
  CONTENT_DIRECTIONS_MAX_ITEMS,
  CORE_IDEA_MAX_LENGTH,
  COUNT_DEFAULT,
  COUNT_MAX,
  COUNT_MIN,
  COVER_COMPOSITION_MAX_LENGTH,
  COVER_HEADLINE_MAX_LENGTH,
  COVER_VISUAL_SUBJECT_MAX_LENGTH,
  ENDING_TYPE_MAX_LENGTH,
  HASHTAG_MAX_ITEMS,
  HASHTAG_MAX_LENGTH,
  HASHTAG_MIN_ITEMS,
  HOOK_TYPE_MAX_LENGTH,
  IMPROVEMENT_MAX_LENGTH,
  PRODUCT_CATEGORY_MAX_LENGTH,
  PRODUCT_MAX_LENGTH,
  REFERENCE_TEXT_MAX_LENGTH,
  SCENARIO_MAX_LENGTH,
  SCENARIOS_MAX_ITEMS,
  SCORE_DIMENSION_MAX,
  SCORE_SUM_EPSILON,
  SCORE_TOTAL_MAX,
  SELLING_POINTS_MAX_ITEMS,
  SELLING_POINT_MAX_LENGTH,
  STRATEGY_SUMMARY_MAX_LENGTH,
  STRENGTH_MAX_LENGTH,
  STRUCTURE_TYPE_MAX_LENGTH,
  TARGET_USERS_MAX_ITEMS,
  TARGET_USER_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_VARIANT_ANALYSIS_MAX_LENGTH,
  TITLE_VARIANT_COUNT,
  TITLE_VARIANT_TYPE_MAX_LENGTH,
} from './constants.js'
import {
  isAngleType,
  isContentDirection,
  isContentGoal,
  isRiskLevel,
  isStyle,
  sortStyles,
} from './enums.js'
import type { ContentDirection, Style } from './enums.js'
import type {
  AiNote,
  ApiError,
  ComplianceResult,
  ContentAngle,
  ContentStrategy,
  CoverSuggestion,
  CurrentNote,
  DiversityReport,
  ErrorField,
  GenerateInput,
  ReferenceAnalysis,
  RewriteRequest,
  Score,
  ScoreRequest,
  TitleVariant,
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
  goalInvalid: '内容目标不在允许范围内',
  targetUsersInvalid: '目标用户填写不正确',
  scenariosInvalid: '使用场景填写不正确',
  referenceTextRequired: '请粘贴参考文案',
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

/** 校验「字符串数组」：去空、去重、限长、限条数 */
function validateStringList(
  value: unknown,
  options: { field: ErrorField; message: string; maxItems: number; maxLength: number; required: boolean },
): ValidationResult<string[]> {
  if (value === undefined || value === null) {
    return options.required
      ? failure('INVALID_INPUT', options.message, options.field)
      : { ok: true, value: [] }
  }
  if (!Array.isArray(value)) {
    return failure('INVALID_INPUT', options.message, options.field)
  }
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const unique = [...new Set(items)]
  if (options.required && unique.length === 0) {
    return failure('INVALID_INPUT', options.message, options.field)
  }
  if (unique.length > options.maxItems) {
    return failure('INVALID_INPUT', `${options.message}（最多 ${options.maxItems} 项）`, options.field)
  }
  if (unique.some((item) => item.length > options.maxLength)) {
    return failure('INVALID_INPUT', `${options.message}（单项不超过 ${options.maxLength} 个字符）`, options.field)
  }
  return { ok: true, value: unique }
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

function validateSellingPoints(value: unknown): ValidationResult<string[]> {
  return validateStringList(value, {
    field: 'selling_points',
    message: MESSAGES.sellingPointsRequired,
    maxItems: SELLING_POINTS_MAX_ITEMS,
    maxLength: SELLING_POINT_MAX_LENGTH,
    required: true,
  })
}

/** 风格：至少 1 个、必须属于 STYLES；并按固定枚举顺序重排 */
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

function validateGoal(value: unknown): ValidationResult<GenerateInput['goal']> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: '种草' } // 未选择时的默认目标
  }
  if (!isContentGoal(value)) {
    return failure('INVALID_INPUT', MESSAGES.goalInvalid, 'goal')
  }
  return { ok: true, value }
}

function validateOptionalText(
  value: unknown,
  field: ErrorField,
  maxLength: number,
): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined }
  }
  if (typeof value !== 'string') {
    return failure('INVALID_INPUT', MESSAGES.requestInvalid, field)
  }
  const text = value.trim()
  if (text.length === 0) {
    return { ok: true, value: undefined }
  }
  if (text.length > maxLength) {
    return failure('INVALID_INPUT', `内容不超过 ${maxLength} 个字符`, field)
  }
  return { ok: true, value: text }
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

  const category = validateOptionalText(raw.product_category, 'product_category', PRODUCT_CATEGORY_MAX_LENGTH)
  if (!category.ok) return category

  const additionalInfo = validateOptionalText(raw.additional_info, 'additional_info', ADDITIONAL_INFO_MAX_LENGTH)
  if (!additionalInfo.ok) return additionalInfo

  const targetUsers = validateStringList(raw.target_users, {
    field: 'target_users',
    message: MESSAGES.targetUsersInvalid,
    maxItems: TARGET_USERS_MAX_ITEMS,
    maxLength: TARGET_USER_MAX_LENGTH,
    required: false,
  })
  if (!targetUsers.ok) return targetUsers

  const scenarios = validateStringList(raw.scenarios, {
    field: 'scenarios',
    message: MESSAGES.scenariosInvalid,
    maxItems: SCENARIOS_MAX_ITEMS,
    maxLength: SCENARIO_MAX_LENGTH,
    required: false,
  })
  if (!scenarios.ok) return scenarios

  const goal = validateGoal(raw.goal)
  if (!goal.ok) return goal

  const referenceText = validateOptionalText(raw.reference_text, 'reference_text', REFERENCE_TEXT_MAX_LENGTH)
  if (!referenceText.ok) return referenceText

  return {
    ok: true,
    value: {
      product: product.value,
      selling_points: sellingPoints.value,
      styles: styles.value,
      count: count.value,
      target_users: targetUsers.value,
      scenarios: scenarios.value,
      goal: goal.value,
      ...(category.value === undefined ? {} : { product_category: category.value }),
      ...(additionalInfo.value === undefined ? {} : { additional_info: additionalInfo.value }),
      ...(referenceText.value === undefined ? {} : { reference_text: referenceText.value }),
    },
  }
}

/**
 * 供**表单界面**使用：一次返回**全部**字段级错误（首次校验就一起标出），
 * 而不是像 validateGenerateInput 那样只返回第一个。
 *
 * 复用下方同一批字段校验器，**不复制任何规则**。
 */
export function collectGenerateInputFieldErrors(
  raw: unknown,
): Partial<Record<'product' | 'selling_points' | 'styles' | 'count', string>> {
  if (!isRecord(raw)) {
    return {}
  }

  const errors: Partial<Record<'product' | 'selling_points' | 'styles' | 'count', string>> = {}

  const product = validateProduct(raw.product)
  if (!product.ok) errors.product = product.error.message

  const sellingPoints = validateSellingPoints(raw.selling_points)
  if (!sellingPoints.ok) errors.selling_points = sellingPoints.error.message

  const styles = validateStyles(raw.styles)
  if (!styles.ok) errors.styles = styles.error.message

  const count = validateCount(raw.count, styles.ok ? styles.value.length : 0)
  if (!count.ok) errors.count = count.error.message

  return errors
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
    return failure('INVALID_INPUT', MESSAGES.styleInvalid, 'style')
  }

  const directions = validateContentDirections(raw.content_directions, 'INVALID_INPUT')
  if (!directions.ok) return directions

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

/* ---------- /api/title-variants 输入校验 ---------- */

export function validateTitleVariantsInput(raw: unknown): ValidationResult<{
  title: string
  body: string
  style: Style
  content_directions: ContentDirection[]
  product: string
  selling_points: string[]
}> {
  const base = validateScoreInput(raw)
  if (!base.ok) return base
  const { content_directions, product, selling_points, style, title, body } = base.value
  return { ok: true, value: { title, body, style, content_directions, product, selling_points } }
}

/* ---------- /api/reference/analyze 输入校验 ---------- */

export function validateReferenceText(value: unknown): ValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return failure('INVALID_INPUT', MESSAGES.referenceTextRequired, 'reference_text')
  }
  const text = value.trim()
  if (text.length > REFERENCE_TEXT_MAX_LENGTH) {
    return failure('INVALID_INPUT', `参考文案不超过 ${REFERENCE_TEXT_MAX_LENGTH} 个字符`, 'reference_text')
  }
  return { ok: true, value: text }
}

/* ---------- /api/compliance/check 输入校验 ---------- */

export function validateComplianceCheckInput(raw: unknown): ValidationResult<{
  title: string
  body: string
  hashtags: string[]
  product: string
  selling_points: string[]
}> {
  if (!isRecord(raw)) {
    return failure('INVALID_INPUT', MESSAGES.requestInvalid)
  }
  if (!isNonEmptyString(raw.title) || raw.title.trim().length > TITLE_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.titleRequired, 'title')
  }
  if (!isNonEmptyString(raw.body) || raw.body.trim().length > BODY_MAX_LENGTH) {
    return failure('INVALID_INPUT', MESSAGES.bodyRequired, 'body')
  }
  const hashtags = validateHashtags(raw.hashtags)
  if (!hashtags.ok) return hashtags
  const product = validateProduct(raw.product)
  if (!product.ok) return product
  const sellingPoints = validateSellingPoints(raw.selling_points)
  if (!sellingPoints.ok) return sellingPoints

  return {
    ok: true,
    value: {
      title: raw.title.trim(),
      body: raw.body.trim(),
      hashtags: hashtags.value,
      product: product.value,
      selling_points: sellingPoints.value,
    },
  }
}

/* ---------- 结果结构校验（AI 返回内容的校验） ---------- */

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
): ValidationResult<ContentDirection[]> {
  const field: ErrorField | undefined = errorType === 'INVALID_INPUT' ? 'content_directions' : undefined
  if (!Array.isArray(value) || value.length === 0 || value.length > CONTENT_DIRECTIONS_MAX_ITEMS) {
    return failure(errorType, MESSAGES.contentDirectionsRequired, field)
  }
  if (!value.every(isContentDirection)) {
    return failure(errorType, MESSAGES.contentDirectionsRequired, field)
  }
  return { ok: true, value: [...value] }
}

function validateCheckList(
  value: unknown,
  label: string,
): ValidationResult<string[]> {
  if (!Array.isArray(value) || value.length > CHECK_ISSUES_MAX_ITEMS) {
    return failure('SCHEMA_FAILED', `${label}格式不正确`)
  }
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length > CHECK_ITEM_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', `${label}格式不正确`)
    }
    const text = item.trim()
    if (text.length > 0) items.push(text)
  }
  return { ok: true, value: items }
}

/** AI 味检查结果（独立项，不进入总分） */
export function validateAiNess(value: unknown): ValidationResult<{
  risk_level: 'low' | 'medium' | 'high'
  issues: string[]
  suggestions: string[]
}> {
  if (!isRecord(value) || !isRiskLevel(value.risk_level)) {
    return failure('SCHEMA_FAILED', 'AI 味检查结果格式不正确')
  }
  const issues = validateCheckList(value.issues, 'AI 味问题列表')
  if (!issues.ok) return issues
  const suggestions = validateCheckList(value.suggestions, 'AI 味建议列表')
  if (!suggestions.ok) return suggestions
  return { ok: true, value: { risk_level: value.risk_level, issues: issues.value, suggestions: suggestions.value } }
}

/** 合规检查结果 */
export function validateCompliance(value: unknown): ValidationResult<ComplianceResult> {
  if (!isRecord(value) || !isRiskLevel(value.risk_level)) {
    return failure('SCHEMA_FAILED', '合规检查结果格式不正确')
  }
  const issues = validateCheckList(value.issues, '合规问题列表')
  if (!issues.ok) return issues
  const suggestions = validateCheckList(value.suggestions, '合规建议列表')
  if (!suggestions.ok) return suggestions
  return { ok: true, value: { risk_level: value.risk_level, issues: issues.value, suggestions: suggestions.value } }
}

/** 封面创意建议 */
export function validateCoverSuggestion(value: unknown): ValidationResult<CoverSuggestion> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '封面建议格式不正确')
  }
  const { headline, visual_subject, composition } = value
  if (!isNonEmptyString(headline) || headline.trim().length > COVER_HEADLINE_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '封面建议的标题不合适')
  }
  if (!isNonEmptyString(visual_subject) || visual_subject.trim().length > COVER_VISUAL_SUBJECT_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '封面建议的画面主体不合适')
  }
  if (!isNonEmptyString(composition) || composition.trim().length > COVER_COMPOSITION_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '封面建议的构图描述不合适')
  }
  return {
    ok: true,
    value: {
      headline: headline.trim(),
      visual_subject: visual_subject.trim(),
      composition: composition.trim(),
    },
  }
}

/**
 * Score 结构约束（V2：六维，总分 100）：
 *   - 六个维度均为**整数**且在各自区间内
 *   - total 为整数，必须等于六项之和
 *   - total 范围 0～100
 *   - strength / improvement 为非空字符串
 */
export function validateScore(value: unknown): ValidationResult<Score> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '评分结构不正确')
  }

  let sum = 0
  for (const [dimension, max] of Object.entries(SCORE_DIMENSION_MAX)) {
    const item = value[dimension]
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > max) {
      return failure('SCHEMA_FAILED', `评分维度 ${dimension} 必须是 0～${max} 的整数`)
    }
    sum += item
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
      content_value: value.content_value as number,
      specificity: value.specificity as number,
      native_feel: value.native_feel as number,
      differentiation: value.differentiation as number,
      structure: value.structure as number,
      authenticity: value.authenticity as number,
      strength: value.strength.trim(),
      improvement: value.improvement.trim(),
    },
  }
}

/** 创作角度校验 */
export function validateContentAngle(value: unknown): ValidationResult<ContentAngle> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '创作角度格式不正确')
  }
  const { id, audience, scenario, core_idea, hook_type, structure_type, ending_type } = value
  if (!isNonEmptyString(id) || id.trim().length > ANGLE_ID_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '创作角度缺少合法的 id')
  }
  if (!isAngleType(value.type)) {
    return failure('SCHEMA_FAILED', '创作角度的类型不在允许范围内')
  }
  const texts: Array<[unknown, number, string]> = [
    [audience, AUDIENCE_MAX_LENGTH, '目标人群'],
    [scenario, AUDIENCE_MAX_LENGTH, '使用场景'],
    [core_idea, CORE_IDEA_MAX_LENGTH, '核心想法'],
    [hook_type, HOOK_TYPE_MAX_LENGTH, '开头类型'],
    [structure_type, STRUCTURE_TYPE_MAX_LENGTH, '结构类型'],
    [ending_type, ENDING_TYPE_MAX_LENGTH, '结尾类型'],
  ]
  for (const [text, max, label] of texts) {
    if (!isNonEmptyString(text) || text.trim().length > max) {
      return failure('SCHEMA_FAILED', `创作角度的${label}不合适`)
    }
  }
  return {
    ok: true,
    value: {
      id: id.trim(),
      type: value.type,
      audience: (audience as string).trim(),
      scenario: (scenario as string).trim(),
      core_idea: (core_idea as string).trim(),
      hook_type: (hook_type as string).trim(),
      structure_type: (structure_type as string).trim(),
      ending_type: (ending_type as string).trim(),
    },
  }
}

/** 多样性报告（程序生成的字段，但结构也要校验） */
export function validateDiversityReport(value: unknown): ValidationResult<DiversityReport> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '多样性报告格式不正确')
  }
  const keys = ['opening_types', 'structure_types', 'ending_types', 'style_types', 'angle_types'] as const
  for (const key of keys) {
    const item = value[key]
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) {
      return failure('SCHEMA_FAILED', `多样性报告 ${key} 必须是非负整数`)
    }
  }
  if (!isRiskLevel(value.duplicate_risk)) {
    return failure('SCHEMA_FAILED', '多样性报告的重复风险等级不正确')
  }
  return {
    ok: true,
    value: {
      opening_types: value.opening_types as number,
      structure_types: value.structure_types as number,
      ending_types: value.ending_types as number,
      style_types: value.style_types as number,
      angle_types: value.angle_types as number,
      duplicate_risk: value.duplicate_risk,
    },
  }
}

/**
 * AI 输出的内容策略校验。
 *
 * `diversity_report` 由**程序**计算，因此这里只校验 AI 提供的部分；
 * 组装完整的 ContentStrategy 时由调用方补上 diversity_report。
 */
export function validateStrategy(
  value: unknown,
  options: { expectedCount: number; allowedStyles: readonly Style[] },
): ValidationResult<Pick<ContentStrategy, 'summary' | 'target_users' | 'scenarios' | 'angles'>> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '内容策略格式不正确')
  }

  if (!isNonEmptyString(value.summary) || value.summary.trim().length > STRATEGY_SUMMARY_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '内容策略的 summary 不合适')
  }

  const targetUsers = validateCheckList(value.target_users, '策略目标用户')
  if (!targetUsers.ok) return targetUsers
  const scenarios = validateCheckList(value.scenarios, '策略使用场景')
  if (!scenarios.ok) return scenarios

  if (!Array.isArray(value.angles)) {
    return failure('SCHEMA_FAILED', '内容策略缺少 angles')
  }
  if (value.angles.length !== options.expectedCount) {
    return failure(
      'SCHEMA_FAILED',
      `内容角度数量必须等于篇数（期望 ${options.expectedCount} 个，实际 ${value.angles.length} 个）`,
    )
  }

  const angles: ContentAngle[] = []
  for (const item of value.angles) {
    const angle = validateContentAngle(item)
    if (!angle.ok) return angle
    angles.push(angle.value)
  }

  const uniqueIds = new Set(angles.map((angle) => angle.id))
  if (uniqueIds.size !== angles.length) {
    return failure('SCHEMA_FAILED', '内容角度的 id 必须互不相同')
  }

  return {
    ok: true,
    value: {
      summary: value.summary.trim(),
      target_users: targetUsers.value,
      scenarios: scenarios.value,
      angles,
    },
  }
}

/** AI 输出的单篇笔记（id / stale 由程序补齐） */
export function validateAiNote(
  value: unknown,
  options: { allowedStyles: readonly Style[]; angleIds?: ReadonlySet<string> },
): ValidationResult<AiNote> {
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
  if (!options.allowedStyles.includes(value.style)) {
    return failure('SCHEMA_FAILED', `出现了未选择的风格：${value.style}`)
  }

  const angleId = value.angle_id
  if (!isNonEmptyString(angleId) || angleId.trim().length > ANGLE_ID_MAX_LENGTH) {
    return failure('SCHEMA_FAILED', '笔记缺少合法的 angle_id')
  }
  if (options.angleIds !== undefined && !options.angleIds.has(angleId.trim())) {
    return failure('SCHEMA_FAILED', '笔记的 angle_id 与内容策略中的角度不对应')
  }

  const score = validateScore(value.score)
  if (!score.ok) return score

  const aiNess = validateAiNess(value.ai_ness)
  if (!aiNess.ok) return aiNess

  const compliance = validateCompliance(value.compliance)
  if (!compliance.ok) return compliance

  const cover = validateCoverSuggestion(value.cover_suggestion)
  if (!cover.ok) return cover

  return {
    ok: true,
    value: {
      title: title.trim(),
      body: body.trim(),
      hashtags: hashtags.value,
      style: value.style,
      content_directions: directions.value,
      angle_id: angleId.trim(),
      score: score.value,
      ai_ness: aiNess.value,
      compliance: compliance.value,
      cover_suggestion: cover.value,
    },
  }
}

/**
 * 批量结果校验（generate / rewrite 共用）。
 *
 * 校验项：
 *   1. 每篇的 style 必须属于 allowedStyles
 *   2. notes.length 必须等于 expectedCount
 *   3. 每篇的 angle_id 必须能对应到内容策略中的角度
 *   （按 style 分组的篇数是否等于分配表，由 allocation.ts 负责比对）
 */
export function validateNotesResult(
  value: unknown,
  options: { expectedCount: number; allowedStyles: readonly Style[]; angleIds?: ReadonlySet<string> },
): ValidationResult<AiNote[]> {
  if (!Array.isArray(value)) {
    return failure('SCHEMA_FAILED', 'notes 必须是数组')
  }
  if (value.length !== options.expectedCount) {
    return failure(
      'SCHEMA_FAILED',
      `篇数不符合要求（期望 ${options.expectedCount} 篇，实际 ${value.length} 篇）`,
    )
  }

  const notes: AiNote[] = []
  for (const item of value) {
    const note = validateAiNote(item, {
      allowedStyles: options.allowedStyles,
      angleIds: options.angleIds,
    })
    if (!note.ok) return note
    notes.push(note.value)
  }

  return { ok: true, value: notes }
}

/* ---------- 标题变体与参考文案分析 ---------- */

export function validateTitleVariants(value: unknown): ValidationResult<TitleVariant[]> {
  if (!Array.isArray(value) || value.length !== TITLE_VARIANT_COUNT) {
    return failure('SCHEMA_FAILED', `标题变体数量必须为 ${TITLE_VARIANT_COUNT} 个`)
  }
  const variants: TitleVariant[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      return failure('SCHEMA_FAILED', '标题变体格式不正确')
    }
    const { title, type, analysis } = item
    if (!isNonEmptyString(title) || title.trim().length > TITLE_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', '标题变体的标题不合适')
    }
    if (!isNonEmptyString(type) || type.trim().length > TITLE_VARIANT_TYPE_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', '标题变体的类型不合适')
    }
    if (!isNonEmptyString(analysis) || analysis.trim().length > TITLE_VARIANT_ANALYSIS_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', '标题变体的说明不合适')
    }
    variants.push({ title: title.trim(), type: type.trim(), analysis: analysis.trim() })
  }
  return { ok: true, value: variants }
}

export function validateReferenceAnalysis(value: unknown): ValidationResult<ReferenceAnalysis> {
  if (!isRecord(value)) {
    return failure('SCHEMA_FAILED', '参考文案分析结果格式不正确')
  }
  const textFields = [
    'topic',
    'opening_type',
    'structure',
    'information_density',
    'rhythm',
    'narrative',
    'emotional_intensity',
    'ending_type',
    'interaction',
  ] as const
  for (const key of textFields) {
    if (!isNonEmptyString(value[key]) || (value[key] as string).trim().length > CHECK_ITEM_MAX_LENGTH) {
      return failure('SCHEMA_FAILED', `参考文案分析的 ${key} 不合适`)
    }
  }
  const learnable = validateCheckList(value.learnable_methods, '可借鉴方法')
  if (!learnable.ok) return learnable
  const doNotCopy = validateCheckList(value.do_not_copy, '不应复制的表达')
  if (!doNotCopy.ok) return doNotCopy

  return {
    ok: true,
    value: {
      topic: (value.topic as string).trim(),
      opening_type: (value.opening_type as string).trim(),
      structure: (value.structure as string).trim(),
      information_density: (value.information_density as string).trim(),
      rhythm: (value.rhythm as string).trim(),
      narrative: (value.narrative as string).trim(),
      emotional_intensity: (value.emotional_intensity as string).trim(),
      ending_type: (value.ending_type as string).trim(),
      interaction: (value.interaction as string).trim(),
      learnable_methods: learnable.value,
      do_not_copy: doNotCopy.value,
    },
  }
}
