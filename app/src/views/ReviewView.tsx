/**
 * 数据看板（Phase 6：本地生产数据；发布后复盘在 Phase 10 接入）。
 *
 * 严格区分两类数据：
 *   A. 本地内容生产数据 —— 来自当前会话的真实状态（无数据时显示「暂无数据」）
 *   B. 发布后表现数据 —— **尚未连接小红书平台**，本产品不伪造任何平台指标
 */

import { useApp } from '../state/AppProvider'

export function ReviewView() {
  const { state } = useApp()
  const { notes, batch, strategy } = state

  const averageQuality =
    notes.length > 0
      ? Math.round(notes.reduce((sum, note) => sum + note.score.total, 0) / notes.length)
      : null
  const riskyNotes = notes.filter((note) => note.ai_ness.risk_level !== 'low').length
  const duration = batch.durationMs === null ? null : `${(batch.durationMs / 1000).toFixed(1)} 秒`

  const rows: Array<{ label: string; value: string }> = [
    { label: '本次生成篇数', value: notes.length > 0 ? `${notes.length} 篇` : '暂无数据' },
    { label: '平均内容质量', value: averageQuality === null ? '暂无数据' : `${averageQuality} / 100` },
    { label: '内容角度数量', value: strategy ? `${strategy.angles.length} 个` : '暂无数据' },
    {
      label: '重复风险',
      value: strategy ? strategy.diversity_report.duplicate_risk : '暂无数据',
    },
    { label: 'AI 味非低风险篇数', value: notes.length > 0 ? `${riskyNotes} 篇` : '暂无数据' },
    { label: '上次生成耗时', value: duration ?? '暂无数据' },
  ]

  return (
    <section className="page" aria-label="数据看板">
      <header className="page-head">
        <h2 className="page-title">数据看板</h2>
        <p className="page-sub">只有真实记录的数据才会显示在这里。</p>
      </header>

      <h3 className="page-section">A · 本地内容生产数据</h3>
      <table className="data-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="page-section">B · 发布后表现数据</h3>
      <div className="placeholder-note placeholder-strong">
        尚未连接平台数据。本工作台不会显示或推算曝光、点赞、收藏、评论、分享、关注等平台指标。
        <br />
        发布后复盘（由你手动录入真实数据后统计）将在 Phase 10 接入。
      </div>
    </section>
  )
}
