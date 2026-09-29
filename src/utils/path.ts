export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

export function joinFilePath(directory: string, fileName: string): string {
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${fileName}`
}
