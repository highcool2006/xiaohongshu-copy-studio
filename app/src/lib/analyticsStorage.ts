/**
 * 本地内容生产数据统计（localStorage）。
 *
 * 记录的是**真实发生过的操作**：
 *   - 没有发生过的操作在看板上就是 0，不做任何填充
 *   - 不记录正文、标题等大文本，只记录计数与日期
 *   - 不预测、不推算平台数据（曝光/点赞/收藏/涨粉一律不在本模块范围内）
 *
 * 设计要点：
 *   1. 版本化（schemaVersion）+ 损坏安全降级，绝不抛异常
 *   2. daily 只保留最近若干天，避免无限增长
 *   3. `recordEvent` 是**纯函数**：调用方决定何时落盘（保持可测）
 *   4. 聚合逻辑都在这里，不塞进 AppProvider
 *
 * 说明：本模块自带一份最小 JSON 守卫（与 assetsStorage 的同名工具各自私有）——
 * 两者校验的对象结构完全不同，共用会引入不必要的耦合。
 */

import type { RiskLevel } from '../../shared/enums'
import type { SavedAsset } from './assetsStorage'

export const ANALYTICS_STORAGE_KEY = 'xhs-copy-studio/analytics'
export const ANALYTICS_BACKUP_KEY = 'xhs-copy-studio/analytics.corrupted'
export const ANALYTICS_SCHEMA_VERSION = 1

/** daily 保留的天数（超出后裁剪最旧的记录） */
export const DAILY_RETENTION_DAYS = 30
/** 看板展示的最近天数 */
export const RECENT_DAYS = 7

/** 累计计数：键名与「一次真实操作」一一对应 */
export interface AnalyticsCounters {
  /** 发起生成并成功的次数 */
  generate_count: number
  /** 累计生成的笔记篇数 */
  generate_notes: number
  rewrite_count: number
  score_count: number
  /** 标题变体生成（标题实验）次数 */
  title_experiment_count: number
  /** 采用标题变体的次数 */
  title_apply_count: number
  copy_count: number
  save_asset_count: number
  delete_asset_count: number
  compliance_count: number
}

/** 按日聚合的计数（只保留看板需要的 4 项，控制体积） */
export interface DailyCounter {
  /** 本地日期 YYYY-MM-DD */
  date: string
  generate_notes: number
  save_asset: number
  title_experiment: number
  rewrite: number
}

export interface AnalyticsState {
  totals: AnalyticsCounters
  daily: DailyCounter[]
}

/** 触发统计的真实操作 */
export type AnalyticsEvent =
  | { type: 'generate'; notes: number }
  | { type: 'rewrite' }
  | { type: 'score' }
  | { type: 'title_experiment' }
  | { type: 'title_apply' }
  | { type: 'copy' }
  | { type: 'save_asset' }
  | { type: 'delete_asset' }
  | { type: 'compliance' }

export const EMPTY_COUNTERS: AnalyticsCounters = {
  generate_count: 0,
  generate_notes: 0,
  rewrite_count: 0,
  score_count: 0,
  title_experiment_count: 0,
  title_apply_count: 0,
  copy_count: 0,
  save_asset_count: 0,
  delete_asset_count: 0,
  compliance_count: 0,
}

export const EMPTY_ANALYTICS: AnalyticsState = { totals: EMPTY_COUNTERS, daily: [] }

/* ---------- 日期工具（本地时区） ---------- */

/** 本地日期键 YYYY-MM-DD */
export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 最近 N 天的日期键（升序，含今天） */
export function recentDateKeys(days: number, now = new Date()): string[] {
  const keys: string[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    keys.push(dateKey(date))
  }
  return keys
}

/* ---------- 变更（纯函数） ---------- */

function bumpCounters(totals: AnalyticsCounters, event: AnalyticsEvent): AnalyticsCounters {
  switch (event.type) {
    case 'generate':
      return {
        ...totals,
        generate_count: totals.generate_count + 1,
        // 篇数可能是 0（理论上不会），按实际返回值累加，不假设
        generate_notes: totals.generate_notes + Math.max(0, event.notes),
      }
    case 'rewrite':
      return { ...totals, rewrite_count: totals.rewrite_count + 1 }
    case 'score':
      return { ...totals, score_count: totals.score_count + 1 }
    case 'title_experiment':
      return { ...totals, title_experiment_count: totals.title_experiment_count + 1 }
    case 'title_apply':
      return { ...totals, title_apply_count: totals.title_apply_count + 1 }
    case 'copy':
      return { ...totals, copy_count: totals.copy_count + 1 }
    case 'save_asset':
      return { ...totals, save_asset_count: totals.save_asset_count + 1 }
    case 'delete_asset':
      return { ...totals, delete_asset_count: totals.delete_asset_count + 1 }
    case 'compliance':
      return { ...totals, compliance_count: totals.compliance_count + 1 }
    default:
      return totals
  }
}

