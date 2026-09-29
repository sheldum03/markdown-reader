import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
function closure(key, seen = new Set()) { if (seen.has(key)) return seen; seen.add(key); for (const dep of manifest[key]?.imports || []) closure(dep, seen); return seen }
function measure(keys) { return [...keys].reduce((result, key) => { const path = `dist/${manifest[key].file}`; const bytes = readFileSync(path); result.bytes += bytes.length; result.gzipBytes += gzipSync(bytes).length; return result }, { bytes: 0, gzipBytes: 0 }) }
const entry = name => Object.keys(manifest).find(key => manifest[key].name === name)
const shell = closure('index.html'), reading = closure(entry('MarkdownDocument'), new Set(shell))
const report = { shell: measure(shell), reading: measure(reading), sourceEditor: measure(closure(entry('SourceEditor'))), mermaid: measure(closure(entry('mermaid.core'))), largest: Object.values(manifest).filter(m => m.file.endsWith('.js')).map(m => ({ file: m.file, bytes: statSync(`dist/${m.file}`).size })).sort((a,b) => b.bytes - a.bytes).slice(0,12) }
writeFileSync('docs/qa/phase-two-bundle.json', JSON.stringify(report, null, 2)+'\n')
console.log(JSON.stringify(report, null, 2))
