#!/usr/bin/env node
/**
 * Standalone design-request agent.
 * Long-polls the server, reads source files, calls Claude API for code changes,
 * applies edits, and reports results — all in one fast loop.
 *
 * Usage: node scripts/agent.mjs
 * Env:   reads from .env (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL)
 */

import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SERVER = process.env.SERVER_URL || 'http://127.0.0.1:3771'

const API_KEY = process.env.ANTHROPIC_API_KEY
const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY is required')
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchNext(timeoutMs = 30000) {
  const res = await fetch(`${SERVER}/api/next?timeout=${timeoutMs}`)
  const data = await res.json()
  return data.request || null
}

async function reportComplete(id, payload) {
  const res = await fetch(`${SERVER}/api/complete/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

function readFile_safe(path) {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

// ── AI call ──────────────────────────────────────────────────────────────────

async function askClaude(systemPrompt, userMessage) {
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const textBlock = data.content?.find((b) => b.type === 'text')
  return textBlock?.text || ''
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are a front-end code editor. The user selects a DOM element on a web page and describes a visual change they want.

You will receive:
1. The full source file content
2. Element context (tag, classes, computed styles, text content)
3. The user's modification request

Your task: output the COMPLETE modified file with the requested change applied.

Rules:
- Output ONLY the modified file content, nothing else
- Do NOT add explanations, markdown fences, or any text outside the file content
- Make minimal, precise changes — don't rewrite things that don't need to change
- Preserve all existing structure and formatting
- If the element needs a new CSS class to avoid affecting other elements, add it
- Ensure the change is visually correct (e.g., good contrast for text on dark backgrounds)`

// ── Main loop ────────────────────────────────────────────────────────────────

console.log(`[agent] design-easily agent started`)
console.log(`[agent] model: ${MODEL}`)
console.log(`[agent] server: ${SERVER}`)
console.log(`[agent] watching for requests...\n`)

async function processRequest(request) {
  const { id, element, userMessage, action } = request
  const short = userMessage.length > 50 ? userMessage.slice(0, 50) + '...' : userMessage
  console.log(`[request] ${id.slice(0, 8)} | "${short}" | element: <${element.tag}>`)

  // Try to find the source file
  let sourceFile = element.sourceFile || null
  let sourceContent = null

  // If no source file, look for test/index.html as fallback
  if (!sourceFile) {
    const candidates = [
      'test/index.html',
      'index.html',
    ]
    for (const c of candidates) {
      const full = resolve(ROOT, c)
      const content = readFile_safe(full)
      if (content && content.includes(element.textContent?.slice(0, 20) || '___NOMATCH___')) {
        sourceFile = full
        sourceContent = content
        break
      }
    }
  } else {
    sourceContent = readFile_safe(sourceFile)
  }

  if (!sourceContent) {
    await reportComplete(id, {
      status: 'failed',
      error: `Could not find source file${sourceFile ? `: ${sourceFile}` : ''}`,
    })
    console.log(`[result] ${id.slice(0, 8)} FAILED — source file not found\n`)
    return
  }

  // Build context for AI
  const context = `Element context:
- Tag: <${element.tag}>
- Classes: ${element.classList?.join(' ') || '(none)'}
- Text content: ${(element.textContent || '').slice(0, 200)}
- Computed styles: ${JSON.stringify(element.computedStyles || {}, null, 2)}
${element.sourceFile ? `- Source file: ${element.sourceFile}:${element.sourceLine || '?'}` : ''}

User request: ${userMessage}`

  const userPrompt = `Source file: ${sourceFile}\n\n\`\`\`\n${sourceContent}\n\`\`\`\n\n${context}`

  try {
    const modified = await askClaude(SYSTEM, userPrompt)

    // Validate: the response should look like file content
    if (!modified || modified.length < 10) {
      throw new Error('AI returned empty or too-short response')
    }

    // Strip markdown fences if present
    let cleaned = modified
    const fenceMatch = cleaned.match(/^```(?:\w*)\n([\s\S]*?)\n```$/)
    if (fenceMatch) {
      cleaned = fenceMatch[1]
    }

    // Write the modified file
    writeFileSync(sourceFile, cleaned, 'utf-8')

    await reportComplete(id, {
      status: 'completed',
      summary: `AI 已将修改应用到 ${sourceFile.split('/').pop()}`,
      changedFiles: [sourceFile.replace(ROOT + '/', '')],
      content: `已修改 ${sourceFile.split('/').pop()}：${userMessage}`,
    })

    console.log(`[result] ${id.slice(0, 8)} DONE — modified ${sourceFile.split('/').pop()}`)
  } catch (err) {
    console.error(`[error] ${id.slice(0, 8)} ${err.message}`)
    await reportComplete(id, {
      status: 'failed',
      error: err.message,
    })
  }
  console.log()
}

// ── Poll loop ────────────────────────────────────────────────────────────────

async function poll() {
  while (true) {
    try {
      const request = await fetchNext(30000)
      if (request) {
        await processRequest(request)
      }
    } catch (err) {
      console.error(`[poll] error: ${err.message}`)
      // Wait a bit before retrying on error
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

poll()
