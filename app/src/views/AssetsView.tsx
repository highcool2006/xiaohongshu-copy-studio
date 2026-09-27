/**
 * 我的创作收藏。
 *
 * 四个分区（同一条资产的不同侧面，不是四份数据）：
 *   收藏笔记   —— 完整资产，可展开查看正文 / 标签 / 标题记录 / 产品信息
 *   标题模板   —— 汇总所有资产里做过的标题变体（含 AI 给的切入理由）
 *   封面模板   —— 汇总所有资产保存时的封面创意建议
 *   风格资产   —— 你在哪些风格下积累了多少篇，可跳去风格库
 *
 * 数据来自 localStorage（见 lib/assetsStorage）：刷新后仍在；读取失败安全降级。
 * 只读展示 + 删除，不做搜索/编辑（编辑在卡片上进行）。
 *
 * ⚠️ cover_suggestion 是 2026-09-27 新增的可选字段：**此前收藏的资产没有它**。
 *    封面模板区会如实说明有多少条缺这一项，而不是当作 0 或悄悄跳过。
 */

import { useMemo, useState } from 'react'

import { aggregateAssets } from '../lib/analyticsStorage'
import { RISK_LABELS } from '../lib/riskLabels'
import { STYLE_GUIDE } from '../lib/styleGuide'
import { variantSlotLabel } from '../lib/titleExperiment'
import type { SavedAsset } from '../lib/assetsStorage'
import { useApp } from '../state/AppProvider'

type Section = 'notes' | 'titles' | 'covers' | 'styles'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'notes', label: '收藏笔记' },
  { id: 'titles', label: '标题模板' },
  { id: 'covers', label: '封面模板' },
  { id: 'styles', label: '风格资产' },
]

/** 把 ISO 时间格式化为本地可读文本；非法时间不抛错 */
function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 资产所属的产品名，用作「这条模板是从哪来的」的出处标注 */
function sourceOf(asset: SavedAsset): string {
  return asset.product.name.length > 0 ? asset.product.name : '未命名产品'
}

