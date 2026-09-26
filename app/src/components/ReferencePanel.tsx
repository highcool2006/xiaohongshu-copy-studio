/**
 * 参考文案分析结果卡（Phase 7）。
 *
 * 三段结构：
 *   1. 它是怎么写的 —— 9 个方法特征字段
 *   2. 可以借鉴的方法 —— learnable_methods
 *   3. 不要复制的内容 —— do_not_copy
 *
 * 边界提示固定显示在卡片底部：分析只描述写法与结构，不会复制原文。
 * 本组件是**纯展示**：不触发任何请求，也不参与生成流程。
 */

import type { ReferenceAnalysis } from '../../shared/types'

/**
 * 契约字段 → 界面标签。
 *
 * 用 Record<keyof ...> 保证 9 个字段一个不漏 —— 契约增减字段会编译失败。
 * 语义映射（Phase 7 确认，不新增契约字段）：
 *   opening_type 同时承载「标题结构」；narrative 同时承载「语言风格」。
 */
const FIELD_LABELS: Record<
  | 'topic'
  | 'opening_type'
  | 'structure'
  | 'information_density'
  | 'rhythm'
  | 'narrative'
  | 'emotional_intensity'
  | 'ending_type'
  | 'interaction',
  string
> = {
  topic: '主题',
  opening_type: '开头 / 标题策略',
  structure: '内容结构',
  information_density: '信息密度',
  rhythm: '节奏',
  narrative: '叙事 / 语言风格',
  emotional_intensity: '情绪强度',
  ending_type: '结尾',
  interaction: '互动 / CTA',
}

export function ReferencePanel({ analysis }: { analysis: ReferenceAnalysis }) {
  return (
    <div className="ref-card">
      <p className="ref-section-title">它是怎么写的</p>

      <dl className="ref-fields">
        {(Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).map((field) => (
          <div key={field} className="ref-field">
            <dt className="ref-field-label">{FIELD_LABELS[field]}</dt>
            <dd className="ref-field-value">{analysis[field]}</dd>
          </div>
        ))}
      </dl>

      {analysis.learnable_methods.length > 0 && (
        <>
          <p className="ref-section-title ref-section-title-spaced">可以借鉴的方法</p>
          <ul className="ref-list">
            {analysis.learnable_methods.map((method) => (
              <li key={method} className="ref-list-item">
                {method}
              </li>
            ))}
          </ul>
        </>
      )}

      {analysis.do_not_copy.length > 0 && (
        <>
          <p className="ref-section-title ref-section-title-spaced">不要复制的内容</p>
          <ul className="ref-list ref-list-warn">
            {analysis.do_not_copy.map((item) => (
              <li key={item} className="ref-list-item">
                {item}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="ref-note">以上仅分析写法与结构，不会复制参考文案中的句子、故事或具体事实。</p>
    </div>
  )
}
