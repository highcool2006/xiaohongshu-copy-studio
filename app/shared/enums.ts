/**
 * 固定枚举。
 *
 * ⚠️ STYLES 的数组顺序即语义：风格分配的 round-robin 顺序依赖它。
 *    调整顺序等于改变分配结果，必须同步修改文档与测试预期。
 *
 * 依据：docs/技术架构决策.md 第 8、9 节
 */

/* ---------- 4 个基础风格 ---------- */

export const STYLES = ['亲切分享', '专业测评', '搞笑段子', '干货攻略'] as const

export type Style = (typeof STYLES)[number]

/* ---------- 8 个内容方向 ---------- */

export const CONTENT_DIRECTIONS = [
  '使用场景',
  '用户痛点',
  '产品亮点',
  '购买建议',
  '避坑攻略',
  '干货清单',
  '对比分析',
  '情绪共鸣',
] as const

export type ContentDirection = (typeof CONTENT_DIRECTIONS)[number]

/* ---------- 类型守卫 ---------- */

export function isStyle(value: unknown): value is Style {
  return typeof value === 'string' && (STYLES as readonly string[]).includes(value)
}

export function isContentDirection(value: unknown): value is ContentDirection {
  return typeof value === 'string' && (CONTENT_DIRECTIONS as readonly string[]).includes(value)
}

/* ---------- 顺序工具 ---------- */

/**
 * 按「固定枚举顺序」重排给定风格，并过滤掉非法值与重复项。
 *
 * 用途：用户勾选顺序不可预期，任何依赖顺序的逻辑都必须先经过本函数。
 */
export function sortStyles(styles: readonly string[]): Style[] {
  const selected = new Set(styles)
  return STYLES.filter((style) => selected.has(style))
}
