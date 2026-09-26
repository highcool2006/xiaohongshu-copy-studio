/**
 * 复制文本拼装（纯函数，便于单独验证）。
 *
 * 格式（依据 docs/技术架构决策.md 第 14 节）：
 *   标题
 *   （空行）
 *   正文
 *   （空行）
 *   #标签1 #标签2 #标签3
 *
 * 不复制：风格标签、内容方向标签、score 及其 strength / improvement、任何界面文字。
 * `#` 由程序渲染（数据层的 hashtags 不带 `#`）。
 */

import type { Note } from '../../shared/types'

export function buildCopyText(note: Note): string {
  const hashtags = note.hashtags.map((tag) => `#${tag}`).join(' ')
  return [note.title, '', note.body, '', hashtags].join('\n').trim()
}
