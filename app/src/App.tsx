/**
 * 单页面外壳：页头身份层 + 左右工作区。
 *
 * 页面结构见 docs/页面结构方案.md：单页、无路由、无页脚、无导航。
 * 本阶段只接通「输入 → /api/generate → 结果展示」这一条链路。
 */

import { InputPanel } from './components/InputPanel'
import { ResultPanel } from './components/ResultPanel'
import { AppProvider } from './state/AppProvider'

export default function App() {
  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">小红书爆款文案工坊</h1>
          <p className="app-tagline">输入产品和卖点，批量生成不同风格的小红书种草笔记</p>
        </header>

        <main className="app-main">
          <InputPanel />
          <ResultPanel />
        </main>
      </div>
    </AppProvider>
  )
}
