/**
 * 进程入口。
 *
 * 只做两件事：读取端口、启动应用。
 * 应用装配见 app.ts —— 这样测试可以构造带依赖注入的 app 而不启动真实端口。
 *
 * 端口取自环境变量 PORT（开发环境由 `--env-file-if-exists=.env` 提供）。
 */

import { createApp } from './app.js'

const PORT = Number(process.env.PORT ?? 3001)

const app = createApp()

app.listen(PORT, () => {
  console.log(`[server] 已启动：http://localhost:${PORT}`)
})
