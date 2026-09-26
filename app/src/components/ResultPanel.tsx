/**
 * 右栏：文案工作区。
 *
 * 结构：工作区头部（固定） + 结果主体（独立滚动）。
 * 左栏因此天然保持可见，左右两栏形成明确但不厚重的关系。
 *
 * 四种状态都在结果主体内切换；生成失败时**保留此前的结果**。
 */

import { STYLES } from '../../shared/enums'
import { useApp } from '../state/AppProvider'
import { NoteCard } from './NoteCard'

export function ResultPanel() {
  const { state, submitGenerate } = useApp()
  const { notes, information, batch } = state

  const isLoading = batch.status === 'loading'
  const hasNotes = notes.length > 0

  // 派生数据：不存进 state
  const usedStyleCount = STYLES.filter((style) => notes.some((note) => note.style === style)).length

  return (
    <section className="workspace" aria-label="文案工作区">
      <header className="workspace-head">
        <div className="workspace-heading">
          <h2 className="workspace-title">生成结果</h2>
          {hasNotes ? (
            <p className="workspace-summary">
              {notes.length} 篇文案 · {usedStyleCount} 种风格
            </p>
          ) : (
            <p className="workspace-summary workspace-summary-muted">等待生成</p>
          )}
        </div>

        {/* 排序 / 筛选：本轮只保留视觉位置，功能未实现，故为 disabled */}
        {hasNotes && (
          <div className="workspace-tools">
            <button type="button" className="tool-button" disabled>
              排序
            </button>
            <button type="button" className="tool-button" disabled>
              筛选
            </button>
          </div>
        )}
      </header>

      <div className="workspace-body">
        {batch.status === 'error' && batch.error && (
          <div className="notice notice-error" role="alert">
            <div className="notice-text">
              <strong className="notice-strong">生成失败</strong>
              <span>{batch.error.message}</span>
              {hasNotes && <span className="notice-sub">以下是上一次的结果</span>}
            </div>
            <button type="button" className="notice-action" onClick={() => void submitGenerate()}>
              重试
            </button>
          </div>
        )}

        {isLoading && (
          <div className="notice notice-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>正在生成文案，请稍候…</span>
          </div>
        )}

        {/* 信息充分度提示：温和样式，刻意与“错误”区分开 */}
        {information?.status === 'limited' && information.message.length > 0 && (
          <div className="notice notice-hint">
            <span>{information.message}</span>
          </div>
        )}

        {!hasNotes && !isLoading && batch.status !== 'error' && (
          <div className="empty">
            <p className="empty-title">开始创作你的第一批小红书文案</p>
            <ol className="empty-steps">
              <li>在左侧填写产品名称与卖点</li>
              <li>选择你想要的表达风格</li>
              <li>点击「生成文案」</li>
            </ol>
          </div>
        )}

        {hasNotes && (
          <div className="note-list">
            {notes.map((note) => (
              <NoteCard key={note.localId} note={note} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
