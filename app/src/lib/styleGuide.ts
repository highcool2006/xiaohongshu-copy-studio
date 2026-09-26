/**
 * 风格说明的**唯一来源**（前端展示层）。
 *
 * 背景：此前 SetupPanel（一句话简介）与 StyleLibraryView（详细说明）各硬编码了
 * 一套风格文案 —— 同一份信息存在两处，改一处就会漂移。现在统一到这里。
 *
 * 边界：
 *   - 枚举本身来自 app/shared/enums（不在此重复定义风格列表）
 *   - 完整的「写作策略」属于 Prompt 层（服务端），前端**不得**引用，
 *     因此这里只描述**用户可见的写法特征**，与提示词文本各自独立。
 *   - Record<Style, …> 保证 6 种风格一个不漏：枚举增减会编译失败
 */

import { STYLES } from '../../shared/enums'
import type { Style } from '../../shared/enums'

export interface StyleGuideEntry {
  /** 一句话定位（左栏选择卡使用） */
  summary: string
  /** 适合什么内容 */
  fit: string
  /** 语言特点 */
  language: string
  /** 结构特点 */
  structure: string
}

export const STYLE_GUIDE: Record<Style, StyleGuideEntry> = {
  亲切分享: {
    summary: '像朋友推荐',
    fit: '日常推荐、朋友视角的经验分享',
    language: '口语、短句、有停顿',
    structure: '一条经历线，不列点',
  },
  专业测评: {
    summary: '理性分析',
    fit: '购买决策、参数与维度说明',
    language: '克制陈述，不用感叹号',
    structure: '结论前置 + 维度拆解',
  },
  搞笑段子: {
    summary: '轻松有梗',
    fit: '轻松话题、反差表达',
    language: '极短句、留白',
    structure: '铺垫 → 转折 → 冷收',
  },
  干货攻略: {
    summary: '步骤清晰',
    fit: '步骤、清单、避坑',
    language: '祈使句、短句',
    structure: '结果前置 + 编号步骤',
  },
  情绪共鸣: {
    summary: '先讲情绪',
    fit: '生活方式、情绪表达',
    language: '中短句，真诚克制',
    structure: '情绪铺垫 → 产品为落点',
  },
  清单种草: {
    summary: '条目清晰',
    fit: '多卖点并列、快速阅读',
    language: '条目平行、短句',
    structure: '编号条目 + 边界提醒',
  },
}

/** 按固定枚举顺序展开的风格清单（风格库页面使用） */
export const STYLE_GUIDE_LIST: ReadonlyArray<{ style: Style } & StyleGuideEntry> = STYLES.map(
  (style) => ({ style, ...STYLE_GUIDE[style] }),
)
