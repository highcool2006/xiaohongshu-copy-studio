/**
 * 底部状态栏：说明数据来源与当前 AI 状态。
 *
 * 明确标注「未连接平台数据」，避免任何伪造的平台指标。
 */

import { isMockEnabled } from '../api/mockMode'

export function StatusBar() {
  const mock = isMockEnabled()

  return (
    <footer className="statusbar">
      <span className="statusbar-item">
        AI 状态：{mock ? 'Mock 模式（不消耗额度）' : '真实 AI（已连接模型服务）'}
      </span>
      <span className="statusbar-item">数据来源：仅本地操作记录 · 未连接小红书平台数据</span>
    </footer>
  )
}
