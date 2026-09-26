import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'

/**
 * 后端入口（脚手架）。
 *
 * 目前只包含：
 *   1. GET /api/health —— 健康检查（非业务端点，用于本地确认服务在跑、演示前排障）
 *   2. 生产环境下的前端静态文件服务
 *
 * 三个业务端点（/api/generate、/api/rewrite、/api/score）尚未实现，
 * 契约见 docs/技术架构决策.md 第 4 节。
 */

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(express.json())

// 健康检查（非业务端点）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// 生产环境：由 Express 提供 Vite 构建产物，实现「API 与前端同一进程」
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web')
app.use(express.static(webDir))

app.listen(PORT, () => {
  console.log(`[server] 已启动：http://localhost:${PORT}`)
  console.log(`[server] 静态文件目录：${webDir}`)
})
