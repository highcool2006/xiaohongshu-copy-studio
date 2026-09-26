/**
 * 【仅用于开发与 UI 验收】Mock：/api/reference/analyze。
 *
 * 诚实说明：这里**不是** AI 分析，而是**确定性的结构探测**：
 * 从输入文本本身计算段落数、句长分布、标点分布、人称与情绪线索，
 * 再据此拼出各字段描述。目的只是让 UI 与 reducer 在无 Key 环境下验证完整链路。
 *
 * 硬约束（docs/V2产品决策.md 第 9 节）：
 *   - **禁止**"无论输入什么都返回同一结果"：所有字段都从输入推导
 *   - 输出必须能通过共享的 validateReferenceAnalysis
 *   - 不调用任何 API、不使用 API Key
 *
 * 字段语义映射（Phase 7 确认，不新增契约字段）：
 *   -「标题结构」并入 opening_type；「语言风格」并入 narrative
 */

import { CHECK_ITEM_MAX_LENGTH } from '../../shared/constants'
import type { ReferenceAnalysis, ReferenceAnalyzeRequest } from '../../shared/types'

/* ---------- 工具 ---------- */

/** 保证单条文本不超过契约上限（200 字） */
function clamp(text: string): string {
  return text.length > CHECK_ITEM_MAX_LENGTH
    ? `${text.slice(0, CHECK_ITEM_MAX_LENGTH - 1)}…`
    : text
}

const EMOTION_WORDS = ['喜欢', '爱了', '惊艳', '惊喜', '难过', '失望', '开心', '幸福', '崩溃', '无语', '绝了', '宝藏', '避雷', '救命']
const COLLOQUIAL_WORDS = ['其实', '真的', '就是', '挺', '蛮', '反正', '干脆', '居然', '竟然', '说白了', '讲真']
const INTERACTION_WORDS = ['评论区', '留言', '告诉我', '你们', '大家', '一起', '欢迎', '求推荐', '蹲一个']
const TURN_WORDS = ['但是', '但', '不过', '其实', '反而', '结果', '后来']
const CONDITION_WORDS = ['如果', '假如', '要是', '当你']

/** 高频但无主题信息的两字片段（避免把"我们""这个"当成主题词） */
const STOP_GRAMS = new Set([
  '我们', '你们', '他们', '她们', '这个', '那个', '这些', '那些', '什么', '怎么', '怎样',
  '就是', '然后', '但是', '不过', '所以', '因为', '如果', '其实', '真的', '一个', '一种',
  '可以', '不能', '不会', '不是', '没有', '已经', '还是', '这样', '那么', '而且', '或者',
  '自己', '知道', '觉得', '东西', '时候', '一样', '非常', '特别', '有点', '一下', '起来',
  '分享', '推荐', '喜欢', '真的', '第一', '第二', '第三', '来说', '关于', '对于', '以及',
  // 高频抽象词：确实高频，但不足以作为主题线索
  '部分', '情况', '方法', '地方', '方式', '结果', '时间', '感觉', '问题', '效果',
  '之后', '之前', '开始', '上面', '下面', '里面', '外面', '中间', '内容', '需求',
])

/**
 * 虚词 / 代词 / 数量词字符。
 *
 * 含这些字的片段一律不作为主题线索 —— 否则会提取出「的部分」「我的东」这类
 * 语法碎片（它们确实高频，但不承载主题）。宁可返回"未发现"，也不要给出噪音。
 */
const FUNCTION_CHARS = new Set(
  '的了着过是在把被和与也就都而及等并且或很太更最不没会能要这那你我他她它们之其上下里外中'.split(''),
)

function hasFunctionChar(gram: string): boolean {
  for (const char of gram) {
    if (FUNCTION_CHARS.has(char)) return true
  }
  return false
}

/* ---------- 结构探测 ---------- */

