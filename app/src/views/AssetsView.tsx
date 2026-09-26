/**
 * 资产库（Phase 6：结构占位；本地保存与导出在 Phase 9 接入）。
 *
 * 说明：当前版本**还没有**本地持久化，因此这里不会显示任何"历史记录"，
 * 避免用假数据制造"已经有资产"的错觉。
 */

export function AssetsView() {
  return (
    <section className="page" aria-label="资产库">
      <header className="page-head">
        <h2 className="page-title">资产库</h2>
        <p className="page-sub">保存你的生成批次与文案，便于复用与复盘。</p>
      </header>

      <div className="empty">
        <p className="empty-title">还没有本地资产</p>
        <ol className="empty-steps">
          <li>当前版本尚未开启本地保存，因此这里没有任何记录</li>
          <li>Phase 9 将接入 localStorage（结构：Workspace → Product → Batch → Note → 标题变体 → 复盘）</li>
          <li>届时支持查看 / 删除 / 复制 / 导出（TXT · Markdown · JSON）</li>
        </ol>
      </div>
    </section>
  )
}
