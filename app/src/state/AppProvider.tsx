/**
 * 状态容器 + 操作编排（V2 工作台）。
 *
 * 层次：UI 组件 → **本文件（状态 + 流程）** → api/* → shared 校验/类型
 *
 * 业务规则全部来自 app/shared，本文件不复制任何规则：
 *   - 一次标出全部字段错误 → collectGenerateInputFieldErrors（shared）
 *   - 提交前的权威归一化   → validateGenerateInput（shared）
 *
 * 调用次数纪律：一次操作 = 一次 AI 请求（生成 / 重写 / 评分 / 发布前检查 / 标题变体各一次）。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'

import {
  collectGenerateInputFieldErrors,
  validateGenerateInput,
  validateReferenceText,
} from '../../shared/validation'
import { requestCompliance } from '../api/compliance'
import { requestGenerate } from '../api/generate'
import type { FrontendApiError } from '../api/http'
import { requestReferenceAnalyze } from '../api/referenceAnalyze'
import { requestRewrite } from '../api/rewrite'
import { requestScore } from '../api/score'
import { requestTitleVariants } from '../api/titleVariants'
import {
  EMPTY_COUNTERS,
  loadAnalytics,
  persistAnalytics,
  recordEvent,
} from '../lib/analyticsStorage'
import type { AnalyticsEvent, AnalyticsState } from '../lib/analyticsStorage'
import {
  computeAssetId,
  loadAssets,
  persistAssets,
  removeAsset,
  upsertAsset,
} from '../lib/assetsStorage'
import type { SavedAsset } from '../lib/assetsStorage'
import { buildCopyText } from '../lib/copyText'
import {
  appReducer,
  createLocalId,
  initialAppState,
  parseSellingPoints,
} from './appState'
import type { ActiveView, AppAction, AppState, FormField } from './appState'

/** 后端字段名（snake_case）→ 表单字段名，用于把行内错误落到对应输入框 */
const BACKEND_FIELD_TO_FORM_FIELD: Partial<Record<string, FormField>> = {
  product: 'product',
  selling_points: 'sellingPoints',
  styles: 'styles',
  count: 'count',
  // 参考文案超长等错误回落到参考文案输入框（generate 与 reference/analyze 共用同一字段名）
  reference_text: 'referenceText',
}

const COPY_FEEDBACK_MS = 2000

/**
 * 提交时使用的卖点：已确认的标签 + 输入框里尚未回车的内容。
 * 这样用户即使忘了按回车，也不会丢失刚写下的卖点。
 */
function effectiveSellingPoints(profile: AppState['profile']): string[] {
  return [...new Set([...profile.sellingPoints, ...parseSellingPoints(profile.sellingPointDraft)])]
}

