/**
 * Mock 开关（**唯一**判定点）。
 *
 * 只认显式的 "true"，其它值（含未设置）一律视为关闭 —— 默认关闭。
 * 开启方式（无需创建 .env 文件）：
 *   VITE_USE_MOCK_DATA=true npm run dev:web
 *
 * ⚠️ Mock 只用于开发与 UI 验收，**永不进入生产路径**。
 * 用可选链读取 import.meta.env：该对象只由 Vite 注入，在非 Vite 环境下安全地视为关闭。
 */
export function isMockEnabled(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  return env?.VITE_USE_MOCK_DATA === 'true'
}
