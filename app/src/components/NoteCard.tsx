/**
 * 爆款方案卡片（V2 核心组件）。
 *
 * 展示层级（本组件最重要的约定）：
 *   概览层  方案序号 · 风格 · 爆款指数（数字 + 进度条）→ 推荐标题
 *           → 内容方向 / 目标用户 / 本篇讲的是 → 风险标记 → 操作
 *   详情层  「查看完整笔记」展开：正文 + 话题标签 + 全部分析（NoteAnalysis）
 *
 * 为什么把正文收进详情层：卡片在这一层要回答的是「这套方案值不值得展开看」，
 * 而不是「正文写了什么」。六张卡同时铺开正文时，用户第一眼看到的是文字墙，
 * 真正用于决策的信息（指数、方向、人群、风险）反而被淹没。
 *
 * ⚠️ 卡片之间的差异化只能来自**内容与排版**。任务书 4.1 把「五张结果卡五种配色」
 *    列为视觉一票否决项，因此**不得**按风格或方案给卡片上不同颜色。
 *
 * 三种形态：display / edit（就地编辑，不调 AI）/ rewrite（选目标风格，确认后才调 AI）。
 * 标题优化、发布前检查、重新评分都是**用户主动触发**的一次 AI 调用。
 */

import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { RISK_LABELS } from '../lib/riskLabels'
import { variantSlotLabel } from '../lib/titleExperiment'
import { useApp } from '../state/AppProvider'
import { createCardState } from '../state/appState'
import type { NoteWithId } from '../state/appState'
import { NoteAnalysis } from './NoteAnalysis'

/** 当前生效的那一项高亮（标题可由用户在原稿与各变体之间切换） */
function variantRowClass(active: boolean): string {
  return active ? 'variant variant-active' : 'variant'
}

