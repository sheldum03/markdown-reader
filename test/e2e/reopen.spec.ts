import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspacePath = process.env.E2E_WORKSPACE_PATH || join(tmpdir(), 'markdown-html-e2e-workspace 中文 &^#')
const notePath = join(workspacePath, 'note.md')
const phase = process.env.E2E_REOPEN_PHASE

function buttonWithText(text: string) {
  return $(`//button[normalize-space(.)="${text}"]`)
}

function buttonContaining(text: string) {
  return $(`//button[contains(normalize-space(.), "${text}")]`)
}

async function waitForBodyText(text: string) {
  await browser.waitUntil(
    async () => (await $('body').getText()).includes(text),
    { timeoutMsg: `Expected body text to include: ${text}` }
  )
}

async function setEditorContent(text: string) {
  const edit = $('//*[@data-active-document="true"]//button[normalize-space(.)="编辑"]')
  if (await edit.getAttribute('aria-pressed') !== 'true') await edit.click()
  await browser.waitUntil(async () => browser.execute(() => !!(window as any).__markdownHtmlE2E))
  const updated = await browser.execute((content) => {
    const helpers = (document.querySelector('[data-active-document="true"] .cm-editor')?.parentElement as any)?.__editor || (window as any).__markdownHtmlE2E
    if (!helpers) return false
    helpers.setEditorContent(content)
    return true
  }, text)

  expect(updated).toBe(true)
  await waitForBodyText('Edited after app restart')
}

async function selectEditorText(text: string) {
  const selected = await browser.execute((target) => {
    const helpers = (document.querySelector('[data-active-document="true"] .cm-editor')?.parentElement as any)?.__editor
    return helpers?.selectText(target) || false
  }, text)
  expect(selected).toBe(true)
  await waitForBodyText('Add comment')
}

async function openE2EWorkspaceAndNote(expectedText: string) {
  await buttonWithText('Open folder').click()
  await waitForBodyText('note.md')

  await buttonContaining('note.md').click()
  await waitForBodyText(expectedText)
}

describe('MD+HTML Reader app restart persistence', () => {
  before(async () => {
    await browser.execute(() => localStorage.setItem('md-html-reader.locale', 'en'))
    await browser.refresh()
    if (phase === 'create') {
      rmSync(workspacePath, { recursive: true, force: true })
      mkdirSync(workspacePath, { recursive: true })
      writeFileSync(
        notePath,
        '# Restart E2E Note\n\nOriginal restart text.\n\nRestart comment target.\n'
      )
      return
    }

    if (phase === 'verify' && !existsSync(notePath)) {
      throw new Error('Missing reopen fixture; run E2E_REOPEN_PHASE=create first')
    }
  })

  it('creates a saved comment or verifies it after a fresh app process', async () => {
    if (phase === 'create') {
      await openE2EWorkspaceAndNote('Original restart text')
      await setEditorContent('# Restart E2E Note\n\nEdited after app restart.\n\nRestart comment target.')
      await buttonContaining('Save').click()
      await waitForBodyText('Saved just now')
      expect(readFileSync(notePath, 'utf8')).toContain('Edited after app restart')

      await selectEditorText('Restart comment target')
      await buttonContaining('Add comment').click()
      await $('textarea[placeholder="Write a comment..."]').setValue('Reopen review note')
      await buttonWithText('Submit').click()
      await waitForBodyText('Reopen review note')
      expect(existsSync(join(workspacePath, '.comments'))).toBe(true)
      return
    }

    expect(phase).toBe('verify')
    await openE2EWorkspaceAndNote('Edited after app restart')
    await waitForBodyText('Reopen review note')
  })
})
