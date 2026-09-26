/**
 * 共享常量与上限。
 *
 * 本文件是前后端「单一事实来源」的一部分：
 * 范围、默认值、上限只在此定义一次，前端与后端均从此处引用，不得各自复制一份。
 *
 * 依据：docs/技术架构决策.md 第 5、7、10 节
 */

/* ---------- 生成篇数 ---------- */

export const COUNT_MIN = 5
export const COUNT_MAX = 10
export const COUNT_DEFAULT = 6

/* ---------- 评分维度上限 ---------- */

/**
 * 各评分维度的满分。
 * 键与 Score 接口中的维度字段一一对应（不含 total）。
 */
export const SCORE_DIMENSION_MAX = {
  title_attractiveness: 25,
  readability: 25,
  identification: 20,
  style_match: 15,
  information_completeness: 15,
} as const

export type ScoreDimension = keyof typeof SCORE_DIMENSION_MAX

export const SCORE_TOTAL_MAX = 100

/** 浮点比较容差（total 与五项之和的比较） */
export const SCORE_SUM_EPSILON = 1e-6

/* ---------- 文本长度上限（防御性） ---------- */

export const PRODUCT_MAX_LENGTH = 100
export const SELLING_POINT_MAX_LENGTH = 50
export const SELLING_POINTS_MAX_ITEMS = 20

export const TITLE_MAX_LENGTH = 60
export const BODY_MAX_LENGTH = 3000
/** 每篇笔记的话题标签数量（产品规则：AI 自动生成 3～5 个） */
export const HASHTAG_MIN_ITEMS = 3
export const HASHTAG_MAX_ITEMS = 5
/** 单个标签文本的长度上限 */
export const HASHTAG_MAX_LENGTH = 20
export const CONTENT_DIRECTIONS_MAX_ITEMS = 8
export const STRENGTH_MAX_LENGTH = 100
export const IMPROVEMENT_MAX_LENGTH = 100

/* ---------- 信息充分度（generate 的辅助提示字段） ---------- */

export const INFORMATION_STATUS_VALUES = ['sufficient', 'limited'] as const

export type InformationStatus = (typeof INFORMATION_STATUS_VALUES)[number]

/**
 * information 字段缺失或非法时的降级值。
 *
 * 该字段是**辅助字段**：异常时只降级为「不提示」，不判 SCHEMA_FAILED、不触发 D8 重试。
 * 核心 notes 仍必须严格校验。
 */
export const INFORMATION_FALLBACK = { status: 'sufficient', message: '' } as const

/* ---------- 错误类型 ---------- */

export const ERROR_TYPES = [
  'INVALID_INPUT',
  'PARSE_FAILED',
  'SCHEMA_FAILED',
  'AI_CALL_FAILED',
  'INTERNAL',
] as const

export type ErrorType = (typeof ERROR_TYPES)[number]

/**
 * 错误类型 → HTTP 状态码。
 *
 * 注：AI_CALL_FAILED 采用 503（上游依赖暂时不可用）；
 * 该类型的「判定规则」仍属推迟项，见 docs/技术架构决策.md 第 16 节。
 */
export const ERROR_HTTP_STATUS = {
  INVALID_INPUT: 400,
  PARSE_FAILED: 502,
  SCHEMA_FAILED: 502,
  AI_CALL_FAILED: 503,
  INTERNAL: 500,
} as const satisfies Record<ErrorType, number>
