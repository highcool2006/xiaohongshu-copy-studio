/**
 * 资产库的本地持久化（localStorage）。
 *
 * 设计要点：
 *   1. **版本化**：写入带 schemaVersion；读取时版本不符 → 安全降级，绝不抛异常
 *   2. **安全降级**：JSON 损坏 / 结构不符 / 单条非法 → 只丢弃坏数据，保留可用部分
 *   3. **不销毁证据**：整份数据损坏时把原始字符串转存到备份键，便于排障
 *   4. **幂等去重**：资产 id 由内容指纹决定 —— 同一篇文案重复保存是更新而不是新增
 *
 * 不含任何业务规则：本模块只负责「把资产存好、读回来、读坏了也不崩」。
 */

import type { ContentDirection, ContentGoal, RiskLevel, Style } from '../../shared/enums'
import type { CoverSuggestion, TitleVariant } from '../../shared/types'

/** 存储键（带产品前缀，避免与同域其它应用冲突） */
export const ASSETS_STORAGE_KEY = 'xhs-copy-studio/assets'
/** 损坏数据的备份键：只写不读，用于人工排障 */
export const ASSETS_BACKUP_KEY = 'xhs-copy-studio/assets.corrupted'
/** 当前 schema 版本：结构变更时 +1，并在 migrate 中处理旧版本 */
export const ASSETS_SCHEMA_VERSION = 1

/** 一条已保存的资产（自包含：不依赖会话状态，刷新后依然完整） */
export interface SavedAsset {
  id: string
  /** ISO 时间字符串 */
  savedAt: string
  product: {
    name: string
    category: string
    selling_points: string[]
    goal: ContentGoal
  }
  note: {
    /** 当前使用的标题 */
    title: string
    body: string
    hashtags: string[]
    style: Style
    content_directions: ContentDirection[]
    /** 内容质量总分（0~100） */
    score_total: number
    /** 发布检查风险等级 */
    compliance_risk: RiskLevel
    /** AI 味风险等级 */
    ai_ness_risk: RiskLevel
  }
  /** 标题 A/B 信息（没有做过标题优化时 original_title 为 null、variants 为空数组） */
  title_experiment: {
    original_title: string | null
    variants: TitleVariant[]
  }
  /**
   * 封面创意建议（2026-09-27 新增，可选）。
   *
   * ⚠️ 可选是刻意的：**此前收藏的资产没有这个字段**，读取时缺失即视为「未记录」，
   *    资产卡片的封面模板区显示占位文案而不是报错。写入永远带上它。
   */
  cover_suggestion?: CoverSuggestion
}

/** 落盘结构 */
interface AssetStoreFile {
  schemaVersion: number
  assets: SavedAsset[]
}

/* ---------- 内容指纹 ---------- */

/**
 * 由「风格 + 标题 + 正文」生成稳定的资产 id。
 *
 * 用途：同一篇文案重复点击保存时**更新**而不是新增，避免资产库堆满重复项。
 * 只做简单散列（非加密用途），保证同输入同输出即可。
 */
export function computeAssetId(style: string, title: string, body: string): string {
  const source = `${style}\u0000${title}\u0000${body}`
  let hash = 2166136261
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `asset-${(hash >>> 0).toString(36)}-${source.length.toString(36)}`
}

/* ---------- 校验（逐字段，坏数据只丢坏的那条） ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high'
}

function parseTitleVariant(value: unknown): TitleVariant | null {
  if (!isRecord(value)) return null
  const { title, type, analysis } = value
  if (typeof title !== 'string' || typeof type !== 'string' || typeof analysis !== 'string') {
    return null
  }
  return { title, type, analysis }
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * 解析单条资产。
 *
 * 无法修复的结构返回 null（调用方丢弃这一条），而不是让整份数据失效。
 */
