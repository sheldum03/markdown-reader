import { it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VirtualMarkdown from '../components/VirtualMarkdown.vue'
vi.mock('../lib/markdown/enhance', () => ({ enhanceMarkdown: () => () => {} }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals() })
it('requests a new bounded window on native scroll even when animation frames are suspended', async () => {
  class FakeWorker {
    static instance: FakeWorker
    onmessage: ((event: any) => void) | null = null
    postMessage = vi.fn(); terminate = vi.fn()
    constructor() { FakeWorker.instance = this }
  }
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const wrapper = mount(VirtualMarkdown, { props: { content: 'source', filePath: '/a.md' } })
  await new Promise(resolve => setTimeout(resolve, 1))
  const worker = FakeWorker.instance
  worker.onmessage?.({ data: { type: 'ready', headings: [], anchors: {}, blocks: Array.from({ length: 10000 }, (_, i) => ({ line: i + 1, endLine: i + 2, start: i * 100, end: i * 100 + 100, estimate: 100 })) } })
  await flushPromises()
  expect(worker.postMessage.mock.calls.at(-1)?.[0].indices.length).toBeLessThan(15)
  wrapper.element.scrollTop = 800_000
  await wrapper.trigger('scroll')
  const latest = worker.postMessage.mock.calls.at(-1)?.[0]
  expect(latest.indices[0]).toBe(7998)
  worker.onmessage?.({ data: { type: 'range', request: latest.request - 1, blocks: [{ index: 0, html: 'STALE' }] } })
  await flushPromises(); expect(wrapper.text()).not.toContain('STALE')
  worker.onmessage?.({ data: { type: 'range', request: latest.request, blocks: [{ index: 7998, html: '<p>VISIBLE</p>' }] } })
  await flushPromises(); expect(wrapper.text()).toContain('VISIBLE')
  wrapper.unmount(); expect(worker.terminate).toHaveBeenCalled()
})
