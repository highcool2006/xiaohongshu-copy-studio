/**
 * app/prompts 统一出口。
 *
 * ⚠️ 本目录只被**后端**引用（app/server）。提示词包含系统规则，
 *    绝不能被前端打包进去 —— 因此 app/src/tsconfig.json 不包含本目录。
 *
 * NodeNext 约定：本层内部与 server 侧引用均使用带 .js 后缀的相对路径。
 */

export * from './compliance.js'
export * from './generate.js'
export * from './reference.js'
export * from './rewrite.js'
export * from './score.js'
export * from './shared.js'
