/**
 * 前端状态：类型 + reducer（纯函数，不依赖 React）。
 *
 * 依据 docs/V2产品决策.md 与 docs/技术架构决策.md 第 11、12 节（D5：useReducer + Context）。
 *   - 派生数据（篇数、风格分布、排序结果）不存进 state
 *   - 内容（notes）与卡片交互状态（cards）分开存
 *   - V2：左侧输入升级为「产品档案」，新增策略、排序筛选、批量选择与卡片级检查状态
 */

import { COUNT_DEFAULT } from '../../shared/constants'
import { sortStyles } from '../../shared/enums'
import type { ContentDirection, ContentGoal, Style } from '../../shared/enums'
import { minCountForStyles } from '../../shared/validation'
import { removeAsset, upsertAsset } from '../lib/assetsStorage'
import type {
  ComplianceResult,
  ContentStrategy,
  Information,
  Note,
  ReferenceAnalysis,
  Score,
  TitleVariant,
} from '../../shared/types'
import type { FrontendApiError } from '../api/http'
import type { SavedAsset } from '../lib/assetsStorage'

/** 工作台视图（不引入 react-router，用轻量 view state 切换） */
export type ActiveView = 'workbench' | 'style-library' | 'review' | 'assets'

/** 界面侧的 Note：契约 Note + 前端分配的 localId（localId 绝不进入 AI 契约） */
export interface NoteWithId extends Note {
  localId: string
}

/**
 * 表单字段名。
 *
 * 前四项与 collectGenerateInputFieldErrors 的键一致（generate 的行内错误）；
 * `referenceText` 用于参考文案区自身的校验错误（例如未粘贴内容就点分析）。
 */
export type FormField = 'product' | 'sellingPoints' | 'styles' | 'count' | 'referenceText'

export type CardView = 'display' | 'edit' | 'rewrite'
export type CardStatus = 'idle' | 'rewriting' | 'scoring' | 'checking' | 'variants'

export interface CardState {
  view: CardView
  draft: { title: string; body: string } | null
  targetStyle: Style | null
  status: CardStatus
  scoreStale: boolean
  error: FrontendApiError | null
  errorAction: 'rewrite' | 'score' | 'compliance' | 'variants' | null
  copyFeedback: 'idle' | 'copied' | 'failed'
  /** 用户主动触发的发布前检查结果（与 note 自带的 compliance 区分） */
  complianceCheck: ComplianceResult | null
  /** 用户主动生成的标题变体 */
  titleVariants: TitleVariant[] | null
  /**
   * 标题 A/B 的基线：进入标题优化时的原标题。
   *
   * 采用变体后**不清空**，用户可以在「原标题 / 变体 A / B / C」之间反复切换对比。
   * 内容被重写后失效（REWRITE_SUCCESS 时清空）。
   */
  originalTitle: string | null
}

export function createCardState(): CardState {
  return {
    view: 'display',
    draft: null,
    targetStyle: null,
    status: 'idle',
    scoreStale: false,
    error: null,
    errorAction: null,
    copyFeedback: 'idle',
    complianceCheck: null,
    titleVariants: null,
    originalTitle: null,
  }
}

/** 生成过程的阶段提示（仅用于让用户知道在做什么；非精确进度） */
export const GENERATION_STAGES = [
  '正在分析产品信息',
  '正在规划内容角度',
  '正在生成不同表达',
  '正在检查事实与合规',
  '正在检查模板与重复',
  '正在完成评分',
] as const

