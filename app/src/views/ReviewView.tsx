/**
 * 数据看板 / 内容复盘（Phase 10）。
 *
 * 严格区分两类数据：
 *   A. **本地内容生产数据** —— 来自 localStorage 的真实操作记录与已保存资产。
 *      没有发生过的操作就是 0；没有资产时平均分为「暂无数据」而不是 0。
 *   B. **发布后表现数据** —— 尚未连接小红书平台。本产品不显示、
 *      不推算、不预测曝光/点赞/收藏/评论/分享/涨粉，也不声称任何"爆款率"。
 *
 * 所有统计都由 lib/analyticsStorage 的 aggregate() 计算，本组件只负责渲染。
 */

import { useMemo } from 'react'

import { RECENT_DAYS, aggregate, isAnalyticsEmpty, sumRecent } from '../lib/analyticsStorage'
import type { CountedItem, DailyCounter } from '../lib/analyticsStorage'
import { RISK_LABELS } from '../lib/riskLabels'
import { useApp } from '../state/AppProvider'


/** 最近 N 天趋势里展示的 4 条曲线 */
const TREND_FIELDS: Array<{ field: keyof Omit<DailyCounter, 'date'>; label: string }> = [
  { field: 'generate_notes', label: '生成笔记' },
  { field: 'save_asset', label: '保存资产' },
  { field: 'title_experiment', label: '标题实验' },
  { field: 'rewrite', label: '改写' },
]

/** 把日期键显示为「月/日」，避免表头过长 */
function shortDate(dateKey: string): string {
  const parts = dateKey.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateKey
}

/** 分布条：用纯 CSS 宽度表达占比，不引入图表库 */
function Distribution({ title, items }: { title: string; items: CountedItem[] }) {
  const max = items.reduce((value, item) => Math.max(value, item.count), 0)

  return (
    <div className="review-block">
      <p className="review-block-title">{title}</p>
      {items.length === 0 ? (
        <p className="review-muted">暂无数据</p>
      ) : (
        <ul className="dist-list">
          {items.map((item) => (
            <li key={item.key} className="dist-item">
              <span className="dist-key">{item.key}</span>
              <span className="dist-bar" aria-hidden="true">
                <span className="dist-bar-fill" style={{ width: `${max === 0 ? 0 : (item.count / max) * 100}%` }} />
              </span>
              <span className="dist-value">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ReviewView() {
  const { state, analytics } = useApp()
  const { assets } = state

  const data = useMemo(() => aggregate(analytics, assets), [analytics, assets])
  const empty = isAnalyticsEmpty(analytics, assets)

  const { totals, recent, assets: assetStats } = data
  const recentTotals = {
    generate_notes: sumRecent(recent, 'generate_notes'),
    save_asset: sumRecent(recent, 'save_asset'),
    title_experiment: sumRecent(recent, 'title_experiment'),
    rewrite: sumRecent(recent, 'rewrite'),
  }
  /** 第一层：核心指标（全部是真实计数） */
  const metrics: Array<{ label: string; value: number }> = [
    { label: '累计生成笔记', value: totals.generate_notes },
    { label: '累计生成次数', value: totals.generate_count },
    { label: '改写次数', value: totals.rewrite_count },
    { label: '评分次数', value: totals.score_count },
    { label: '标题实验次数', value: totals.title_experiment_count },
    { label: '标题采用次数', value: totals.title_apply_count },
    { label: '复制次数', value: totals.copy_count },
    { label: '合规检查次数', value: totals.compliance_count },
    { label: '已保存资产', value: assetStats.total },
    { label: '保存 / 删除资产', value: totals.save_asset_count },
  ]

  return (
    <section className="page" aria-label="数据看板">
      <header className="page-head">
        <h2 className="page-title">数据看板</h2>
        <p className="page-sub">只有真实记录的数据才会显示在这里。</p>
      </header>

      {empty && (
        <div className="empty">
          <p className="empty-title">还没有生产数据</p>
          <ol className="empty-steps">
            <li>在工作台生成第一篇内容后，这里会出现统计</li>
            <li>改写、评分、标题实验、复制等操作都会计入</li>
            <li>数据保存在本机浏览器（localStorage），刷新后仍在</li>
          </ol>
        </div>
      )}

      {!empty && (
        <>
          {/* 第一层：核心指标 */}
          <h3 className="page-section">A · 本地内容生产数据</h3>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span className="metric-value">{metric.value}</span>
                <span className="metric-label">{metric.label}</span>
              </div>
            ))}
          </div>

          {/* 第二层：最近 7 天 */}
          <h3 className="page-section">B · 最近 {RECENT_DAYS} 天</h3>
          <div className="review-block">
            <div className="trend-legend">
              {TREND_FIELDS.map((item) => (
                <span key={item.field} className="trend-legend-item">
                  <span className="trend-legend-key">{item.label}</span>
                  <span className="trend-legend-value">{recentTotals[item.field]}</span>
                </span>
              ))}
            </div>
            <table className="trend-table">
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  {TREND_FIELDS.map((item) => (
                    <th key={item.field} scope="col">
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{shortDate(day.date)}</th>
                    {TREND_FIELDS.map((item) => (
                      <td key={item.field} className={day[item.field] > 0 ? 'trend-cell-active' : ''}>
                        {day[item.field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="review-muted">
              没有操作的那一天记 0，不做任何补值。最近 {RECENT_DAYS} 天共生成 {recentTotals.generate_notes} 篇。
            </p>
          </div>

          {/* 第三层：内容结构分析（来自已保存资产） */}
          <h3 className="page-section">C · 内容结构分析</h3>
          {assetStats.total === 0 ? (
            <p className="review-muted">还没有保存任何资产。保存后这里会按风格与内容方向统计。</p>
          ) : (
            <div className="review-grid">
              <div className="review-block">
                <p className="review-block-title">平均内容质量</p>
                <p className="review-score">
                  {assetStats.averageScore}
                  <span className="review-score-max">/100</span>
                </p>
                <p className="review-muted">基于 {assetStats.total} 条已保存资产</p>
              </div>
              <Distribution title="各风格资产数量" items={assetStats.byStyle} />
              <Distribution title="各内容方向数量" items={assetStats.byDirection} />
              <div className="review-block">
                <p className="review-block-title">AI 味风险分布</p>
                <ul className="risk-list">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <li key={level} className="risk-item">
                      <span className={`risk risk-${level}`}>{RISK_LABELS[level]}</span>
                      <span className="risk-count">{assetStats.aiNess[level]} 篇</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="review-block">
                <p className="review-block-title">发布检查风险分布</p>
                <ul className="risk-list">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <li key={level} className="risk-item">
                      <span className={`risk risk-${level}`}>{RISK_LABELS[level]}</span>
                      <span className="risk-count">{assetStats.compliance[level]} 篇</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* 发布后表现数据：明确未连接 */}
      <h3 className="page-section">D · 发布后表现数据</h3>
      <div className="placeholder-note placeholder-strong">
        尚未连接平台数据。本工作台不会显示或推算曝光、点赞、收藏、评论、分享、关注等平台指标，
        也不会给出「爆款率」之类的预测。
        <br />
        发布后复盘（由你手动录入真实数据后统计）属于后续版本的范围。
      </div>
    </section>
  )
}