export function parseAsset(value: unknown): SavedAsset | null {
  if (!isRecord(value)) return null

  const { id, savedAt, product, note, title_experiment: experiment } = value
  if (typeof id !== 'string' || id.length === 0) return null
  // note 是资产的核心（标题 / 正文 / 风格）；product 属于附属信息，
  // 缺失或损坏时填默认值即可，不该因此丢弃整条资产
  if (!isRecord(note)) return null
  const productRecord = isRecord(product) ? product : {}

  // note 是资产的核心：标题/正文/风格缺一不可
  const { title, body, hashtags, style, content_directions, score_total, compliance_risk, ai_ness_risk } = note
  if (typeof title !== 'string' || title.length === 0) return null
  if (typeof body !== 'string' || body.length === 0) return null
  if (typeof style !== 'string' || style.length === 0) return null

  const variants: TitleVariant[] = []
  let originalTitle: string | null = null
  if (isRecord(experiment)) {
    if (typeof experiment['original_title'] === 'string') {
      originalTitle = experiment['original_title']
    }
    if (Array.isArray(experiment['variants'])) {
      for (const item of experiment['variants']) {
        const variant = parseTitleVariant(item)
        if (variant !== null) variants.push(variant)
      }
    }
  }

  // 封面建议：三个字段齐全才算有效，否则视为「未记录」（旧资产走这条分支）
  const rawCover = value['cover_suggestion']
  let cover: CoverSuggestion | undefined
  if (isRecord(rawCover)) {
    const headline = rawCover['headline']
    const visualSubject = rawCover['visual_subject']
    const composition = rawCover['composition']
    if (
      typeof headline === 'string' &&
      headline.length > 0 &&
      typeof visualSubject === 'string' &&
      typeof composition === 'string'
    ) {
      cover = { headline, visual_subject: visualSubject, composition }
    }
  }

  return {
    id,
    savedAt: typeof savedAt === 'string' && savedAt.length > 0 ? savedAt : new Date().toISOString(),
    product: {
      name: parseString(productRecord['name']),
      category: parseString(productRecord['category']),
      selling_points: isStringArray(productRecord['selling_points']) ? productRecord['selling_points'] : [],
      goal: parseString(productRecord['goal'], '种草') as ContentGoal,
    },
    note: {
      title,
      body,
      hashtags: isStringArray(hashtags) ? hashtags : [],
      style: style as Style,
      content_directions: isStringArray(content_directions)
        ? (content_directions as ContentDirection[])
        : [],
      score_total: typeof score_total === 'number' && Number.isFinite(score_total) ? score_total : 0,
      compliance_risk: isRiskLevel(compliance_risk) ? compliance_risk : 'low',
      ai_ness_risk: isRiskLevel(ai_ness_risk) ? ai_ness_risk : 'low',
    },
    title_experiment: { original_title: originalTitle, variants },
    // 旧资产没有这一项 → 保持 undefined（界面据此显示「收藏时未记录」）
    ...(cover === undefined ? {} : { cover_suggestion: cover }),
  }
}

/* ---------- 版本迁移 ---------- */

/**
 * 把任意版本的落盘结构迁移到当前版本。
 *
 * 目前只有 v1；未来新增版本时在此追加分支。无法识别的版本返回 null，
 * 由调用方走「安全降级」而不是抛异常。
 */
function migrate(value: unknown): SavedAsset[] | null {
  if (!isRecord(value)) return null

  const version = value['schemaVersion']
  if (version !== ASSETS_SCHEMA_VERSION) {
    // 未知版本（含未来版本）：不猜测结构，降级为空集，但原始数据已在备份中
    return null
  }

  const rawAssets = value['assets']
  if (!Array.isArray(rawAssets)) return null

  const assets: SavedAsset[] = []
  for (const item of rawAssets) {
    const asset = parseAsset(item)
    if (asset !== null) assets.push(asset)
  }
  return assets
}

/* ---------- 读写 ---------- */

/** 安全访问 localStorage：隐私模式 / 被禁用时返回 null 而不是抛错 */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/**
 * 读取全部资产。
 *
 * 任何异常（无 localStorage、JSON 损坏、版本不符、结构非法）都降级为
 * **返回目前能读到的资产**（最坏情况是空数组），绝不抛出。
 */
export function loadAssets(): SavedAsset[] {
  const storage = getStorage()
  if (storage === null) return []

  let raw: string | null
  try {
    raw = storage.getItem(ASSETS_STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null || raw.length === 0) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    backupCorrupted(storage, raw, '无法解析为 JSON')
    return []
  }

  const assets = migrate(parsed)
  if (assets === null) {
    backupCorrupted(storage, raw, 'schemaVersion 不符或结构非法')
    return []
  }
  return assets
}

/** 把损坏的原始数据转存到备份键（不删除，便于排障） */
function backupCorrupted(storage: Storage, raw: string, reason: string): void {
  try {
    storage.setItem(ASSETS_BACKUP_KEY, JSON.stringify({ reason, at: new Date().toISOString(), raw }))
  } catch {
    // 备份失败（例如配额已满）不应影响主流程
  }
}

/** 写入全部资产。配额超限等失败返回 false，由调用方决定是否提示 */
export function persistAssets(assets: SavedAsset[]): boolean {
  const storage = getStorage()
  if (storage === null) return false

  const file: AssetStoreFile = { schemaVersion: ASSETS_SCHEMA_VERSION, assets }
  try {
    storage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

/* ---------- 集合操作（纯函数，便于测试） ---------- */

/** 新增或按 id 覆盖（同一篇文案重复保存 = 更新），最新的排在最前 */
export function upsertAsset(assets: readonly SavedAsset[], asset: SavedAsset): SavedAsset[] {
  return [asset, ...assets.filter((item) => item.id !== asset.id)]
}

/** 删除指定资产 */
export function removeAsset(assets: readonly SavedAsset[], id: string): SavedAsset[] {
  return assets.filter((item) => item.id !== id)
}
