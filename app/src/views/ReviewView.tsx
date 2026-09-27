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

import { RECENT_DAYS, aggregate, buildJourney, isAnalyticsEmpty } from '../lib/analyticsStorage'
import type { CountedItem, JourneyEntry } from '../lib/analyticsStorage'
import { useApp } from '../state/AppProvider'


/* 注：原 7 天趋势表的列定义（TREND_FIELDS）已随表格一起移除 ——
   逐日表格是数据后台的写法，现由「创作旅程」时间线取代。 */

/** 把日期键显示为「月/日」，避免表头过长 */
function shortDate(dateKey: string): string {
  const parts = dateKey.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateKey
}

/**
 * 把计数列表写成一行「名称 数量 · 名称 数量」。
 *
 * 取代原先的条形图：条形长度只表达相对大小，而这里要说的其实是
 * 「你写过哪些、各写了多少」—— 用文字陈述比用图形更贴近这个意思。
 */
function rankedText(items: CountedItem[]): string {
  if (items.length === 0) return '暂无'
  return items.map((item) => `${item.key} ${item.count}`).join(' · ')
}

/**
 * 把一天的动作写成一句人话。
 *
 * 只陈述**记录里确实有的事**，不做任何推断 ——
 * 旅程写的是"你做了什么"，不是"你在进步"。
 */
function describeDay(day: JourneyEntry): string[] {
  const parts: string[] = []
  if (day.written > 0) parts.push(`写了 ${day.written} 篇`)
  if (day.saved > 0) parts.push(`收藏了 ${day.saved} 条`)
  if (day.titleExperiments > 0) parts.push(`做了 ${day.titleExperiments} 次标题实验`)
  if (day.rewrites > 0) parts.push(`改写了 ${day.rewrites} 篇`)
  return parts
}

/* 注：原 Distribution 分布条组件已移除 ——
   条形图是仪表盘的语言，而这一层要说的是"我习惯怎么写"，改成 .habit-row 文字陈述。 */

