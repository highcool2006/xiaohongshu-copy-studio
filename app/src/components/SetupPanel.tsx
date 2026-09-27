/**
 * 左栏：创作设置（V2）。
 *
 * 分区：01 产品信息 · 02 补充真实细节 · 03 目标用户 · 04 内容目标 · 05 内容方向
 *      · 06 使用场景 · 07 文案类型 · 08 文案风格 · 09 生成数量 · 参考文案
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
  COPY_TYPES,
  SCENARIO_PRESETS,
  STYLES,
  TARGET_USER_PRESETS,
} from '../../shared/enums'
import type { ContentDirection, ContentGoal, CopyType, Style } from '../../shared/enums'
import { minCountForStyles } from '../../shared/validation'
import { STYLE_GUIDE } from '../lib/styleGuide'
import { useApp } from '../state/AppProvider'
import { parseSellingPoints } from '../state/appState'
import type { FormField } from '../state/appState'
import { ReferencePanel } from './ReferencePanel'

const FIELD_ORDER: FormField[] = ['product', 'sellingPoints', 'styles', 'count']

/**
 * 小抹灵感提示：按当前填写状态给一条**可执行**的建议。
 *
 * 边界：这里说的是「你这一步可以怎么填」，不是对小抹输入的分析结论 ——
 * 生成前的任何"洞察"都只能是编的，那正是本产品禁止的事。
 * 文案里提到的规则都与 Prompt 层的真实约束一致（例如不编造经历、多风格差异更明显）。
 */
function inspireTip(profile: {
  product: string
  sellingPoints: string[]
  personalMaterial: string
  styles: string[]
  directions: string[]
}): string {
  if (profile.sellingPoints.length === 0) {
    return '先把卖点写下来。「3秒速溶」比「方便快捷」能撑起的内容多得多 —— 越具体，越好写。'
  }
  if (profile.personalMaterial.trim().length === 0) {
    return '想让它更像你自己写的，把真实经历填进「补充真实细节」。我不会替你编经历 —— 那是这类文案最容易翻车的地方。'
  }
  if (profile.styles.length < 2) {
    return '试试多选两种风格。同一批里风格差异越明显，"这几篇不像同一个模子"的感觉越强。'
  }
  if (profile.directions.length === 0) {
    return '方向可以留空，我来定；也可以在上面勾几个，那样出来的方案会更贴着你想讲的点。'
  }
  return `信息和方向都齐了。${profile.product.length > 0 ? `「${profile.product}」` : '这个产品'}现在可以出方案了。`
}

/**
 * 文案类型的一句话说明（UI 展示用，不参与生成）。
 *
 * ⚠️ 这里只讲「这篇讲什么」，不讲「怎么写」——怎么写由文案风格负责。
 *    提示词侧的体裁手册在 app/prompts/shared.ts 的 COPY_TYPE_PLAYBOOK。
 */
const COPY_TYPE_GUIDE: Record<CopyType, string> = {
  强种草推荐: '把一个核心卖点讲成想拥有的理由',
  产品测评: '结论前置，逐维度说清值不值得',
  平价好物分享: '讲同等条件下的取舍逻辑',
  避坑对比: '先说清什么样的选法会踩坑',
  使用攻略: '什么时候用、怎么用，步骤化',
}

