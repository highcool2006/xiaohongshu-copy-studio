/**
 * app/shared 统一出口。
 *
 * 前端（app/src）与后端（app/server）都只能从这里引用共享内容，
 * 以保证「单一事实来源」：枚举、常量、规则不在任何一侧复制第二份。
 *
 * ⚠️ NodeNext 约定：server 侧引用本层时使用带 .js 后缀的相对路径，
 *    例如：import { STYLES } from '../shared/index.js'
 */

export * from './allocation.js'
export * from './constants.js'
export * from './diversity.js'
export * from './enums.js'
export * from './types.js'
export * from './validation.js'
