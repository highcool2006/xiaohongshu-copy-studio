/**
 * 单篇笔记卡片（V2 核心组件）。
 *
 * 信息层级：风格/方向/创作角度 → 标题 → 正文 → 话题标签 → 封面建议
 *          → 内容质量（六维）→ AI 味风险 → 合规状态 → 操作区
 *
 * 三种形态：display / edit（就地编辑，不调 AI）/ rewrite（选目标风格，确认后才调 AI）。
 * 标题优化与发布前检查都是**用户主动触发**的一次 AI 调用。
 */

import { SCORE_DIMENSION_MAX } from '../../shared/constants'
import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { useApp } from '../state/AppProvider'
import { createCardState } from '../state/appState'
import type { NoteWithId } from '../state/appState'

const DIMENSION_LABELS: Record<keyof typeof SCORE_DIMENSION_MAX, string> = {
  content_value: '内容价值',
  specificity: '具体度',
  native_feel: '原生感',
  differentiation: '差异化',
  structure: '结构完整',
  authenticity: '真实性',
}

const RISK_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高' }

export function NoteCard({ note }: { note: NoteWithId }) {
  const {
    state,
    dispatch,
    submitRewrite,
    submitScore,
    submitComplianceCheck,
    submitTitleVariants,
    retryCard,
    copyNote,
  } = useApp()

  const card = state.cards[note.localId] ?? createCardState()
  const angle = state.strategy?.angles.find((item) => item.id === note.angle_id)
  const isEditing = card.view === 'edit'
  const isChoosingStyle = card.view === 'rewrite'
  const busy = card.status !== 'idle'
  const selected = state.selected.includes(note.localId)

  const copyLabel =
    card.copyFeedback === 'copied' ? '已复制 ✓' : card.copyFeedback === 'failed' ? '复制失败' : '复制'

  return (
    <article className="note-card">
      <header className="note-top">
        <input
          type="checkbox"
          className="note-select"
          aria-label="选择这篇文案"
          checked={selected}
          onChange={() => dispatch({ type: 'TOGGLE_SELECT', localId: note.localId })}
        />
        <span className="chip chip-style">{note.style}</span>
        {note.content_directions.map((direction) => (
          <span key={direction} className="chip chip-direction">
            {direction}
          </span>
        ))}
        {angle && (
          <span className="chip chip-angle" title={angle.core_idea}>
            创作角度 · {angle.type}
          </span>
        )}
      </header>

      {angle && <p className="note-angle">本篇讲的是：{angle.core_idea}</p>}

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
          <h3 className="note-title">{note.title}</h3>
          <p className="note-body">{note.body}</p>

          <footer className="note-hashtags">
            {note.hashtags.map((hashtag) => (
              <span key={hashtag} className="hashtag">
                <span className="hashtag-hash">#</span>
                {hashtag}
              </span>
            ))}
          </footer>

          {/* 封面创意建议（只给创意，不生成图片） */}
          <div className="cover">
            <span className="cover-label">封面建议</span>
            <div className="cover-body">
              <p className="cover-headline">{note.cover_suggestion.headline}</p>
              <p className="cover-meta">
                画面主体：{note.cover_suggestion.visual_subject} · 构图：{note.cover_suggestion.composition}
              </p>
            </div>
          </div>

          {/* 内容质量（六维） */}
          <div className="quality">
            <div className="quality-head">
              <span className="quality-label">内容质量</span>
              <span className="quality-total">
                {note.score.total}
                <span className="quality-max">/100</span>
              </span>
              {card.scoreStale && <span className="score-stale">内容已修改，评分可能过时</span>}
              <button
                type="button"
                className="card-button card-button-small"
                disabled={busy}
                onClick={() => void submitScore(note.localId)}
              >
                {card.status === 'scoring' ? '评分中…' : '重新评分'}
              </button>
            </div>
            <div className="quality-dims">
              {(Object.keys(SCORE_DIMENSION_MAX) as Array<keyof typeof SCORE_DIMENSION_MAX>).map((dimension) => (
                <span key={dimension} className="dim">
                  <span className="dim-label">{DIMENSION_LABELS[dimension]}</span>
                  <span className="dim-value">
                    {note.score[dimension]}
                    <span className="dim-max">/{SCORE_DIMENSION_MAX[dimension]}</span>
                  </span>
                </span>
              ))}
            </div>
            <p className="quality-note">
              <span className="quality-note-key">优势</span>
              {note.score.strength}
            </p>
            <p className="quality-note">
              <span className="quality-note-key">建议</span>
              {note.score.improvement}
            </p>
          </div>

          {/* AI 味（独立风险） */}
          <div className="check-row">
            <span className="check-label">AI 味</span>
            <span className={`risk risk-${note.ai_ness.risk_level}`}>
              {RISK_LABELS[note.ai_ness.risk_level] ?? note.ai_ness.risk_level}
            </span>
            {note.ai_ness.issues.length > 0 && (
              <span className="check-text">{note.ai_ness.issues.join('；')}</span>
            )}
          </div>

          {/* 合规（生成时的自检 + 用户主动复查） */}
          <div className="check-row">
            <span className="check-label">发布检查</span>
            <span className={`risk risk-${(card.complianceCheck ?? note.compliance).risk_level}`}>
              {RISK_LABELS[(card.complianceCheck ?? note.compliance).risk_level] ?? ''}
            </span>
            {(card.complianceCheck ?? note.compliance).issues.length > 0 ? (
              <span className="check-text">
                {(card.complianceCheck ?? note.compliance).issues.join('；')}
              </span>
            ) : (
              <span className="check-text">未发现明显风险</span>
            )}
            <span className="check-note">AI 风险提示，不代表平台审核结果</span>
          </div>

          <div className="note-actions">
            <button type="button" className="action-button" onClick={() => void copyNote(note.localId)}>
              {copyLabel}
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => dispatch({ type: 'BEGIN_EDIT', localId: note.localId })}
            >
              编辑
            </button>
            <button
              type="button"
              className="action-button"
              disabled={busy}
              onClick={() => dispatch({ type: 'BEGIN_REWRITE', localId: note.localId })}
            >
              换风格重写
            </button>
            <button
              type="button"
              className="action-button"
              disabled={busy}
              onClick={() => void submitTitleVariants(note.localId)}
            >
              {card.status === 'variants' ? '生成中…' : '标题优化'}
            </button>
            <button
              type="button"
              className="action-button"
              disabled={busy}
              onClick={() => void submitComplianceCheck(note.localId)}
            >
              {card.status === 'checking' ? '检查中…' : '发布前检查'}
            </button>
          </div>
        </>
      )}

      {/* 标题变体 */}
      {card.titleVariants && card.titleVariants.length > 0 && (
        <div className="variants">
          <p className="variants-title">标题变体（AI 判断，不代表平台表现）</p>
          {card.titleVariants.map((variant) => (
            <div key={variant.title} className="variant">
              <div className="variant-head">
                <span className="chip chip-quiet">{variant.type}</span>
                <span className="variant-title">{variant.title}</span>
                <button
                  type="button"
                  className="card-button card-button-small"
                  onClick={() => dispatch({ type: 'APPLY_TITLE_VARIANT', localId: note.localId, title: variant.title })}
                >
                  采用
                </button>
              </div>
              <p className="variant-analysis">{variant.analysis}</p>
            </div>
          ))}
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
            <span className="card-hint">确认后会重写这一篇，并重新评分</span>
          </div>
        </div>
      )}

      {/* 卡片级错误 */}
      {card.error && (
        <div className="card-error" role="alert">
          <span>
            {card.errorAction === 'rewrite'
              ? '换风格重写失败'
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
