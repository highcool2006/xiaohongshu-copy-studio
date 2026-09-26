/**
 * 左栏：创作设置（V2）。
 *
 * 分区：01 产品信息 · 02 目标用户 · 03 内容目标 · 04 内容方向 · 05 文案风格 · 06 生成 · 07 参考文案
 *
 * 设计目标：用户进入后 10～20 秒内能明白「填什么 → 选什么 → 点哪里」。
 * 高级项（补充信息、参考文案）默认折叠，控制左侧密度。
 * 行为：校验、派发动作、首错聚焦。
 */

import { useEffect, useRef, useState } from 'react'

import { COUNT_MAX } from '../../shared/constants'
import {
  CONTENT_DIRECTIONS,
  CONTENT_GOALS,
  SCENARIO_PRESETS,
  STYLES,
  TARGET_USER_PRESETS,
} from '../../shared/enums'
import type { ContentDirection, ContentGoal, Style } from '../../shared/enums'
import { minCountForStyles } from '../../shared/validation'
import { useApp } from '../state/AppProvider'
import { parseSellingPoints } from '../state/appState'
import type { FormField } from '../state/appState'

const FIELD_ORDER: FormField[] = ['product', 'sellingPoints', 'styles', 'count']

/** 风格的极简说明（Record<Style, string> —— 枚举变动会编译失败） */
const STYLE_DESCRIPTIONS: Record<Style, string> = {
  亲切分享: '像朋友推荐',
  专业测评: '理性分析',
  搞笑段子: '轻松有梗',
  干货攻略: '步骤清晰',
  情绪共鸣: '先讲情绪',
  清单种草: '条目清晰',
}

