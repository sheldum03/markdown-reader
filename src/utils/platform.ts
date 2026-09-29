export function isMacPlatform(platform = navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

export function primaryShortcut(key: string, platform = navigator.platform): string {
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key
  return isMacPlatform(platform) ? `⌘${normalizedKey}` : `Ctrl+${normalizedKey}`
}