export interface AppState {
  activeView: ActiveView
  profile: {
    product: string
    category: string
    /** 已确认的卖点标签（提交给 API 的即是它） */
    sellingPoints: string[]
    /** 卖点输入框的当前内容（尚未成为标签） */
    sellingPointDraft: string
    additionalInfo: string
    /**
     * 我的素材：用户自己写的真实经历 / 细节 / 感受。
     *
     * 这是产出「真实小红书笔记」的关键输入：产品参数只能支撑决策建议，
     * 第一人称的真实细节只能由用户提供。为空时生成结果会退回通用建议。
     */
    personalMaterial: string
    /** 我是谁：身份 / 口吻 / 立场（只影响语气，不构成事实） */
    personaNote: string
    targetUsers: string[]
    scenarios: string[]
    goal: ContentGoal
    /** 期望的内容方向；空数组表示不限定 */
    directions: ContentDirection[]
    styles: Style[]
    count: number
    referenceText: string
  }
  errors: Partial<Record<FormField, string>>
  batch: {
    status: 'idle' | 'loading' | 'error'
    error: FrontendApiError | null
    /** 上一次生成的真实耗时（毫秒） */
    durationMs: number | null
  }
  information: Information | null
  /** 本次生成的内容策略（含角度与多样性报告） */
  strategy: ContentStrategy | null
  /**
   * 参考文案分析结果（用户主动触发）。
   *
   * ⚠️ 仅用于展示：**不回灌 generate**，也不参与任何生成逻辑。
   * 分析失败时不清空已有结果（保留上一次的有效分析并同时显示错误）。
   */
  referenceAnalysis: ReferenceAnalysis | null
  referenceAnalysisLoading: boolean
  /** 面向用户的错误文案（不进入 API 契约，故用 string 而非 FrontendApiError） */
  referenceAnalysisError: string | null
  notes: NoteWithId[]
  cards: Record<string, CardState>
  /** 结果区排序与筛选（仅存用户选择；排序结果是派生值） */
  sort: 'quality' | 'newest'
  filterStyle: Style | 'all'
  filterRisk: 'all' | 'low' | 'medium' | 'high'
  /** 批量操作的选中项（localId） */
  selected: string[]
  /**
   * 资产库（localStorage 持久化，刷新后仍在）。
   *
   * state 只是内存镜像：写入一律经由 lib/assetsStorage 落盘后再 dispatch，
   * 因此这里不存「是否已写入」之类的中间态。
   */
  assets: SavedAsset[]
  /** 是否已从 localStorage 读取过（避免首帧误显示"还没有资产"） */
  assetsLoaded: boolean
}

export const initialAppState: AppState = {
  activeView: 'workbench',
  profile: {
    product: '',
    category: '',
    sellingPoints: [],
    sellingPointDraft: '',
    additionalInfo: '',
    personalMaterial: '',
    personaNote: '',
    targetUsers: [],
    scenarios: [],
    goal: '种草',
    directions: [],
    styles: [],
    count: COUNT_DEFAULT,
    referenceText: '',
  },
  errors: {},
  batch: { status: 'idle', error: null, durationMs: null },
  information: null,
  strategy: null,
  referenceAnalysis: null,
  referenceAnalysisLoading: false,
  referenceAnalysisError: null,
  notes: [],
  cards: {},
  sort: 'newest',
  filterStyle: 'all',
  filterRisk: 'all',
  selected: [],
  assets: [],
  assetsLoaded: false,
}