function emptyDaily(date: string): DailyCounter {
  return { date, generate_notes: 0, save_asset: 0, title_experiment: 0, rewrite: 0 }
}

/** 把事件累加到当天（只累加看板展示的 4 项） */
function bumpDaily(daily: DailyCounter, event: AnalyticsEvent): DailyCounter {
  switch (event.type) {
    case 'generate':
      return { ...daily, generate_notes: daily.generate_notes + Math.max(0, event.notes) }
    case 'save_asset':
      return { ...daily, save_asset: daily.save_asset + 1 }
    case 'title_experiment':
      return { ...daily, title_experiment: daily.title_experiment + 1 }
    case 'rewrite':
      return { ...daily, rewrite: daily.rewrite + 1 }
    default:
      return daily
  }
}

/** 裁剪超出保留期的日记录 */
function pruneDaily(daily: DailyCounter[], now: Date): DailyCounter[] {
  const oldest = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAILY_RETENTION_DAYS - 1)))
  return daily.filter((item) => item.date >= oldest)
}

/**
 * 记录一次真实操作（纯函数）。
 *
 * 返回新的统计状态，**不落盘** —— 由调用方决定何时写入 localStorage。
 */
export function recordEvent(
  state: AnalyticsState,
  event: AnalyticsEvent,
  now: Date = new Date(),
): AnalyticsState {
  const key = dateKey(now)
  const existing = state.daily.find((item) => item.date === key) ?? emptyDaily(key)
  const updated = bumpDaily(existing, event)
  const daily = state.daily.some((item) => item.date === key)
    ? state.daily.map((item) => (item.date === key ? updated : item))
    : [...state.daily, updated]

  return {
    totals: bumpCounters(state.totals, event),
    daily: pruneDaily(daily, now).sort((a, b) => (a.date < b.date ? -1 : 1)),
  }
}

/* ---------- 解析与降级 ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 非负整数；其它一律视为 0（脏数据不放大） */
function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function parseCounters(value: unknown): AnalyticsCounters {
  if (!isRecord(value)) return { ...EMPTY_COUNTERS }
  return {
    generate_count: toCount(value['generate_count']),
    generate_notes: toCount(value['generate_notes']),
    rewrite_count: toCount(value['rewrite_count']),
    score_count: toCount(value['score_count']),
    title_experiment_count: toCount(value['title_experiment_count']),
    title_apply_count: toCount(value['title_apply_count']),
    copy_count: toCount(value['copy_count']),
    save_asset_count: toCount(value['save_asset_count']),
    delete_asset_count: toCount(value['delete_asset_count']),
    compliance_count: toCount(value['compliance_count']),
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDaily(value: unknown): DailyCounter[] {
  if (!Array.isArray(value)) return []
  const daily: DailyCounter[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const date = item['date']
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) continue
    daily.push({
      date,
      generate_notes: toCount(item['generate_notes']),
      save_asset: toCount(item['save_asset']),
      title_experiment: toCount(item['title_experiment']),
      rewrite: toCount(item['rewrite']),
    })
  }
  return daily
}

/**
 * 解析落盘结构。
 *
 * 返回 null 表示整份不可用（版本不符 / 结构非法），由调用方走安全降级。
 */
export function parseAnalytics(value: unknown): AnalyticsState | null {
  if (!isRecord(value)) return null
  if (value['schemaVersion'] !== ANALYTICS_SCHEMA_VERSION) return null

  return {
    totals: parseCounters(value['totals']),
    daily: parseDaily(value['daily']).sort((a, b) => (a.date < b.date ? -1 : 1)),
  }
}

/* ---------- 读写 ---------- */

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/** 读取统计；任何异常都降级为空统计，绝不抛错 */
export function loadAnalytics(): AnalyticsState {
  const storage = getStorage()
  if (storage === null) return { ...EMPTY_ANALYTICS, totals: { ...EMPTY_COUNTERS } }

  let raw: string | null
  try {
    raw = storage.getItem(ANALYTICS_STORAGE_KEY)
  } catch {
    return { ...EMPTY_ANALYTICS, totals: { ...EMPTY_COUNTERS } }
  }
  if (raw === null || raw.length === 0) return { ...EMPTY_ANALYTICS, totals: { ...EMPTY_COUNTERS } }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    backupCorrupted(storage, raw, '无法解析为 JSON')
    return { ...EMPTY_ANALYTICS, totals: { ...EMPTY_COUNTERS } }
  }

  const state = parseAnalytics(parsed)
  if (state === null) {
    backupCorrupted(storage, raw, 'schemaVersion 不符或结构非法')
    return { ...EMPTY_ANALYTICS, totals: { ...EMPTY_COUNTERS } }
  }
  return state
}

