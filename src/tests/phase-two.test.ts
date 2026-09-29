import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import SourceEditor from '../components/SourceEditor.vue'
import { prepareMarkdown, renderMarkdown } from '../lib/markdown/renderer'
import { mapDomSelection } from '../lib/markdown/sourceMap'
import { formatMarkdownChecked } from '../lib/cjkFormatter/formatter'
import { DEFAULT_CJK_FORMATTING } from '../lib/cjkFormatter/types'
import { createAnchor, relocateAnchor } from '../utils/comment-anchor'
import { useWorkspaceStore } from '../stores/workspace'

afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })
const rich = '# 同名\r\n\r\nText **bold** and [link](local.md). $x^2$\r\n\r\n## 同名\r\n\r\n- [x] task\r\n\r\n| A | B |\r\n| - | - |\r\n| 1 | 2 |\r\n\r\nNote[^a]\r\n\r\n[^a]: footnote\r\n\r\n```mermaid\r\ngraph LR\r\n A-->B\r\n```\r\n'
describe('phase two fidelity and isolation', () => {
  it('source editor does not save on mount, preserves CRLF and undoes formatting', async () => {
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(SourceEditor, { attachTo: document.body, props: { file: { path: '/note.md', content: rich }, saveContent } })
    await flushPromises()
    await (wrapper.vm as any).saveCurrentContent()
    expect(saveContent).not.toHaveBeenCalled()
    expect((wrapper.vm as any).getCurrentContent()).toBe(rich)
    const view = EditorView.findFromDOM(wrapper.get('.cm-editor').element as HTMLElement)!
    view.dispatch({ changes: { from: 0, insert: '中文ABC\r\n' } })
    expect((wrapper.vm as any).getCurrentContent()).toBe('中文ABC\r\n' + rich)
    undo(view)
    expect((wrapper.vm as any).getCurrentContent()).toBe(rich)
    wrapper.unmount()
  })
  it('keeps links, code, formulas, frontmatter and hard breaks intact during CJK formatting', () => {
    const source = '---\ntitle: 中文ABC\n---\n\n中文ABC测试...  \n\n`中文ABC` [链接](https://example.com/中文ABC) $中文ABC$\n\n```js\n中文ABC\n```\n\n$$\n中文ABC\n$$\n'
    const result = formatMarkdownChecked(source, DEFAULT_CJK_FORMATTING, { preserveTwoSpaceHardBreaks: true })
    expect(result.refused).toBe(false)
    expect(result.text).toContain('中文 ABC 测试')
    for (const protectedText of ['title: 中文ABC', '`中文ABC`', 'https://example.com/中文ABC', '$中文ABC$', '```js\n中文ABC\n```', '$$\n中文ABC\n$$']) expect(result.text).toContain(protectedText)
    expect(result.text).toContain('  \n')
  })
  it('virtual block rendering preserves cross-block references, footnotes and duplicate heading ids', () => {
    const source = '# Same\n\n[reference][x]\n\n# Same\n\n[^a]: Detail\n\nNote[^a]\n\n[x]: https://example.com\n'
    const doc = prepareMarkdown(source)
    const html = doc.blocks.map((_, i) => doc.render(i)).join('')
    expect(html).toBe(renderMarkdown(source).html)
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('footnote-item')
    expect(doc.headings.map(h => h.id)).toEqual(['heading-1', 'heading-5'])
    expect(doc.anchors.fn1).toBeDefined()
    expect(doc.anchors.fnref1).toBeDefined()
  })
  it('bounds an indivisible 100k-character source block without losing characters', () => {
    const source = 'x'.repeat(100_000)
    const doc = prepareMarkdown(source, true)
    expect(doc.blocks.length).toBeGreaterThan(10)
    expect(doc.blocks.every(b => b.end - b.start <= 8000)).toBe(true)
    expect(doc.blocks.map(b => source.slice(b.start, b.end)).join('')).toBe(source)
  })
  it('maps a repeated formatted selection to its exact second source occurrence', () => {
    const source = 'A **same** [link](https://same.com).\n\nA **same** [link](https://same.com).'
    const root = document.createElement('article'); root.innerHTML = renderMarkdown(source).html; document.body.append(root)
    const p = root.querySelectorAll('p')[1]
    const range = document.createRange(); range.setStart(p.querySelector('strong')!.firstChild!, 0); range.setEnd(p.querySelector('a')!.firstChild!, 4)
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
    range.getBoundingClientRect = () => new DOMRect(0, 0, 20, 20)
    const mapped = mapDomSelection(root, source)!
    expect(source.slice(mapped.start, mapped.end)).toBe('same** [link')
    expect(mapped.start).toBe(source.lastIndexOf('**same') + 2)
  })
  it('maps formatted link text to its label rather than matching text in its destination', () => {
    const source = '[**foo**bar](https://x/foobar)'
    const root = document.createElement('article'); root.innerHTML = renderMarkdown(source).html; document.body.append(root)
    const range = document.createRange(); range.selectNodeContents(root.querySelector('a')!)
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
    range.getBoundingClientRect = () => new DOMRect(0, 0, 20, 20)
    expect(mapDomSelection(root, source)).toMatchObject({ text: 'foobar', start: 3, end: 11 })
  })
  it.each(['foo_bar', '`foo_bar`', '**foo_bar**'])('preserves literal underscores when mapping %s', source => {
    const root = document.createElement('article'); root.innerHTML = renderMarkdown(source).html; document.body.append(root)
    const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!)
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
    range.getBoundingClientRect = () => new DOMRect(0, 0, 20, 20)
    expect(mapDomSelection(root, source)).toMatchObject({ text: 'foo_bar', start: source.indexOf('foo_bar'), end: source.indexOf('foo_bar') + 7 })
  })
  it('assigns source lines to each slice of a long code block', () => {
    const source = '```text\n' + 'abcdefghijk\n'.repeat(4000) + '```\n'
    const doc = prepareMarkdown(source, true)
    const target = doc.blocks.find(b => b.line <= 3000 && b.endLine > 3000)!
    expect(doc.blocks.indexOf(target)).toBeGreaterThan(0)
    for (const block of doc.blocks) {
      expect(block.line).toBe(source.slice(0, block.start).split('\n').length)
      expect(block.endLine).toBe(source.slice(0, block.end - 1).split('\n').length + 1)
    }
  })
  it('relocates duplicate comment contexts nearest their previous source position', () => {
    const repeated = 'A'.repeat(150) + 'target' + 'B'.repeat(150)
    const source = repeated + '\n' + repeated
    const start = source.lastIndexOf('target')
    const anchor = createAnchor(source, start, start + 6)
    expect(relocateAnchor(anchor, source).newOffset).toBe(start)
    expect(relocateAnchor(anchor, 'prefix' + source).newOffset).toBe(start + 6)
  })
  it('keeps background save targets and per-tab drafts distinct', async () => {
    setActivePinia(createPinia()); const store = useWorkspaceStore(); store.folderPath = '/w'
    vi.mocked(invoke).mockImplementation(async (command, args: any) => command === 'read_file' ? args.path : undefined)
    await store.openFile('/w/a.md'); store.tabs[0].draft = 'A draft'
    await store.openFile('/w/b.md'); await store.saveFile('/w/a.md', 'A saved')
    expect(invoke).toHaveBeenCalledWith('write_file_checked', { workspacePath: '/w', path: '/w/a.md', content: 'A saved', expectedContent: '/w/a.md' })
    expect(store.currentFile?.content).toBe('/w/b.md')
    await store.openFile('/w/a.md')
    expect(store.tabs[0].draft).toBe('A draft')
    expect(store.currentFile?.content).toBe('A saved')
  })
})