export function ReviewView() {
  const { state, analytics } = useApp()
  const { assets } = state

  const data = useMemo(() => aggregate(analytics, assets), [analytics, assets])
  /** 创作旅程：只保留真正发生过事情的日子（逻辑在 analyticsStorage，这里只取结果） */
  const journey = useMemo(() => buildJourney(analytics, assets), [analytics, assets])
  const empty = isAnalyticsEmpty(analytics, assets)

  const { totals, recent, assets: assetStats } = data
  /**
   * 核心指标只留两个 —— 十项平铺时其中六项常年是 0，
   * 一整排零是这页"像后台"的最大来源（PRD 4.2 反面示例：完全一致、密度偏高）。
   */
  const heroMetrics: Array<{ label: string; value: number; hint: string }> = [
    { label: '累计生成笔记', value: totals.generate_notes, hint: '写出来的篇数' },
    { label: '已保存资产', value: assetStats.total, hint: '收藏下来的篇数' },
  ]

  /**
   * 其余计数合并成一行「足迹」。
   *
   * 全部保留、一个不删 —— 零值不做隐藏，只是**在视觉上退到后面**。
   * 隐藏零值会让用户以为这个动作不存在；平铺又会让人以为自己在用一堆没用过的功能。
   */
  const footprints: Array<{ label: string; value: number }> = [
    { label: '生成', value: totals.generate_count },
    { label: '改写', value: totals.rewrite_count },
    { label: '评分', value: totals.score_count },
    { label: '标题实验', value: totals.title_experiment_count },
    { label: '标题采用', value: totals.title_apply_count },
    { label: '复制', value: totals.copy_count },
    { label: '发布前检查', value: totals.compliance_count },
    { label: '存/删资产', value: totals.save_asset_count },
  ]

  return (
    <section className="page" aria-label="数据看板">
      <header className="page-head">
        <p className="page-eyebrow">成长旅程</p>
        <h2 className="page-title">创作者成长旅程</h2>
        <p className="page-sub">
          这里记的是你走过的路：哪一天写了什么、留下了什么。没创作的日子不出现，也不补 0 ——
          旅程只写发生过的事。
        </p>
      </header>

      {empty && (
        <div className="empty">
          <p className="empty-title">旅程还没有开始</p>
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
          <h3 className="page-section">创作数量</h3>
          <div className="hero-metrics">
            {heroMetrics.map((metric) => (
              <div key={metric.label} className="hero-metric">
                <span className="hero-metric-value">{metric.value}</span>
                <span className="hero-metric-body">
                  <span className="hero-metric-label">{metric.label}</span>
                  <span className="hero-metric-hint">{metric.hint}</span>
                </span>
              </div>
            ))}
          </div>

          {/* 足迹：其余计数全部保留，零值在视觉上退到后面 */}
          <p className="footprint-line">
            {footprints.map((item, index) => (
              <span
                key={item.label}
                className={item.value === 0 ? 'footprint footprint-zero' : 'footprint'}
              >
                {index > 0 && <span className="footprint-sep" aria-hidden="true">·</span>}
                {item.label} <span className="footprint-value">{item.value}</span>
              </span>
            ))}
          </p>

          {/* 第二层：成长旅程 —— 只记走过的路，不渲染"什么都没发生" */}
          <h3 className="page-section">创作旅程</h3>
          {journey.length === 0 ? (
            <div className="placeholder-note">
              最近 {RECENT_DAYS} 天还没有留下记录。写下第一篇的时候，这里就会有第一段旅程。
            </div>
          ) : (
            <div className="review-block">
              <ol className="journey">
                {journey.map((day) => (
                  <li key={day.date} className="journey-item">
                    <span className="journey-dot" aria-hidden="true" />
                    <span className="journey-date">{shortDate(day.date)}</span>
                    <span className="journey-body">
                      <span className="journey-line">
                        {describeDay(day).join(' · ')}
                      </span>
                      {day.averageScore !== null && (
                        <span className="journey-score">当天收藏的内容质量均值 {day.averageScore}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="review-muted">
                {journey.length === recent.length
                  ? `最近 ${RECENT_DAYS} 天每天都留下了记录。`
                  : `最近 ${RECENT_DAYS} 天里有 ${journey.length} 天在创作；没创作的日子不在这里出现，也不补 0。`}
              </p>
            </div>
          )}

          {/*
            第三层：偏好与风险。
            原先这里是 5 张带进度条的卡片 —— 条形图是仪表盘的语言，
            而这一层要回答的只是"我习惯怎么写"。改成几行陈述，信息一条不少。
          */}
          <h3 className="page-section">写下来的习惯</h3>
          {assetStats.total === 0 ? (
            <p className="review-muted">还没有收藏。收藏之后，这里会慢慢显出你的偏好。</p>
          ) : (
            <div className="habit-list">
              <p className="habit-row">
                <span className="habit-key">收藏作品的均分</span>
                <span className="habit-value">
                  {assetStats.averageScore}
                  <span className="habit-unit">/100</span>
                </span>
                <span className="habit-note">基于 {assetStats.total} 条收藏</span>
              </p>
              <p className="habit-row">
                <span className="habit-key">最常写的风格</span>
                <span className="habit-text">{rankedText(assetStats.byStyle)}</span>
              </p>
              <p className="habit-row">
                <span className="habit-key">写过的方向</span>
                <span className="habit-text">{rankedText(assetStats.byDirection)}</span>
              </p>
              <p className="habit-row">
                <span className="habit-key">风险情况</span>
                <span className="habit-text">
                  AI 味 低 {assetStats.aiNess.low} · 中 {assetStats.aiNess.medium} · 高{' '}
                  {assetStats.aiNess.high}　｜　发布检查 低 {assetStats.compliance.low} · 中{' '}
                  {assetStats.compliance.medium} · 高 {assetStats.compliance.high}
                </span>
              </p>
            </div>
          )}
        </>
      )}

      {/* 发布后表现数据：明确未连接 */}
      <h3 className="page-section">发布后表现</h3>
      <div className="placeholder-note placeholder-strong">
        尚未连接平台数据。本工作台不会显示或推算曝光、点赞、收藏、评论、分享、关注等平台指标，
        也不会给出「爆款率」之类的预测。
        <br />
        发布后复盘（由你手动录入真实数据后统计）属于后续版本的范围。
      </div>
    </section>
  )
}
