import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
function dependencies(entry, seen = new Set()) {
  if (seen.has(entry)) return seen
  const chunk = manifest[entry]
  if (!chunk) throw new Error(`Missing build entry: ${entry}`)
  seen.add(entry)
  for (const imported of chunk.imports || []) dependencies(imported, seen)
  return seen
}
const shell = dependencies('index.html')
const documentEntry = Object.keys(manifest).find(key => manifest[key].name === 'MarkdownDocument' && manifest[key].isDynamicEntry)
if (!documentEntry) throw new Error('Missing MarkdownDocument build entry')
const reading = dependencies(documentEntry, new Set(shell))
for (const entry of reading) {
  const chunk = manifest[entry]
  if (/SourceEditor|codemirror|MilkdownEditor|editor-framework|editor-presets|editor-plugins|mermaid|katex|prism/i.test(entry + chunk.file)) {
    throw new Error(`Reading eagerly loads an optional renderer: ${chunk.file}`)
  }
}
for (const [label, entries] of [['Shell', shell], ['Shell + reading', reading]]) {
  let bytes = 0, gzip = 0
  for (const entry of entries) {
    const file = `dist/${manifest[entry].file}`
    bytes += statSync(file).size
    gzip += gzipSync(readFileSync(file)).length
  }
  console.log(`${label}: ${(bytes / 1024).toFixed(1)} KiB JS / ${(gzip / 1024).toFixed(1)} KiB gzip`)
}
console.log('PASS: editor, math, diagram and highlighting engines remain demand-loaded.')
