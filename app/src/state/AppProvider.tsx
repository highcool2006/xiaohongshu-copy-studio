/**
 * 状态容器 + 操作编排。
 *
 * 层次：UI 组件 → **本文件（状态 + 流程）** → api/* → shared 校验/类型
 *
 * 业务规则全部来自 app/shared，本文件不复制任何规则：
 *   - 一次标出全部字段错误 → collectGenerateInputFieldErrors（shared）
 *   - 提交前的权威归一化   → validateGenerateInput（shared）
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Dispatch, ReactNode } from 'react'

import {
  collectGenerateInputFieldErrors,
  validateGenerateInput,
} from '../../shared/validation'
import { requestGenerate } from '../api/generate'
import type { FrontendApiError } from '../api/http'
import { requestRewrite } from '../api/rewrite'
import { requestScore } from '../api/score'
import { buildCopyText } from '../lib/copyText'
import {
  appReducer,
  createLocalId,
  initialAppState,
  parseSellingPoints,
} from './appState'
import type { AppAction, AppState, FormField } from './appState'

/** 后端字段名（snake_case）→ 表单字段名，用于把行内错误落到对应输入框 */
const BACKEND_FIELD_TO_FORM_FIELD: Partial<Record<string, FormField>> = {
  product: 'product',
  selling_points: 'sellingPoints',
  styles: 'styles',
  count: 'count',
}

/** 复制反馈的复位延时（毫秒） */
const COPY_FEEDBACK_MS = 2000

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
  /** 批量生成 */
  submitGenerate: () => Promise<void>
  /** 对某张卡片执行换风格重写（重试时复用已保存的 targetStyle） */
  submitRewrite: (localId: string) => Promise<void>
  /** 对某张卡片重新评分 */
  submitScore: (localId: string) => Promise<void>
  /** 按卡片上记录的错误来源，重跑对应操作 */
  retryCard: (localId: string) => Promise<void>
  /** 复制该卡片的当前内容 */
  copyNote: (localId: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState)
  const { product, sellingPointDraft, styles, count } = state.form

  /** 复制反馈的定时器；卸载时清理，避免残留回调 */
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

  /* ---------- 批量生成 ---------- */

  const submitGenerate = useCallback(async (): Promise<void> => {
    const candidate = {
      product,
      selling_points: parseSellingPoints(sellingPointDraft),
      styles,
      count,
    }

    // 1. 一次标出全部字段错误；只要有一条就不发请求
    const fieldErrors = mapFieldErrors(collectGenerateInputFieldErrors(candidate))
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: 'VALIDATION_FAILED', errors: fieldErrors })
      return
    }

    // 2. 用共享的权威校验器做归一化（count 取默认值、styles 按固定顺序）
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

    // 3. 请求
    dispatch({ type: 'GENERATE_START' })
    const result = await requestGenerate(validated.value)

    if (result.ok) {
      dispatch({
        type: 'GENERATE_SUCCESS',
        information: result.value.information,
        notes: result.value.notes.map((note) => ({ ...note, localId: createLocalId() })),
      })
      return
    }

    // 4. 失败：后端 INVALID_INPUT 且有字段 → 落回行内；其余 → 区域级错误
    const error: FrontendApiError = result.error
    const formField = error.field === undefined ? undefined : BACKEND_FIELD_TO_FORM_FIELD[error.field]
    if (error.type === 'INVALID_INPUT' && formField !== undefined) {
      dispatch({ type: 'VALIDATION_FAILED', errors: { [formField]: error.message } })
      return
    }
    dispatch({ type: 'GENERATE_FAILURE', error })
  }, [product, sellingPointDraft, styles, count])

  /* ---------- 单篇换风格重写 ---------- */

  const submitRewrite = useCallback(
    async (localId: string): Promise<void> => {
      const card = state.cards[localId]
      const note = state.notes.find((item) => item.localId === localId)
      if (card === undefined || note === undefined || card.targetStyle === null) {
        return
      }
      if (card.status !== 'idle') {
        return
      }

      dispatch({ type: 'CONFIRM_REWRITE', localId })
      const result = await requestRewrite({
        product,
        selling_points: parseSellingPoints(sellingPointDraft),
        target_style: card.targetStyle,
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
      } else {
        dispatch({ type: 'REWRITE_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, product, sellingPointDraft],
  )

  /* ---------- 重新评分 ---------- */

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
        product,
        selling_points: parseSellingPoints(sellingPointDraft),
      })

      if (result.ok) {
        dispatch({ type: 'SCORE_SUCCESS', localId, score: result.value })
      } else {
        dispatch({ type: 'SCORE_FAILURE', localId, error: result.error })
      }
    },
    [state.cards, state.notes, product, sellingPointDraft],
  )

  /* ---------- 卡片级重试 ---------- */

  const retryCard = useCallback(
    async (localId: string): Promise<void> => {
      const action = state.cards[localId]?.errorAction
      if (action === 'rewrite') {
        await submitRewrite(localId)
      } else if (action === 'score') {
        await submitScore(localId)
      }
    },
    [state.cards, submitRewrite, submitScore],
  )

  /* ---------- 复制 ---------- */

  const copyNote = useCallback(
    async (localId: string): Promise<void> => {
      const note = state.notes.find((item) => item.localId === localId)
      if (note === undefined) {
        return
      }

      let value: 'copied' | 'failed' = 'copied'
      try {
        await navigator.clipboard.writeText(buildCopyText(note))
      } catch {
        value = 'failed'
      }
      dispatch({ type: 'SET_COPY_FEEDBACK', localId, value })

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
    },
    [state.notes],
  )

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, submitGenerate, submitRewrite, submitScore, retryCard, copyNote }),
    [state, submitGenerate, submitRewrite, submitScore, retryCard, copyNote],
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
