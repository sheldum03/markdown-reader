import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../stores/workspace'
import { useCommentsStore } from '../stores/comments'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
describe('navigation races', () => {
  it('late file read cannot replace a newer selection or its loading state', async () => {
    const a = deferred<string>(), b = deferred<string>()
    vi.mocked(invoke).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const store = useWorkspaceStore()
    store.folderPath = '/workspace'
    const first = store.openFile('/workspace/a.md')
    const second = store.openFile('/workspace/b.md')
    a.resolve('A')
    expect(await first).toBe(false)
    expect(store.openingPath).toBe('/workspace/b.md')
    b.resolve('B')
    expect(await second).toBe(true)
    expect(store.currentFile?.content).toBe('B')
    expect(store.openingPath).toBeNull()
  })
  it('switching workspace invalidates an in-flight document read', async () => {
    const old = deferred<string>()
    vi.mocked(invoke).mockReturnValueOnce(old.promise).mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    store.folderPath = '/old'
    const reading = store.openFile('/old/a.md')
    await store.loadFolder('/new')
    old.resolve('OLD')
    expect(await reading).toBe(false)
    expect(store.currentFile).toBeNull()
  })
  it('an older folder scan cannot overwrite a newer workspace', async () => {
    const old = deferred<[]>()
    vi.mocked(invoke).mockReturnValueOnce(old.promise).mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    const first = store.loadFolder('/old')
    await store.loadFolder('/new')
    old.resolve([])
    expect(await first).toBe(false)
    expect(store.folderPath).toBe('/new')
  })
  it('late comment results never leak into a different document', async () => {
    const old = deferred<[]>()
    vi.mocked(invoke).mockImplementation(async (command, args: any) => {
      if (command === 'calculate_file_hash') return args.path
      if (args.filePath === '/a.md') return old.promise
      return []
    })
    const store = useCommentsStore()
    const first = store.loadComments('/workspace', '/a.md')
    await Promise.resolve()
    await store.loadComments('/workspace', '/b.md')
    old.resolve([])
    await first
    expect(store.currentFilePath).toBe('/b.md')
    expect(store.currentFileHash).toBe('/b.md')
  })
  it('clearing a workspace invalidates pending comment hashes', async () => {
    const hash = deferred<string>()
    vi.mocked(invoke).mockReturnValueOnce(hash.promise)
    const store = useCommentsStore()
    const reading = store.loadComments('/old', '/old/a.md')
    store.clearCurrentFile()
    hash.resolve('old')
    await reading
    expect(store.currentFilePath).toBeNull()
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
