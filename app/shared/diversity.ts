/**
 * 多样性报告：**由程序确定性计算**，不交给 AI 判断。
 *
 * 依据：V2 决策「AI 负责语义与创意，程序负责确定性逻辑」。
 * 输入：内容策略中的 angles（每篇一个）+ 生成出的 notes。
 */

import type { ContentAngle, DiversityReport, Note } from './types.js'
import type { RiskLevel } from './enums.js'

/** 只依赖 style 与 angle_id，因此 AI 原始输出（AiNote）也可参与统计 */
type StyledNote = Pick<Note, 'style' | 'angle_id'>

function distinctCount<T>(items: readonly T[]): number {
  return new Set(items).size
}

/**
 * 重复风险的判定规则（确定性、可测试）：
 *   - low   ：开头类型几乎全不同（≥ 篇数 - 1）
 *   - medium：开头类型 ≥ 篇数的一半
 *   - high ：低于上述两条
 *
 * 采用「开头类型」作为主导指标——它是"换关键词模板文"最先暴露的地方。
 */
function deriveDuplicateRisk(openingTypes: number, total: number): RiskLevel {
  if (total <= 1) return 'low'
  if (openingTypes >= total - 1) return 'low'
  if (openingTypes >= Math.ceil(total / 2)) return 'medium'
  return 'high'
}

export function computeDiversityReport(
  angles: readonly ContentAngle[],
  notes: readonly StyledNote[],
): DiversityReport {
  const angleById = new Map(angles.map((angle) => [angle.id, angle]))
  const usedAngles = notes
    .map((note) => angleById.get(note.angle_id))
    .filter((angle): angle is ContentAngle => angle !== undefined)

  const openingTypes = distinctCount(usedAngles.map((angle) => angle.hook_type))
  const structureTypes = distinctCount(usedAngles.map((angle) => angle.structure_type))
  const endingTypes = distinctCount(usedAngles.map((angle) => angle.ending_type))
  const angleTypes = distinctCount(usedAngles.map((angle) => angle.type))
  const styleTypes = distinctCount(notes.map((note) => note.style))

  return {
    opening_types: openingTypes,
    structure_types: structureTypes,
    ending_types: endingTypes,
    style_types: styleTypes,
    angle_types: angleTypes,
    duplicate_risk: deriveDuplicateRisk(openingTypes, notes.length),
  }
}
