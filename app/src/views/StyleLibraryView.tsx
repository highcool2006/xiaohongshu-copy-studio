/**
 * 我的创作风格资产。
 *
 * 数据来源：
 *   - 风格清单与写法说明 → lib/styleGuide（前端展示层的**唯一**风格说明来源）
 *   - 「已收藏 N 篇」     → 已保存资产按风格聚合（lib/analyticsStorage 的 aggregateAssets）
 *
 * ⚠️ 只展示前端可见的写法说明。完整的「写作策略」属于 Prompt 层（服务端），
 *    前端不引用 Prompt 模块，避免把系统提示词打包进浏览器。
 *
 * ⚠️ 「已收藏 N 篇」不等于「用过 N 次」：生成次数未按风格分别统计，这里给的是
 *    真实可得的那个数 —— 该风格下**被收藏进资产库**的篇数。标签必须如实这么写。
 *
 * 自定义风格：生成仍走 shared 的固定枚举（STYLES），因此不提供「自定义」入口，
 * 保留的是结构上的扩展位（STYLE_GUIDE 为 Record<Style, …>，枚举一变就编译失败）。
 */

import { useMemo } from 'react'

import type { Style } from '../../shared/enums'
import { aggregateAssets } from '../lib/analyticsStorage'
import { STYLE_GUIDE_LIST } from '../lib/styleGuide'
import { useApp } from '../state/AppProvider'

export function StyleLibraryView() {
  const { state, dispatch, setActiveView } = useApp()

  const assetStats = useMemo(() => aggregateAssets(state.assets), [state.assets])

  /** 把某个风格带进创作区：选中它，然后回到工作台。已选中的不重复切换 */
  const applyStyle = (style: Style): void => {
    if (!state.profile.styles.includes(style)) {
      dispatch({ type: 'TOGGLE_STYLE', style })
    }
    setActiveView('workbench')
  }

  return (
    <section className="page" aria-label="我的创作风格资产">
      <header className="page-head">
        <p className="page-eyebrow">创作资产</p>
        <h2 className="page-title">我的创作风格资产</h2>
        <p className="page-sub">
          六种写法，每一种都对应一套结构与语气 —— 不只是换语气词。点「用这个风格」可以直接带回创作区。
        </p>
      </header>

      <div className="style-assets">
        {STYLE_GUIDE_LIST.map((entry) => {
          const inUse = state.profile.styles.includes(entry.style)
          const savedCount = assetStats.byStyle.find((item) => item.key === entry.style)?.count ?? 0

          return (
            <article key={entry.style} className="style-asset">
              <header className="style-asset-head">
                <h3 className="style-asset-name">{entry.style}</h3>
                <span className="style-asset-count">
                  {savedCount > 0 ? `已收藏 ${savedCount} 篇` : '还没收藏过'}
                </span>
              </header>

              <p className="style-asset-summary">{entry.summary}</p>

              <dl className="style-asset-facts">
                <div className="style-asset-fact">
                  <dt>适合什么</dt>
                  <dd>{entry.fit}</dd>
                </div>
                <div className="style-asset-fact">
                  <dt>语言特点</dt>
                  <dd>{entry.language}</dd>
                </div>
                <div className="style-asset-fact">
                  <dt>结构特点</dt>
                  <dd>{entry.structure}</dd>
                </div>
              </dl>

              <button
                type="button"
                className={inUse ? 'style-asset-apply style-asset-apply-on' : 'style-asset-apply'}
                disabled={inUse}
                onClick={() => applyStyle(entry.style)}
              >
                {inUse ? '已在创作区 ✓' : '用这个风格'}
              </button>
            </article>
          )
        })}
      </div>

      <div className="placeholder-note">
        生成时只使用上述 6 种内置风格（由 shared 的固定枚举决定）。
        自定义风格的写入需要在生成链路中加入可扩展的风格定义，属于后续版本的范围。
      </div>
    </section>
  )
}