export function SetupPanel() {
  const { state, dispatch, submitGenerate } = useApp()
  const { profile, errors, batch } = state
  const isLoading = batch.status === 'loading'

  const [showExtra, setShowExtra] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [customUser, setCustomUser] = useState('')
  const [customScenario, setCustomScenario] = useState('')

  const productRef = useRef<HTMLInputElement>(null)
  const sellingInputRef = useRef<HTMLInputElement>(null)
  const countRef = useRef<HTMLButtonElement>(null)
  const firstStyleRef = useRef<HTMLButtonElement>(null)

  const minCount = minCountForStyles(profile.styles.length)

  useEffect(() => {
    const firstErrorField = FIELD_ORDER.find((field) => errors[field] !== undefined)
    if (firstErrorField === undefined) return
    const target =
      firstErrorField === 'product'
        ? productRef.current
        : firstErrorField === 'sellingPoints'
          ? sellingInputRef.current
          : firstErrorField === 'count'
            ? countRef.current
            : firstStyleRef.current
    target?.focus()
  }, [errors])

  const commitSellingPoints = (): void => {
    const values = parseSellingPoints(profile.sellingPointDraft)
    if (values.length > 0) {
      dispatch({ type: 'ADD_SELLING_POINTS', values })
      dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'sellingPoints' })
    }
  }

  return (
    <section className="setup" aria-label="创作设置">
      {/* 01 产品信息 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">01</span>
          <h2 className="section-title">产品信息</h2>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="product">
            产品 / 主题 <span className="field-required">必填</span>
          </label>
          <input
            id="product"
            ref={productRef}
            className={errors.product ? 'control control-invalid' : 'control'}
            type="text"
            value={profile.product}
            placeholder="例如：抹茶巧克力棒"
            onChange={(event) => {
              dispatch({ type: 'SET_PRODUCT', value: event.target.value })
              dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'product' })
            }}
          />
          {errors.product && <p className="field-error">{errors.product}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="category">
            产品类别 <span className="field-optional">可选</span>
          </label>
          <input
            id="category"
            className="control"
            type="text"
            value={profile.category}
            placeholder="例如：食品 / 零食"
            onChange={(event) => dispatch({ type: 'SET_CATEGORY', value: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="selling-point-input">
            核心卖点 <span className="field-required">必填</span>
          </label>
          <div className="tag-input">
            {profile.sellingPoints.map((point) => (
              <span key={point} className="tag-pill">
                {point}
                <button
                  type="button"
                  className="tag-remove"
                  aria-label={`删除卖点 ${point}`}
                  onClick={() => dispatch({ type: 'REMOVE_SELLING_POINT', value: point })}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="selling-point-input"
              ref={sellingInputRef}
              className="tag-field"
              type="text"
              value={profile.sellingPointDraft}
              placeholder={profile.sellingPoints.length === 0 ? '输入卖点后按回车，可一次写多个' : '继续添加'}
              onChange={(event) => dispatch({ type: 'SET_SELLING_POINT_DRAFT', value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitSellingPoints()
                }
              }}
              onBlur={commitSellingPoints}
            />
          </div>
          <p className="field-hint">
            支持一次输入多个（用换行或「、」分隔），程序会自动整理为独立卖点
          </p>
          {errors.sellingPoints && <p className="field-error">{errors.sellingPoints}</p>}
        </div>

        <button type="button" className="link-button" onClick={() => setShowExtra((value) => !value)}>
          {showExtra ? '收起补充信息' : '补充规格 / 价格 / 使用条件等（可选）'}
        </button>
        {showExtra && (
          <textarea
            className="control control-area control-mt"
            rows={3}
            value={profile.additionalInfo}
            placeholder="例如：独立包装、单根 20g、常温保存"
            onChange={(event) => dispatch({ type: 'SET_ADDITIONAL_INFO', value: event.target.value })}
          />
        )}
      </div>

      {/* 02 目标用户 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">02</span>
          <h2 className="section-title">目标用户</h2>
        </div>
        <div className="chip-group">
          {TARGET_USER_PRESETS.map((user) => {
            const selected = profile.targetUsers.includes(user)
            return (
              <button
                key={user}
                type="button"
                className={selected ? 'chip chip-selectable chip-on' : 'chip chip-selectable'}
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'TOGGLE_TARGET_USER', value: user })}
              >
                {user}
              </button>
            )
          })}
          {profile.targetUsers
            .filter((user) => !(TARGET_USER_PRESETS as readonly string[]).includes(user))
            .map((user) => (
              <button
                key={user}
                type="button"
                className="chip chip-selectable chip-on"
                onClick={() => dispatch({ type: 'TOGGLE_TARGET_USER', value: user })}
              >
                {user}
              </button>
            ))}
        </div>
        <div className="inline-add">
          <input
            className="control control-compact"
            type="text"
            value={customUser}
            placeholder="自定义人群"
            onChange={(event) => setCustomUser(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customUser.trim().length > 0) {
                event.preventDefault()
                dispatch({ type: 'TOGGLE_TARGET_USER', value: customUser.trim() })
                setCustomUser('')
              }
            }}
          />
        </div>
        <p className="field-hint">不选也可以：AI 会根据产品信息给出推测的人群假设</p>
      </div>

      {/* 03 内容目标 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">03</span>
          <h2 className="section-title">内容目标</h2>
        </div>
        <div className="chip-group">
          {CONTENT_GOALS.map((goal: ContentGoal) => (
            <button
              key={goal}
              type="button"
              className={profile.goal === goal ? 'chip chip-selectable chip-on' : 'chip chip-selectable'}
              aria-pressed={profile.goal === goal}
              onClick={() => dispatch({ type: 'SET_GOAL', value: goal })}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      {/* 04 内容方向 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">04</span>
          <h2 className="section-title">内容方向</h2>
        </div>
        <div className="chip-group">
          {CONTENT_DIRECTIONS.map((direction: ContentDirection) => {
            const selected = profile.directions.includes(direction)
            return (
              <button
                key={direction}
                type="button"
                className={selected ? 'chip chip-selectable chip-on' : 'chip chip-selectable'}
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'TOGGLE_DIRECTION', direction })}
              >
                {direction}
              </button>
            )
          })}
        </div>
        <p className="field-hint">不选则由 AI 根据产品自行规划</p>
      </div>

      {/* 05 使用场景 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">05</span>
          <h2 className="section-title">使用场景</h2>
        </div>
        <div className="chip-group">
          {SCENARIO_PRESETS.map((scenario) => {
            const selected = profile.scenarios.includes(scenario)
            return (
              <button
                key={scenario}
                type="button"
                className={selected ? 'chip chip-selectable chip-on' : 'chip chip-selectable'}
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'TOGGLE_SCENARIO', value: scenario })}
              >
                {scenario}
              </button>
            )
          })}
          {profile.scenarios
            .filter((scenario) => !(SCENARIO_PRESETS as readonly string[]).includes(scenario))
            .map((scenario) => (
              <button
                key={scenario}
                type="button"
                className="chip chip-selectable chip-on"
                onClick={() => dispatch({ type: 'TOGGLE_SCENARIO', value: scenario })}
              >
                {scenario}
              </button>
            ))}
        </div>
        <div className="inline-add">
          <input
            className="control control-compact"
            type="text"
            value={customScenario}
            placeholder="自定义场景"
            onChange={(event) => setCustomScenario(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customScenario.trim().length > 0) {
                event.preventDefault()
                dispatch({ type: 'TOGGLE_SCENARIO', value: customScenario.trim() })
                setCustomScenario('')
              }
            }}
          />
        </div>
      </div>

      {/* 06 文案风格 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">06</span>
          <h2 className="section-title">文案风格</h2>
          <span className="field-required">必填</span>
        </div>
        <div className="style-grid">
          {STYLES.map((style: Style, index) => {
            const selected = profile.styles.includes(style)
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

      {/* 07 生成数量 + 主按钮 */}
      <div className="setup-section setup-section-last">
        <div className="section-head">
          <span className="field-index">07</span>
          <h2 className="section-title">生成数量</h2>
        </div>
        <div className="stepper">
          <button
            type="button"
            className="stepper-button"
            aria-label="减少一篇"
            disabled={profile.count <= minCount}
            onClick={() => {
              dispatch({ type: 'SET_COUNT', value: Math.max(minCount, profile.count - 1) })
              dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'count' })
            }}
          >
            −
          </button>
          <span className="stepper-value" aria-live="polite">
            {profile.count}
            <span className="stepper-unit">篇</span>
          </span>
          <button
            ref={countRef}
            type="button"
            className="stepper-button"
            aria-label="增加一篇"
            disabled={profile.count >= COUNT_MAX}
            onClick={() => {
              dispatch({ type: 'SET_COUNT', value: Math.min(COUNT_MAX, profile.count + 1) })
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
            {profile.styles.length > 5
              ? `已选 ${profile.styles.length} 种风格，至少 ${minCount} 篇 · 最多 ${COUNT_MAX} 篇`
              : `可选 ${minCount}～${COUNT_MAX} 篇`}
          </p>
        )}

        <button
          type="button"
          className="cta"
          disabled={isLoading}
          onClick={() => {
            void submitGenerate()
          }}
        >
          <span className="cta-label">{isLoading ? '正在生成…' : '生成文案'}</span>
          {!isLoading && <span className="cta-sub">生成 {profile.count} 篇</span>}
        </button>
      </div>

      {/* 08 参考文案 */}
      <div className="setup-section setup-section-last">
        <button type="button" className="link-button" onClick={() => setShowReference((value) => !value)}>
          {showReference ? '收起参考文案' : '参考文案（可选）'}
        </button>
        {showReference && (
          <>
            <p className="field-hint">
              粘贴一篇你喜欢的小红书文案。AI 只分析它的**结构与节奏等方法**，
              <strong>不会复制其中的句子、故事或具体事实</strong>。
            </p>
            <textarea
              className="control control-area control-mt"
              rows={5}
              value={profile.referenceText}
              placeholder="粘贴参考文案原文……"
              onChange={(event) => dispatch({ type: 'SET_REFERENCE_TEXT', value: event.target.value })}
            />
          </>
        )}
      </div>
    </section>
  )
}