function AssetCard({ asset }: { asset: SavedAsset }) {
  const { deleteAsset } = useApp()
  const [open, setOpen] = useState(false)

  const toggle = () => setOpen((value) => !value)

  const confirmDelete = () => {
    if (window.confirm('删除这条收藏？删除后无法恢复。')) {
      deleteAsset(asset.id)
    }
  }

  return (
    <li className={open ? 'asset-card asset-card-open' : 'asset-card'}>
      <div className="asset-head">
        <button type="button" className="asset-toggle" aria-expanded={open} onClick={toggle}>
          {asset.note.title}
        </button>
        <div className="asset-tags">
          <span className="chip chip-style">{asset.note.style}</span>
          {asset.note.content_directions.map((direction) => (
            <span key={direction} className="chip chip-direction">
              {direction}
            </span>
          ))}
        </div>
      </div>

      {/* 分数是这张卡唯一的强信号，放前；风险点是辅助；时间退到最后 */}
      <div className="asset-stats">
        <span className="asset-score">
          {asset.note.score_total}
          <span className="asset-score-max">/100</span>
        </span>
        <span className="asset-stat">
          <span
            className={`summary-mark summary-mark-${asset.note.ai_ness_risk}`}
            aria-hidden="true"
          />
          AI 味 {RISK_LABELS[asset.note.ai_ness_risk] ?? ''}
        </span>
        <span className="asset-stat">
          <span
            className={`summary-mark summary-mark-${asset.note.compliance_risk}`}
            aria-hidden="true"
          />
          发布检查 {RISK_LABELS[asset.note.compliance_risk] ?? ''}
        </span>
        <span className="asset-time">{formatTime(asset.savedAt)}</span>
      </div>

      {open && (
        <div className="asset-body">
          <p className="asset-text">{asset.note.body}</p>

          {asset.note.hashtags.length > 0 && (
            <div className="asset-hashtags">
              {asset.note.hashtags.map((tag) => (
                <span key={tag} className="hashtag">
                  <span className="hashtag-hash">#</span>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {asset.title_experiment.variants.length > 0 && (
            <div className="asset-section">
              <p className="asset-section-title">标题记录</p>
              {asset.title_experiment.original_title !== null && (
                <p className="asset-line">
                  <span className="variant-slot">标题 A</span>
                  <span className="asset-line-text">{asset.title_experiment.original_title}</span>
                </p>
              )}
              {asset.title_experiment.variants.map((variant, index) => (
                <p key={variant.title} className="asset-line">
                  <span className="variant-slot">{variantSlotLabel(index)}</span>
                  <span className="asset-line-text">{variant.title}</span>
                  {variant.title === asset.note.title && <span className="variant-current">收藏时使用</span>}
                </p>
              ))}
            </div>
          )}

          {asset.cover_suggestion !== undefined && (
            <div className="asset-section">
              <p className="asset-section-title">封面建议</p>
              <p className="asset-line">
                <span className="asset-line-key">封面标题</span>
                <span className="asset-line-text">{asset.cover_suggestion.headline}</span>
              </p>
              <p className="asset-line">
                <span className="asset-line-key">画面主体</span>
                <span className="asset-line-text">{asset.cover_suggestion.visual_subject}</span>
              </p>
              <p className="asset-line">
                <span className="asset-line-key">构图</span>
                <span className="asset-line-text">{asset.cover_suggestion.composition}</span>
              </p>
            </div>
          )}

          <div className="asset-section">
            <p className="asset-section-title">产品信息</p>
            <p className="asset-line">
              <span className="asset-line-key">产品</span>
              <span className="asset-line-text">
                {asset.product.name.length > 0 ? asset.product.name : '（未填写）'}
                {asset.product.category.length > 0 ? `（${asset.product.category}）` : ''}
              </span>
            </p>
            <p className="asset-line">
              <span className="asset-line-key">卖点</span>
              <span className="asset-line-text">
                {asset.product.selling_points.length > 0 ? asset.product.selling_points.join('、') : '（未填写）'}
              </span>
            </p>
            <p className="asset-line">
              <span className="asset-line-key">内容目标</span>
              <span className="asset-line-text">{asset.product.goal}</span>
            </p>
          </div>
        </div>
      )}

      {/*
        删除是破坏性操作，不该和「查看」平权。这里降为次要文字按钮：
        平时是浅灰，只有悬停时才显出危险色 —— 一屏六个红按钮是最强的"后台感"来源。
      */}
      <div className="asset-actions">
        <button type="button" className="asset-open" aria-expanded={open} onClick={toggle}>
          {open ? '收起全文' : '查看全文'}
          <span className="summary-caret" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
        <button type="button" className="asset-remove" onClick={confirmDelete}>
          删除
        </button>
      </div>
    </li>
  )
}

export function AssetsView() {
  const { state, setActiveView } = useApp()
  const { assets, assetsLoaded } = state
  const [section, setSection] = useState<Section>('notes')

  const assetStats = useMemo(() => aggregateAssets(assets), [assets])

  /** 标题模板：把所有资产做过的标题变体摊平，保留出处 */
  const titleTemplates = useMemo(
    () =>
      assets.flatMap((asset) =>
        asset.title_experiment.variants.map((variant) => ({
          key: `${asset.id}-${variant.title}`,
          variant,
          from: sourceOf(asset),
          style: asset.note.style,
        })),
      ),
    [assets],
  )

  /** 封面模板：同样摊平；同时统计有多少条旧资产没记录封面 */
  const coverTemplates = useMemo(
    () =>
      assets
        .filter((asset) => asset.cover_suggestion !== undefined)
        .map((asset) => ({
          key: asset.id,
          cover: asset.cover_suggestion!,
          from: sourceOf(asset),
          style: asset.note.style,
        })),
    [assets],
  )
  const missingCover = assets.length - coverTemplates.length

  return (
    <section className="page" aria-label="我的创作收藏">
      <header className="page-head">
        <p className="page-eyebrow">创作资产</p>
        <h2 className="page-title">我的创作收藏</h2>
        <p className="page-sub">
          {assets.length > 0
            ? `已收藏 ${assets.length} 条 · 保存在本机浏览器中，刷新后仍在`
            : '收藏你满意的文案、标题与封面，慢慢攒成自己的素材库。'}
        </p>
      </header>

      {!assetsLoaded && <p className="assets-loading">正在读取本地收藏……</p>}

      {assetsLoaded && assets.length === 0 && (
        <div className="empty">
          <p className="empty-title">这里会攒下你写过的故事</p>
          <ol className="empty-steps">
            <li>在工作台填好产品与卖点，生成方案</li>
            <li>在满意的方案上点「收藏模板」</li>
            <li>收藏保存在本机浏览器（localStorage），刷新后仍可查看</li>
          </ol>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <nav className="asset-tabs" aria-label="收藏分区">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? 'asset-tab asset-tab-on' : 'asset-tab'}
                aria-current={section === item.id ? 'true' : undefined}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {section === 'notes' && (
            <ul className="asset-list">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </ul>
          )}

          {section === 'titles' && (
            <>
              {titleTemplates.length === 0 ? (
                <div className="placeholder-note">
                  还没有标题模板。在方案卡片上点「标题优化实验室」生成变体后再收藏，这里就会攒起来。
                </div>
              ) : (
                <ul className="template-list">
                  {titleTemplates.map((item) => (
                    <li key={item.key} className="template-card">
                      <div className="template-head">
                        <span className="chip chip-quiet">{item.variant.type}</span>
                        <span className="template-source">
                          {item.from} · {item.style}
                        </span>
                      </div>
                      <p className="template-title">{item.variant.title}</p>
                      <p className="template-why">{item.variant.analysis}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {section === 'covers' && (
            <>
              {coverTemplates.length === 0 ? (
                <div className="placeholder-note">
                  {missingCover > 0
                    ? `已收藏的 ${missingCover} 条资产都在封面记录功能之前保存，没有留下封面建议。新收藏的方案会自动带上。`
                    : '还没有封面模板。收藏方案时会把封面创意建议一起存下来。'}
                </div>
              ) : (
                <>
                  <ul className="template-list">
                    {coverTemplates.map((item) => (
                      <li key={item.key} className="template-card">
                        <div className="template-head">
                          <span className="chip chip-quiet">{item.style}</span>
                          <span className="template-source">{item.from}</span>
                        </div>
                        <p className="template-title">{item.cover.headline}</p>
                        <p className="template-why">画面主体：{item.cover.visual_subject}</p>
                        <p className="template-why">构图：{item.cover.composition}</p>
                      </li>
                    ))}
                  </ul>
                  {missingCover > 0 && (
                    <p className="template-note">
                      另有 {missingCover} 条较早收藏的资产没有封面记录（该字段是后加的）。
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {section === 'styles' && (
            <>
              <ul className="template-list">
                {assetStats.byStyle.map((item) => {
                  const guide = STYLE_GUIDE[item.key as keyof typeof STYLE_GUIDE]
                  return (
                    <li key={item.key} className="template-card">
                      <div className="template-head">
                        <span className="chip chip-style">{item.key}</span>
                        <span className="template-count">已收藏 {item.count} 篇</span>
                      </div>
                      {guide !== undefined && <p className="template-why">{guide.fit}</p>}
                    </li>
                  )
                })}
              </ul>
              <button type="button" className="insight-action" onClick={() => setActiveView('style-library')}>
                去风格库看全部写法
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}