export type AppAction =
  // 视图
  | { type: 'SET_ACTIVE_VIEW'; view: ActiveView }
  // 产品档案
  | { type: 'SET_PRODUCT'; value: string }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_SELLING_POINT_DRAFT'; value: string }
  | { type: 'ADD_SELLING_POINTS'; values: string[] }
  | { type: 'REMOVE_SELLING_POINT'; value: string }
  | { type: 'SET_ADDITIONAL_INFO'; value: string }
  | { type: 'SET_PERSONAL_MATERIAL'; value: string }
  | { type: 'SET_PERSONA_NOTE'; value: string }
  | { type: 'SET_REFERENCE_TEXT'; value: string }
  | { type: 'TOGGLE_TARGET_USER'; value: string }
  | { type: 'TOGGLE_SCENARIO'; value: string }
  | { type: 'SET_GOAL'; value: ContentGoal }
  | { type: 'TOGGLE_DIRECTION'; direction: ContentDirection }
  | { type: 'TOGGLE_STYLE'; style: Style }
  | { type: 'SET_COUNT'; value: number }
  | { type: 'VALIDATION_FAILED'; errors: Partial<Record<FormField, string>> }
  | { type: 'CLEAR_FIELD_ERROR'; field: FormField }
  // 批量生成
  | { type: 'GENERATE_START' }
  | {
      type: 'GENERATE_SUCCESS'
      information: Information
      strategy: ContentStrategy
      notes: NoteWithId[]
      durationMs: number
    }
  | { type: 'GENERATE_FAILURE'; error: FrontendApiError; durationMs: number }
  // 结果区排序 / 筛选 / 批量选择
  | { type: 'SET_SORT'; sort: AppState['sort'] }
  | { type: 'SET_FILTER_STYLE'; style: AppState['filterStyle'] }
  | { type: 'SET_FILTER_RISK'; risk: AppState['filterRisk'] }
  | { type: 'TOGGLE_SELECT'; localId: string }
  | { type: 'SET_SELECTION'; localIds: string[] }
  // 就地编辑（本地，不调 AI）
  | { type: 'BEGIN_EDIT'; localId: string }
  | { type: 'UPDATE_DRAFT'; localId: string; patch: Partial<{ title: string; body: string }> }
  | { type: 'COMMIT_EDIT'; localId: string }
  | { type: 'CANCEL_EDIT'; localId: string }
  // 换风格重写（卡片级，调 AI）
  | { type: 'BEGIN_REWRITE'; localId: string }
  | { type: 'SET_TARGET_STYLE'; localId: string; style: Style }
  | { type: 'CONFIRM_REWRITE'; localId: string }
  | { type: 'REWRITE_SUCCESS'; localId: string; note: Note }
  | { type: 'REWRITE_FAILURE'; localId: string; error: FrontendApiError }
  | { type: 'CANCEL_REWRITE'; localId: string }
  // 重新评分（卡片级，调 AI）
  | { type: 'REQUEST_SCORE'; localId: string }
  | { type: 'SCORE_SUCCESS'; localId: string; score: Score }
  | { type: 'SCORE_FAILURE'; localId: string; error: FrontendApiError }
  // 发布前检查（卡片级，用户主动触发）
  | { type: 'REQUEST_COMPLIANCE'; localId: string }
  | { type: 'COMPLIANCE_SUCCESS'; localId: string; compliance: ComplianceResult }
  | { type: 'COMPLIANCE_FAILURE'; localId: string; error: FrontendApiError }
  // 标题变体（卡片级，用户主动触发）
  | { type: 'REQUEST_TITLE_VARIANTS'; localId: string }
  | { type: 'TITLE_VARIANTS_SUCCESS'; localId: string; variants: TitleVariant[] }
  | { type: 'TITLE_VARIANTS_FAILURE'; localId: string; error: FrontendApiError }
  | { type: 'APPLY_TITLE_VARIANT'; localId: string; title: string }
  // 参考文案分析（用户主动触发；一次分析 = 一次请求）
  | { type: 'REFERENCE_ANALYZE_START' }
  | { type: 'REFERENCE_ANALYZE_SUCCESS'; analysis: ReferenceAnalysis }
  | { type: 'REFERENCE_ANALYZE_ERROR'; message: string }
  // 复制反馈
  | { type: 'SET_COPY_FEEDBACK'; localId: string; value: 'copied' | 'failed' }
  | { type: 'RESET_COPY_FEEDBACK'; localId: string }
  // 资产库（持久化由 AppProvider 负责，这里只同步内存镜像）
  | { type: 'ASSETS_LOADED'; assets: SavedAsset[] }
  | { type: 'ASSET_SAVED'; asset: SavedAsset }
  | { type: 'ASSET_DELETED'; assetId: string }

let localIdCounter = 0

/** 生成卡片身份：仅用于前端挂载状态，不进入任何 API 契约 */
export function createLocalId(): string {
  localIdCounter += 1
  return `note-${localIdCounter}`
}

/**
 * 把用户随手输入的内容整理为独立卖点。
 *
 * 支持换行、中文逗号/顿号、英文逗号分隔；去空、去重、去首尾空白。
 * 用户不需要逐个精确操作 —— 拆分由程序负责。
 */
