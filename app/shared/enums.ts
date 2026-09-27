/**
 * 固定枚举。
 *
 * ⚠️ STYLES 的数组顺序即语义：风格分配的 round-robin 顺序依赖它。
 *    调整顺序等于改变分配结果，必须同步修改文档与测试预期。
 *
 * 依据：docs/技术架构决策.md 第 8、9 节；docs/V2产品决策.md
 */

/* ---------- 文案风格（生成时可选的固定枚举） ---------- */

export const STYLES = [
  '亲切分享',
  '专业测评',
  '搞笑段子',
  '干货攻略',
  '情绪共鸣',
  '清单种草',
] as const

export type Style = (typeof STYLES)[number]

/* ---------- 8 个内容方向（一篇可含多个标签） ---------- */

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

/* ---------- V2 新增：目标用户 / 使用场景 / 内容目标 / 创作角度类型 ---------- */

/**
 * 目标用户**预设**（UI 选项）。
 * 用户可自定义，因此实际存储的是 string[]，这里只提供候选项。
 */
export const TARGET_USER_PRESETS = [
  '学生党',
  '上班族',
  '宝妈',
  '健身人群',
  '旅行人群',
  '送礼人群',
  '年轻女性',
  '男性用户',
] as const

/** 使用场景**预设**（UI 选项）；用户可自定义，实际存储为 string[] */
export const SCENARIO_PRESETS = [
  '办公室',
  '宿舍',
  '通勤',
  '学习',
  '旅行',
  '居家',
  '送礼',
  '周末',
  '聚会',
  '日常囤货',
] as const

/** 内容目标（单选） */
export const CONTENT_GOALS = [
  '种草',
  '产品介绍',
  '购买决策',
  '经验分享',
  '干货科普',
  '场景内容',
  '品牌内容',
] as const

export type ContentGoal = (typeof CONTENT_GOALS)[number]

/* ---------- 文案类型（单选；体裁控制） ---------- */

/**
 * 文案类型 = 这篇文案的**体裁**：讲什么、不讲什么、按什么结构组织。
 *
 * 与另外两个控制项的三层关系（提示词中有同一条规则，勿改其一）：
 *   - 文案类型（本枚举）：体裁与内容取舍
 *   - 内容目标 CONTENT_GOALS：这篇内容要达成什么意图
 *   - 文案风格 STYLES：语气与句式（怎么写）
 * 冲突时以**文案类型**为准。
 */
export const COPY_TYPES = [
  '强种草推荐',
  '产品测评',
  '平价好物分享',
  '避坑对比',
  '使用攻略',
] as const

export type CopyType = (typeof COPY_TYPES)[number]

/**
 * 文案类型默认值（单选控件不会出现空值）。
 *
 * 三个消费方必须一致：前端初始 state、后端校验缺省、提示词兜底。
 */
export const COPY_TYPE_DEFAULT: CopyType = '强种草推荐'

/** 创作角度类型（每篇一个 angle.type） */
export const ANGLE_TYPES = ['场景', '人群', '决策', '产品', '对比', '情绪', '清单'] as const

export type AngleType = (typeof ANGLE_TYPES)[number]

/** AI 味 / 合规风险的等级（两者共用同一套等级） */
export const RISK_LEVELS = ['low', 'medium', 'high'] as const

export type RiskLevel = (typeof RISK_LEVELS)[number]

/* ---------- 类型守卫 ---------- */

export function isStyle(value: unknown): value is Style {
  return typeof value === 'string' && (STYLES as readonly string[]).includes(value)
}

export function isContentDirection(value: unknown): value is ContentDirection {
  return typeof value === 'string' && (CONTENT_DIRECTIONS as readonly string[]).includes(value)
}

export function isContentGoal(value: unknown): value is ContentGoal {
  return typeof value === 'string' && (CONTENT_GOALS as readonly string[]).includes(value)
}

export function isAngleType(value: unknown): value is AngleType {
  return typeof value === 'string' && (ANGLE_TYPES as readonly string[]).includes(value)
}

export function isCopyType(value: unknown): value is CopyType {
  return typeof value === 'string' && (COPY_TYPES as readonly string[]).includes(value)
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && (RISK_LEVELS as readonly string[]).includes(value)
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
