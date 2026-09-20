import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
export function resolveImages(root: HTMLElement, filePath: string) {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    if (src && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src)) {
      const base = new URL('file:///'); base.pathname = filePath
      img.src = convertFileSrc(decodeURIComponent(new URL(src, base).pathname))
    }
  }
}
export async function handleMarkdownLink(event: MouseEvent, root: HTMLElement | null) {
  const target = event.target as HTMLElement, button = target.closest<HTMLButtonElement>('[data-copy-code]')
  if (button) { await navigator.clipboard.writeText(button.closest('.code-block')?.querySelector('pre')?.textContent || ''); button.textContent = '已复制'; return }
  const link = target.closest('a'); if (!link) return
  event.preventDefault()
  const href = link.getAttribute('href') || ''
  if (href.startsWith('#')) {
    let id = href.slice(1); try { id = decodeURIComponent(id) } catch { /* literal */ }
    Array.from(root?.querySelectorAll<HTMLElement>('[id]') || []).find(node => node.id === id)?.scrollIntoView({ block: 'start' })
  } else if (/^(https?:|mailto:)/i.test(href)) await open(href)
}
