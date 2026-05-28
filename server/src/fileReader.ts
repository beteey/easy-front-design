/**
 * Read a source file snippet around a specific line for AI context.
 */

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

export interface FileContext {
  file: string
  line: number
  snippet: string
  language: string
}

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.json': 'json',
  '.md': 'markdown',
  '.vue': 'vue',
  '.svelte': 'svelte',
}

const CONTEXT_LINES = 10

export async function readFileContext(file: string, line: number): Promise<FileContext | null> {
  try {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')
    const start = Math.max(0, line - CONTEXT_LINES - 1)
    const end = Math.min(lines.length, line + CONTEXT_LINES)
    const snippet = lines.slice(start, end).join('\n')
    const ext = extname(file).toLowerCase()
    const language = LANG_MAP[ext] ?? 'text'

    return { file, line, snippet, language }
  } catch {
    return null
  }
}
