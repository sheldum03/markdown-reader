import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const workspace = '/tmp/markdown-html-e2e-workspace'

describe('Sidebar resizing', () => {
  before(async () => {
    rmSync(workspace, { recursive: true, force: true })
    mkdirSync(workspace, { recursive: true })
    writeFileSync(join(workspace, 'note.md'), '# Sidebar note\n\nSelect this passage for a comment.')
    await browser.execute(() => {
      localStorage.setItem('md-html-reader.locale', 'en')
      localStorage.removeItem('md-html-reader.sidebar-widths')
    })
    await browser.refresh()
  })

  it('drags, persists and constrains desktop sidebars without narrowing the document pane on compact windows', async () => {
    await $('//button[normalize-space(.)="Open folder"]').click()
    const file = $('[data-file-path$="/note.md"]')
    await file.waitForExist()
    await file.click()
    await $('[aria-label="编辑"]').click()
    await $('.cm-editor').waitForExist()

    await browser.execute(() => {
      const drag = (label: string, start: number, end: number) => {
        const handle = document.querySelector<HTMLElement>(`[aria-label="${label}"]`)
        if (!handle) throw new Error(`Missing resize handle: ${label}`)
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: start }))
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: end }))
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: end }))
      }
      drag('调整文件侧边栏宽度', 256, 336)
    })
    expect(await browser.execute(() => JSON.parse(localStorage.getItem('md-html-reader.sidebar-widths') || '{}').workspace)).toBe(336)

    await browser.execute(() => (window as any).__markdownHtmlE2E.selectText('Select this passage'))
    await $('[aria-label="Add comment"]').click()
    await $('[aria-label="Document tools"]').waitForExist()
    await browser.execute(() => {
      const handle = document.querySelector<HTMLElement>('[aria-label="调整文档工具侧边栏宽度"]')
      if (!handle) throw new Error('Missing document resize handle')
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 1100 }))
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1020 }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 1020 }))
    })
    expect(await browser.execute(() => JSON.parse(localStorage.getItem('md-html-reader.sidebar-widths') || '{}').document)).toBe(432)

    await browser.setWindowSize(800, 900)
    const compactLayout = await browser.execute(() => {
      const workspace = document.querySelector<HTMLElement>('.apple-workspace-sidebar')!
      const documentTools = document.querySelector<HTMLElement>('.apple-document-sidebar')!
      const activeDocument = document.querySelector<HTMLElement>('[data-active-document="true"]')!
      return {
        workspaceWidth: workspace.getBoundingClientRect().width,
        documentPosition: getComputedStyle(documentTools).position,
        activeDocumentWidth: activeDocument.getBoundingClientRect().width,
      }
    })
    expect(compactLayout.workspaceWidth).toBeLessThanOrEqual(256)
    expect(compactLayout.documentPosition).toBe('absolute')
    expect(compactLayout.activeDocumentWidth).toBeGreaterThan(compactLayout.workspaceWidth)

    await browser.setWindowSize(1280, 900)
    await browser.refresh()
    await $('//button[normalize-space(.)="Open folder"]').click()
    const reopenedFile = $('[data-file-path$="/note.md"]')
    await reopenedFile.waitForExist()
    await reopenedFile.click()
    const restoredWidths = await browser.execute(() => ({
      workspace: document.querySelector<HTMLElement>('.apple-workspace-sidebar')?.style.getPropertyValue('--workspace-sidebar-width'),
      document: JSON.parse(localStorage.getItem('md-html-reader.sidebar-widths') || '{}').document,
    }))
    expect(restoredWidths.workspace).toBe('336px')
    expect(restoredWidths.document).toBe(432)
  })
})
