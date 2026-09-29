#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const spec = process.argv[2]
const reopenPhase = process.argv[3]
const appBinaryName = process.platform === 'win32' ? 'md-html-reader.exe' : 'md-html-reader'
const appBinary = resolve('src-tauri', 'target', 'debug', appBinaryName)
const workspacePath = process.env.E2E_WORKSPACE_PATH || join(tmpdir(), 'markdown-html-e2e-workspace 中文 &^#')

if (!spec) {
  console.error('Usage: node scripts/run-e2e.mjs <spec> [create|verify]')
  process.exit(2)
}

if (reopenPhase && !['create', 'verify'].includes(reopenPhase)) {
  console.error(`Invalid reopen phase: ${reopenPhase}`)
  process.exit(2)
}

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate an E2E port')))
        return
      }
      server.close(error => error ? reject(error) : resolvePort(address.port))
    })
  })
}

const requestedPort = process.env.TAURI_WEBDRIVER_PORT
const port = requestedPort ? Number(requestedPort) : await availablePort()
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid TAURI_WEBDRIVER_PORT: ${requestedPort}`)
  process.exit(2)
}

function runWdio() {
  return new Promise(resolveRun => {
    const wdio = resolve('node_modules', '@wdio', 'cli', 'bin', 'wdio.js')
    const child = spawn(
      process.execPath,
      [wdio, 'run', 'wdio.e2e.conf.ts', '--spec', spec],
      {
        env: {
          ...process.env,
          E2E_WORKSPACE_PATH: workspacePath,
          TAURI_WEBDRIVER_PORT: String(port),
          ...(reopenPhase ? { E2E_REOPEN_PHASE: reopenPhase } : {}),
        },
        stdio: 'inherit',
      },
    )

    child.once('error', error => {
      console.error(`[e2e] failed to start WDIO: ${error.message}`)
      resolveRun(1)
    })
    child.once('exit', code => resolveRun(code ?? 1))
  })
}

console.log(`[e2e] running ${spec}, binary ${appBinary}, port ${port}`)
process.exit(await runWdio())
