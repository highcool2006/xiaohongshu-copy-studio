/**
 * 前端状态：类型 + reducer（纯函数，不依赖 React）。
 *
 * 依据 docs/技术架构决策.md 第 11、12 节（D5：useReducer + Context）。
 *   - 派生数据（篇数、风格分布）不存进 state，由界面按需计算
 *   - 内容（notes）与卡片交互状态（cards）**分开存**：草稿/编辑态的生命周期与内容不同，
 *     取消编辑时只需重置卡片状态，不必碰内容
 */

import { COUNT_DEFAULT } from '../../shared/constants'
import { sortStyles } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { minCountForStyles } from '../../shared/validation'
import type { Information, Note, Score } from '../../shared/types'
import type { FrontendApiError } from '../api/http'

/** 界面侧的 Note：契约 Note + 前端分配的 localId（localId 绝不进入 AI 契约） */
export interface NoteWithId extends Note {
  localId: string
}

/** 表单字段名（与文档 11.2 的 errors 结构一致） */
export type FormField = 'product' | 'sellingPoints' | 'styles' | 'count'

/** 卡片形态：浏览 / 就地编辑 / 换风格重写（选择目标风格中） */
export type CardView = 'display' | 'edit' | 'rewrite'

/** 卡片当前正在进行的操作 */
export type CardStatus = 'idle' | 'rewriting' | 'scoring'

export interface CardState {
  view: CardView
  /** 编辑草稿（仅 edit 态存在；与正文分离，取消时可原样丢弃） */
  draft: { title: string; body: string } | null
  /** 重写态选中的目标风格；重写失败后**保留**，供「重试」直接复用 */
  targetStyle: Style | null
  status: CardStatus
  /** 编辑保存后置 true；重写成功 / 重新评分成功后置 false */
  scoreStale: boolean
  /** 卡片级错误（重写失败 / 评分失败） */
  error: FrontendApiError | null
  /** 出错的操作类型，决定「重试」该重跑哪一个 */
  errorAction: 'rewrite' | 'score' | null
  /** 复制按钮的临时反馈 */
  copyFeedback: 'idle' | 'copied' | 'failed'
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
  }
}

export interface AppState {
  form: {
    product: string
    /** 卖点输入框的原始文本（每行一个卖点）；拆分后的数组是它的派生值，不单独存 */
    sellingPointDraft: string
    styles: Style[]
    count: number
  }
  errors: Partial<Record<FormField, string>>
  batch: {
    status: 'idle' | 'loading' | 'error'
    error: FrontendApiError | null
  }
  /** 本次生成的信息充分度提示（辅助字段，非错误） */
  information: Information | null
  notes: NoteWithId[]
  /** 卡片级状态，以 localId 为键 */
  cards: Record<string, CardState>
}

export const initialAppState: AppState = {
  form: {
    product: '',
    sellingPointDraft: '',
    styles: [],
    count: COUNT_DEFAULT,
  },
  errors: {},
  batch: { status: 'idle', error: null },
  information: null,
  notes: [],
  cards: {},
}

export type AppAction =
  // 表单与校验
  | { type: 'SET_PRODUCT'; value: string }
  | { type: 'SET_SELLING_POINT_DRAFT'; value: string }
  | { type: 'TOGGLE_STYLE'; style: Style }
  | { type: 'SET_COUNT'; value: number }
  | { type: 'VALIDATION_FAILED'; errors: Partial<Record<FormField, string>> }
  | { type: 'CLEAR_FIELD_ERROR'; field: FormField }
  // 批量生成
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; information: Information; notes: NoteWithId[] }
  | { type: 'GENERATE_FAILURE'; error: FrontendApiError }
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
  // 复制反馈
  | { type: 'SET_COPY_FEEDBACK'; localId: string; value: 'copied' | 'failed' }
  | { type: 'RESET_COPY_FEEDBACK'; localId: string }

let localIdCounter = 0

