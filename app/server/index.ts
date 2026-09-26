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

/**
 * 持有 server 引用，并显式处理启动错误。
 *
 * 为什么必须显式处理（实测行为，Windows）：
 *   端口已被占用时，`listen` 的回调**仍会被调用**（于是先打印"已启动"），
 *   随后进程以**退出码 0 静默退出** —— 既没有错误信息，退出码也是"成功"。
 *   结果是：以为服务起来了，实际端口上跑的是**另一个**进程，问题完全不可诊断。
 *
 * 处理方式：把错误明确说出来并以非零码退出（fail fast）。
 *   换端口或自动重试会掩盖冲突 —— vite 的代理写死了 3001，静默换端口只会让问题更晚暴露。
 */
const server = app.listen(PORT, () => {
  console.log(`[server] 已启动：http://localhost:${PORT}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[server] 启动失败：端口 ${PORT} 已被占用（可能已有一个后端在运行）。\n` +
        '  处理方式：先停掉占用该端口的进程，或用 PORT=其它端口 启动。',
    )
  } else {
    console.error(`[server] 启动失败：${error.code ?? ''} ${error.message}`)
  }
  process.exit(1)
})
