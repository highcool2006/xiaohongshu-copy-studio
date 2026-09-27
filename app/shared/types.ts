/**
 * 核心数据类型（V2）。
 *
 * 契约依据：docs/技术架构决策.md 第 4、5、6 节；docs/V2产品决策.md
 *
 * 约定：
 *   - hashtags 的值不含前导 #（# 由程序渲染）
 *   - id / angle_id 由**程序**生成（AI 不生成随机 ID）
 *   - 不存在 persona 字段（本系统不设「人设」概念）
 *   - localId 由前端生成，不属于本文件的任何契约类型
 *   - 「AI 味」是独立检查项（AiNessResult），**不是评分维度**
 */

import type { ErrorType, InformationStatus } from './constants.js'
import type {
  AngleType,
  ContentDirection,
  ContentGoal,
  CopyType,
  RiskLevel,
  Style,
} from './enums.js'

/* ---------- 评分（六维，总分 100） ---------- */

/** 内容质量评分。仅为 AI 辅助评价，不是爆款概率，也不预测任何平台数据。 */
export interface Score {
  total: number
  content_value: number
  specificity: number
  native_feel: number
  differentiation: number
  structure: number
  authenticity: number
  /** 一句具体优势 */
  strength: string
  /** 一句具体改进建议 */
  improvement: string
}

/* ---------- V2 独立检查项 ---------- */

/** AI 味检查结果（独立质量风险，不进入总分） */
export interface AiNessResult {
  risk_level: RiskLevel
  issues: string[]
  suggestions: string[]
}

/** 发布前合规检查结果（AI 风险提示，不代表平台审核结果） */
export interface ComplianceResult {
  risk_level: RiskLevel
  issues: string[]
  suggestions: string[]
}

/** 封面创意建议（本阶段只生成创意，不生成图片） */
export interface CoverSuggestion {
  headline: string
  visual_subject: string
  composition: string
}

/* ---------- 内容角度与策略 ---------- */

/** 一个创作角度（与一篇笔记一一对应） */
export interface ContentAngle {
  id: string
  type: AngleType
  audience: string
  scenario: string
  core_idea: string
  hook_type: string
  structure_type: string
  ending_type: string
}

/** 多样性报告：由**程序**统计，不由 AI 判断 */
export interface DiversityReport {
  /** 不同开头类型的数量 */
  opening_types: number
  /** 不同结构类型的数量 */
  structure_types: number
  /** 不同结尾类型的数量 */
  ending_types: number
  /** 不同风格的数量 */
  style_types: number
  /** 不同角度类型的数量 */
  angle_types: number
  /** 重复风险：low / medium / high */
  duplicate_risk: RiskLevel
}

/** 内容策略（一次 generate 调用返回） */
export interface ContentStrategy {
  summary: string
  target_users: string[]
  scenarios: string[]
  angles: ContentAngle[]
  diversity_report: DiversityReport
}

/* ---------- 笔记 ---------- */

/** 一篇笔记（AI 输出 + 程序补齐的字段） */
export interface Note {
  /** 由程序生成 */
  id: string
  title: string
  body: string
  /** 话题标签，值不含前导 # */
  hashtags: string[]
  style: Style
  content_directions: ContentDirection[]
  /** 对应 ContentStrategy.angles 中的角度 */
  angle_id: string
  score: Score
  ai_ness: AiNessResult
  compliance: ComplianceResult
  cover_suggestion: CoverSuggestion
  /** 内容被用户编辑后由程序置 true，表示评分可能过时 */
  stale: boolean
}

/**
 * AI 输出的单篇笔记。
 *
 * `id` 与 `stale` **由程序补齐**（AI 不生成随机 ID，也不决定内容是否过时），
 * 因此校验 AI 输出时使用本类型，而不是完整的 Note。
 */
export type AiNote = Omit<Note, 'id' | 'stale'>

/** 重写输入用的「当前文案」（契约最小集，不含评分与检查结果） */
export type CurrentNote = Pick<
  Note,
  'title' | 'body' | 'hashtags' | 'content_directions' | 'style'
>

/* ---------- 产品档案（前端输入，随 generate 一起提交） ---------- */

export interface ProductProfile {
  name: string
  category?: string
  selling_points: string[]
  additional_info?: string
  /**
   * 我的素材：用户自己写下的真实经历、细节与感受。
   *
   * **这是唯一允许第一人称体验（感官、亲历、真实场景细节）的事实来源。**
   * 产品参数只能支撑"决策建议"体裁；要产出真正的小红书笔记，
   * 必须由用户提供"我这个人在什么时候、经历了什么"。
   * 未提供时，AI 一律不得自行补齐（见 prompts/shared.ts 的语义级事实边界）。
   */
  personal_material?: string
  /**
   * 我是谁：身份 / 口吻 / 立场（例如「上班族，说话比较直」）。
   *
   * 只影响第一人称的**语气**，本身不构成事实，不得从中推导出经历。
   */
  persona_note?: string
  /** 预设见 TARGET_USER_PRESETS；允许自定义值 */
  target_users: string[]
  /** 预设见 SCENARIO_PRESETS；允许自定义值 */
  scenarios: string[]
  goal: ContentGoal
  /** 参考文案原文（仅用于方法分析，绝不复制内容） */
  reference_text?: string
}

