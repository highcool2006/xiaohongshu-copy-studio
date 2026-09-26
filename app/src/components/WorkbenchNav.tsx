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
      <div className="topbar-brand">种草工坊</div>

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

      <div className="topbar-stats" aria-label="本次会话统计">
        <div className="topbar-stat">
          <span className="topbar-stat-value">{notes.length > 0 ? notes.length : '—'}</span>
          <span className="topbar-stat-label">本次生成</span>
        </div>
        <div className="topbar-stat">
          <span className="topbar-stat-value">{averageQuality ?? '—'}</span>
          <span className="topbar-stat-label">平均内容质量</span>
        </div>
        <div className="topbar-stat">
          <span className="topbar-stat-value">{duration ?? '—'}</span>
          <span className="topbar-stat-label">上次耗时</span>
        </div>
      </div>
    </header>
  )
}