function backupCorrupted(storage: Storage, raw: string, reason: string): void {
  try {
    storage.setItem(ANALYTICS_BACKUP_KEY, JSON.stringify({ reason, at: new Date().toISOString(), raw }))
  } catch {
    // 备份失败不应影响主流程
  }
}

/** 落盘；失败（配额满 / 隐私模式）返回 false，由调用方决定是否留痕 */
export function persistAnalytics(state: AnalyticsState): boolean {
  const storage = getStorage()
  if (storage === null) return false
  try {
    storage.setItem(
      ANALYTICS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: ANALYTICS_SCHEMA_VERSION, totals: state.totals, daily: state.daily }),
    )
    return true
  } catch {
    return false
  }
}

/* ---------- 聚合（看板数据） ---------- */

export interface CountedItem {
  key: string
  count: number
}

export interface AssetStats {
  total: number
  /** 没有资产时为 null（不返回 0，避免"平均分 0"这种误导） */
  averageScore: number | null
  byStyle: CountedItem[]
  byDirection: CountedItem[]
  aiNess: Record<RiskLevel, number>
  compliance: Record<RiskLevel, number>
}

export interface DashboardData {
  totals: AnalyticsCounters
  /** 最近 RECENT_DAYS 天（**补零**，升序，含今天） */
  recent: DailyCounter[]
  assets: AssetStats
}

/** 按出现次数降序排列计数项 */
function tally(values: readonly string[]): CountedItem[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))
}

/** 统计已保存资产的结构分布（全部来自真实资产，无数据时为 0 / null） */
export function aggregateAssets(assets: readonly SavedAsset[]): AssetStats {
  const aiNess: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 }
  const compliance: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 }

  for (const asset of assets) {
    aiNess[asset.note.ai_ness_risk] += 1
    compliance[asset.note.compliance_risk] += 1
  }

  const totalScore = assets.reduce((sum, asset) => sum + asset.note.score_total, 0)

  return {
    total: assets.length,
    averageScore: assets.length === 0 ? null : Math.round(totalScore / assets.length),
    byStyle: tally(assets.map((asset) => asset.note.style)),
    byDirection: tally(assets.flatMap((asset) => asset.note.content_directions)),
    aiNess,
    compliance,
  }
}

/**
 * 生成看板数据。
 *
 * 最近 7 天**补零**：某天没有操作就是 0，而不是省略该天 ——
 * 这样趋势图不会把"没有数据"误画成"连续下降"。
 */
export function aggregate(
  analytics: AnalyticsState,
  assets: readonly SavedAsset[],
  now: Date = new Date(),
): DashboardData {
  const byDate = new Map(analytics.daily.map((item) => [item.date, item]))
  const recent = recentDateKeys(RECENT_DAYS, now).map((date) => byDate.get(date) ?? emptyDaily(date))

  return { totals: analytics.totals, recent, assets: aggregateAssets(assets) }
}

/** 最近 N 天某字段的合计 */
export function sumRecent(recent: readonly DailyCounter[], field: keyof Omit<DailyCounter, 'date'>): number {
  return recent.reduce((sum, item) => sum + item[field], 0)
}

/** 是否完全没有生产数据（用于空状态判定） */
export function isAnalyticsEmpty(analytics: AnalyticsState, assets: readonly SavedAsset[]): boolean {
  return assets.length === 0 && analytics.daily.length === 0 && analytics.totals.generate_count === 0
}
