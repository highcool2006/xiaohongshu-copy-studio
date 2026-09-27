/**
 * 单篇笔记卡片（三级分层，V2 核心组件）。
 *
 * 信息层级（这是本组件最重要的约定）：
 *   L1 主层   风格标记 → 标题 → 正文 → 话题标签          永远可见
 *   L2 摘要层 分数 + AI 味 + 合规 + 展开按钮             永远可见，低视觉权重
 *   L3 分析层 创作角度 / 封面建议 / 六维评分 / AI 味 / 发布检查   默认折叠
 *
 * 分层的理由：正文是这张卡存在的意义，评分与检查是**围绕**它的分析。
 * 此前两者平铺，导致 L3 的内容与正文争夺同样的视觉权重、卡片被撑得很高，
 * 且多张卡之间因为区块完全相同而显得"五张卡长一个样"。
 *
 * ⚠️ 卡片之间的差异化只能来自**内容与排版**。PRD 4.1 把"五张结果卡五种配色"
 *    列为视觉一票否决项，因此**不得**按风格给卡片上不同颜色。
 *
 * 三种形态：display / edit（就地编辑，不调 AI）/ rewrite（选目标风格，确认后才调 AI）。
 * 标题优化与发布前检查都是**用户主动触发**的一次 AI 调用。
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

export function NoteCard({ note }: { note: NoteWithId }) {
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

  const copyLabel =
    card.copyFeedback === 'copied' ? '已复制 ✓' : card.copyFeedback === 'failed' ? '复制失败' : '复制'

  /** 标题 A/B 的基线标题（可能尚未生成过变体） */
  const originalTitle = card.originalTitle
  const usesOriginalTitle = originalTitle !== null && note.title === originalTitle

  /** 当前内容是否已存入资产库（标题或正文变化后会重新变为未保存） */
  const saved = isNoteSaved(note.localId)

  /** 用户主动复查过就用复查结果，否则用生成时的自检（摘要行与抽屉共用同一判定） */
  const compliance = card.complianceCheck ?? note.compliance

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
        {/* 只保留一个风格标记：多风格批次下卡片之间需要可辨识，但不再堆叠 chip。
            内容方向与创作角度移入 L3 抽屉，它们属于分析而非文案本体。 */}
        <span className="chip chip-style">{note.style}</span>
      </header>

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

          {/* L2 摘要层：收起时仍能看到分数与风险，避免折叠变成「盲选」 */}
          <div className="note-summary">
            <span className="summary-score">
              {note.score.total}
              <span className="summary-score-unit">/100</span>
            </span>
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
            <button
              type="button"
              className="summary-toggle"
              aria-expanded={card.analysisOpen}
              aria-controls={`${note.localId}-analysis`}
              onClick={() => dispatch({ type: 'TOGGLE_ANALYSIS', localId: note.localId })}
            >
              {card.analysisOpen ? '收起分析' : '展开分析'}
              <span className="summary-caret" aria-hidden="true">
                {card.analysisOpen ? '▴' : '▾'}
              </span>
            </button>
          </div>

          {/* L3 分析层（默认折叠）：角度 / 封面 / 六维 / AI 味 / 发布检查 */}
          {card.analysisOpen && <NoteAnalysis note={note} angle={angle} />}

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
            <button
              type="button"
              className={saved ? 'action-button action-button-saved' : 'action-button'}
              disabled={saved}
              onClick={() => saveNoteToAssets(note.localId)}
            >
              {saved ? '已存入资产库 ✓' : '保存到资产库'}
            </button>
          </div>
        </>
      )}

      {/* 标题 A/B 测试：原标题 + 3 个变体，可反复切换 */}
      {card.titleVariants && card.titleVariants.length > 0 && (
        <div className="variants">
          <p className="variants-title">标题 A/B 测试（AI 判断，不代表平台表现）</p>

          {/* 原标题始终保留，随时可以切回 */}
          {originalTitle !== null && (
            <div className={variantRowClass(usesOriginalTitle)}>
              <div className="variant-head">
                <span className="variant-slot">原标题</span>
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

          {card.titleVariants.map((variant, index) => {
            const active = note.title === variant.title
            return (
              <div key={variant.title} className={variantRowClass(active)}>
                <div className="variant-head">
                  <span className="variant-slot">{variantSlotLabel(index)}</span>
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
                <p className="variant-analysis">{variant.analysis}</p>
              </div>
            )
          })}
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
