/**
 * 【仅用于开发与 UI 验收】Mock 数据（V2）。
 *
 * ⚠️ 不是业务逻辑，也不是质量模拟：
 *   - 只在开发环境、且显式开启开关时生效；默认关闭；**永不进入生产路径**
 *   - 不调用任何 API、不使用 API Key
 *   - 唯一的注入点是 api/generate.ts 的 requestGenerate()
 *
 * 开启方式（默认关闭，无需创建 .env）：
 *   VITE_USE_MOCK_DATA=true npm run dev:web
 *
 * 约束：
 *   - 所有结构标注为 **共享类型**（GenerateResponse / Note / ContentAngle…），契约一变就编译失败
 *   - 篇数严格等于 count；风格严格取自选中的 styles；分配复用 shared 的 allocateStyles
 *   - 文案只引用本次输入的 product / selling_points / target_users / scenarios / goal，不编造产品事实
 *   - **不含任何第一人称使用经历**（使用行为与用量、时间地点事件、感官观察、第三方经历、亲测功效）：
 *     Mock 数据本来就会进入截图与演示，必须与 prompts/shared.ts 的「分享口吻 vs 虚构经历」界线一致，
 *     否则演示时会直接展示规则明令禁止的内容。态度、偏好、情绪、口语节奏不受此限。
 *   - diversity_report 由 shared 的 computeDiversityReport 计算（与真实链路同一套逻辑）
 *
 * 已知限制：单一风格且篇数 > 3 时模板会循环复用，出现重复卡片。
 */

import { allocateStyles } from '../../shared/allocation'
import { computeDiversityReport } from '../../shared/diversity'
import type { AngleType, ContentDirection, Style } from '../../shared/enums'
import type {
  AiNessResult,
  ComplianceResult,
  ContentAngle,
  GenerateInput,
  GenerateResponse,
  Note,
  Score,
} from '../../shared/types'

interface MockTemplate {
  style: Style
  title: string
  body: string
  hashtags: string[]
  content_directions: ContentDirection[]
  /** 本篇的创作角度（不含 id / audience / scenario —— 那些由输入决定） */
  angle: {
    type: AngleType
    core_idea: string
    hook_type: string
    structure_type: string
    ending_type: string
  }
  score: Score
  ai_ness: AiNessResult
  compliance: ComplianceResult
  cover_headline: string
}

const LOW_RISK: AiNessResult = { risk_level: 'low', issues: [], suggestions: [] }
const CLEAN: ComplianceResult = { risk_level: 'low', issues: [], suggestions: [] }