/* ---------- /api/generate ---------- */

/** 客户端 → 服务端（V2 扩展字段全部可选，保持向后兼容） */
export interface GenerateRequest {
  product: string
  selling_points: string[]
  styles: Style[]
  /** 省略时使用 COUNT_DEFAULT */
  count?: number
  product_category?: string
  additional_info?: string
  /** 我的素材：第一人称真实经历（唯一允许第一人称体验的事实来源） */
  personal_material?: string
  /** 我是谁：身份 / 口吻 / 立场 */
  persona_note?: string
  target_users?: string[]
  scenarios?: string[]
  goal?: ContentGoal
  /** 文案类型（体裁控制）；省略时使用 COPY_TYPE_DEFAULT */
  copy_type?: CopyType
  reference_text?: string
  /** 期望的内容方向（可多选）；提供时 AI 应优先从中选择 */
  content_directions_preference?: ContentDirection[]
}

/** 校验并归一化之后的生成输入 */
export interface GenerateInput {
  product: string
  selling_points: string[]
  styles: Style[]
  count: number
  target_users: string[]
  scenarios: string[]
  goal: ContentGoal
  /** 校验归一化后一定有值（缺省回落 COPY_TYPE_DEFAULT） */
  copy_type: CopyType
  /** 空数组表示不限定方向，由 AI 自行规划 */
  content_directions_preference: ContentDirection[]
  product_category?: string
  additional_info?: string
  /** 我的素材：第一人称真实经历 */
  personal_material?: string
  /** 我是谁：身份 / 口吻 / 立场 */
  persona_note?: string
  reference_text?: string
}

export interface Information {
  status: InformationStatus
  message: string
}

export interface GenerateResponse {
  /** 辅助提示（前端展示位置：结果区信息条） */
  information: Information
  /** 内容策略：与 notes 一一对应 */
  strategy: ContentStrategy
  notes: Note[]
}

/* ---------- /api/rewrite ---------- */

export interface RewriteRequest {
  product: string
  selling_points: string[]
  /**
   * 我的素材（可选）。
   *
   * 与 generate 用同一份输入：换风格重写是「同一篇的另一种写法」，
   * 若原笔记建立在用户的真实经历上，重写必须能继续使用这些细节，
   * 否则重写后会退回通用建议，与首次生成的口径不一致。
   */
  personal_material?: string
  /** 我是谁：身份 / 口吻 / 立场 */
  persona_note?: string
  /** 目标新风格；与 current_note.style（当前风格）区分 */
  target_style: Style
  current_note: CurrentNote
  /**
   * 原笔记的创作角度 id（可选）。
   * 提供时 AI 必须原样回填，且**以程序传入的值为准**；未提供时 AI 填 "angle-1"，由程序接管。
   */
  angle_id?: string
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
  /** 原始产品：编造的对照基准 */
  product: string
  /** 原始卖点：编造的对照基准 */
  selling_points: string[]
}

export interface ScoreResponse {
  score: Score
}

/* ---------- /api/title-variants ---------- */

export interface TitleVariant {
  title: string
  /** 切入方式，例如「场景型」「问题型」「结果型」 */
  type: string
  analysis: string
}

export interface TitleVariantsRequest {
  title: string
  body: string
  style: Style
  content_directions: ContentDirection[]
  product: string
  selling_points: string[]
  /** 本篇创作角度，可选（有则更贴合） */
  angle?: ContentAngle
}

export interface TitleVariantsResponse {
  variants: TitleVariant[]
}

/* ---------- /api/reference/analyze ---------- */

/** 参考文案的**方法分析**（绝不逐句复制原文） */
export interface ReferenceAnalysis {
  topic: string
  opening_type: string
  structure: string
  information_density: string
  rhythm: string
  narrative: string
  emotional_intensity: string
  ending_type: string
  interaction: string
  /** 可借鉴的方法 */
  learnable_methods: string[]
  /** 明确不应复制的具体表达 */
  do_not_copy: string[]
}

export interface ReferenceAnalyzeRequest {
  reference_text: string
}

export interface ReferenceAnalyzeResponse {
  analysis: ReferenceAnalysis
}

/* ---------- /api/compliance/check ---------- */

export interface ComplianceCheckRequest {
  title: string
  body: string
  hashtags: string[]
  product: string
  selling_points: string[]
}

export interface ComplianceCheckResponse {
  compliance: ComplianceResult
}

/* ---------- 统一错误 ---------- */

/** 可出现在 INVALID_INPUT 上的字段名 */
export type ErrorField =
  | 'product'
  | 'product_category'
  | 'selling_points'
  | 'additional_info'
  | 'personal_material'
  | 'persona_note'
  /** /api/generate 的所选风格（多个） */
  | 'styles'
  /** /api/score 的当前风格（单个） */
  | 'style'
  | 'count'
  | 'target_users'
  | 'scenarios'
  | 'goal'
  | 'copy_type'
  | 'reference_text'
  | 'target_style'
  | 'current_note'
  | 'title'
  | 'body'
  | 'content_directions'
  | 'hashtags'

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
