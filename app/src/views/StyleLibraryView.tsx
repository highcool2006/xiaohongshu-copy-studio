/**
 * 风格库（Phase 9）。
 *
 * 数据来源：lib/styleGuide（前端展示层的**唯一**风格说明来源）——
 * 此处不再自带一份风格定义，风格清单本身来自 app/shared/enums 的 STYLES。
 *
 * ⚠️ 只展示前端可见的写法说明。完整的「写作策略」属于 Prompt 层（服务端），
 *    前端不引用 Prompt 模块，避免把系统提示词打包进浏览器。
 *
 * 自定义风格：当前生成仍走 shared 的固定枚举（STYLES），因此这里只做展示，
 * 不提供「自定义」入口 —— 保留的是**结构上的扩展位**（STYLE_GUIDE 为
 * Record<Style, …>，枚举一变就编译失败，不会漏配）。
 */

import { STYLE_GUIDE_LIST } from '../lib/styleGuide'

export function StyleLibraryView() {
  return (
    <section className="page" aria-label="风格库">
      <header className="page-head">
        <h2 className="page-title">风格库</h2>
        <p className="page-sub">内置 6 种风格，每种都对应一套写法（不只是语气差异）。</p>
      </header>

      <div className="style-library">
        {STYLE_GUIDE_LIST.map((entry) => (
          <article key={entry.style} className="style-card-lg">
            <h3 className="style-card-lg-title">{entry.style}</h3>
            <p className="style-card-lg-summary">{entry.summary}</p>
            <dl className="style-facts">
              <div>
                <dt>适合什么</dt>
                <dd>{entry.fit}</dd>
              </div>
              <div>
                <dt>语言特点</dt>
                <dd>{entry.language}</dd>
              </div>
              <div>
                <dt>结构特点</dt>
                <dd>{entry.structure}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="placeholder-note">
        生成时仍只使用上述 6 种内置风格（由 shared 的固定枚举决定）。
        自定义风格需要在生成链路中加入可扩展的风格定义，属于后续版本的范围。
      </div>
    </section>
  )
}
