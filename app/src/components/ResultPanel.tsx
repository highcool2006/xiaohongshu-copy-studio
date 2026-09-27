/**
 * 右栏：文案工作区。
 *
 * 结构：工作区头部（固定）+ 策略面板 + 结果主体（独立滚动）。
 * 四种状态在结果主体内切换；生成失败时**保留此前的结果与策略**。
 *
 * 加载态显示**真实已用秒数**与阶段提示，不显示伪造的百分比进度。
 */

import { useEffect, useMemo, useState } from 'react'

import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'
import { useApp } from '../state/AppProvider'
import { GENERATION_STAGES } from '../state/appState'
import type { NoteWithId } from '../state/appState'
import { NoteCard } from './NoteCard'
import { StrategyPanel } from './StrategyPanel'

const RISK_OPTIONS = [
  { value: 'all', label: '全部风险' },
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
] as const

/** 生成阶段提示的推进节奏（毫秒）：仅用于提示"在做什么"，不是精确进度 */
const STAGE_INTERVAL_MS = 9000

export function ResultPanel() {
  const { state, dispatch, submitGenerate, copySelected } = useApp()
  const { notes, strategy, information, batch, sort, filterStyle, filterRisk, selected } = state

  const isLoading = batch.status === 'loading'
  const hasNotes = notes.length > 0

  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!isLoading) {
      setElapsedMs(0)
      return
    }
    const started = Date.now()
    const timer = setInterval(() => setElapsedMs(Date.now() - started), 500)
    return () => clearInterval(timer)
  }, [isLoading])

  const stageIndex = Math.min(
    GENERATION_STAGES.length - 1,
    Math.floor(elapsedMs / STAGE_INTERVAL_MS),
  )

  // 派生：筛选 + 排序（不存进 state）
  const visibleNotes = useMemo(() => {
    const filtered = notes.filter((note) => {
      if (filterStyle !== 'all' && note.style !== filterStyle) return false
      if (filterRisk !== 'all' && note.ai_ness.risk_level !== filterRisk) return false
      return true
    })
    return sort === 'quality'
      ? [...filtered].sort((a, b) => b.score.total - a.score.total)
      : filtered
  }, [notes, filterStyle, filterRisk, sort])

  const usedStyles = STYLES.filter((style) => notes.some((note) => note.style === style))
  const durationText = batch.durationMs === null ? null : `${(batch.durationMs / 1000).toFixed(1)}s`

  return (
    <section className="workspace" aria-label="文案工作区">
      <header className="workspace-head">
        <div className="workspace-heading">
          <h2 className="workspace-title">爆款方案</h2>
          {hasNotes ? (
            <p className="workspace-summary">
              {notes.length} 篇 · {usedStyles.length} 种风格{durationText ? ` · 用时 ${durationText}` : ''}
            </p>
          ) : (
            <p className="workspace-summary workspace-summary-muted">等待生成</p>
          )}
        </div>

        {hasNotes && (
          <div className="workspace-tools">
            <label className="tool-field">
              <span className="tool-label">排序</span>
              <select
                className="tool-select"
                value={sort}
                onChange={(event) =>
                  dispatch({ type: 'SET_SORT', sort: event.target.value as 'quality' | 'newest' })
                }
              >
                <option value="newest">按生成顺序</option>
                <option value="quality">按内容质量</option>
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">风格</span>
              <select
                className="tool-select"
                value={filterStyle}
                onChange={(event) =>
                  dispatch({ type: 'SET_FILTER_STYLE', style: event.target.value as Style | 'all' })
                }
              >
                <option value="all">全部风格</option>
                {usedStyles.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">AI 味</span>
              <select
                className="tool-select"
                value={filterRisk}
                onChange={(event) =>
                  dispatch({ type: 'SET_FILTER_RISK', risk: event.target.value as typeof filterRisk })
                }
              >
                {RISK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
          <div className="notice notice-loading notice-stack" role="status">
            <div className="loading-line">
              <span className="spinner" aria-hidden="true" />
              <span>
                {GENERATION_STAGES[stageIndex]}… 已用 {(elapsedMs / 1000).toFixed(0)}s
              </span>
            </div>
            <ol className="stage-list">
              {GENERATION_STAGES.map((stage, index) => (
                <li key={stage} className={index === stageIndex ? 'stage-item stage-item-active' : 'stage-item'}>
                  {stage}
                </li>
              ))}
            </ol>
            <p className="loading-note">阶段提示仅说明正在做什么，不代表精确进度</p>
          </div>
        )}

        {information?.status === 'limited' && information.message.length > 0 && (
          <div className="notice notice-hint">
            <span>{information.message}</span>
          </div>
        )}

        {!hasNotes && !isLoading && batch.status !== 'error' && (
          <div className="empty">
            <p className="empty-eyebrow">种草实验室</p>
            <p className="empty-title">
              你好，抹茶巧克力棒
              <span className="empty-wave" aria-hidden="true">
                👋
              </span>
            </p>
            <p className="empty-lede empty-lede-strong">今天想创造什么爆款？</p>
            <p className="empty-sub">
              把生活里的一点灵感，变成值得分享的故事。
              左边填好产品与卖点，我来把它写成能直接发出去的样子。
            </p>
            <ol className="empty-steps">
              <li>填写产品名称与卖点（至少各一项）</li>
              <li>选目标用户、文案类型与文案风格</li>
              <li>生成后逐篇重写、评分、做发布前检查</li>
            </ol>
            <button type="button" className="empty-cta" onClick={() => void submitGenerate()}>
              生成爆款方案
            </button>
          </div>
        )}

        {hasNotes && strategy && <StrategyPanel strategy={strategy} />}

        {hasNotes && (
          <>
            <div className="batch-bar">
              <label className="batch-check">
                <input
                  type="checkbox"
                  checked={selected.length > 0 && selected.length === visibleNotes.length}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_SELECTION',
                      localIds: event.target.checked ? visibleNotes.map((note) => note.localId) : [],
                    })
                  }
                />
                全选（当前 {visibleNotes.length} 篇）
              </label>
              <span className="batch-count">{selected.length > 0 ? `已选 ${selected.length} 篇` : ''}</span>
              <button type="button" className="tool-button" onClick={() => void copySelected()}>
                {selected.length > 0 ? '复制选中' : '复制全部'}
              </button>
            </div>

            <div className="note-list">
              {visibleNotes.map((note: NoteWithId, index: number) => (
                /* 序号按**当前可见顺序**给（受排序与筛选影响），与卡片上的「方案 01」一致 */
                <NoteCard key={note.localId} note={note} index={index + 1} />
              ))}
            </div>

            {visibleNotes.length === 0 && (
              <p className="filter-empty">当前筛选条件下没有文案，试试切换筛选。</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
