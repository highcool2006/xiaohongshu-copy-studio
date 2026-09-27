/**
 * 共享常量与上限。
 *
 * 本文件是前后端「单一事实来源」的一部分：
 * 范围、默认值、上限只在此定义一次，前端与后端均从此处引用，不得各自复制一份。
 *
 * 依据：docs/技术架构决策.md 第 5、7、10 节；docs/V2产品决策.md
 */

/* ---------- 生成篇数 ---------- */

export const COUNT_MIN = 5
export const COUNT_MAX = 10
export const COUNT_DEFAULT = 6

/* ---------- 评分维度上限（V2：六维，总分 100） ---------- */

/**
 * 各评分维度的满分。
 * 键与 Score 接口中的维度字段一一对应（不含 total）。
 *
 * ⚠️ 「AI 味」不是评分维度，它是独立的质量风险检查（见 AiNessResult）。
 */
export const SCORE_DIMENSION_MAX = {
  content_value: 25,
  specificity: 20,
  native_feel: 20,
  differentiation: 15,
  structure: 10,
  authenticity: 10,
} as const

export type ScoreDimension = keyof typeof SCORE_DIMENSION_MAX

export const SCORE_TOTAL_MAX = 100

/** 浮点比较容差（total 与各项之和的比较） */
export const SCORE_SUM_EPSILON = 1e-6

/* ---------- 文本长度上限（防御性） ---------- */

export const PRODUCT_MAX_LENGTH = 100
export const PRODUCT_CATEGORY_MAX_LENGTH = 40
export const ADDITIONAL_INFO_MAX_LENGTH = 1000

/**
 * 我的素材（用户的真实经历）。
 *
 * 放宽到 2000：这一段是产出「真实笔记」而非「运营建议」的关键输入，
 * 用户写得越具体（时间、地点、当时的反应、对话、数字）结果越好，不应过早截断。
 */
export const PERSONAL_MATERIAL_MAX_LENGTH = 2000
/** 我是谁（身份 / 口吻），一句话即可 */
export const PERSONA_NOTE_MAX_LENGTH = 60

export const SELLING_POINT_MAX_LENGTH = 50
export const SELLING_POINTS_MAX_ITEMS = 20

export const TARGET_USERS_MAX_ITEMS = 12
export const TARGET_USER_MAX_LENGTH = 20
export const SCENARIOS_MAX_ITEMS = 12
export const SCENARIO_MAX_LENGTH = 20

/** 参考文案原文字数上限（仅用于方法分析，绝不复制） */
export const REFERENCE_TEXT_MAX_LENGTH = 4000

export const TITLE_MAX_LENGTH = 60
export const BODY_MAX_LENGTH = 3000

/**
 * 话题标签数量（3~5 → 5~10）。
 *
 * 真实小红书笔记的标签通常在 5~10 个，且分三层（品类大词 / 精准场景词 / 长尾情绪词）。
 * 这里只放宽数量上限，分层要求属写作规范，见 prompts/shared.ts 的 NOTE_ANATOMY_TEXT。
 */
export const HASHTAG_MAX_ITEMS = 10
export const HASHTAG_MIN_ITEMS = 5
export const HASHTAG_MAX_LENGTH = 20
export const CONTENT_DIRECTIONS_MAX_ITEMS = 8

export const STRENGTH_MAX_LENGTH = 100
export const IMPROVEMENT_MAX_LENGTH = 100

/* ---------- V2：创作角度 / 策略 / 封面建议 / 检查结果 ---------- */

export const ANGLE_ID_MAX_LENGTH = 24
export const CORE_IDEA_MAX_LENGTH = 200
export const AUDIENCE_MAX_LENGTH = 40
export const HOOK_TYPE_MAX_LENGTH = 20
export const STRUCTURE_TYPE_MAX_LENGTH = 20
export const ENDING_TYPE_MAX_LENGTH = 20
export const STRATEGY_SUMMARY_MAX_LENGTH = 500

export const COVER_HEADLINE_MAX_LENGTH = 40
export const COVER_VISUAL_SUBJECT_MAX_LENGTH = 60
export const COVER_COMPOSITION_MAX_LENGTH = 120

/** AI 味 / 合规：问题与建议条数与单条长度上限 */
export const CHECK_ISSUES_MAX_ITEMS = 10
export const CHECK_ITEM_MAX_LENGTH = 200

/** 标题变体：一次生成的数量 */
export const TITLE_VARIANT_COUNT = 3
export const TITLE_VARIANT_TYPE_MAX_LENGTH = 20
export const TITLE_VARIANT_ANALYSIS_MAX_LENGTH = 200

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