export function SetupPanel() {
  const { state, dispatch, submitGenerate, submitReferenceAnalyze } = useApp()
  const {
    profile,
    errors,
    batch,
    referenceAnalysis,
    referenceAnalysisLoading,
    referenceAnalysisError,
  } = state
  const isLoading = batch.status === 'loading'
  /** 没有参考文案内容时不允许触发分析（按钮 disabled） */
  const hasNoReferenceText = profile.referenceText.trim().length === 0

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
      {/* 创作区标题：把「填表单」重新框成「跟搭子说今天想做什么」 */}
      <header className="setup-head">
        <p className="setup-eyebrow">小抹在等你</p>
        <h1 className="setup-title">今天想创造什么？</h1>
        <p className="setup-sub">把产品和卖点交给我，我按你选的方向，写成值得分享的样子。</p>
      </header>

      {/* 小抹灵感提示：跟着当前填写状态走，说的是「你这一步可以做什么」，不是分析结果 */}
      <div className="inspire">
        <span className="inspire-avatar" aria-hidden="true">
          抹
        </span>
        <div className="inspire-body">
          <p className="inspire-title">小抹灵感提示</p>
          <p className="inspire-text">{inspireTip(profile)}</p>
        </div>
      </div>

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

      {/* 02 补充真实细节 —— 增强可信度，不主导内容 */}
      <div className="setup-section setup-section-key">
        <div className="section-head">
          <span className="field-index">02</span>
          <h2 className="section-title">补充真实细节</h2>
          <span className="field-optional">可选</span>
        </div>

        <p className="field-hint field-hint-strong">
          填了它，文案会更具体可信；<strong>不填也能生成</strong>，内容由产品信息承担。
        </p>

        <textarea
          className="control control-area"
          rows={5}
          value={profile.personalMaterial}
          placeholder={
            // 每行控制在 16 字内：左栏宽度下中文约 19 字/行，超出会换行并被框体裁掉
            '例如：\n周三下午在工位犯困，翻出这根。\n第一口比想象中苦，我愣了一下。\n后来配美式吃，反而刚好。'
          }
          onChange={(event) => dispatch({ type: 'SET_PERSONAL_MATERIAL', value: event.target.value })}
        />

        <p className="field-hint">
          这是感官细节与具体经历的<strong>唯一来源</strong>——不填时 AI 不得编写这类内容。
          素材只用来补充细节增强可信度，正文主干仍是产品卖点。
        </p>

        <div className="field-block">
          <label className="field-label" htmlFor="persona-note">
            我是谁 <span className="field-optional">可选</span>
          </label>
          <input
            id="persona-note"
            className="control"
            type="text"
            value={profile.personaNote}
            placeholder="例如：上班族，说话比较直接"
            onChange={(event) => dispatch({ type: 'SET_PERSONA_NOTE', value: event.target.value })}
          />
          <p className="field-hint">只影响说话的语气，不构成事实。</p>
        </div>
      </div>

      {/* 03 目标用户 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">03</span>
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

      {/* 04 内容目标 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">04</span>
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

      {/* 05 内容方向 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">05</span>
          <h2 className="section-title">我的创作方向</h2>
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

      {/* 06 使用场景 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">06</span>
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

      {/* 07 文案类型（体裁，单选） */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">07</span>
          <h2 className="section-title">文案类型</h2>
          <span className="field-required">必填</span>
        </div>
        <div className="style-grid">
          {COPY_TYPES.map((type: CopyType) => {
            const selected = profile.copyType === type
            return (
              <button
                key={type}
                type="button"
                className={selected ? 'style-card style-card-selected' : 'style-card'}
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'SET_COPY_TYPE', value: type })}
              >
                <span className="style-card-name">{type}</span>
                <span className="style-card-desc">{COPY_TYPE_GUIDE[type]}</span>
              </button>
            )
          })}
        </div>
        <p className="field-hint">
          决定这篇「讲什么、不讲什么」（体裁）。与下面的「文案风格」分层——风格只决定「怎么说」。
        </p>
      </div>

      {/* 08 文案风格 */}
      <div className="setup-section">
        <div className="section-head">
          <span className="field-index">08</span>
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
                <span className="style-card-desc">{STYLE_GUIDE[style].summary}</span>
              </button>
            )
          })}
        </div>
        {errors.styles && <p className="field-error">{errors.styles}</p>}
      </div>

      {/* 09 生成数量 + 主按钮 */}
      <div className="setup-section setup-section-last">
        <div className="section-head">
          <span className="field-index">09</span>
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
          <span className="cta-label">{isLoading ? '正在生成…' : '生成爆款方案'}</span>
          {!isLoading && <span className="cta-sub">出 {profile.count} 套方案</span>}
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
              className={
                errors.referenceText ? 'control control-area control-mt control-invalid' : 'control control-area control-mt'
              }
              rows={5}
              value={profile.referenceText}
              placeholder="粘贴参考文案原文……"
              onChange={(event) => {
                dispatch({ type: 'SET_REFERENCE_TEXT', value: event.target.value })
                dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'referenceText' })
              }}
            />
            {errors.referenceText && <p className="field-error">{errors.referenceText}</p>}

            {/* 分析入口：用户主动触发，一次点击 = 一次请求 */}
            <div className="ref-actions">
              <button
                type="button"
                className="card-button"
                disabled={hasNoReferenceText || referenceAnalysisLoading}
                onClick={() => void submitReferenceAnalyze()}
              >
                {referenceAnalysisLoading ? '分析中…' : '分析这篇参考文案'}
              </button>
            </div>

            {referenceAnalysisError !== null && (
              <p className="ref-error" role="alert">
                {referenceAnalysisError}
              </p>
            )}

            {referenceAnalysis !== null && <ReferencePanel analysis={referenceAnalysis} />}
          </>
        )}
      </div>
    </section>
  )
}
