import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const workspace = '/tmp/markdown-html-e2e-workspace'
const source = '---\nname: ui-design-assistant\ndescription: UI 界面设计师\n---\n\n# UI 界面设计师 — 灵魂\n\n你好！我是 **UI 界面设计师数字人**。\n\n## 能力\n\n- 保留 Markdown 源代码\n- 支持阅读、编辑与分屏\n\n```ts\nconst message = "Hello, world"\n```\n'

describe('Source editing and icon controls', () => {
  before(async () => {
    rmSync(workspace, { recursive: true, force: true })
    mkdirSync(workspace, { recursive: true })
    writeFileSync(join(workspace, 'SOUL.md'), source)
    await browser.execute(() => localStorage.setItem('md-html-reader.locale', 'zh-CN'))
    await browser.refresh()
  })
  it('shows raw Markdown with named IconPark controls and preview on the left in split mode', async () => {
    await $('//button[normalize-space(.)="打开文件夹"]').click()
    const file = $('[data-file-path$="/SOUL.md"]')
    await file.waitForExist()
    await file.click()
    await $('[aria-label="编辑"]').click()
    await $('.cm-editor').waitForExist()
    const state = await browser.execute(() => ({
      source: document.querySelector('.cm-content')?.textContent,
      tabs: document.querySelectorAll('[role="tab"]').length,
      previewVisible: Array.from(document.querySelectorAll<HTMLElement>('.markdown-preview, .ProseMirror')).some(element => element.getBoundingClientRect().width > 0),
      actions: Array.from(document.querySelectorAll<HTMLButtonElement>('button.icon-button')).map(button => ({ icon: !!button.querySelector('svg'), label: button.getAttribute('aria-label'), title: button.title })),
    }))
    expect(state.source).toContain('# UI 界面设计师 — 灵魂')
    expect(state.source).toContain('**UI 界面设计师数字人**')
    expect(state.tabs).toBe(1)
    expect(state.previewVisible).toBe(false)
    expect(state.actions.length).toBeGreaterThan(10)
    expect(state.actions.every(button => button.icon && button.label && button.title)).toBe(true)
    await $('[aria-label="编辑"]').moveTo()
    await expect($('[aria-label="编辑"]')).toHaveAttribute('title', '编辑')
    await $('[aria-label="分屏"]').click()
    await $('.markdown-preview').waitForExist()
    expect(await $('.cm-editor').isDisplayed()).toBe(true)
    const previewOnLeft = await browser.execute(() => {
      const preview = document.querySelector('.markdown-preview')!.getBoundingClientRect()
      const editor = document.querySelector('.source-editor')!.getBoundingClientRect()
      return preview.width > 0 && editor.width > 0 && preview.right <= editor.left
    })
    expect(previewOnLeft).toBe(true)
    await $('.source-editor summary').click()
    const settingsFit = await browser.execute(() => {
      const editor = document.querySelector('.source-editor')!.getBoundingClientRect()
      const panel = document.querySelector('.source-editor details > div')!.getBoundingClientRect()
      return panel.left >= editor.left && panel.right <= editor.right && panel.width > 0
    })
    expect(settingsFit).toBe(true)
  })
})