function mapFieldErrors(
  source: Partial<Record<'product' | 'selling_points' | 'styles' | 'count', string>>,
): Partial<Record<FormField, string>> {
  const mapped: Partial<Record<FormField, string>> = {}
  for (const [backendField, message] of Object.entries(source)) {
    const formField = BACKEND_FIELD_TO_FORM_FIELD[backendField]
    if (formField !== undefined && message !== undefined) {
      mapped[formField] = message
    }
  }
  return mapped
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
  setActiveView: (view: ActiveView) => void
  submitGenerate: () => Promise<void>
  submitRewrite: (localId: string) => Promise<void>
  submitScore: (localId: string) => Promise<void>
  submitComplianceCheck: (localId: string) => Promise<void>
  submitTitleVariants: (localId: string) => Promise<void>
  /** 分析参考文案（用户主动触发；一次分析 = 一次请求） */
  submitReferenceAnalyze: () => Promise<void>
  /** 把一篇笔记存入资产库（按内容指纹去重：重复保存 = 更新） */
  saveNoteToAssets: (localId: string) => void
  /** 该笔记当前内容是否已存入资产库 */
  isNoteSaved: (localId: string) => boolean
  /** 从资产库删除一条资产 */
  deleteAsset: (assetId: string) => void
  /** 采用某个标题变体（同时计入标题采用次数） */
  applyTitleVariant: (localId: string, title: string) => void
  /** 本地内容生产统计（真实操作记录，随 localStorage 持久化） */
  analytics: AnalyticsState
  retryCard: (localId: string) => Promise<void>
  copyNote: (localId: string) => Promise<void>
  /** 批量复制选中项（未选中任何项时复制当前筛选结果） */
  copySelected: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState)
  const { profile } = state

  /* ---------- 本地生产统计（只记真实操作，不改业务 reducer 语义） ---------- */

  const [analytics, setAnalytics] = useState<AnalyticsState>(() => ({
    totals: { ...EMPTY_COUNTERS },
    daily: [],
  }))

  useEffect(() => {
    setAnalytics(loadAnalytics())
  }, [])

  /**
   * 记录一次真实操作：先算新状态、再落盘、最后更新内存。
   * 写成函数式更新，因此 `track` 的引用永远稳定，不会引起下游 callback 重建。
   */
  const track = useCallback((event: AnalyticsEvent): void => {
    setAnalytics((previous) => {
      const next = recordEvent(previous, event)
      if (!persistAnalytics(next)) {
        console.warn('[统计] 写入 localStorage 失败：本次统计仅在当前会话内有效')
      }
      return next
    })
  }, [])

  const copyTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const timers = copyTimers.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  /* ---------- 视图 ---------- */

  const setActiveView = useCallback((view: ActiveView) => {
    dispatch({ type: 'SET_ACTIVE_VIEW', view })
  }, [])

  /* ---------- 批量生成 ---------- */

  const submitGenerate = useCallback(async (): Promise<void> => {
    const sellingPoints = effectiveSellingPoints(profile)
    const candidate = {
      product: profile.product,
      selling_points: sellingPoints,
      styles: profile.styles,
      count: profile.count,
      product_category: profile.category,
      additional_info: profile.additionalInfo,
      personal_material: profile.personalMaterial,
      persona_note: profile.personaNote,
      target_users: profile.targetUsers,
      scenarios: profile.scenarios,
      goal: profile.goal,
      reference_text: profile.referenceText,
      content_directions_preference: profile.directions,
    }

    // 1. 一次标出全部字段错误；只要有一条就不发请求
    const fieldErrors = mapFieldErrors(collectGenerateInputFieldErrors(candidate))
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: 'VALIDATION_FAILED', errors: fieldErrors })
      return
    }

    // 2. 用共享的权威校验器做归一化（count 取默认值、styles 按固定顺序、可选字段去空）
    const validated = validateGenerateInput(candidate)
    if (!validated.ok) {
      const formField = validated.error.field
        ? BACKEND_FIELD_TO_FORM_FIELD[validated.error.field]
        : undefined
      dispatch({
        type: 'VALIDATION_FAILED',
        errors: formField === undefined ? {} : { [formField]: validated.error.message },
      })
      return
    }

    // 3. 请求（真实耗时会被记录，用于结果区显示）
    dispatch({ type: 'GENERATE_START' })
    const startedAt = Date.now()
    const result = await requestGenerate(validated.value)
    const durationMs = Date.now() - startedAt

    if (result.ok) {
      dispatch({
        type: 'GENERATE_SUCCESS',
        information: result.value.information,
        strategy: result.value.strategy,
        notes: result.value.notes.map((note) => ({ ...note, localId: createLocalId() })),
        durationMs,
      })
      track({ type: 'generate', notes: result.value.notes.length })
      return
    }

    // 4. 失败：后端 INVALID_INPUT 且有字段 → 落回行内；其余 → 区域级错误
    const error: FrontendApiError = result.error
    const formField = error.field === undefined ? undefined : BACKEND_FIELD_TO_FORM_FIELD[error.field]
    if (error.type === 'INVALID_INPUT' && formField !== undefined) {
      dispatch({ type: 'VALIDATION_FAILED', errors: { [formField]: error.message } })
      return
    }
    dispatch({ type: 'GENERATE_FAILURE', error, durationMs })
  }, [profile, track])

  /* ---------- 卡片级操作 ---------- */

  const submitRewrite = useCallback(
    async (localId: string): Promise<void> => {
      const card = state.cards[localId]
      const note = state.notes.find((item) => item.localId === localId)
      if (card === undefined || note === undefined || card.targetStyle === null || card.status !== 'idle') {
        return
      }

      dispatch({ type: 'CONFIRM_REWRITE', localId })
      const result = await requestRewrite({
        product: profile.product,
        selling_points: effectiveSellingPoints(profile),
        // 与 generate 用同一份素材：换风格只换写法，不丢真实细节
        personal_material: profile.personalMaterial,
        persona_note: profile.personaNote,
        target_style: card.targetStyle,
        angle_id: note.angle_id,
        current_note: {
          title: note.title,
          body: note.body,
          hashtags: note.hashtags,
          content_directions: note.content_directions,
          style: note.style,
        },
      })

      if (result.ok) {
        dispatch({ type: 'REWRITE_SUCCESS', localId, note: result.value })
        track({ type: 'rewrite' })
      } else {
        dispatch({ type: 'REWRITE_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, profile, track],
  )

  const submitScore = useCallback(
    async (localId: string): Promise<void> => {
      const card = state.cards[localId]
      const note = state.notes.find((item) => item.localId === localId)
      if (card === undefined || note === undefined || card.status !== 'idle') {
        return
      }

      dispatch({ type: 'REQUEST_SCORE', localId })
      const result = await requestScore({
        title: note.title,
        body: note.body,
        style: note.style,
        content_directions: note.content_directions,
        product: profile.product,
        selling_points: effectiveSellingPoints(profile),
      })

      if (result.ok) {
        dispatch({ type: 'SCORE_SUCCESS', localId, score: result.value })
        track({ type: 'score' })
      } else {
        dispatch({ type: 'SCORE_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, profile, track],
  )

  const submitComplianceCheck = useCallback(
    async (localId: string): Promise<void> => {
      const card = state.cards[localId]
      const note = state.notes.find((item) => item.localId === localId)
      if (card === undefined || note === undefined || card.status !== 'idle') {
        return
      }

      dispatch({ type: 'REQUEST_COMPLIANCE', localId })
      const result = await requestCompliance({
        title: note.title,
        body: note.body,
        hashtags: note.hashtags,
        product: profile.product,
        selling_points: effectiveSellingPoints(profile),
      })

      if (result.ok) {
        dispatch({ type: 'COMPLIANCE_SUCCESS', localId, compliance: result.value })
        track({ type: 'compliance' })
      } else {
        dispatch({ type: 'COMPLIANCE_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, profile, track],
  )

  const submitTitleVariants = useCallback(
    async (localId: string): Promise<void> => {
      const card = state.cards[localId]
      const note = state.notes.find((item) => item.localId === localId)
      if (card === undefined || note === undefined || card.status !== 'idle') {
        return
      }

      dispatch({ type: 'REQUEST_TITLE_VARIANTS', localId })
      // 有策略信息时把本篇的创作角度一并传入：变体会贴合「这一篇讲给谁、讲哪一件事」。
      // 重写后 angle_id 可能与当前策略不再对应，此时 find 返回 undefined → 不传（可选字段）
      const angle = state.strategy?.angles.find((item) => item.id === note.angle_id)
      const result = await requestTitleVariants({
        title: note.title,
        body: note.body,
        style: note.style,
        content_directions: note.content_directions,
        product: profile.product,
        selling_points: effectiveSellingPoints(profile),
        ...(angle === undefined ? {} : { angle }),
      })

      if (result.ok) {
        dispatch({ type: 'TITLE_VARIANTS_SUCCESS', localId, variants: result.value })
        track({ type: 'title_experiment' })
      } else {
        dispatch({ type: 'TITLE_VARIANTS_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, state.strategy, profile, track],
  )

  /** 采用标题变体：先记录次数，再改标题 */
  const applyTitleVariant = useCallback(
    (localId: string, title: string): void => {
      dispatch({ type: 'APPLY_TITLE_VARIANT', localId, title })
      track({ type: 'title_apply' })
    },
    [track],
  )

  /* ---------- 资产库（localStorage 持久化） ---------- */

  // 挂载时读取一次；读取失败会安全降级为空集（见 lib/assetsStorage）
  useEffect(() => {
    dispatch({ type: 'ASSETS_LOADED', assets: loadAssets() })
  }, [])

  /**
   * 把一篇笔记存入资产库。
   *
   * 顺序：先写盘、再同步内存镜像 —— 这样"已保存"的 UI 状态与磁盘一致。
   * 写盘失败（配额已满 / 隐私模式）不阻断操作，但会在控制台留痕。
   */
  const saveNoteToAssets = useCallback(
    (localId: string): void => {
      const note = state.notes.find((item) => item.localId === localId)
      if (note === undefined) {
        return
      }
      const card = state.cards[localId]

      const asset: SavedAsset = {
        id: computeAssetId(note.style, note.title, note.body),
        savedAt: new Date().toISOString(),
        product: {
          name: profile.product,
          category: profile.category,
          selling_points: effectiveSellingPoints(profile),
          goal: profile.goal,
        },
        note: {
          title: note.title,
          body: note.body,
          hashtags: [...note.hashtags],
          style: note.style,
          content_directions: [...note.content_directions],
          score_total: note.score.total,
          // 用户主动复查过就用复查结果，否则用生成时的自检
          compliance_risk: (card?.complianceCheck ?? note.compliance).risk_level,
          ai_ness_risk: note.ai_ness.risk_level,
        },
        title_experiment: {
          original_title: card?.originalTitle ?? null,
          variants: card?.titleVariants === null || card?.titleVariants === undefined ? [] : [...card.titleVariants],
        },
      }

      const persisted = persistAssets(upsertAsset(state.assets, asset))
      if (!persisted) {
        console.warn('[资产库] 写入 localStorage 失败：本次保存仅在当前会话内有效')
      }
      dispatch({ type: 'ASSET_SAVED', asset })
      track({ type: 'save_asset' })
    },
    [state.notes, state.cards, state.assets, profile, track],
  )

  const isNoteSaved = useCallback(
    (localId: string): boolean => {
      const note = state.notes.find((item) => item.localId === localId)
      if (note === undefined) {
        return false
      }
      const id = computeAssetId(note.style, note.title, note.body)
      return state.assets.some((asset) => asset.id === id)
    },
    [state.notes, state.assets],
  )

  const deleteAsset = useCallback(
    (assetId: string): void => {
      const persisted = persistAssets(removeAsset(state.assets, assetId))
      if (!persisted) {
        console.warn('[资产库] 删除后写入 localStorage 失败：刷新后该资产可能重新出现')
      }
      dispatch({ type: 'ASSET_DELETED', assetId })
      track({ type: 'delete_asset' })
    },
    [state.assets, track],
  )

  /* ---------- 参考文案分析（用户主动触发，与生成流程相互独立） ---------- */

  const submitReferenceAnalyze = useCallback(async (): Promise<void> => {
    // 1. 用共享校验器检查输入（与后端 validateReferenceText 同一套规则）
    const validated = validateReferenceText(profile.referenceText)
    if (!validated.ok) {
      // 复用既有的 VALIDATION_FAILED：把错误落到参考文案输入框
      dispatch({ type: 'VALIDATION_FAILED', errors: { referenceText: validated.error.message } })
      return
    }

    // 2. 一次点击 = 一次请求（不做自动分析、不做 debounce）
    dispatch({ type: 'REFERENCE_ANALYZE_START' })
    const result = await requestReferenceAnalyze({ reference_text: validated.value })

    if (result.ok) {
      dispatch({ type: 'REFERENCE_ANALYZE_SUCCESS', analysis: result.value })
      return
    }
    // 失败：保留输入、保留旧分析，只显示错误
    dispatch({ type: 'REFERENCE_ANALYZE_ERROR', message: result.error.message })
  }, [profile.referenceText])

  const retryCard = useCallback(
    async (localId: string): Promise<void> => {
      const action = state.cards[localId]?.errorAction
      if (action === 'rewrite') await submitRewrite(localId)
      else if (action === 'score') await submitScore(localId)
      else if (action === 'compliance') await submitComplianceCheck(localId)
      else if (action === 'variants') await submitTitleVariants(localId)
    },
    [state.cards, submitRewrite, submitScore, submitComplianceCheck, submitTitleVariants],
  )

  /* ---------- 复制 ---------- */

  const writeClipboard = useCallback(async (localId: string, text: string): Promise<void> => {
    let value: 'copied' | 'failed' = 'copied'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      value = 'failed'
    }
    dispatch({ type: 'SET_COPY_FEEDBACK', localId, value })
    // 只统计真正复制成功的操作（批量复制算 1 次）
    if (value === 'copied') {
      track({ type: 'copy' })
    }

    const previous = copyTimers.current.get(localId)
    if (previous !== undefined) {
      clearTimeout(previous)
    }
    copyTimers.current.set(
      localId,
      setTimeout(() => {
        copyTimers.current.delete(localId)
        dispatch({ type: 'RESET_COPY_FEEDBACK', localId })
      }, COPY_FEEDBACK_MS),
    )
  }, [track])

  const copyNote = useCallback(
    async (localId: string): Promise<void> => {
      const note = state.notes.find((item) => item.localId === localId)
      if (note === undefined) {
        return
      }
      await writeClipboard(localId, buildCopyText(note))
    },
    [state.notes, writeClipboard],
  )

  const copySelected = useCallback(async (): Promise<void> => {
    const ids = state.selected.length > 0 ? state.selected : state.notes.map((note) => note.localId)
    const targets = state.notes.filter((note) => ids.includes(note.localId))
    if (targets.length === 0) {
      return
    }
    // 批量复制：合并为一段文本，便于一次性粘出
    await writeClipboard(
      targets[0]!.localId,
      targets.map((note) => buildCopyText(note)).join('\n\n---\n\n'),
    )
  }, [state.selected, state.notes, writeClipboard])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      setActiveView,
      submitGenerate,
      submitRewrite,
      submitScore,
      submitComplianceCheck,
      submitTitleVariants,
      submitReferenceAnalyze,
      saveNoteToAssets,
      isNoteSaved,
      deleteAsset,
      applyTitleVariant,
      analytics,
      retryCard,
      copyNote,
      copySelected,
    }),
    [
      state,
      setActiveView,
      submitGenerate,
      submitRewrite,
      submitScore,
      submitComplianceCheck,
      submitTitleVariants,
      submitReferenceAnalyze,
      saveNoteToAssets,
      isNoteSaved,
      deleteAsset,
      applyTitleVariant,
      analytics,
      retryCard,
      copyNote,
      copySelected,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (value === null) {
    throw new Error('useApp 必须在 AppProvider 内使用')
  }
  return value
}
