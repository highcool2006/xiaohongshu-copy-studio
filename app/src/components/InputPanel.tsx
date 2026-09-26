/**
 * 左栏：创作设置。
 *
 * 视觉上刻意不像传统 HTML 表单，而是四段编号式设置：
 *   01 产品 / 主题 · 02 卖点 · 03 文案风格 · 04 生成数量 → 主按钮
 *
 * 行为与上一版一致（校验、派发动作、首错聚焦都在 state / api 层），
 * 本文件只负责呈现与派发。
 */

import { useEffect, useRef } from 'react'

import { COUNT_MAX } from '../../shared/constants'
import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { useApp } from '../state/AppProvider'
import type { FormField } from '../state/appState'
import { minCountForStyles } from '../../shared/validation'

/** 错误焦点优先级：按表单自上而下 */
const FIELD_ORDER: FormField[] = ['product', 'sellingPoints', 'styles', 'count']

/**
 * 风格的极简说明。
 * 类型为 Record<Style, string> —— 枚举有变动时这里会编译失败，不会悄悄漏掉。
 */
const STYLE_DESCRIPTIONS: Record<Style, string> = {
  亲切分享: '像朋友一样推荐',
  专业测评: '理性分析产品',
  搞笑段子: '轻松、有梗',
  干货攻略: '步骤清晰实用',
  情绪共鸣: '先讲情绪，再说产品',
  清单种草: '条目清晰，一眼看懂',
}

export function InputPanel() {
  const { state, dispatch, submitGenerate } = useApp()
  const { form, errors, batch } = state
  const isLoading = batch.status === 'loading'
  /** 篇数下限随选中风格数变化（每个选中风格至少 1 篇） */
  const minCount = minCountForStyles(form.styles.length)

  const productRef = useRef<HTMLInputElement>(null)
  const sellingPointsRef = useRef<HTMLTextAreaElement>(null)
  const countRef = useRef<HTMLButtonElement>(null)
  const firstStyleRef = useRef<HTMLButtonElement>(null)

  // 校验失败后把焦点移到第一个出错的字段
  useEffect(() => {
    const firstErrorField = FIELD_ORDER.find((field) => errors[field] !== undefined)
    if (firstErrorField === undefined) {
      return
    }
    const target =
      firstErrorField === 'product'
        ? productRef.current
        : firstErrorField === 'sellingPoints'
          ? sellingPointsRef.current
          : firstErrorField === 'count'
            ? countRef.current
            : firstStyleRef.current
    target?.focus()
  }, [errors])

  const sellingPointCount = form.sellingPointDraft
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length

  return (
    <section className="setup" aria-label="创作设置">
      <h2 className="setup-title">创作设置</h2>

      {/* 01 产品 / 主题 */}
      <div className="field">
        <div className="field-head">
          <span className="field-index">01</span>
          <label className="field-label" htmlFor="product">
            产品 / 主题
          </label>
          <span className="field-required">必填</span>
        </div>
        <input
          id="product"
          ref={productRef}
          className={errors.product ? 'control control-invalid' : 'control'}
          type="text"
          value={form.product}
          placeholder="例如：山野冷萃冻干咖啡粉"
          aria-invalid={errors.product !== undefined}
          onChange={(event) => {
            dispatch({ type: 'SET_PRODUCT', value: event.target.value })
            dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'product' })
          }}
        />
        {errors.product && <p className="field-error">{errors.product}</p>}
      </div>

      {/* 02 卖点 */}
      <div className="field">
        <div className="field-head">
          <span className="field-index">02</span>
          <label className="field-label" htmlFor="selling-points">
            卖点
          </label>
          <span className="field-required">必填</span>
        </div>
        <textarea
          id="selling-points"
          ref={sellingPointsRef}
          className={errors.sellingPoints ? 'control control-area control-invalid' : 'control control-area'}
          rows={4}
          value={form.sellingPointDraft}
          placeholder={'每行一个卖点，例如：\n0糖0脂\n冷水速溶'}
          aria-invalid={errors.sellingPoints !== undefined}
          onChange={(event) => {
            dispatch({ type: 'SET_SELLING_POINT_DRAFT', value: event.target.value })
            dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'sellingPoints' })
          }}
        />
        <div className="field-foot">
          <span className="field-hint">
            {sellingPointCount > 0 ? `已识别 ${sellingPointCount} 个卖点` : '每行一个卖点'}
          </span>
          {errors.sellingPoints && <span className="field-error field-error-inline">{errors.sellingPoints}</span>}
        </div>
      </div>

      {/* 03 文案风格 */}
      <div className="field">
        <div className="field-head">
          <span className="field-index">03</span>
          <span className="field-label">文案风格</span>
          <span className="field-required">必填</span>
        </div>
        <div className="style-grid" role="group" aria-label="文案风格（可多选）">
          {STYLES.map((style: Style, index) => {
            const selected = form.styles.includes(style)
            return (
              <button
                key={style}
                ref={index === 0 ? firstStyleRef : undefined}
                type="button"
                className={selected ? 'style-card style-card-selected' : 'style-card'}
                aria-pressed={selected}
                onClick={() => {
                  dispatch({ type: 'TOGGLE_STYLE', style })
                  dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'styles' })
                }}
              >
                <span className="style-card-name">{style}</span>
                <span className="style-card-desc">{STYLE_DESCRIPTIONS[style]}</span>
              </button>
            )
          })}
        </div>
        {errors.styles && <p className="field-error">{errors.styles}</p>}
      </div>

      {/* 04 生成数量 */}
      <div className="field">
        <div className="field-head">
          <span className="field-index">04</span>
          <span className="field-label">生成数量</span>
        </div>
        <div className="stepper">
          <button
            type="button"
            className="stepper-button"
            aria-label="减少一篇"
            disabled={form.count <= minCount}
            onClick={() => {
              dispatch({ type: 'SET_COUNT', value: Math.max(minCount, form.count - 1) })
              dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'count' })
            }}
          >
            −
          </button>
          <span className="stepper-value" aria-live="polite">
            {form.count}
            <span className="stepper-unit">篇</span>
          </span>
          <button
            ref={countRef}
            type="button"
            className="stepper-button"
            aria-label="增加一篇"
            disabled={form.count >= COUNT_MAX}
            onClick={() => {
              dispatch({ type: 'SET_COUNT', value: Math.min(COUNT_MAX, form.count + 1) })
              dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'count' })
            }}
          >
            +
          </button>
        </div>
        {errors.count ? (
          <p className="field-error">{errors.count}</p>
        ) : (
          <p className="field-hint">
            {form.styles.length > 5
              ? `已选 ${form.styles.length} 种风格，至少 ${minCount} 篇 · 最多 ${COUNT_MAX} 篇`
              : `可选 ${minCount}～${COUNT_MAX} 篇`}
          </p>
        )}
      </div>

      {/* 主按钮：左侧面板的视觉终点 */}
      <button
        type="button"
        className="cta"
        disabled={isLoading}
        onClick={() => {
          void submitGenerate()
        }}
      >
        <span className="cta-label">{isLoading ? '正在生成…' : '生成文案'}</span>
        {!isLoading && <span className="cta-sub">生成 {form.count} 篇</span>}
      </button>
    </section>
  )
}
