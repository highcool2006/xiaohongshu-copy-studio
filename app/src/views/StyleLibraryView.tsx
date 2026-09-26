/**
 * 风格库（Phase 6：结构与预设展示；自定义风格保存在 Phase 9 接入）。
 *
 * ⚠️ 只展示前端可见的简短说明。完整的"写作策略"属于 Prompt 层（服务端），
 *    前端不引用 Prompt 模块，避免把系统提示词打包进浏览器。
 */

import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'

const STYLE_SUMMARY: Record<Style, { fit: string; language: string; structure: string }> = {
  亲切分享: { fit: '适合日常推荐、朋友视角', language: '口语、短句、有停顿', structure: '一条经历线，不列点' },
  专业测评: { fit: '适合购买决策、参数说明', language: '克制陈述，不用感叹号', structure: '结论前置 + 维度拆解' },
  搞笑段子: { fit: '适合轻松话题、反差表达', language: '极短句、留白', structure: '铺垫 → 转折 → 冷收' },
  干货攻略: { fit: '适合步骤、清单、避坑', language: '祈使句、短句', structure: '结果前置 + 编号步骤' },
  情绪共鸣: { fit: '适合生活方式、情绪表达', language: '中短句，真诚克制', structure: '情绪铺垫 → 产品为落点' },
  清单种草: { fit: '适合多卖点并列、快速阅读', language: '条目平行、短句', structure: '编号条目 + 边界提醒' },
}

export function StyleLibraryView() {
  return (
    <section className="page" aria-label="风格库">
      <header className="page-head">
        <h2 className="page-title">风格库</h2>
        <p className="page-sub">内置 6 种风格，每种都对应一套写法（不只是语气差异）。</p>
      </header>

      <div className="style-library">
        {STYLES.map((style: Style) => {
          const info = STYLE_SUMMARY[style]
          return (
            <article key={style} className="style-card-lg">
              <h3 className="style-card-lg-title">{style}</h3>
              <dl className="style-facts">
                <div>
                  <dt>适合什么</dt>
                  <dd>{info.fit}</dd>
                </div>
                <div>
                  <dt>语言特点</dt>
                  <dd>{info.language}</dd>
                </div>
                <div>
                  <dt>结构特点</dt>
                  <dd>{info.structure}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>

      <div className="placeholder-note">
        自定义风格与「收藏当前文案风格」将在 Phase 9 接入（localStorage 保存，带 schemaVersion）。
      </div>
    </section>
  )
}
