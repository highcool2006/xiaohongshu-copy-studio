/**
 * 内容策略面板：本轮总策略 + 目标人群/场景 + 创作角度 + 多样性报告。
 *
 * 这些值全部来自 API 返回的 strategy；多样性报告由**程序**计算（不交给 AI）。
 * 角度展示的是"这一篇要讲的那一件事"，不是模型内部思考过程。
 *
 * 展示策略（2026-09-27）：**默认折叠**，只留一行头部（标题 + 多样性风险）。
 * 理由：这是"本轮怎么规划的"，属于幕后信息；用户打开工作台想看的是**方案本身**。
 * 整块铺开时，六行角度列表会把方案卡片挤到首屏之外。多样性风险是唯一需要一眼看到的
 * 指标（它直接影响这批方案值不值得用），所以留在折叠外的头部。
 */

import { useState } from 'react'

import type { ContentStrategy } from '../../shared/types'
import { RISK_LABELS } from '../lib/riskLabels'

export function StrategyPanel({ strategy }: { strategy: ContentStrategy }) {
  const report = strategy.diversity_report
  const [open, setOpen] = useState(false)

  return (
    <section className="strategy" aria-label="内容策略">
      <div className="strategy-head">
        <h3 className="strategy-title">内容策略</h3>
        <div className="diversity">
          <span className="diversity-label">多样性</span>
          <span className={`diversity-risk diversity-${report.duplicate_risk}`}>
            重复风险 {RISK_LABELS[report.duplicate_risk]}
          </span>
          {open && (
            <span className="diversity-detail">
              角度 {report.angle_types} · 开头 {report.opening_types} · 结构{' '}
              {report.structure_types} · 结尾 {report.ending_types}
            </span>
          )}
        </div>
        <button
          type="button"
          className="strategy-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '收起' : '本轮怎么规划的'}
          <span className="summary-caret" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
      </div>

      {!open ? null : (
        <>
      <p className="strategy-summary">{strategy.summary}</p>

      <div className="strategy-meta">
        {strategy.target_users.length > 0 && (
          <div className="strategy-meta-group">
            <span className="strategy-meta-label">目标人群</span>
            {strategy.target_users.map((user) => (
              <span key={user} className="chip chip-quiet">
                {user}
              </span>
            ))}
          </div>
        )}
        {strategy.scenarios.length > 0 && (
          <div className="strategy-meta-group">
            <span className="strategy-meta-label">使用场景</span>
            {strategy.scenarios.map((scenario) => (
              <span key={scenario} className="chip chip-quiet">
                {scenario}
              </span>
            ))}
          </div>
        )}
      </div>

      <ol className="angle-list">
        {strategy.angles.map((angle, index) => (
          <li key={angle.id} className="angle-item">
            <span className="angle-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="angle-body">
              <div className="angle-line">
                <span className="chip chip-angle">{angle.type}</span>
                <span className="angle-idea">{angle.core_idea}</span>
              </div>
              <div className="angle-meta">
                {angle.audience} · {angle.scenario} · {angle.hook_type} → {angle.structure_type} →{' '}
                {angle.ending_type}
              </div>
            </div>
          </li>
        ))}
      </ol>
        </>
      )}
    </section>
  )
}
