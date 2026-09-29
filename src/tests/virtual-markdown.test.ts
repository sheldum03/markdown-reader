import { it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VirtualMarkdown from '../components/VirtualMarkdown.vue'
import { prepareMarkdown } from '../lib/markdown/renderer'
import { open } from '@tauri-apps/plugin-shell'
vi.mock('../lib/markdown/enhance', () => ({ enhanceMarkdown: () => () => {} }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
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

async function mountIndexedDocument(source: string) {
  class Worker {
    static instance: Worker
    onmessage: ((event: any) => void) | null = null
    postMessage = vi.fn(); terminate = vi.fn()
    constructor() { Worker.instance = this }
  }
  vi.stubGlobal('Worker', Worker)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const wrapper = mount(VirtualMarkdown, { props: { content: source, filePath: '/a.md' } })
  await new Promise(resolve => setTimeout(resolve, 1))
  const doc = prepareMarkdown(source, true), worker = Worker.instance
  worker.onmessage?.({ data: { type: 'ready', headings: doc.headings, anchors: doc.anchors, blocks: doc.blocks } })
  const request = worker.postMessage.mock.calls.at(-1)![0]
  worker.onmessage?.({ data: { type: 'range', request: request.request, blocks: request.indices.map((index: number) => ({ index, html: doc.render(index) })) } })
  await flushPromises()
  return { wrapper, worker, doc }
}
it('opens external fragment URLs instead of treating them as local heading IDs', async () => {
  const { wrapper } = await mountIndexedDocument('# Top\n\n[external](https://example.com/#heading-1)')
  await wrapper.get('a').trigger('click')
  expect(open).toHaveBeenCalledWith('https://example.com/#heading-1')
  wrapper.unmount()
})
it('synchronizes a source line into a later raw slice and reports that slice on scroll', async () => {
  const source = '```text\n' + 'abcdefghijk\n'.repeat(4000) + '```\n'
  const { wrapper, worker, doc } = await mountIndexedDocument(source)
  const target = doc.blocks.findIndex(b => b.line <= 3000 && b.endLine > 3000)
  expect(target).toBeGreaterThan(0)
  ;(wrapper.vm as any).scrollToLine(3000)
  expect(wrapper.element.scrollTop).toBe(doc.blocks.slice(0, target).reduce((sum, b) => sum + b.estimate, 0))
  expect(worker.postMessage.mock.calls.at(-1)![0].indices).toContain(target)
  await wrapper.trigger('wheel')
  await wrapper.trigger('scroll')
  expect(wrapper.emitted('scroll')?.at(-1)).toEqual([doc.blocks[target].line])
  wrapper.unmount()
})
it('resolves heading slugs outside the mounted window and preserves explicit duplicate IDs', async () => {
  const source = '# Top\n\n[far](#far-away)\n\n' + 'padding\n\n'.repeat(100) + '# Far away\n\n# Far away\n'
  const { wrapper, worker, doc } = await mountIndexedDocument(source)
  expect(wrapper.text()).not.toContain('Far away')
  const target = doc.blocks.findIndex(b => b.line === doc.headings[1].line)
  await wrapper.get('a').trigger('click')
  expect(wrapper.element.scrollTop).toBe(doc.blocks.slice(0, target).reduce((total, b) => total + b.estimate, 0))
  expect(worker.postMessage.mock.calls.at(-1)![0].indices).toContain(target)
  expect(doc.anchors['far-away']).toBe(target)
  expect(doc.anchors[doc.headings[2].id]).not.toBe(target)
  wrapper.unmount()
})