interface Probe {
  chars: number
  paragraphs: string[]
  sentences: string[]
  avgSentenceLength: number
  /** ≤ 12 字的句子占比（0~1） */
  shortRatio: number
  exclamations: number
  questions: number
  hasNumberedList: boolean
  firstParagraph: string
  lastSentence: string
  firstPerson: number
  secondPerson: number
  emotionHits: string[]
  colloquialHits: string[]
  turnHits: string[]
  conditionHits: string[]
  interactionHits: string[]
  topicWord: string | null
}

/** 从纯汉字序列里取频次最高的 2~3 字片段作为主题线索 */
function extractTopicWord(text: string): string | null {
  const segments = text
    .replace(/[^一-龥]/g, ' ')
    .split(/\s+/)
    .filter((segment) => segment.length >= 2)

  const counts = new Map<string, number>()
  for (const segment of segments) {
    for (const len of [2, 3]) {
      for (let i = 0; i + len <= segment.length; i += 1) {
        const gram = segment.slice(i, i + len)
        if (STOP_GRAMS.has(gram) || hasFunctionChar(gram)) continue
        counts.set(gram, (counts.get(gram) ?? 0) + 1)
      }
    }
  }

  const candidates = [...counts.entries()].filter(([, count]) => count >= 2)
  if (candidates.length === 0) return null
  // 频次优先；同频次取**较短**者（中文双字词占多数，取长的会切出不完整的片段，
  // 例如「抹茶巧克力棒」会得到「抹茶巧」而不是「抹茶」）。
  // 同频同长时保持插入顺序（即按在文中首次出现的位置），结果确定。
  candidates.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
  return candidates[0]![0]
}

function countHits(text: string, words: readonly string[]): string[] {
  return words.filter((word) => text.includes(word))
}

function probe(text: string): Probe {
  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const sentences = text
    .split(/[。！？!?；;…\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const totalSentenceChars = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
  const avgSentenceLength =
    sentences.length === 0 ? text.length : Math.round(totalSentenceChars / sentences.length)
  const shortCount = sentences.filter((sentence) => sentence.length <= 12).length
  const shortRatio = sentences.length === 0 ? 0 : shortCount / sentences.length

  const firstParagraph = paragraphs[0] ?? text.trim()
  const lastSentence = sentences[sentences.length - 1] ?? text.trim()

  return {
    chars: text.length,
    paragraphs,
    sentences,
    avgSentenceLength,
    shortRatio,
    exclamations: (text.match(/[！!]/g) ?? []).length,
    questions: (text.match(/[？?]/g) ?? []).length,
    hasNumberedList: /^\s*(?:\d+[）).、]|[一二三四五六七八九十]+[、.）)])/m.test(text),
    firstParagraph,
    lastSentence,
    firstPerson: (text.match(/我/g) ?? []).length,
    secondPerson: (text.match(/你/g) ?? []).length,
    emotionHits: countHits(text, EMOTION_WORDS),
    colloquialHits: countHits(text, COLLOQUIAL_WORDS),
    turnHits: countHits(text, TURN_WORDS),
    conditionHits: countHits(text, CONDITION_WORDS),
    interactionHits: countHits(text, INTERACTION_WORDS),
    topicWord: extractTopicWord(text),
  }
}

/* ---------- 各字段描述（全部由探测结果推导） ---------- */

function describeTopic(p: Probe): string {
  const word = p.topicWord
  const scope = `全文 ${p.paragraphs.length} 段、约 ${p.chars} 字`
  return clamp(
    word === null
      ? `（Mock）未发现重复出现的关键词，主题需人工判断。${scope}。`
      : `（Mock）主题线索指向「${word}」（该词在文中重复出现），${scope}。`,
  )
}