export function parseSellingPoints(draft: string): string[] {
  return [
    ...new Set(
      draft
        .split(/[\n,，、;；]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ]
}

/** 数组切换工具：存在则移除，不存在则追加（保持追加顺序） */
function toggleItem<T>(items: readonly T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
}

/* ---------- reducer 内部小工具 ---------- */

function patchCard(state: AppState, localId: string, patch: Partial<CardState>): AppState {
  const current = state.cards[localId]
  if (current === undefined) {
    return state // 卡片已不存在（例如已重新生成），忽略
  }
  return { ...state, cards: { ...state.cards, [localId]: { ...current, ...patch } } }
}

function patchNote(
  state: AppState,
  localId: string,
  update: (note: NoteWithId) => NoteWithId,
): AppState {
  return { ...state, notes: state.notes.map((note) => (note.localId === localId ? update(note) : note)) }
}

function findNote(state: AppState, localId: string): NoteWithId | undefined {
  return state.notes.find((note) => note.localId === localId)
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    /* ---------- 视图 ---------- */
    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.view }

    /* ---------- 产品档案 ---------- */
    case 'SET_PRODUCT':
      return { ...state, profile: { ...state.profile, product: action.value } }
    case 'SET_CATEGORY':
      return { ...state, profile: { ...state.profile, category: action.value } }
    case 'SET_SELLING_POINT_DRAFT':
      return { ...state, profile: { ...state.profile, sellingPointDraft: action.value } }

    case 'ADD_SELLING_POINTS': {
      const merged = [...new Set([...state.profile.sellingPoints, ...action.values])]
      return { ...state, profile: { ...state.profile, sellingPoints: merged, sellingPointDraft: '' } }
    }

    case 'REMOVE_SELLING_POINT':
      return {
        ...state,
        profile: {
          ...state.profile,
          sellingPoints: state.profile.sellingPoints.filter((item) => item !== action.value),
        },
      }
    case 'SET_ADDITIONAL_INFO':
      return { ...state, profile: { ...state.profile, additionalInfo: action.value } }
    case 'SET_PERSONAL_MATERIAL':
      return { ...state, profile: { ...state.profile, personalMaterial: action.value } }
    case 'SET_PERSONA_NOTE':
      return { ...state, profile: { ...state.profile, personaNote: action.value } }
    case 'SET_REFERENCE_TEXT':
      return { ...state, profile: { ...state.profile, referenceText: action.value } }
    case 'TOGGLE_TARGET_USER':
      return { ...state, profile: { ...state.profile, targetUsers: toggleItem(state.profile.targetUsers, action.value) } }
    case 'TOGGLE_SCENARIO':
      return { ...state, profile: { ...state.profile, scenarios: toggleItem(state.profile.scenarios, action.value) } }
    case 'SET_GOAL':
      return { ...state, profile: { ...state.profile, goal: action.value } }
    case 'TOGGLE_DIRECTION':
      return { ...state, profile: { ...state.profile, directions: toggleItem(state.profile.directions, action.direction) } }

    case 'TOGGLE_STYLE': {
      const selected = state.profile.styles.includes(action.style)
      const nextStyles = selected
        ? state.profile.styles.filter((style) => style !== action.style)
        : sortStyles([...state.profile.styles, action.style]) // 按固定枚举顺序存放
      // 选中风格变化后，篇数不能低于「每个选中风格至少 1 篇」的动态下限
      const nextCount = Math.max(state.profile.count, minCountForStyles(nextStyles.length))
      return { ...state, profile: { ...state.profile, styles: nextStyles, count: nextCount } }
    }

    case 'SET_COUNT':
      return { ...state, profile: { ...state.profile, count: action.value } }

    case 'VALIDATION_FAILED':
      return { ...state, errors: action.errors, batch: { ...state.batch, status: 'idle', error: null } }

    case 'CLEAR_FIELD_ERROR': {
      if (state.errors[action.field] === undefined) {
        return state
      }
      const next = { ...state.errors }
      delete next[action.field]
      return { ...state, errors: next }
    }

    /* ---------- 批量生成 ---------- */
    case 'GENERATE_START':
      // 刻意**不清空** notes / cards / strategy / information：生成失败时旧结果仍可恢复显示
      return { ...state, errors: {}, batch: { status: 'loading', error: null, durationMs: null } }

    case 'GENERATE_SUCCESS':
      return {
        ...state,
        batch: { status: 'idle', error: null, durationMs: action.durationMs },
        information: action.information,
        strategy: action.strategy,
        notes: action.notes,
        // 新一轮结果是全新集合 → 重置所有卡片状态与选中项
        cards: Object.fromEntries(action.notes.map((note) => [note.localId, createCardState()])),
        selected: [],
        filterStyle: 'all',
        filterRisk: 'all',
      }

    case 'GENERATE_FAILURE':
      // 同样保留旧 notes / cards / strategy
      return { ...state, batch: { status: 'error', error: action.error, durationMs: action.durationMs } }

    /* ---------- 排序 / 筛选 / 批量选择 ---------- */
    case 'SET_SORT':
      return { ...state, sort: action.sort }
    case 'SET_FILTER_STYLE':
      return { ...state, filterStyle: action.style }
    case 'SET_FILTER_RISK':
      return { ...state, filterRisk: action.risk }
    case 'TOGGLE_SELECT':
      return { ...state, selected: toggleItem(state.selected, action.localId) }
    case 'SET_SELECTION':
      return { ...state, selected: action.localIds }

    /* ---------- 就地编辑（本地，不调 AI） ---------- */
    case 'BEGIN_EDIT': {
      const note = findNote(state, action.localId)
      if (note === undefined) {
        return state
      }
      return patchCard(state, action.localId, {
        view: 'edit',
        draft: { title: note.title, body: note.body },
        error: null,
        errorAction: null,
      })
    }
    case 'UPDATE_DRAFT': {
      const card = state.cards[action.localId]
      if (card === undefined || card.draft === null) {
        return state
      }
      return patchCard(state, action.localId, { draft: { ...card.draft, ...action.patch } })
    }
    case 'COMMIT_EDIT': {
      const card = state.cards[action.localId]
      if (card === undefined || card.draft === null) {
        return state
      }
      const draft = card.draft
      const next = patchNote(state, action.localId, (note) => ({ ...note, ...draft }))
      return patchCard(next, action.localId, {
        view: 'display',
        draft: null,
        // 内容改了，原评分保留但标记为「可能过时」
        scoreStale: true,
      })
    }
    case 'CANCEL_EDIT':
      return patchCard(state, action.localId, { view: 'display', draft: null })

    /* ---------- 换风格重写 ---------- */
    case 'BEGIN_REWRITE':
      return patchCard(state, action.localId, {
        view: 'rewrite',
        targetStyle: null,
        error: null,
        errorAction: null,
      })
    case 'SET_TARGET_STYLE':
      return patchCard(state, action.localId, { targetStyle: action.style })
    case 'CONFIRM_REWRITE':
      return patchCard(state, action.localId, { status: 'rewriting', error: null, errorAction: null })
    case 'REWRITE_SUCCESS': {
      // 替换内容，但**保留 localId**（否则卡片状态会错位）
      const next = patchNote(state, action.localId, (note) => ({ ...action.note, localId: note.localId }))
      return patchCard(next, action.localId, {
        view: 'display',
        status: 'idle',
        targetStyle: null,
        scoreStale: false,
        error: null,
        errorAction: null,
        // 内容变了，之前的检查结果与标题 A/B 基线都不再适用
        complianceCheck: null,
        titleVariants: null,
        originalTitle: null,
      })
    }
    case 'REWRITE_FAILURE':
      // 原文案不变；**保留 targetStyle**，让「重试」直接复用原目标风格
      return patchCard(state, action.localId, {
        view: 'display',
        status: 'idle',
        error: action.error,
        errorAction: 'rewrite',
      })
    case 'CANCEL_REWRITE':
      return patchCard(state, action.localId, {
        view: 'display',
        status: 'idle',
        targetStyle: null,
        error: null,
        errorAction: null,
      })

    /* ---------- 重新评分 ---------- */
    case 'REQUEST_SCORE':
      return patchCard(state, action.localId, { status: 'scoring', error: null, errorAction: null })
    case 'SCORE_SUCCESS': {
      const next = patchNote(state, action.localId, (note) => ({ ...note, score: action.score }))
      return patchCard(next, action.localId, {
        status: 'idle',
        scoreStale: false,
        error: null,
        errorAction: null,
      })
    }
    case 'SCORE_FAILURE':
      return patchCard(state, action.localId, {
        status: 'idle',
        error: action.error,
        errorAction: 'score',
      })

    /* ---------- 发布前检查 ---------- */
    case 'REQUEST_COMPLIANCE':
      return patchCard(state, action.localId, { status: 'checking', error: null, errorAction: null })
    case 'COMPLIANCE_SUCCESS':
      return patchCard(state, action.localId, {
        status: 'idle',
        complianceCheck: action.compliance,
        error: null,
        errorAction: null,
      })
    case 'COMPLIANCE_FAILURE':
      return patchCard(state, action.localId, {
        status: 'idle',
        error: action.error,
        errorAction: 'compliance',
      })

    /* ---------- 标题变体（A/B 对比） ---------- */
    case 'REQUEST_TITLE_VARIANTS': {
      const card = state.cards[action.localId]
      const note = findNote(state, action.localId)
      if (card === undefined || note === undefined) {
        return state
      }
      return patchCard(state, action.localId, {
        status: 'variants',
        error: null,
        errorAction: null,
        // 首次进入标题优化时记下原标题作为 A/B 基线；之后重复生成变体不改基线
        originalTitle: card.originalTitle ?? note.title,
      })
    }
    case 'TITLE_VARIANTS_SUCCESS':
      return patchCard(state, action.localId, {
        status: 'idle',
        titleVariants: action.variants,
        error: null,
        errorAction: null,
      })
    case 'TITLE_VARIANTS_FAILURE':
      return patchCard(state, action.localId, {
        status: 'idle',
        error: action.error,
        errorAction: 'variants',
      })
    case 'APPLY_TITLE_VARIANT': {
      const next = patchNote(state, action.localId, (note) => ({ ...note, title: action.title }))
      // 改标题不改变正文质量评价，但标题变了 → 评分标记为可能过时。
      // **保留**标题变体列表与原标题：A/B 各选项之间可以反复来回切换。
      return patchCard(next, action.localId, { scoreStale: true })
    }

    /* ---------- 参考文案分析 ---------- */
    case 'REFERENCE_ANALYZE_START': {
      // 开始分析说明输入已通过校验 → 顺手清掉参考文案区的行内错误
      const nextErrors = { ...state.errors }
      delete nextErrors.referenceText
      // 刻意**不清空** referenceAnalysis：分析中仍可看到上一次的结果
      return {
        ...state,
        errors: nextErrors,
        referenceAnalysisLoading: true,
        referenceAnalysisError: null,
      }
    }

    case 'REFERENCE_ANALYZE_SUCCESS':
      return {
        ...state,
        referenceAnalysisLoading: false,
        referenceAnalysisError: null,
        referenceAnalysis: action.analysis,
      }

    case 'REFERENCE_ANALYZE_ERROR':
      // 失败时保留旧分析结果，只显示错误（不清空输入，也不影响生成结果）
      return { ...state, referenceAnalysisLoading: false, referenceAnalysisError: action.message }

    /* ---------- 复制反馈 ---------- */
    case 'SET_COPY_FEEDBACK':
      return patchCard(state, action.localId, { copyFeedback: action.value })
    case 'RESET_COPY_FEEDBACK':
      return patchCard(state, action.localId, { copyFeedback: 'idle' })

    /* ---------- 资产库 ---------- */
    case 'ASSETS_LOADED':
      return { ...state, assets: action.assets, assetsLoaded: true }

    case 'ASSET_SAVED':
      // 同一篇文案重复保存 = 更新（id 由内容指纹决定），最新的排在最前
      return { ...state, assets: upsertAsset(state.assets, action.asset) }

    case 'ASSET_DELETED':
      return { ...state, assets: removeAsset(state.assets, action.assetId) }

    default:
      return state
  }
}
