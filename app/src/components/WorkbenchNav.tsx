/**
 * 顶部导航（不引入 react-router，用 activeView 切换）。
 *
 * 右侧三项统计全部来自**当前会话的真实操作**：没有数据时显示「—」，
 * 不显示任何伪造的平台数据（曝光/点赞/收藏等一律不出现）。
 */

import { useApp } from '../state/AppProvider'
import type { ActiveView } from '../state/appState'

const VIEWS: Array<{ id: ActiveView; label: string }> = [
  { id: 'workbench', label: '工作台' },
  { id: 'style-library', label: '风格库' },
  { id: 'review', label: '数据看板' },
  { id: 'assets', label: '资产库' },
]

export function WorkbenchNav() {
  const { state, setActiveView } = useApp()
  const { notes, batch } = state

  const averageQuality =
    notes.length > 0
      ? Math.round(notes.reduce((sum, note) => sum + note.score.total, 0) / notes.length)
      : null
  const duration = batch.durationMs === null ? null : `${(batch.durationMs / 1000).toFixed(1)}s`

  return (
    <header className="topbar">
      {/* 创作者品牌：抹茶巧克力棒 · 种草实验室。不用通用 AI 工具的中性命名 */}
      <div className="topbar-brand">
        <span className="topbar-brand-mark" aria-hidden="true">
          🍵
        </span>
        <span className="topbar-brand-name">抹茶巧克力棒</span>
        <span className="topbar-brand-divider" aria-hidden="true" />
        <span className="topbar-brand-lab">种草实验室</span>
      </div>

      <nav className="topbar-tabs" aria-label="主导航">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={state.activeView === view.id ? 'topbar-tab topbar-tab-active' : 'topbar-tab'}
            aria-current={state.activeView === view.id ? 'page' : undefined}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {/*
        会话统计合并成一行轻量文字。
        原先三个独立小卡（本次生成 / 平均内容质量 / 上次耗时）在顶栏右侧排成一组数字，
        读起来像系统监控面板 —— 信息本身保留，只是不再抢品牌标识与导航的注意力。
        「上次耗时」是唯一偏工程向的一项，退到行末。
      */}
      <p className="topbar-stats" aria-label="本次会话统计">
        {notes.length > 0 ? (
          <>
            <span className="topbar-stat">
              本次 <span className="topbar-stat-value">{notes.length}</span> 篇
            </span>
            <span className="topbar-stat">
              平均 <span className="topbar-stat-value">{averageQuality}</span> 分
            </span>
            {duration !== null && <span className="topbar-stat topbar-stat-quiet">用时 {duration}</span>}
          </>
        ) : (
          <span className="topbar-stat topbar-stat-quiet">今天还没有开始创作</span>
        )}
      </p>
    </header>
  )
}
