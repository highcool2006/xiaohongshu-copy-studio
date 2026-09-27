/**
 * 工作台外壳：顶部导航 + 视图切换 + 底部状态栏。
 *
 * 不引入 react-router，用 activeView 轻量切换（依据 V2 决策）。
 */

import { AiInsightPanel } from './components/AiInsightPanel'
import { ResultPanel } from './components/ResultPanel'
import { SetupPanel } from './components/SetupPanel'
import { StatusBar } from './components/StatusBar'
import { WorkbenchNav } from './components/WorkbenchNav'
import { AppProvider, useApp } from './state/AppProvider'
import { AssetsView } from './views/AssetsView'
import { ReviewView } from './views/ReviewView'
import { StyleLibraryView } from './views/StyleLibraryView'

function Shell() {
  const { state } = useApp()

  return (
    <div className="app">
      <WorkbenchNav />

      {state.activeView === 'workbench' ? (
        /* 三栏：创作输入 | 爆款方案（核心）| 小抹洞察 */
        <main className="app-main">
          <SetupPanel />
          <ResultPanel />
          <AiInsightPanel />
        </main>
      ) : (
        <main className="app-main app-main-single">
          {state.activeView === 'style-library' && <StyleLibraryView />}
          {state.activeView === 'review' && <ReviewView />}
          {state.activeView === 'assets' && <AssetsView />}
        </main>
      )}

      <StatusBar />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