function describeOpening(p: Probe): string {
  const hasNumber = /[0-9０-９]/.test(p.firstParagraph)
  const title = hasNumber
    ? '标题走「数字 + 结果感」路线'
    : /[？?]/.test(p.firstParagraph)
      ? '标题走提问式路线'
      : p.firstParagraph.length <= 14
        ? '标题短句直给，不做铺垫'
        : '标题为陈述式，先给一个判断'

  const hook = /^我/.test(p.firstParagraph)
    ? '开头用第一人称经历切入'
    : /^(如果|假如|要是|当你|你有没有)/.test(p.firstParagraph)
      ? '开头从读者处境切入'
      : p.firstParagraph.length <= 14
        ? '开头用很短的一句直接切入'
        : '开头用一句陈述铺垫后展开'

  return clamp(`（Mock）${title}；${hook}。首段 ${p.firstParagraph.length} 字。`)
}

function describeStructure(p: Probe): string {
  const traits: string[] = []
  if (p.hasNumberedList) traits.push('使用编号条目组织')
  if (p.conditionHits.length > 0) traits.push('出现条件式表达')
  if (p.turnHits.length > 0) traits.push('存在转折衔接')
  if (p.paragraphs.length >= 5) traits.push('段落数偏多，逐段推进')
  if (traits.length === 0) traits.push('以自然段落顺序铺开')

  const shape = p.hasNumberedList
    ? '编号清单式'
    : p.turnHits.length > 0
      ? '铺垫转折式'
      : p.conditionHits.length > 0
        ? '条件式'
        : '叙事线式'

  return clamp(`（Mock）整体为${shape}：${traits.join('、')}。共 ${p.paragraphs.length} 个自然段。`)
}

function describeDensity(p: Probe): string {
  const level =
    p.avgSentenceLength <= 15 ? '偏低' : p.avgSentenceLength <= 30 ? '中等' : '偏高'
  const perParagraph = p.paragraphs.length === 0 ? 0 : Math.round(p.chars / p.paragraphs.length)
  const listNote = p.hasNumberedList ? '条目化程度高，信息以并列方式给出。' : '信息以叙述方式给出，未做条目化拆解。'
  return clamp(
    `（Mock）信息密度${level}：平均句长 ${p.avgSentenceLength} 字，每段约 ${perParagraph} 字。${listNote}`,
  )
}

function describeRhythm(p: Probe): string {
  const ratio = Math.round(p.shortRatio * 100)
  const pattern =
    p.shortRatio >= 0.6
      ? '短句为主，推进快'
      : p.shortRatio <= 0.3
        ? '长句为主，节奏偏缓'
        : '长短句交替'
  return clamp(
    `（Mock）${pattern}：短句（≤12 字）占比约 ${ratio}%，共 ${p.sentences.length} 句，分 ${p.paragraphs.length} 段。`,
  )
}

function describeNarrative(p: Probe): string {
  const person =
    p.firstPerson > p.secondPerson && p.firstPerson > 0
      ? '第一人称「我」为主'
      : p.secondPerson > p.firstPerson && p.secondPerson > 0
        ? '第二人称「你」为主'
        : '人称中立，偏第三人称陈述'
  const tone =
    p.colloquialHits.length >= 2
      ? '口语化明显'
      : p.colloquialHits.length === 1
        ? '口语与书面语混合'
        : '偏书面表达'
  const detail =
    p.colloquialHits.length > 0 ? `口语标记：${p.colloquialHits.slice(0, 3).join('、')}` : '未见明显口语标记'
  return clamp(`（Mock）叙事以${person}；语言风格${tone}（我 ${p.firstPerson} 次 / 你 ${p.secondPerson} 次）。${detail}。`)
}

function describeEmotion(p: Probe): string {
  const score = p.exclamations + p.emotionHits.length
  const level = score === 0 ? '低' : score <= 3 ? '中' : '高'
  const way =
    p.exclamations > 0
      ? '通过感叹号强化'
      : p.emotionHits.length > 0
        ? '通过情绪词表达'
        : '以克制陈述为主，不刻意渲染'
  return clamp(
    `（Mock）情绪强度${level}：感叹号 ${p.exclamations} 处、情绪词 ${p.emotionHits.length} 个，${way}。`,
  )
}

