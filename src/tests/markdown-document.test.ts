import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MarkdownDocument from '../components/MarkdownDocument.vue'

const harness = vi.hoisted(() => ({ mounted: vi.fn(), save: vi.fn(), replace: vi.fn() }))
vi.mock('../components/SourceEditor.vue', () => ({ default: {
  props: ['file'], emits: ['change'],
  mounted: harness.mounted,
  setup(_: unknown, { expose }: any) { expose({ saveCurrentContent: harness.save, replaceContent: harness.replace, requestDiscardChanges: async () => true }) },
  template: '<div data-editor><button @click="$emit(\'change\', \'updated\')">change</button></div>',
} }))
vi.mock('../components/MarkdownPreview.vue', () => ({ default: { props: ['content'], template: '<div data-preview>{{ content }}</div>' } }))
afterEach(() => { vi.clearAllMocks() })
function setup() {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(MarkdownDocument, { props: { file: { path: '/a.md', content: '# Original' }, saveContent } })
  const click = async (label: string) => { await wrapper.findAll('button').find(b => b.text() === label)!.trigger('click'); await flushPromises() }
  return { wrapper, click, saveContent }
}
describe('Markdown document modes', () => {
  it('opens in reading mode without mounting the editor and supports AI write-back', async () => {
    const { wrapper, saveContent } = setup()
    await flushPromises()
    expect(harness.mounted).not.toHaveBeenCalled()
    expect(wrapper.get('[data-preview]').text()).toBe('# Original')
    await (wrapper.vm as any).replaceContent('# New')
    expect(saveContent).toHaveBeenCalledWith('# New')
    expect(wrapper.get('[data-preview]').text()).toBe('# New')
    wrapper.unmount()
  })
  it('loads editor once, keeps it alive across modes, and previews unsaved changes', async () => {
    const { wrapper, click } = setup()
    await click('分屏')
    expect(harness.mounted).toHaveBeenCalledTimes(1)
    const preview = wrapper.get('[data-preview]').element
    const editor = wrapper.get('[data-editor]').element
    expect(Boolean(preview.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    await click('change')
    expect(wrapper.get('[data-preview]').text()).toBe('updated')
    await click('阅读')
    expect(harness.save).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-editor]').isVisible()).toBe(false)
    await click('编辑')
    expect(harness.mounted).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('does not hide the editor when saving before reading fails', async () => {
    const { wrapper, click } = setup()
    await click('编辑')
    harness.save.mockRejectedValueOnce(new Error('Disk full'))
    await click('阅读')
    expect(wrapper.get('[role=alert]').text()).toContain('Disk full')
    expect(wrapper.get('[data-editor]').isVisible()).toBe(true)
    wrapper.unmount()
  })
})
