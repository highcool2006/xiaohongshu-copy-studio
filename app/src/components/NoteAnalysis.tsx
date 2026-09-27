/**
 * 卡片分析抽屉（L3 层，默认折叠）。
 *
 * 从 NoteCard 抽出。卡片默认只展示「标题 → 正文 → 话题标签」，
 * 以下五块收进这里：
 *   创作角度 / 封面建议 / 六维评分 / AI 味 / 发布检查
 *
 * 提取理由：
 *   - 这五块的共同点是**分析结果**，不是**文案本体** —— 形态与生命周期一致
 *   - NoteCard 继续内联会让它同时承担「展示文案」与「展示分析」两件事
 *
 * 边界：
 *   - 全部数据来自已有的 Note 与 CardState，**不新增任何字段**
 *   - 抽屉是**展示层**：这里不放新的 AI 调用。重新评分按钮沿用原有的
 *     submitScore；「发布前检查」的触发仍在卡片操作区（不重复提供入口）
 */

import { SCORE_DIMENSION_MAX } from '../../shared/constants'
import type { ContentAngle } from '../../shared/types'
import { RISK_LABELS } from '../lib/riskLabels'
import { useApp } from '../state/AppProvider'
import { createCardState } from '../state/appState'
import type { NoteWithId } from '../state/appState'

const DIMENSION_LABELS: Record<keyof typeof SCORE_DIMENSION_MAX, string> = {
  content_value: '内容价值',
  specificity: '具体度',
  native_feel: '原生感',
  differentiation: '差异化',
  structure: '结构完整',
  authenticity: '真实性',
}

export function NoteAnalysis({
  note,
  angle,
}: {
  note: NoteWithId
  angle: ContentAngle | undefined
}) {
  const { state, submitScore } = useApp()
  const card = state.cards[note.localId] ?? createCardState()
  const busy = card.status !== 'idle'
  /** 复查结果优先于生成时的自检结果（与操作区的判定一致） */
  const compliance = card.complianceCheck ?? note.compliance

  return (
    <div className="analysis" id={`${note.localId}-analysis`}>
      {/* 创作角度：程序把它从首屏移到这里，但角度信息本身一条都没少 */}
      {angle && (
        <section className="analysis-section">
          <h4 className="analysis-heading">创作角度</h4>
          {/* 点题句已上移到卡片正文区，这里只留角度类型与写作路径，避免重复 */}
          <div className="analysis-chips">
            <span className="chip chip-angle">角度 · {angle.type}</span>
            {note.content_directions.map((direction) => (
              <span key={direction} className="chip chip-direction">
                {direction}
              </span>
            ))}
          </div>
          <p className="analysis-meta">
            {angle.audience} · {angle.scenario} · {angle.hook_type} → {angle.structure_type} →{' '}
            {angle.ending_type}
          </p>
        </section>
      )}

      {/* 封面创意建议（只给创意，不生成图片） */}
      <section className="analysis-section">
        <h4 className="analysis-heading">封面建议</h4>
        <p className="cover-headline">{note.cover_suggestion.headline}</p>
        <p className="cover-meta">
          画面主体：{note.cover_suggestion.visual_subject} · 构图：{note.cover_suggestion.composition}
        </p>
      </section>

      {/* 内容质量（六维） */}
      <section className="analysis-section">
        <div className="quality-head">
          <span className="quality-label">内容质量</span>
          <span className="quality-total">
            {note.score.total}
            <span className="quality-max">/100</span>
          </span>
          {card.scoreStale && <span className="score-stale">内容已修改，评分可能过时</span>}
          <button
            type="button"
            className="card-button card-button-small"
            disabled={busy}
            onClick={() => void submitScore(note.localId)}
          >
            {card.status === 'scoring' ? '评分中…' : '重新评分'}
          </button>
        </div>
        <div className="quality-dims">
          {(Object.keys(SCORE_DIMENSION_MAX) as Array<keyof typeof SCORE_DIMENSION_MAX>).map(
            (dimension) => (
              <span key={dimension} className="dim">
                <span className="dim-label">{DIMENSION_LABELS[dimension]}</span>
                <span className="dim-value">
                  {note.score[dimension]}
                  <span className="dim-max">/{SCORE_DIMENSION_MAX[dimension]}</span>
                </span>
              </span>
            ),
          )}
        </div>
        <p className="quality-note">
          <span className="quality-note-key">优势</span>
          {note.score.strength}
        </p>
        <p className="quality-note">
          <span className="quality-note-key">建议</span>
          {note.score.improvement}
        </p>
      </section>

      {/* AI 味 + 发布检查：只展示结果，触发入口仍在卡片操作区 */}
      <section className="analysis-section">
        <div className="check-row">
          <span className="check-label">AI 味</span>
          <span className={`risk risk-${note.ai_ness.risk_level}`}>
            {RISK_LABELS[note.ai_ness.risk_level]}
          </span>
          {note.ai_ness.issues.length > 0 && (
            <span className="check-text">{note.ai_ness.issues.join('；')}</span>
          )}
        </div>
        <div className="check-row">
          <span className="check-label">发布检查</span>
          <span className={`risk risk-${compliance.risk_level}`}>
            {RISK_LABELS[compliance.risk_level]}
          </span>
          {compliance.issues.length > 0 ? (
            <span className="check-text">{compliance.issues.join('；')}</span>
          ) : (
            <span className="check-text">未发现明显风险</span>
          )}
          <span className="check-note">AI 风险提示，不代表平台审核结果</span>
        </div>
      </section>
    </div>
  )
}
