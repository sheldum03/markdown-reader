import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
const workspace = '/tmp/markdown-html-e2e-workspace'
const active = '[data-active-document="true"]'
const button = (text: string) => $(`//button[normalize-space(.)="${text}"]`)
const file = (name: string) => $(`//button[contains(normalize-space(.),"${name}")]`)
const report: Record<string, unknown> = {}
function rss() {
  // Native process RSS is reported separately from WebKit's multiprocess memory.
  const output = execFileSync('ps', ['-axo', 'pid,ppid,rss,command'], { encoding: 'utf8' })
  return output.split('\n').filter(line => /md-html-reader|WebKit.WebContent/.test(line) && !/node|wdio|sh -c/.test(line))
}
async function openFolder() { await button('Open folder').click(); await file('large.md').waitForExist() }
async function bodyHas(text: string) { await browser.waitUntil(async () => (await $('body').getText()).includes(text), { timeout: 60000 }) }
describe('Phase two native acceptance', () => {
  before(async () => {
    rmSync(workspace, { recursive: true, force: true }); mkdirSync(workspace, { recursive: true })
    const paragraph = '中文 English **bold** with a [local link](small.md), measured native disk input. '.repeat(8)
    let large = ''; for (let i = 0; large.length < 10_000_000; i++) large += `# Section ${i}\n\n${paragraph}\n\n`
    report.characters = large.length; report.utf8Bytes = Buffer.byteLength(large)
    writeFileSync(join(workspace, 'large.md'), large)
    writeFileSync(join(workspace, 'sync.md'), Array.from({ length: 300 }, (_, i) => `# Same\n\nParagraph ${i} with **bold** text.\n\n`).join(''))
    writeFileSync(join(workspace, 'small.md'), '# Same\n\n中文ABC **bold** and [link](small.md).\n\n# Same\n\nSecond comment target.\n')
    writeFileSync(join(workspace, 'rich.md'), '# Formula\r\n\r\n$x^2$ and footnote[^a].\r\n\r\n[^a]: Footnote detail\r\n\r\n- [x] Done\r\n\r\n| A | B |\r\n| - | - |\r\n| 1 | 2 |\r\n\r\n![local](pixel.svg)\r\n\r\n```mermaid\r\ngraph LR\r\n A-->B\r\n```\r\n')
    writeFileSync(join(workspace, 'pixel.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')
    await browser.execute(() => localStorage.setItem('md-html-reader.locale', 'en')); await browser.refresh()
  })
  after(() => { mkdirSync('docs/qa', { recursive: true }); writeFileSync('docs/qa/phase-two-native.json', JSON.stringify(report, null, 2)) })
  it('opens ten million characters from disk with bounded DOM and responsive scrolling/editing', async () => {
    await openFolder(); report.rssBefore = rss()
    await browser.execute(() => {
      const state = { start: performance.now(), last: performance.now(), gaps: [] as number[], timer: 0 }
      state.timer = window.setInterval(() => { const now = performance.now(); state.gaps.push(now - state.last); state.last = now }, 16)
      ;(window as any).__benchmark = state
    })
    const started = Date.now(); await file('large.md').click()
    await $(`${active} .virtual-body section`).waitForExist({ timeout: 60000 })
    report.openMs = Date.now() - started
    const first = await browser.execute(() => {
      const state = (window as any).__benchmark; clearInterval(state.timer)
      const root = document.querySelector('[data-active-document="true"] .virtual-body')!
      return { nodes: root.querySelectorAll('*').length, blocks: root.children.length, longestMainThreadGapMs: Math.max(...state.gaps), engineLoads: performance.getEntriesByType('mark').filter(e => e.name.startsWith('reader:load:')).map(e => e.name), resources: performance.getEntriesByType('resource').map((entry: any) => entry.name) }
    })
    report.firstRender = first; expect(first.engineLoads).toEqual([]); expect(first.nodes).toBeLessThan(1000)
    expect(first.resources.some((url: string) => /SourceEditor|MilkdownEditor|mermaid.core|katex|prism/i.test(url))).toBe(false)
    report.rssReading = rss()
    await browser.saveScreenshot('docs/qa/phase-two-reading.png')
    const scroll = await browser.execute(async () => {
      const scroller = document.querySelector('[data-active-document="true"] .markdown-preview') as HTMLElement
      const start = performance.now(); const height = scroller.scrollHeight, clientHeight = scroller.clientHeight; scroller.scrollTop = scroller.scrollHeight * .8; scroller.dispatchEvent(new Event('scroll'))
      await new Promise<void>(resolve => { const observe = new MutationObserver(() => { observe.disconnect(); resolve() }); observe.observe(scroller, { childList: true, subtree: true }); setTimeout(() => { observe.disconnect(); resolve() }, 3000) })
      return { height, clientHeight, scrollTop: scroller.scrollTop, ms: performance.now() - start, nodes: scroller.querySelectorAll('*').length, text: scroller.innerText.slice(0, 80) }
    })
    report.scroll = scroll; expect(scroll.nodes).toBeLessThan(1200); expect(scroll.scrollTop).toBeGreaterThan(1000); expect(scroll.text.length).toBeGreaterThan(0)
    const editStart = Date.now(); await $(`//*[@data-active-document="true"]//button[normalize-space(.)="编辑"]`).click()
    await $(`${active} .cm-content`).waitForExist({ timeout: 60000 }); report.sourceEditorOpenMs = Date.now() - editStart
    report.sourceEditorNodes = await $$(`${active} .cm-content *`).length
    report.editMs = await browser.execute(async () => {
      const helpers = (document.querySelector('[data-active-document="true"] .cm-editor')?.parentElement as any).__editor
      const start = performance.now(); helpers.insertText('X'); await new Promise(resolve => setTimeout(resolve, 0)); return performance.now() - start
    })
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="撤销"]`).click()
    report.rssEditing = rss(); expect(report.sourceEditorNodes).toBeLessThan(2000)
    await browser.saveScreenshot('docs/qa/phase-two-large.png')
    await $('[aria-label="关闭 large.md"]').click()
  })
  it('preserves complex CRLF source on no-op mode switches and exports offline semantics', async () => {
    const original = readFileSync(join(workspace, 'rich.md'), 'utf8')
    await file('rich.md').click(); await $(`${active} .katex`).waitForExist(); await $(`${active} .mermaid-diagram svg`).waitForExist()
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="分屏"]`).click(); await $(`${active} .cm-content`).waitForExist()
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="阅读"]`).click()
    expect(readFileSync(join(workspace, 'rich.md'), 'utf8')).toBe(original)
    await $('//summary[normalize-space(.)="Document tools"]').click(); await $('[aria-label="Include source Markdown"]').click(); await button('Export HTML').click()
    await bodyHas('HTML reading version created and opened')
    const html = readFileSync(join(workspace, 'note.html'), 'utf8')
    expect(html).toContain('katex'); expect(html).toContain('<svg'); expect(html).toContain('footnote-item'); expect(html).toContain('type="checkbox"'); expect(html).toContain('<table')
    expect(html).toContain('data:image/svg+xml;base64,'); expect(html).not.toMatch(/url\(["']?\/?assets\//)
    expect(html).toContain(encodeURIComponent(original)); report.offlineExportBytes = Buffer.byteLength(html)
    const main = await browser.getWindowHandle(); await button('Open full preview').click()
    await browser.waitUntil(async () => (await browser.getWindowHandles()).length > 1)
    const preview = (await browser.getWindowHandles()).find(handle => handle !== main)!
    await browser.switchToWindow(preview)
    const offline = await browser.execute(async () => { await document.fonts.ready; return { svg: !!document.querySelector('.mermaid-diagram svg'), formula: !!document.querySelector('.katex'), imageLoaded: Array.from(document.images).every(img => img.complete && img.naturalWidth > 0), external: performance.getEntriesByType('resource').filter(e => /^https?:/.test(e.name) && !e.name.includes('localhost')).map(e => e.name) } })
    report.offlinePreview = offline; expect(offline.imageLoaded).toBe(true); expect(offline.external).toEqual([])
    await browser.switchToWindow(preview); await browser.closeWindow(); await browser.waitUntil(async () => (await browser.getWindowHandles()).includes(main)); await browser.switchToWindow(main)
  })
  it('synchronizes both split panes without feedback and locates repeated headings by source line', async () => {
    await file('sync.md').click(); await $(`//*[@data-active-document="true"]//button[normalize-space(.)="分屏"]`).click(); await $(`${active} .cm-content`).waitForExist()
    await button('Show outline').click(); await $('[data-heading-line="13"]').click()
    const heading = await browser.execute(() => {
      const root = document.querySelector('[data-active-document="true"]')!
      const scroller = root.querySelector('.markdown-preview')!
      const target = root.querySelector('#heading-13')!
      return Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top)
    })
    expect(heading).toBeLessThan(26)
    await browser.execute(() => {
      const root = document.querySelector('[data-active-document="true"]')!
      const editor = root.querySelector('.cm-scroller') as HTMLElement
      editor.dispatchEvent(new WheelEvent('wheel', { bubbles: true })); editor.scrollTop = 3000; editor.dispatchEvent(new Event('scroll'))
    })
    await browser.waitUntil(async () => browser.execute(() => (document.querySelector('[data-active-document="true"] .markdown-preview') as HTMLElement).scrollTop > 1000))
    const before = await browser.execute(() => Array.from(document.querySelectorAll('[data-active-document="true"] .cm-scroller, [data-active-document="true"] .markdown-preview')).map(node => node.scrollTop))
    await browser.pause(250)
    const after = await browser.execute(() => Array.from(document.querySelectorAll('[data-active-document="true"] .cm-scroller, [data-active-document="true"] .markdown-preview')).map(node => node.scrollTop))
    expect(after).toEqual(before)
    await browser.execute(() => { const reader = document.querySelector('[data-active-document="true"] .markdown-preview') as HTMLElement; reader.dispatchEvent(new WheelEvent('wheel', { bubbles: true })); reader.scrollTop = 8000; reader.dispatchEvent(new Event('scroll')) })
    await browser.waitUntil(async () => browser.execute(() => Math.abs((document.querySelector('[data-active-document="true"] .cm-scroller') as HTMLElement).scrollTop - 3000) > 100))
    report.splitSync = { repeatedHeadingOffsetPx: heading, stablePositions: after, reverseSync: true }
    await button('Hide outline').click()
  })
  it('previews CJK formatting, undoes it and retains source drafts across tabs', async () => {
    await file('small.md').click(); await $(`//*[@data-active-document="true"]//button[normalize-space(.)="编辑"]`).click(); await $(`${active} .cm-content`).waitForExist()
    const original = readFileSync(join(workspace, 'small.md'), 'utf8')
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="CJK 格式预览"]`).click(); await bodyHas('应用格式')
    expect(readFileSync(join(workspace, 'small.md'), 'utf8')).toBe(original)
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="应用格式"]`).click(); await bodyHas('中文 ABC')
    await $(`//*[@data-active-document="true"]//button[normalize-space(.)="撤销"]`).click(); await bodyHas('中文ABC')
    await file('rich.md').click(); await file('small.md').click(); expect(await $(`${active} .cm-content`).getText()).toContain('中文ABC')
    expect(readFileSync(join(workspace, 'small.md'), 'utf8')).toBe(original)
  })
})
