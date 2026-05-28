/**
 * Open file in VS Code at a specific line.
 * Uses the `code` CLI command.
 */

import { spawn } from 'node:child_process'

export async function openInVSCode(file: string, line: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['--goto', `${file}:${line}`]
    const child = spawn('code', args, { stdio: 'ignore', detached: true })
    child.unref()
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`code exited with ${code}`))
    })
    // Resolve immediately — VS Code may detach
    resolve()
  })
}