/** 生成卡片身份：仅用于前端挂载状态，不进入任何 API 契约 */
export function createLocalId(): string {
  localIdCounter += 1
  return `note-${localIdCounter}`
}

/** 卖点文本 → 独立卖点数组（忽略空行与首尾空白）。纯派生，不单独存 state。 */
export function parseSellingPoints(draft: string): string[] {
  return draft
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
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
    /* ---------- 表单 ---------- */
    case 'SET_PRODUCT':
      return { ...state, form: { ...state.form, product: action.value } }

    case 'SET_SELLING_POINT_DRAFT':
      return { ...state, form: { ...state.form, sellingPointDraft: action.value } }

    case 'TOGGLE_STYLE': {
      const selected = state.form.styles.includes(action.style)
      const nextStyles = selected
        ? state.form.styles.filter((style) => style !== action.style)
        : sortStyles([...state.form.styles, action.style]) // 按固定枚举顺序存放
      // 选中风格变化后，篇数不能低于「每个选中风格至少 1 篇」的动态下限
      const nextCount = Math.max(state.form.count, minCountForStyles(nextStyles.length))
      return { ...state, form: { ...state.form, styles: nextStyles, count: nextCount } }
    }

    case 'SET_COUNT':
      return { ...state, form: { ...state.form, count: action.value } }

    case 'VALIDATION_FAILED':
      // 校验失败不发生请求；同时把 batch 复位（用于「后端 INVALID_INPUT」的情况）
      return { ...state, errors: action.errors, batch: { status: 'idle', error: null } }

    case 'CLEAR_FIELD_ERROR': {
      if (state.errors[action.field] === undefined) {
        return state
      }
      const next = { ...state.errors }
      delete next[action.field]
      return { ...state, errors: next }
    }

    /* ---------- 批量生成（区域级） ---------- */
    case 'GENERATE_START':
      // 刻意**不清空** notes / cards / information：生成失败时旧结果仍可恢复显示
      return { ...state, errors: {}, batch: { status: 'loading', error: null } }

    case 'GENERATE_SUCCESS':
      return {
        ...state,
        batch: { status: 'idle', error: null },
        information: action.information,
        notes: action.notes,
        // 新一轮结果是全新集合 → 重置所有卡片状态
        cards: Object.fromEntries(action.notes.map((note) => [note.localId, createCardState()])),
      }

    case 'GENERATE_FAILURE':
      // 同样保留旧 notes / cards
      return { ...state, batch: { status: 'error', error: action.error } }

    /* ---------- 就地编辑（本地，不调 AI） ---------- */
    case 'BEGIN_EDIT': {
      const note = findNote(state, action.localId)
      if (note === undefined) {
        return state
      }
      return patchCard(state, action.localId, {
        view: 'edit',
        draft: { title: note.title, body: note.body }, // 草稿与正文分离，取消时可原样丢弃
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
      return patchCard(state, action.localId, {
        status: 'rewriting',
        error: null,
        errorAction: null,
      })

    case 'REWRITE_SUCCESS': {
      // 替换内容，但**保留 localId**（否则卡片状态会错位）
      const next = patchNote(state, action.localId, (note) => ({ ...action.note, localId: note.localId }))
      return patchCard(next, action.localId, {
        view: 'display',
        status: 'idle',
        targetStyle: null,
        scoreStale: false, // 新文案带新评分
        error: null,
        errorAction: null,
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
      return patchCard(state, action.localId, {
        status: 'scoring',
        error: null,
        errorAction: null,
      })

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
      // 原有评分不清空
      return patchCard(state, action.localId, {
        status: 'idle',
        error: action.error,
        errorAction: 'score',
      })

    /* ---------- 复制反馈 ---------- */
    case 'SET_COPY_FEEDBACK':
      return patchCard(state, action.localId, { copyFeedback: action.value })

    case 'RESET_COPY_FEEDBACK':
      return patchCard(state, action.localId, { copyFeedback: 'idle' })

    default:
      return state
  }
}
