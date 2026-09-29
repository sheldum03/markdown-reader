import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MarkdownPreview from '../components/MarkdownPreview.vue'
import { enhanceMarkdown } from '../lib/markdown/enhance'
import { open } from '@tauri-apps/plugin-shell'

const cleanup = vi.hoisted(() => vi.fn())
vi.mock('../lib/markdown/enhance', () => ({ enhanceMarkdown: vi.fn(() => cleanup) }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }))
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
async function render() { await vi.runAllTimersAsync(); await flushPromises() }

describe('Markdown preview', () => {
  it('resolves local heading slugs and opens external fragment links', async () => {
    const wrapper = mount(MarkdownPreview, { props: { filePath: '/a.md', content: '# Foo\n\n[local](#foo) [external](https://example.com/#heading-1)\n\n# Foo' } })
    await render()
    const scroll = vi.fn()
    ;(wrapper.get('h1').element as HTMLElement).scrollIntoView = scroll
    await wrapper.findAll('a')[0].trigger('click')
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
    await wrapper.findAll('a')[1].trigger('click')
    expect(open).toHaveBeenCalledWith('https://example.com/#heading-1')
    wrapper.unmount()
  })
  it('renders headings, copies exact fenced source and resolves local images', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(MarkdownPreview, { props: { filePath: '/space name/docs/a.md', content: '# Hello\n\n![pic](../assets/image%20one.png)\n\n```js\nconst n = 1\n```' } })
    await render()
    expect(wrapper.find('h1').text()).toBe('Hello')
    expect(wrapper.emitted('headings')?.[0][0]).toEqual([{ id: 'heading-1', line: 1, text: 'Hello', level: 1 }])
    expect(wrapper.get('img').attributes('src')).toContain(encodeURIComponent('/space name/assets/image one.png'))
    await wrapper.get('[data-copy-code]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('const n = 1\n')
    wrapper.unmount()
    expect(cleanup).toHaveBeenCalled()
  })
  it('debounces live edits and cancels work after unmount', async () => {
    const wrapper = mount(MarkdownPreview, { props: { filePath: '/a.md', content: '# First' } })
    await render()
    await wrapper.setProps({ content: '# Second' })
    await vi.advanceTimersByTimeAsync(80)
    await wrapper.setProps({ content: '# Latest' })
    expect(wrapper.get('h1').text()).toBe('First')
    await render()
    expect(wrapper.get('h1').text()).toBe('Latest')
    await wrapper.setProps({ content: '# Never' })
    wrapper.unmount()
    const count = vi.mocked(enhanceMarkdown).mock.calls.length
    await render()
    expect(enhanceMarkdown).toHaveBeenCalledTimes(count)
  })
  it('uses a worker for large documents and rejects old worker responses', async () => {
    class FakeWorker {
      static instances: FakeWorker[] = []
      onmessage: ((event: any) => void) | null = null
      onerror: (() => void) | null = null
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() { FakeWorker.instances.push(this) }
    }
    vi.stubGlobal('Worker', FakeWorker)
    const wrapper = mount(MarkdownPreview, { props: { filePath: '/large.md', content: 'a'.repeat(80_001) } })
    await render()
    const first = FakeWorker.instances[0]
    const firstId = first.postMessage.mock.calls[0][0].id
    await wrapper.setProps({ content: 'b'.repeat(80_001) })
    await render()
    const latest = FakeWorker.instances[1]
    expect(first.terminate).toHaveBeenCalled()
    first.onmessage?.({ data: { id: firstId, result: { html: '<p>STALE</p>', headings: [] } } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('STALE')
    latest.onmessage?.({ data: { id: latest.postMessage.mock.calls[0][0].id, result: { html: '<p>LATEST</p>', headings: [] } } })
    await flushPromises()
    expect(wrapper.text()).toContain('LATEST')
    expect(latest.terminate).toHaveBeenCalled()
    wrapper.unmount()
  })
})
