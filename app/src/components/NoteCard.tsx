/**
 * 单篇笔记卡片 —— 产品的核心视觉组件。
 *
 * 三种形态（同一张卡内部切换，不用浮层）：
 *   display —— 浏览：标题 / 正文 / 话题标签 / 操作区 / 评分区域
 *   edit    —— 就地编辑：只改本地内容，不调 AI；编辑态**隐藏复制与重写**
 *   rewrite —— 换风格重写：先选目标风格，**确认后**才调 AI
 *
 * 内容层级与交互依据 docs/技术架构决策.md 第 12 节、docs/页面结构方案.md。
 */

import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { useApp } from '../state/AppProvider'
import { createCardState } from '../state/appState'
import type { NoteWithId } from '../state/appState'

export function NoteCard({ note }: { note: NoteWithId }) {
  const { state, dispatch, submitRewrite, submitScore, retryCard, copyNote } = useApp()
  const card = state.cards[note.localId] ?? createCardState()

  const isEditing = card.view === 'edit'
  const isChoosingStyle = card.view === 'rewrite'
  const isRewriting = card.status === 'rewriting'
  const isScoring = card.status === 'scoring'

  const copyLabel =
    card.copyFeedback === 'copied' ? '已复制 ✓' : card.copyFeedback === 'failed' ? '复制失败' : '复制'

  return (
    <article className="note-card">
      <header className="note-top">
        <span className="chip chip-style">{note.style}</span>
        {note.content_directions.map((direction) => (
          <span key={direction} className="chip chip-direction">
            {direction}
          </span>
        ))}
      </header>

      {isEditing ? (
        /* ---------- 编辑态 ---------- */
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
        /* ---------- 浏览态 ---------- */
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

          {/* 操作区 */}
          <div className="note-actions">
            <button
              type="button"
              className="action-button"
              onClick={() => void copyNote(note.localId)}
            >
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
              disabled={isRewriting}
              onClick={() => dispatch({ type: 'BEGIN_REWRITE', localId: note.localId })}
            >
              换风格重写
            </button>
          </div>

          {/* 评分区域 */}
          <div className="note-score">
            <div className="score-head">
              <span className="score-label">爆款潜力自评</span>
              <span className="score-total">
                {note.score.total}
                <span className="score-max">/100</span>
              </span>
              {card.scoreStale && <span className="score-stale">内容已修改，评分可能过时</span>}
              <button
                type="button"
                className="card-button card-button-small"
                disabled={isScoring}
                onClick={() => void submitScore(note.localId)}
              >
                {isScoring ? '评分中…' : '重新评分'}
              </button>
            </div>
            <p className="score-note">
              <span className="score-note-key">优势</span>
              {note.score.strength}
            </p>
            <p className="score-note">
              <span className="score-note-key">建议</span>
              {note.score.improvement}
            </p>
          </div>
        </>
      )}

      {/* ---------- 重写态：先选风格，确认后才调用 AI ---------- */}
      {isChoosingStyle && (
        <div className="rewrite-panel">
          <p className="rewrite-title">换成哪种风格？</p>
          <div className="style-chips">
            {STYLES.map((style: Style) => {
              const selected = card.targetStyle === style
              return (
                <button
                  key={style}
                  type="button"
                  className={selected ? 'style-chip style-chip-selected' : 'style-chip'}
                  aria-pressed={selected}
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
              disabled={card.targetStyle === null || isRewriting}
              onClick={() => void submitRewrite(note.localId)}
            >
              {isRewriting ? '重写中…' : '确认重写'}
            </button>
            <button
              type="button"
              className="card-button"
              disabled={isRewriting}
              onClick={() => dispatch({ type: 'CANCEL_REWRITE', localId: note.localId })}
            >
              取消
            </button>
            <span className="card-hint">确认后会重写这一篇，并重新评分</span>
          </div>
        </div>
      )}

      {/* ---------- 卡片级错误：只影响这张卡 ---------- */}
      {card.error && (
        <div className="card-error" role="alert">
          <span>
            {card.errorAction === 'rewrite' ? '换风格重写失败' : '评分失败'}：{card.error.message}
          </span>
          <button
            type="button"
            className="card-retry"
            onClick={() => void retryCard(note.localId)}
          >
            重试
          </button>
        </div>
      )}
    </article>
  )
}
