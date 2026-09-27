import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'app/src',
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,

        /**
         * ⚠️ 这个 bypass 是必需的，不要删。
         *
         * 前端源码目录是 app/src/api/，因此文件 app/src/api/generate.ts 的模块 URL
         * 就是 `/api/generate.ts` —— 它撞上了本代理规则的前缀 `/api`。
         * 若不加区分，浏览器请求这个模块时会被转发到后端，后端没有该路由 → 404，
         * 导致整个 ESM 模块图加载失败、React 完全不执行（页面白屏）。
         *
         * 规则：凡是"看起来像源码文件"的请求（路径最后一段含小数点，如 .ts/.tsx/.css）
         * 都跳过代理，交回 Vite 处理；其余 /api/* 一律转发给后端。
         */
        bypass: (req) => {
          const url = req.url ?? ''
          const pathWithoutQuery = url.split('?')[0] ?? ''
          const lastSegment = pathWithoutQuery.split('/').pop() ?? ''
          return lastSegment.includes('.') ? url : undefined
        },
      },
    },
  },

  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
})
