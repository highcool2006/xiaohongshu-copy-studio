/**
 * 右栏：小抹洞察。
 *
 * 「小抹」是产品里的 AI 创作伙伴，不是客服机器人。它只做一件事：
 * 把**当前聚焦的那篇方案**的分析结果讲给用户听，并给出下一步动作。
 *
 * 边界（重要）：
 *   - 本组件**不产生任何新的分析**。所有内容都来自已有的
 *     note.score.strength / improvement、note.ai_ness.issues、note.compliance.issues。
 *   - 不展示 token、模型名、接口状态等技术信息 —— 用户不需要。
 *   - 平台数据一律不出现（未连接小红书平台，见 V2 决策第 11 节）。
 */

import { useApp } from '../state/AppProvider'
import { createCardState } from '../state/appState'
import { RISK_LABELS } from '../lib/riskLabels'

/**
 * 小抹的问候语。
 *
 * 只陈述**记录里确实有的事**（"我在看第几篇""下面列的是什么"），
 * 不揣测用户的心情、意图或状态 —— 陪伴感来自语气，不来自假装懂你。
 */
function greeting(hasNotes: boolean, index: number, total: number): string {
  if (!hasNotes) {
    return '还没开始呢。左边把产品和卖点填上，我先给你出几个能直接发的方向。'
  }
  if (total > 1) {
    return `第 ${index} 篇在这儿。它的强项、可以再改的地方，都列在下面了。`
  }
  return '这篇在这儿。强项和可以再改的地方，都列在下面了。'
}

export function AiInsightPanel() {
  const { state, submitScore, submitComplianceCheck, submitTitleVariants, copyNote } = useApp()

  const notes = state.notes
  const focused =
    notes.find((note) => note.localId === state.focusedLocalId) ?? notes[0] ?? undefined
  const focusedIndex = focused === undefined ? 0 : notes.indexOf(focused) + 1
  const card = focused === undefined ? createCardState() : (state.cards[focused.localId] ?? createCardState())
  const busy = card.status !== 'idle'

  const angle =
    focused === undefined
      ? undefined
      : state.strategy?.angles.find((item) => item.id === focused.angle_id)

  /** 优化建议：评分建议 + AI 味问题 + 合规问题，按来源标注，不混为一谈 */
  const suggestions: Array<{ source: string; text: string }> = []
  if (focused !== undefined) {
    suggestions.push({ source: '内容质量', text: focused.score.improvement })
    focused.ai_ness.issues.forEach((text) => suggestions.push({ source: 'AI 味', text }))
    const compliance = card.complianceCheck ?? focused.compliance
    compliance.issues.forEach((text) => suggestions.push({ source: '发布检查', text }))
  }

  return (
    <aside className="insight" aria-label="小抹洞察">
      <header className="insight-head">
        <span className="insight-avatar" aria-hidden="true">
          抹
        </span>
        <div>
          <h2 className="insight-title">小抹洞察</h2>
          <p className="insight-role">你的内容搭子</p>
        </div>
      </header>

      <p className="insight-greeting">{greeting(notes.length > 0, focusedIndex, notes.length)}</p>

      {focused === undefined ? (
        <div className="insight-empty">
          <p>生成之后，我会把这几件事摆在这儿：</p>
          <ul className="insight-empty-list">
            <li>这篇的强项在哪</li>
            <li>哪一句值得再改</li>
            <li>下一步可以做什么</li>
          </ul>
        </div>
      ) : (
        <>
          {/* 聚焦对象：让用户明确「这些话是针对哪一篇」 */}
          <div className="insight-focus">
            <span className="insight-focus-index">第 {focusedIndex} 篇</span>
            <span className="insight-focus-style">{focused.style}</span>
            <p className="insight-focus-title">{focused.title}</p>
            {angle !== undefined && <p className="insight-focus-angle">{angle.core_idea}</p>}
          </div>

          <section className="insight-block">
            <h3 className="insight-block-title">优势分析</h3>
            <p className="insight-text">{focused.score.strength}</p>
          </section>

          <section className="insight-block">
            <h3 className="insight-block-title">优化建议</h3>
            <ul className="insight-list">
              {suggestions.map((item, i) => (
                <li key={`${item.source}-${i}`} className="insight-item">
                  <span className="insight-item-source">{item.source}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="insight-block">
            <h3 className="insight-block-title">风险状态</h3>
            <div className="insight-risks">
              <span className="insight-risk">
                <span className={`summary-mark summary-mark-${focused.ai_ness.risk_level}`} aria-hidden="true" />
                AI 味 {RISK_LABELS[focused.ai_ness.risk_level]}
              </span>
              <span className="insight-risk">
                <span
                  className={`summary-mark summary-mark-${(card.complianceCheck ?? focused.compliance).risk_level}`}
                  aria-hidden="true"
                />
                发布检查 {RISK_LABELS[(card.complianceCheck ?? focused.compliance).risk_level]}
              </span>
            </div>
            <p className="insight-footnote">AI 风险提示，不代表平台审核结果</p>
          </section>

          <section className="insight-block">
            <h3 className="insight-block-title">下一步</h3>
            <div className="insight-actions">
              <button
                type="button"
                className="insight-action insight-action-primary"
                disabled={busy}
                onClick={() => void submitTitleVariants(focused.localId)}
              >
                {card.status === 'variants' ? '生成中…' : '标题优化实验室'}
              </button>
              <button
                type="button"
                className="insight-action"
                disabled={busy}
                onClick={() => void submitScore(focused.localId)}
              >
                {card.status === 'scoring' ? '评分中…' : '重新评分'}
              </button>
              <button
                type="button"
                className="insight-action"
                disabled={busy}
                onClick={() => void submitComplianceCheck(focused.localId)}
              >
                {card.status === 'checking' ? '检查中…' : '发布前检查'}
              </button>
              <button
                type="button"
                className="insight-action"
                onClick={() => void copyNote(focused.localId)}
              >
                {card.copyFeedback === 'copied' ? '已复制 ✓' : '复制这篇'}
              </button>
            </div>
          </section>
        </>
      )}
    </aside>
  )
}
