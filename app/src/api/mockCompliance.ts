/**
 * 【仅用于开发与 UI 验收】Mock：/api/compliance/check。
 *
 * 诚实说明：这里**不是** AI 合规判断，而是**确定性的关键词扫描**：
 * 用一组固定模式在文案里找常见风险表达，命中即报，并给出可直接替换的改法。
 * 目的只是让 UI 与 reducer 在无 Key 环境下能验证「有风险 / 无风险」两种呈现。
 *
 * 输出结构与真实响应一致，且通过共享校验器。
 */

import type { ComplianceResult } from '../../shared/types'

/** 风险模式 → 问题描述与改法（改法是固定句式，不含任何编造信息） */
const RISK_PATTERNS: Array<{ pattern: RegExp; describe: (hit: string) => string; suggestion: string }> = [
  {
    pattern: /最好|最佳|最强|第一|顶级|无敌|天花板/g,
    describe: (hit) => `「${hit}」属于绝对化表达，容易被判定为夸大`,
    suggestion: '把「最好」「第一」这类说法改为个人化表述，例如「我比较喜欢」「我用着顺手」',
  },
  {
    pattern: /100%|百分之百|百分百|完全不会|绝对不会/g,
    describe: (hit) => `「${hit}」属于保证性承诺`,
    suggestion: '去掉绝对保证，改为「在我这里」「一般来说」这类限定表述',
  },
  {
    pattern: /一定能|保证有效|立刻见效|马上就好|瞬间/g,
    describe: (hit) => `「${hit}」暗示确定效果，属于无依据的效果承诺`,
    suggestion: '删除效果承诺，改为描述使用条件或判断标准',
  },
  {
    pattern: /销量第[一1]|销量过万|好评率\s*\d+%|回购率\s*\d+%|月销\s*\d+/g,
    describe: (hit) => `「${hit}」涉及销量或评价数据，来源无法核实`,
    suggestion: '删除无法核实的销量与评价数据；确需保留请标注数据来源',
  },
  {
    pattern: /治疗|治愈|药效|根治|疗效/g,
    describe: (hit) => `「${hit}」属于医疗功效表述，非医疗产品不得使用`,
    suggestion: '删除医疗功效相关表述',
  },
  {
    pattern: /全网最低|史上最低|最低价|骨折价/g,
    describe: (hit) => `「${hit}」属于价格类绝对化表达`,
    suggestion: '删除价格绝对化表述，或改为「我买的时候是这个价」这类个人经历描述',
  },
]

function scan(text: string): { issues: string[]; suggestions: string[] } {
  const issues: string[] = []
  const suggestions: string[] = []
  for (const rule of RISK_PATTERNS) {
    // 每次重新构造正则，避免 g 标志的 lastIndex 残留
    const matches = text.match(new RegExp(rule.pattern.source, 'g'))
    if (matches === null || matches.length === 0) continue
    for (const hit of [...new Set(matches)]) {
      issues.push(rule.describe(hit))
    }
    suggestions.push(rule.suggestion)
  }
  return { issues, suggestions }
}

export function getMockCompliance(input: { title: string; body: string; hashtags: string[] }): ComplianceResult {
  const text = `${input.title}\n${input.body}\n${input.hashtags.join(' ')}`
  const { issues, suggestions } = scan(text)

  const risk_level = issues.length === 0 ? 'low' : issues.length <= 1 ? 'medium' : 'high'

  return { risk_level, issues, suggestions }
}