export function NoteCard({ note, index }: { note: NoteWithId; index: number }) {
  const {
    state,
    dispatch,
    submitRewrite,
    submitComplianceCheck,
    submitTitleVariants,
    saveNoteToAssets,
    isNoteSaved,
    applyTitleVariant,
    retryCard,
    copyNote,
  } = useApp()

  const card = state.cards[note.localId] ?? createCardState()
  const angle = state.strategy?.angles.find((item) => item.id === note.angle_id)
  const isEditing = card.view === 'edit'
  const isChoosingStyle = card.view === 'rewrite'
  const busy = card.status !== 'idle'
  const selected = state.selected.includes(note.localId)
  const focused = state.focusedLocalId === note.localId

  const copyLabel =
    card.copyFeedback === 'copied' ? '已复制 ✓' : card.copyFeedback === 'failed' ? '复制失败' : '复制'

  /** 标题 A/B 的基线标题（可能尚未生成过变体） */
  const originalTitle = card.originalTitle
  const usesOriginalTitle = originalTitle !== null && note.title === originalTitle

  /** 当前内容是否已存入资产库（标题或正文变化后会重新变为未保存） */
  const saved = isNoteSaved(note.localId)

  /** 用户主动复查过就用复查结果，否则用生成时的自检 */
  const compliance = card.complianceCheck ?? note.compliance

  /** 目标用户：优先进度角给出的人群，其次回落到策略层的目标人群 */
  const audience =
    angle?.audience ?? (state.strategy?.target_users ?? []).join('、') ?? ''

  /**
   * 点击卡片 = 把右栏「小抹洞察」切到这一篇。
   * 点在按钮/输入控件上时不抢焦点（否则点「查看完整笔记」会顺带切换聚焦对象）。
   */
  const handleFocus = (event: React.MouseEvent<HTMLElement>): void => {
    if ((event.target as HTMLElement).closest('button, input, textarea, a')) return
    dispatch({ type: 'SET_FOCUS', localId: note.localId })
  }

  return (
    <article
      className={focused ? 'plan-card plan-card-focused' : 'plan-card'}
      onClick={handleFocus}
      aria-label={`方案 ${index}：${note.title}`}
    >
      <header className="plan-head">
        <input
          type="checkbox"
          className="note-select"
          aria-label={`选择方案 ${index}`}
          checked={selected}
          onChange={() => dispatch({ type: 'TOGGLE_SELECT', localId: note.localId })}
        />
        <span className="plan-index">方案 {String(index).padStart(2, '0')}</span>
        <span className="chip chip-style">{note.style}</span>
        <span className="plan-score">
          <span className="plan-score-label">爆款指数</span>
          <span className="plan-score-value">
            {note.score.total}
            <span className="plan-score-unit">分</span>
          </span>
        </span>
      </header>

      {/* 爆款指数进度条。纯展示：数值来自 note.score.total，不是流量预测 */}
      <div
        className="plan-meter"
        role="img"
        aria-label={`爆款指数 ${note.score.total} 分，满分 100`}
      >
        <span className="plan-meter-fill" style={{ width: `${note.score.total}%` }} />
      </div>

      {isEditing ? (
        <div className="edit-area">
          <label className="edit-label" htmlFor={`${note.localId}-title`}>
            标题
          </label>
          <input
            id={`${note.localId}-title`}
            className="control"
            type="text"
            value={card.draft?.title ?? ''}
            onChange={(event) =>
              dispatch({ type: 'UPDATE_DRAFT', localId: note.localId, patch: { title: event.target.value } })
            }
          />
          <label className="edit-label" htmlFor={`${note.localId}-body`}>
            正文
          </label>
          <textarea
            id={`${note.localId}-body`}
            className="control control-area"
            rows={10}
            value={card.draft?.body ?? ''}
            onChange={(event) =>
              dispatch({ type: 'UPDATE_DRAFT', localId: note.localId, patch: { body: event.target.value } })
            }
          />
          <div className="card-actions">
            <button
              type="button"
              className="card-button card-button-primary"
              onClick={() => dispatch({ type: 'COMMIT_EDIT', localId: note.localId })}
            >
              完成
            </button>
            <button
              type="button"
              className="card-button"
              onClick={() => dispatch({ type: 'CANCEL_EDIT', localId: note.localId })}
            >
              取消
            </button>
            <span className="card-hint">编辑只改本地内容，不会调用 AI</span>
          </div>
        </div>
      ) : (
        <>
          <p className="plan-label">推荐标题</p>
          <h3 className="plan-title">{note.title}</h3>

          <dl className="plan-meta">
            <div className="plan-meta-row">
              <dt className="plan-meta-key">内容方向</dt>
              <dd className="plan-meta-val">
                {note.content_directions.map((direction) => (
                  <span key={direction} className="chip chip-direction">
                    {direction}
                  </span>
                ))}
              </dd>
            </div>
            {audience.length > 0 && (
              <div className="plan-meta-row">
                <dt className="plan-meta-key">目标用户</dt>
                <dd className="plan-meta-val">{audience}</dd>
              </div>
            )}
            {angle !== undefined && (
              <div className="plan-meta-row">
                <dt className="plan-meta-key">本篇讲的是</dt>
                <dd className="plan-meta-val plan-meta-angle">{angle.core_idea}</dd>
              </div>
            )}
          </dl>

          {/* 风险标记：低视觉权重，但收起时也看得见 */}
          <div className="plan-risks">
            <span className="summary-item">
              <span
                className={`summary-mark summary-mark-${note.ai_ness.risk_level}`}
                aria-hidden="true"
              />
              AI 味 {RISK_LABELS[note.ai_ness.risk_level]}
            </span>
            <span className="summary-item">
              <span
                className={`summary-mark summary-mark-${compliance.risk_level}`}
                aria-hidden="true"
              />
              合规 {RISK_LABELS[compliance.risk_level]}
            </span>
          </div>

          <div className="plan-actions">
            <button
              type="button"
              className="insight-action insight-action-primary"
              aria-expanded={card.analysisOpen}
              aria-controls={`${note.localId}-analysis`}
              onClick={() => dispatch({ type: 'TOGGLE_ANALYSIS', localId: note.localId })}
            >
              {card.analysisOpen ? '收起完整笔记' : '查看完整笔记'}
              <span className="summary-caret" aria-hidden="true">
                {card.analysisOpen ? '▴' : '▾'}
              </span>
            </button>
            <button
              type="button"
              className="insight-action"
              disabled={busy}
              onClick={() => dispatch({ type: 'BEGIN_REWRITE', localId: note.localId })}
            >
              继续优化
            </button>
            <button
              type="button"
              className={saved ? 'insight-action insight-action-saved' : 'insight-action'}
              disabled={saved}
              onClick={() => saveNoteToAssets(note.localId)}
            >
              {saved ? '已收藏 ✓' : '收藏模板'}
            </button>
          </div>

          {/* 次级操作：保留全部原有能力，但不与上面三个主操作抢注意力 */}
          <div className="plan-actions plan-actions-quiet">
            <button type="button" className="plan-quiet-button" onClick={() => void copyNote(note.localId)}>
              {copyLabel}
            </button>
            <button
              type="button"
              className="plan-quiet-button"
              onClick={() => dispatch({ type: 'BEGIN_EDIT', localId: note.localId })}
            >
              编辑
            </button>
            <button
              type="button"
              className="plan-quiet-button"
              disabled={busy}
              onClick={() => void submitTitleVariants(note.localId)}
            >
              {card.status === 'variants' ? '生成中…' : '标题优化实验室'}
            </button>
            <button
              type="button"
              className="plan-quiet-button"
              disabled={busy}
              onClick={() => void submitComplianceCheck(note.localId)}
            >
              {card.status === 'checking' ? '检查中…' : '发布前检查'}
            </button>
          </div>

          {/* 详情层：正文 + 话题标签 + 分析 */}
          {card.analysisOpen && (
            <div className="plan-detail">
              <p className="plan-detail-label">完整笔记</p>
              <p className="note-body">{note.body}</p>
              <footer className="note-hashtags">
                {note.hashtags.map((hashtag) => (
                  <span key={hashtag} className="hashtag">
                    <span className="hashtag-hash">#</span>
                    {hashtag}
                  </span>
                ))}
              </footer>
              <NoteAnalysis note={note} angle={angle} />
            </div>
          )}
        </>
      )}

      {/* 标题 A/B 测试：原标题 + 3 个变体，可反复切换 */}
      {card.titleVariants && card.titleVariants.length > 0 && (
        <div className="variants">
          <p className="variants-title">标题优化实验室（AI 判断，不代表平台表现）</p>

          {/* 原标题始终保留，随时可以切回 */}
          {originalTitle !== null && (
            <div className={variantRowClass(usesOriginalTitle)}>
              <div className="variant-head">
                <span className="variant-slot">标题 A</span>
                {usesOriginalTitle && <span className="variant-current">当前使用</span>}
                <span className="variant-title">{originalTitle}</span>
                {!usesOriginalTitle && (
                  <button
                    type="button"
                    className="card-button card-button-small"
                    // 切回原标题走 dispatch：它不属于「采用标题变体」，不计入标题采用次数
                    onClick={() =>
                      dispatch({ type: 'APPLY_TITLE_VARIANT', localId: note.localId, title: originalTitle })
                    }
                  >
                    切回
                  </button>
                )}
              </div>
            </div>
          )}

          {card.titleVariants.map((variant, variantIndex) => {
            const active = note.title === variant.title
            return (
              <div key={variant.title} className={variantRowClass(active)}>
                <div className="variant-head">
                  <span className="variant-slot">{variantSlotLabel(variantIndex)}</span>
                  <span className="chip chip-quiet">{variant.type}</span>
                  {active && <span className="variant-current">当前使用</span>}
                  <span className="variant-title">{variant.title}</span>
                  {!active && (
                    <button
                      type="button"
                      className="card-button card-button-small"
                      onClick={() => applyTitleVariant(note.localId, variant.title)}
                    >
                      采用
                    </button>
                  )}
                </div>
                {/* 为什么这么写：AI 给出的切入理由（没有评分比较，不做优劣结论） */}
                <p className="variant-analysis">{variant.analysis}</p>
              </div>
            )
          })}
          <p className="variants-note">
            各标题只给切入方式与理由，不做优劣评分 —— 平台表现取决于发布后的真实反馈。
          </p>
        </div>
      )}

      {/* 重写态 */}
      {isChoosingStyle && (
        <div className="rewrite-panel">
          <p className="rewrite-title">换成哪种风格？</p>
          <div className="style-chips">
            {STYLES.map((style: Style) => {
              const isSelected = card.targetStyle === style
              return (
                <button
                  key={style}
                  type="button"
                  className={isSelected ? 'style-chip style-chip-selected' : 'style-chip'}
                  aria-pressed={isSelected}
                  onClick={() => dispatch({ type: 'SET_TARGET_STYLE', localId: note.localId, style })}
                >
                  {style}
                  {style === note.style && <span className="style-chip-now">当前</span>}
                </button>
              )
            })}
          </div>
          <div className="card-actions">
            <button
              type="button"
              className="card-button card-button-primary"
              disabled={card.targetStyle === null || busy}
              onClick={() => void submitRewrite(note.localId)}
            >
              {card.status === 'rewriting' ? '重写中…' : '确认重写'}
            </button>
            <button
              type="button"
              className="card-button"
              disabled={busy}
              onClick={() => dispatch({ type: 'CANCEL_REWRITE', localId: note.localId })}
            >
              取消
            </button>
            <span className="card-hint">确认后会重写这一套方案，并重新评分</span>
          </div>
        </div>
      )}

      {/* 卡片级错误 */}
      {card.error && (
        <div className="card-error" role="alert">
          <span>
            {card.errorAction === 'rewrite'
              ? '继续优化失败'
              : card.errorAction === 'score'
                ? '评分失败'
                : card.errorAction === 'compliance'
                  ? '发布前检查失败'
                  : '标题优化失败'}
            ：{card.error.message}
          </span>
          <button type="button" className="card-retry" onClick={() => void retryCard(note.localId)}>
            重试
          </button>
        </div>
      )}
    </article>
  )
}