function describeEnding(p: Probe): string {
  const last = p.lastSentence
  const type = /[？?]$/.test(last)
    ? '提问收束'
    : /(可以|建议|试试|不妨|记得)/.test(last)
      ? '给出行动建议'
      : last.length <= 10
        ? '短句冷收'
        : '自然停顿收尾'
  return clamp(`（Mock）结尾为${type}，末句 ${last.length} 字。`)
}

function describeInteraction(p: Probe): string {
  if (p.interactionHits.length > 0 || p.questions > 0) {
    const parts: string[] = []
    if (p.interactionHits.length > 0) parts.push(`出现互动词：${p.interactionHits.slice(0, 3).join('、')}`)
    if (p.questions > 0) parts.push(`全文 ${p.questions} 处提问`)
    return clamp(`（Mock）有显式互动设计：${parts.join('；')}。`)
  }
  return clamp('（Mock）无显式互动，结尾为陈述式收束，未邀请评论或行动。')
}

function buildLearnableMethods(p: Probe): string[] {
  const methods: string[] = []

  if (p.shortRatio >= 0.5) {
    methods.push(
      `用短句与独立成段的句子控制阅读节奏：本文短句占比约 ${Math.round(p.shortRatio * 100)}%，读起来推进快、负担低。`,
    )
  }
  if (p.firstParagraph.length <= 16) {
    methods.push('开头不铺垫背景，用很短的一句直接进入主题，读者几秒内就知道这篇在讲什么。')
  }
  if (p.hasNumberedList) {
    methods.push('把并列信息拆成编号条目，每条只讲一件事，降低读者的理解成本。')
  }
  if (p.turnHits.length > 0) {
    methods.push('用「但是 / 其实」这类转折把前后两种认知对比起来，形成推进感。')
  }
  if (p.colloquialHits.length > 0) {
    methods.push('用口语标记（如"其实""真的"）降低书面感，让它更像真人随手写下的内容。')
  }
  if (p.questions > 0) {
    methods.push('在文中设置提问，把读者拉进对话，而不是单向输出。')
  }
  if (p.conditionHits.length > 0) {
    methods.push('用条件式表达（"如果……"）让读者自己代入处境，而不是直接给结论。')
  }

  if (methods.length === 0) {
    methods.push(`以自然段落顺序推进，共 ${p.paragraphs.length} 段，结构不依赖固定模板。`)
  }
  return methods.slice(0, 10).map(clamp)
}

function buildDoNotCopy(p: Probe): string[] {
  const items: string[] = [
    '原文的具体个人经历与故事线（不要改写成自己的经历）。',
    '原文出现的具体数据、销量或评价类表述。',
    '原文中的品牌名、产品名与专有名词。',
    '原文的标志性句式与修辞（换几个词照搬仍属复制）。',
  ]

  if (p.emotionHits.length > 0 || p.exclamations > 0) {
    items.push(`原文的情绪表达方式与标点使用（本文有 ${p.exclamations} 处感叹号），不要照搬同一套情绪节奏。`)
  }
  if (p.questions > 0) {
    items.push(`原文的提问句式（本文有 ${p.questions} 处提问），可以换一种方式建立互动。`)
  }

  return items.slice(0, 10).map(clamp)
}

/**
 * 生成 Mock 的参考文案分析结果。
 *
 * 所有字段都由输入文本推导 —— 换一篇参考文案，结果会随之变化。
 */
export function getMockReferenceAnalysis(input: ReferenceAnalyzeRequest): ReferenceAnalysis {
  const text = input.reference_text.trim()
  const p = probe(text)

  return {
    topic: describeTopic(p),
    opening_type: describeOpening(p),
    structure: describeStructure(p),
    information_density: describeDensity(p),
    rhythm: describeRhythm(p),
    narrative: describeNarrative(p),
    emotional_intensity: describeEmotion(p),
    ending_type: describeEnding(p),
    interaction: describeInteraction(p),
    learnable_methods: buildLearnableMethods(p),
    do_not_copy: buildDoNotCopy(p),
  }
}
