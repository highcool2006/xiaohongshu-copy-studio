/**
 * 风险等级的中文标签（前端展示层的**唯一来源**）。
 *
 * 背景：同一份映射此前在 NoteCard / StrategyPanel / AssetsView / ReviewView
 * 各写了一份（共 4 处重复），改一处就会漂移。现在统一到这里 ——
 * 与 lib/styleGuide、lib/titleExperiment 同一处理方式。
 *
 * 边界：
 *   - 等级本身来自 app/shared/enums 的 RISK_LEVELS，不在此重复定义
 *   - 只做「等级 → 中文」的展示映射，不含任何业务判断
 */

import type { RiskLevel } from '../../shared/enums'

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
}
