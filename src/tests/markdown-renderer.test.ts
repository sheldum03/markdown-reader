import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../lib/markdown/renderer'

describe('Markdown reading pipeline', () => {
  it('renders GFM tables, tasks, strikethrough and footnotes', () => {
    const { html } = renderMarkdown('| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] Done\n\n~~Removed~~\n\nNote[^1]\n\n[^1]: Detail')
    expect(html).toContain('<table')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('<s>Removed</s>')
    expect(html).toContain('footnote-ref')
  })
  it('extracts formatted and setext headings, ignores fenced/indented code, distinguishes duplicates', () => {
    const { headings } = renderMarkdown('# **Intro** `code`\n\n```md\n# Fake\n```\n\n    # Also fake\n\nDetails\n-------\n\n## Details')
    expect(headings.map(({ text, level, line }) => ({ text, level, line }))).toEqual([
      { text: 'Intro code', level: 1, line: 1 },
      { text: 'Details', level: 2, line: 9 },
      { text: 'Details', level: 2, line: 12 },
    ])
    expect(new Set(headings.map(h => h.id)).size).toBe(3)
  })
  it('escapes HTML, unsafe links and fence info rather than executing document content', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n```\"onclick=alert(1)\n<img onerror=alert(1)>\n```')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<img onerror')
    const root = document.createElement('div')
    root.innerHTML = html
    expect(root.querySelector('[onclick]')).toBeNull()
  })
  it('emits escaped math and Mermaid placeholders without loading heavy renderers', () => {
    const { html } = renderMarkdown('Inline $x^2$ and $5 dollars\n\n$$\nx < y\n$$\n\n```mermaid\ngraph LR\n A-->B\n```')
    expect(html).toContain('data-math="inline">x^2</span>')
    expect(html).toContain('x &lt; y')
    expect(html).toContain('data-mermaid')
    expect(html).toContain('$5 dollars')
    expect(html).not.toContain('<svg')
  })
  it('preserves escaped dollars, code dollars and incomplete math', () => {
    const { html } = renderMarkdown('\\$literal and `$code$`\n\n$$\nunclosed')
    expect(html).not.toContain('data-math')
  })
  it('marks images for lazy loading and maps blocks to source lines', () => {
    const { html } = renderMarkdown('# Start\n\n![alt](assets/pic.png)')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('data-source-line="3"')
  })
})
