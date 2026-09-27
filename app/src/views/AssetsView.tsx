/**
 * 资产库（Phase 9）。
 *
 * 数据来自 localStorage（见 lib/assetsStorage）：
 *   - 刷新后仍在；读取失败会安全降级，不会让页面崩溃
 *   - 只读展示 + 删除，不做搜索/编辑（编辑在卡片上进行）
 *
 * 资产的字段集覆盖：标题 / 正文 / 风格 / 内容方向 / 保存时间 /
 * 质量分 / 发布检查风险 / AI 味风险 / 标题 A/B 记录 / 产品信息。
 */

import { useState } from 'react'

import { RISK_LABELS } from '../lib/riskLabels'
import { variantSlotLabel } from '../lib/titleExperiment'
import type { SavedAsset } from '../lib/assetsStorage'
import { useApp } from '../state/AppProvider'


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

function AssetCard({ asset }: { asset: SavedAsset }) {
  const { deleteAsset } = useApp()
  const [open, setOpen] = useState(false)

  const toggle = () => setOpen((value) => !value)

  const confirmDelete = () => {
    if (window.confirm('删除这条资产？删除后无法恢复。')) {
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

      <div className="asset-stats">
        <span className="asset-stat">
          <span className="asset-stat-key">内容质量</span>
          <span className="asset-stat-value">
            {asset.note.score_total}
            <span className="asset-stat-max">/100</span>
          </span>
        </span>
        <span className="asset-stat">
          <span className="asset-stat-key">AI 味</span>
          <span className={`risk risk-${asset.note.ai_ness_risk}`}>{RISK_LABELS[asset.note.ai_ness_risk] ?? ''}</span>
        </span>
        <span className="asset-stat">
          <span className="asset-stat-key">发布检查</span>
          <span className={`risk risk-${asset.note.compliance_risk}`}>
            {RISK_LABELS[asset.note.compliance_risk] ?? ''}
          </span>
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
              <p className="asset-section-title">标题 A/B 记录</p>
              {asset.title_experiment.original_title !== null && (
                <p className="asset-line">
                  <span className="variant-slot">原标题</span>
                  <span className="asset-line-text">{asset.title_experiment.original_title}</span>
                </p>
              )}
              {asset.title_experiment.variants.map((variant, index) => (
                <p key={variant.title} className="asset-line">
                  <span className="variant-slot">{variantSlotLabel(index)}</span>
                  <span className="asset-line-text">{variant.title}</span>
                  {variant.title === asset.note.title && <span className="variant-current">保存时使用</span>}
                </p>
              ))}
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

      <div className="asset-actions">
        <button type="button" className="card-button" onClick={toggle}>
          {open ? '收起' : '查看'}
        </button>
        <button type="button" className="card-button card-button-danger" onClick={confirmDelete}>
          删除
        </button>
      </div>
    </li>
  )
}

export function AssetsView() {
  const { state } = useApp()
  const { assets, assetsLoaded } = state

  return (
    <section className="page" aria-label="资产库">
      <header className="page-head">
        <h2 className="page-title">资产库</h2>
        <p className="page-sub">
          {assets.length > 0
            ? `已保存 ${assets.length} 条资产 · 保存在本机浏览器中，刷新后仍在`
            : '保存你的生成批次与文案，便于复用与复盘。'}
        </p>
      </header>

      {!assetsLoaded && <p className="assets-loading">正在读取本地资产……</p>}

      {assetsLoaded && assets.length === 0 && (
        <div className="empty">
          <p className="empty-title">还没有本地资产</p>
          <ol className="empty-steps">
            <li>在工作台填写产品与卖点，生成文案</li>
            <li>在任意一张卡片上点击「保存到资产库」</li>
            <li>资产保存在本机浏览器（localStorage），刷新页面后仍可查看</li>
          </ol>
        </div>
      )}

      {assets.length > 0 && (
        <ul className="asset-list">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </section>
  )
}