const TEMPLATES: MockTemplate[] = [
  {
    style: '亲切分享',
    title: '{product}值得占一个位置，理由其实就一条',
    body: '抽屉不大，能长期占位置的东西得有点道理。\n\n{product}被留下的理由很直接：{points}。\n\n它不需要记什么复杂步骤，也不用提前准备，想起来就能用上。\n\n抽屉里的位置是有成本的。能把位置让给它，主要就是这一条：它会让人主动想起来，而不是因为在那儿才顺手用一次。\n\n你挑常备东西的时候，也可以按这个标准过一遍。',
    hashtags: ['{product}', '常备好物', '抽屉收纳', '办公室日常', '生活小习惯'],
    content_directions: ['用户痛点'],
    angle: { type: '人群', core_idea: '用「抽屉位置成本」这个标准筛选常备品', hook_type: '场景切入', structure_type: '单一标准', ending_type: '轻邀请' },
    score: { total: 83, content_value: 21, specificity: 16, native_feel: 17, differentiation: 12, structure: 8, authenticity: 9, strength: '用「抽屉位置成本」这一个具体标准，把主观的「好不好」变成了读者可自判的问题。', improvement: '补一句通常在什么时刻会想起它，场景会更具体。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '抽屉里的常客',
  },
  {
    style: '亲切分享',
    title: '说真的，「不用特意安排」的东西，{product}算一个',
    body: '要找的其实不是「好用」，是「不用特意安排」。\n\n不是那种要提前准备、用完还要收拾的，而是想起来就能接上的那种。{product}就落在这个位置上。\n\n它被明确写出来的好处是 {points}。挑它，看的就是这一条。\n\n这种随手就能用的东西，量不必多。留一点在顺手的位置，需要的时候刚好有，就够了。\n\n如果你也有那种「临时想找点什么」的时刻，可以按这个思路想想自己缺的是什么。',
    hashtags: ['{product}', '生活方式', '随手可用', '懒人好物', '日常记录'],
    content_directions: ['使用场景'],
    angle: { type: '场景', core_idea: '「不用特意安排」的使用时机', hook_type: '需求切入', structure_type: '叙事线', ending_type: '反问' },
    score: { total: 82, content_value: 20, specificity: 16, native_feel: 17, differentiation: 12, structure: 8, authenticity: 9, strength: '从「不用特意安排」这个需求切入，视角自然，没有替产品下任何结论。', improvement: '结尾可以补一句你判断「顺手」的具体标准。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '顺手的位置',
  },
  {
    style: '亲切分享',
    title: '挑来挑去，最后起决定作用的往往是这一点',
    body: '买之前会比很久，比到最后反而更乱。\n\n换个方式：不看谁说得更热闹，只看它明确写了什么。{product}写出来的是 {points}，就这一条，很干净。\n\n信息少有一个好处：你能验证的部分少，要猜的部分也少。剩下的交给自己的判断。\n\n说不上多惊艳，但它没让人产生「是不是被说动了」的感觉，这一点我还挺在意。\n\n你买东西的时候，会更信任写得多的，还是写得少的？',
    hashtags: ['{product}', '挑选心得', '消费心理', '买东西的纠结', '少即是多'],
    content_directions: ['情绪共鸣'],
    angle: { type: '情绪', core_idea: '信息少反而更好判断的购物心理', hook_type: '自我剖白', structure_type: '心理对照', ending_type: '提问' },
    score: { total: 84, content_value: 21, specificity: 15, native_feel: 18, differentiation: 12, structure: 8, authenticity: 10, strength: '把「信息少反而好判断」的真实心理讲清楚了，结尾提问留了接话空间。', improvement: '中段可以再压缩一句，让节奏更接近随手发出来的感觉。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '写得少≠不好',
  },
  {
    style: '专业测评',
    title: '{product}只有一个卖点，判断起来反而快',
    body: '只有一个卖点的东西，判断起来反而快。\n\n{product}给出的信息就一条：{points}。没有别的。\n\n卖点越少，你能验证的部分越少，要猜的部分也越少。写十条的要你信十条，写一条的只要你对上一条。\n\n而且这条卖点本身是主观项，落在你自己的偏好上，别人替不了你判断。\n\n剩下其实就一个问题：你要的是它说的这一条，还是这一条之外的东西。\n\n要的是别的——那些它没说的——别替它补上。',
    hashtags: ['{product}', '怎么挑', '单卖点', '理性消费', '测评思路'],
    content_directions: ['产品亮点'],
    angle: { type: '产品', core_idea: '单卖点产品的判断成本更低', hook_type: '结论前置', structure_type: '三层论说', ending_type: '边界提醒' },
    score: { total: 85, content_value: 22, specificity: 17, native_feel: 16, differentiation: 13, structure: 8, authenticity: 9, strength: '把「只有一个卖点」当成可分析的结构来讲，冷静、不替产品补充事实。', improvement: '最后一段的排除项可以再收一句，避免读起来像在列清单。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '单卖点的判断法',
  },
  {
    style: '专业测评',
    title: '买{product}之前，先把判断标准定下来',
    body: '买之前不用看太多，先把自己的标准定下来。\n\n第一，它明确写了什么。{product}写的是 {points}——这是它能被验证的全部范围，别往外扩。\n\n第二，你的使用条件是什么。同样一件东西，在「随手可用」和「专门腾时间用」两种条件下，价值完全不一样。\n\n第三，你能不能接受它没说的部分。没写的通常就是没打算负责的。\n\n三条对完再决定。对不上的话，写得再热闹也不用考虑。',
    hashtags: ['{product}', '购买建议', '下单前必看', '消费决策', '判断标准'],
    content_directions: ['购买建议'],
    angle: { type: '决策', core_idea: '下单前的三条判断标准', hook_type: '行动指引', structure_type: '编号清单', ending_type: '条件收尾' },
    score: { total: 76, content_value: 19, specificity: 15, native_feel: 15, differentiation: 11, structure: 7, authenticity: 9, strength: '三条都是读者可自判的标准，没有替产品下结论。', improvement: '第三条可以补一个具体例子，让「没写的部分」更好落地。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '买前三条',
  },
  {
    style: '专业测评',
    title: '同类里选{product}，只看这两个维度',
    body: '同类产品放在一起比，比「哪个更好」意义不大，答案因人而异。\n\n换个比法，按两个维度看。\n\n维度一：它主打的点对你是否成立。{product}主打的是 {points}。如果你正好在意这一点，它就在你的选项里；不在意，它就不在。\n\n维度二：你是否需要一个这样的形态。同一类产品在形态上的差别，往往比参数更影响实际使用频率。\n\n两个维度都对上再考虑；只对上一条，可以再等等。',
    hashtags: ['{product}', '对比分析', '同类对比', '选购参考', '不踩坑'],
    content_directions: ['对比分析'],
    angle: { type: '对比', core_idea: '只给比较维度、不给结论', hook_type: '否定常见问法', structure_type: '双维度', ending_type: '条件收尾' },
    score: { total: 81, content_value: 20, specificity: 16, native_feel: 16, differentiation: 12, structure: 8, authenticity: 9, strength: '只给比较维度不给结论，读者能据此自己归类，没有编造任何对比结果。', improvement: '第二个维度可以举一个具体的判断例子。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '两个维度',
  },
  {
    style: '搞笑段子',
    title: '买{product}之前，我劝你先想清楚一件事',
    body: '先说结论。\n\n你真正要确认的不是它好不好。\n\n是它写的那一条，你到底在不在意。\n\n事情是这样的。很多人挑东西，是被名字和气氛带走的，脑补出一个自己需要的场景。\n\n然后呢。\n\n然后就发现，它从头到尾只说了 {points}。就这一条。\n\n它没错。它一直是它。错的是你买的时候以为它还负责别的。\n\n所以下单之前问自己一句：我在意的是它说的这条，还是我以为它有的那些。\n\n这两件事，不是一个东西。',
    hashtags: ['{product}', '下单前看看', '消费避坑', '别自己加戏', '购物提醒'],
    content_directions: ['避坑攻略'],
    angle: { type: '决策', core_idea: '把「我以为它有的」和「它实际写的」分开', hook_type: '悬念', structure_type: '铺垫转折', ending_type: '冷收' },
    score: { total: 80, content_value: 20, specificity: 16, native_feel: 17, differentiation: 12, structure: 7, authenticity: 8, strength: '用「你以为的 vs 它实际写的」制造反差，短句分段与冷收都到位。', improvement: '「脑补出一个自己需要的场景」可以换成更具体的画面。' },
    ai_ness: {
      risk_level: 'medium',
      issues: ['开头「先说结论」在这类内容里出现频率较高，容易显得模板化'],
      suggestions: ['可以换成一个具体的场景或一句反问作为开头'],
    },
    compliance: CLEAN,
    cover_headline: '别替它加戏',
  },
  {
    style: '搞笑段子',
    title: '卖点只写了一行的时候，人反而会卡住',
    body: '卖点只写了一行，反而不好办。\n\n不是因为它不好判断。\n\n是因为它把问题原样退回来了。\n\n{product}就是这样。\n\n卖点：{points}。\n\n就这。\n\n没有别的可看，也没有别的可挑。\n\n兄弟，你至少给点台词啊。\n\n……行吧。\n\n至少它没骗人。它说了什么，就只需要回答一个问题：在不在意这一条。\n\n这个问题，包装上不写。\n\n得自己答。',
    hashtags: ['{product}', '选择困难', '只有一行卖点', '日常吐槽', '买东西的纠结'],
    content_directions: ['用户痛点'],
    angle: { type: '情绪', core_idea: '信息少反而不会选的纠结', hook_type: '场景切入', structure_type: '极短句段', ending_type: '冷收' },
    score: { total: 75, content_value: 19, specificity: 15, native_feel: 15, differentiation: 11, structure: 7, authenticity: 8, strength: '极短句与留白构成了段落节奏，把「信息少反而不会选」做成了笑点。', improvement: '中段可以再砍一句，让转折更干脆。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '一行卖点的选择困难',
  },
  {
    style: '搞笑段子',
    title: '{points} 这几个字，为什么反而让人犹豫',
    body: '有些卖点，看一眼就让人心动。\n\n{product}打动人的地方写得很简单：{points}。\n\n简单到不知道该不该信。\n\n说它少吧，也确实少；说它实在吧，也就这一句。\n\n看久了会发现一个问题——\n\n这不是在判断它，是在判断自己到底想不想要。\n\n这个问题，包装上不写。\n\n它不写，也得自己答。',
    hashtags: ['{product}', '内心戏', '买东西的纠结', '纠结日常', '与自己和解'],
    content_directions: ['情绪共鸣'],
    angle: { type: '情绪', core_idea: '纠结的其实是自己', hook_type: '情绪切入', structure_type: '内心独白', ending_type: '自然停顿' },
    score: { total: 77, content_value: 19, specificity: 14, native_feel: 17, differentiation: 12, structure: 7, authenticity: 8, strength: '把「纠结的其实是自己」这层意思点出来，节奏短促且没有编造体验。', improvement: '倒数两句可以合并，让冷收更干脆。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '判断的其实是自己',
  },
  {
    style: '干货攻略',
    title: '买{product}前花三十秒，过这三件事',
    body: '买之前花三十秒，过这三遍，能省掉大部分后悔。\n\n1）先认需求。你现在缺的是「随手能用上的那一下」，还是「专门腾出时间用的那一类」？两个答案指向的东西完全不一样。\n\n2）再看它写了什么。{product}写的是 {points}——没写的就是它没打算负责的，别自己给它加戏。\n\n3）先小量试。第一次接触的东西，别按「以后肯定会用完」的量买。\n\n三条里最容易被跳过的是第二条。人对信息少的东西会本能地补脑，补出来的全是自己的期待。',
    hashtags: ['{product}', '购买攻略', '干货清单', '新手必看', '省心做法'],
    content_directions: ['干货清单'],
    angle: { type: '清单', core_idea: '下单前的三条动作', hook_type: '行动指引', structure_type: '编号清单', ending_type: '坑点提醒' },
    score: { total: 82, content_value: 21, specificity: 16, native_feel: 16, differentiation: 12, structure: 8, authenticity: 9, strength: '三条动作都能立刻执行，第二条把「别给信息少的产品补脑」这个坑点破了。', improvement: '第三条可以补一句判断依据。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '三十秒三件事',
  },
  {
    style: '干货攻略',
    title: '{product}怎么用得住：三个条件先对上',
    body: '想让一件东西真正用得久，先看三个条件对不对得上。\n\n1. 取用成本要低。需要提前准备、用完还要收拾的，通常撑不过两周。\n\n2. 高频场景要明确。你要能说出「我通常在什么时候用它」。说不出，说明它还没进你的日常。\n\n3. 卖点要能被你验证。{product}被写明的是 {points}——这一条你自己就能确认，不需要听别人说。\n\n三个条件里，第 2 条最容易被忽略。说不清场景，就等于没有场景。\n\n提醒一句：这三条是判断框架，不构成任何效果承诺。',
    hashtags: ['{product}', '使用场景', '好用标准', '提高使用率', '日常囤货'],
    content_directions: ['使用场景'],
    angle: { type: '场景', core_idea: '让一件东西用得久的三个条件', hook_type: '条件式', structure_type: '条件清单', ending_type: '边界说明' },
    score: { total: 78, content_value: 19, specificity: 15, native_feel: 16, differentiation: 11, structure: 8, authenticity: 9, strength: '三个条件都由读者自行判断，且结尾明确标注不构成效果承诺。', improvement: '可以为第 1 条补一个更具体的判断例子。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '用得久的条件',
  },
  {
    style: '清单种草',
    title: '{product}值得看的 {points}，一条条说清',
    body: '把 {product} 值得看的地方拆开，就这几条：\n\n1）它明确写了 {points}。这是能验证的部分，也是判断的起点。\n\n2）它没有写别的。没写的部分不用替它补，你自己在意什么就自己比对。\n\n3）它适合的，是「需要一个顺手选项」的场景。不合适的话，再热闹也不用考虑。\n\n三条对完，要不要它基本就有答案了。\n\n最后提醒一句：以上是判断方式，不是效果承诺。',
    hashtags: ['{product}', '清单种草', '选购要点', '新手参考', '理性种草'],
    content_directions: ['购买建议'],
    angle: { type: '清单', core_idea: '把已知卖点拆成可验证的条目', hook_type: '清单直给', structure_type: '编号清单', ending_type: '边界说明' },
    score: { total: 82, content_value: 21, specificity: 16, native_feel: 16, differentiation: 12, structure: 8, authenticity: 9, strength: '条目都由已知信息推导，结尾明确标注不是效果承诺。', improvement: '可以为第 3 条补一个更具体的场景例子。' },
    ai_ness: LOW_RISK,
    compliance: CLEAN,
    cover_headline: '值得看的几条',
  },
]

function fill(text: string, product: string, points: string): string {
  return text.replaceAll('{product}', product).replaceAll('{points}', points)
}

/**
 * 返回一份 Mock 的 /api/generate 成功响应（V2 结构）。
 *
 * - notes 数量**严格等于** input.count
 * - 风格严格取自 input.styles，分配复用 shared 的 allocateStyles
 * - strategy.angles 与 notes **一一对应**（angle_id 可回溯）
 * - diversity_report 由 shared 的 computeDiversityReport 计算
 */
export function getMockGenerateResponse(input: GenerateInput): GenerateResponse {
  const product = input.product.trim() || '这个产品'
  const points = input.selling_points.length > 0 ? input.selling_points.join('、') : '（未填写卖点）'
  const audience = input.target_users.length > 0 ? input.target_users.join('、') : '（AI 推测）关注这类产品的普通用户'
  const scenario = input.scenarios.length > 0 ? input.scenarios.join('、') : '（建议场景）日常使用'

  const allocation = allocateStyles(input.styles, input.count)
  const preferredDirections = input.content_directions_preference

  const angles: ContentAngle[] = []
  const notes: Note[] = []
  let index = 0

  for (const [style, need] of Object.entries(allocation) as Array<[Style, number]>) {
    const pool = TEMPLATES.filter((template) => template.style === style)
    const source = pool.length > 0 ? pool : TEMPLATES
    for (let i = 0; i < need; i += 1) {
      const template = source[i % source.length]!
      index += 1
      const id = `angle-${index}`

      angles.push({
        id,
        type: template.angle.type,
        audience,
        scenario,
        core_idea: fill(template.angle.core_idea, product, points),
        hook_type: template.angle.hook_type,
        structure_type: template.angle.structure_type,
        ending_type: template.angle.ending_type,
      })

      notes.push({
        id: `note-${index}`,
        title: fill(template.title, product, points),
        body: fill(template.body, product, points),
        hashtags: template.hashtags.map((tag) => fill(tag, product, points)),
        style,
        // 若用户指定了期望方向，则优先用他选的方向（按索引轮换），否则用模板自带的方向
        content_directions:
          preferredDirections.length > 0
            ? [preferredDirections[(index - 1) % preferredDirections.length]!]
            : [...template.content_directions],
        angle_id: id,
        score: { ...template.score },
        ai_ness: { ...template.ai_ness, issues: [...template.ai_ness.issues], suggestions: [...template.ai_ness.suggestions] },
        compliance: { ...template.compliance, issues: [...template.compliance.issues], suggestions: [...template.compliance.suggestions] },
        cover_suggestion: {
          headline: fill(template.cover_headline, product, points),
          visual_subject: `${product} · ${template.angle.type === '场景' ? '使用场景' : '产品本身'}`,
          composition: '主体居中，上方留出标题区域，背景简洁不抢主体',
        },
        stale: false,
      })
    }
  }

  const limited = input.selling_points.length < 3
  return {
    information: limited
      ? {
          status: 'limited',
          message: `目前只有「${product}」和 ${input.selling_points.length} 个卖点（${points}），补充规格、使用场合或你在意的点，内容会更具体。`,
        }
      : { status: 'sufficient', message: '' },
    strategy: {
      summary: limited
        ? `当前关于「${product}」的信息较少（只有 ${points}），不适合虚构口感、配料或使用体验。本轮以「${scenario}」等场景、选择逻辑与「${input.goal}」作为主要来源，围绕已知卖点组织内容。`
        : `围绕「${product}」的已知信息（${points}）与「${scenario}」场景，面向「${audience}」的「${input.goal}」需求，规划 ${input.count} 个不同的内容角度。`,
      target_users: [...input.target_users],
      scenarios: [...input.scenarios],
      angles,
      diversity_report: computeDiversityReport(angles, notes),
    },
    notes,
  }
}
