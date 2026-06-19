/**
 * DeepSeek 后台工作服务 — 自动处理设计请求并修改文件
 *
 * 功能：
 * 1. 自动轮询队列，领取设计请求
 * 2. 读取源文件
 * 3. 调用 DeepSeek API 生成修改方案
 * 4. 直接修改文件
 */

import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { queue, type DesignRequest } from './queue.js'

const SERVER_URL = 'http://127.0.0.1:3771'
const WORKER_ID = `deepseek-worker-${process.pid}`
const POLL_INTERVAL_MS = 2000  // 2 秒轮询一次

// DeepSeek API 配置（在启动时读取，确保 dotenv 已加载）
let DEEPSEEK_API_KEY = ''
let DEEPSEEK_MODEL = 'deepseek-chat'
let DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

// 文件扩展名 -> 语言映射
const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.json': 'json',
  '.vue': 'vue',
  '.svelte': 'svelte',
}

/**
 * 读取源文件内容
 */
async function readSourceFile(filePath: string): Promise<{ content: string; language: string } | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const ext = extname(filePath).toLowerCase()
    const language = LANG_MAP[ext] || 'text'
    return { content, language }
  } catch (error) {
    console.error(`[deepseek-worker] 读取文件失败: ${filePath}`, error)
    return null
  }
}

/**
 * 写入文件
 */
async function writeSourceFile(filePath: string, content: string): Promise<boolean> {
  try {
    await writeFile(filePath, content, 'utf-8')
    console.log(`[deepseek-worker] 文件已修改: ${filePath}`)
    return true
  } catch (error) {
    console.error(`[deepseek-worker] 写入文件失败: ${filePath}`, error)
    return false
  }
}

/**
 * 调用 DeepSeek API 处理设计请求（带文件修改）
 */
async function callDeepSeek(request: DesignRequest, fileContent?: string, language?: string, model?: string): Promise<{ content: string; modifiedFile?: string }> {
  const elementInfo = `
元素信息：
- 标签: ${request.element.tag}
- 类名: ${request.element.classList.join(', ')}
- 文本内容: ${request.element.textContent}
- 源文件: ${request.element.sourceFile || '未知'}
- 当前样式:
${Object.entries(request.element.computedStyles).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
`

  const fileSection = fileContent
    ? `
当前文件内容（${language}）：
\`\`\`${language}
${fileContent}
\`\`\`
`
    : ''

  const systemPrompt = `你是一个前端开发助手。用户会给你一个网页元素的信息和修改要求。

你的任务：
1. 分析元素当前的样式和源代码
2. 根据用户要求生成修改方案
3. ${fileContent ? '直接输出修改后的完整文件内容' : '输出具体的 CSS 修改代码'}
4. ${fileContent ? '用 <<<FILE_START>>> 和 <<<FILE_END>>> 标记包裹修改后的文件内容' : ''}

重要规则：
- 保持代码结构不变，只修改必要的部分
- 遵循项目的代码风格（缩进、命名等）
- 不要删除或修改无关的代码
- 确保修改后的代码语法正确
- 如果是 CSS 修改，确保选择器正确
- 如果是 HTML 修改，确保标签闭合正确

${elementInfo}
${fileSection}
用户要求：${request.userMessage}

请直接输出修改结果。${fileContent ? `格式：
<<<FILE_START>>>
（修改后的完整文件内容）
<<<FILE_END>>>
` : `格式：
\`\`\`css
/* 修改建议 */
\`\`\`
`}`

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const result = data.choices[0]?.message?.content || ''

  // 解析文件修改标记
  if (fileContent) {
    const fileMatch = result.match(/<<<FILE_START>>>([\s\S]*?)<<<FILE_END>>>/)
    if (fileMatch) {
      return {
        content: result,
        modifiedFile: fileMatch[1].trim(),
      }
    }
  }

  return { content: result }
}

/**
 * 验证修改是否正确
 */
async function validateModification(
  originalContent: string,
  modifiedContent: string,
  userMessage: string,
  model?: string
): Promise<{ valid: boolean; reason?: string }> {
  const systemPrompt = `你是一个代码审查专家。用户会给你原始文件内容和修改后的文件内容，以及用户的要求。
你的任务是验证修改是否正确。

验证规则：
1. 修改是否符合用户的要求
2. 代码结构是否保持不变
3. 是否删除或修改了无关的代码
4. 语法是否正确
5. 如果是 CSS 修改，选择器是否正确

请用 JSON 格式回复：
{
  "valid": true/false,
  "reason": "如果无效，说明原因"
}`

  const userContent = `用户要求：${userMessage}

原始文件：
${originalContent}

修改后的文件：
${modifiedContent}`

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    console.error(`[deepseek-worker] 验证 API 调用失败: ${response.status}`)
    return { valid: true } // 如果验证失败，假设有效
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const result = data.choices[0]?.message?.content || ''

  try {
    // 尝试解析 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        valid: parsed.valid !== false,
        reason: parsed.reason,
      }
    }
  } catch {
    // 解析失败，假设有效
  }

  return { valid: true }
}

/**
 * 根据 URL 和元素信息查找源文件
 */
async function findSourceFile(url: string, projectPath?: string): Promise<string | null> {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // 优先使用用户配置的项目路径，否则使用默认路径
    const projectRoot = projectPath || process.cwd().replace(/\/server$/, '')

    console.log(`[deepseek-worker] 项目根目录: ${projectRoot}`)
    console.log(`[deepseek-worker] URL: ${url}`)
    console.log(`[deepseek-worker] URL pathname: ${pathname}`)

    // 如果是 file:// 协议，直接使用文件路径
    if (urlObj.protocol === 'file:') {
      // pathname 格式是 /Users/lcc/xxx/index.html，需要解码
      const filePath = decodeURIComponent(pathname)
      console.log(`[deepseek-worker] file:// 协议，直接使用文件路径: ${filePath}`)

      try {
        await readFile(filePath, 'utf-8')
        console.log(`[deepseek-worker] 找到源文件: ${filePath}`)
        return filePath
      } catch {
        console.log(`[deepseek-worker] 文件不存在: ${filePath}`)
        return null
      }
    }

    // 如果是本地服务器，尝试找到对应的文件
    if (urlObj.hostname === '127.0.0.1' || urlObj.hostname === 'localhost') {
      // 尝试常见的项目结构
      const possiblePaths = [
        `${projectRoot}${pathname}`,  // 相对于项目根目录
        `${projectRoot}/src${pathname}`,
        `${projectRoot}/public${pathname}`,
        `${projectRoot}/dist${pathname}`,
        `${projectRoot}/test${pathname}`,
      ]

      for (const path of possiblePaths) {
        try {
          await readFile(path, 'utf-8')
          console.log(`[deepseek-worker] 找到源文件: ${path}`)
          return path
        } catch {
          // 文件不存在，继续尝试下一个
        }
      }

      // 如果pathname是/，尝试查找index.html
      if (pathname === '/') {
        const indexPaths = [
          `${projectRoot}/index.html`,
          `${projectRoot}/src/index.html`,
          `${projectRoot}/public/index.html`,
          `${projectRoot}/test/index.html`,
        ]

        for (const path of indexPaths) {
          try {
            await readFile(path, 'utf-8')
            console.log(`[deepseek-worker] 找到源文件: ${path}`)
            return path
          } catch {
            // 文件不存在，继续尝试下一个
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * 智能查找项目根目录
 */
async function findProjectRoot(startPath: string): Promise<string | null> {
  try {
    let currentPath = startPath

    // 向上查找 package.json 或 .git
    while (currentPath !== '/') {
      try {
        await readFile(`${currentPath}/package.json`, 'utf-8')
        console.log(`[deepseek-worker] 找到项目根目录: ${currentPath}`)
        return currentPath
      } catch {
        // 没有 package.json，继续向上
      }

      try {
        await readFile(`${currentPath}/.git/HEAD`, 'utf-8')
        console.log(`[deepseek-worker] 找到项目根目录: ${currentPath}`)
        return currentPath
      } catch {
        // 没有 .git，继续向上
      }

      // 向上一级目录
      currentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    }

    return null
  } catch {
    return null
  }
}

/**
 * 处理单个设计请求
 */
async function processRequest(request: DesignRequest): Promise<void> {
  console.log(`[deepseek-worker] 处理请求: ${request.id}`)

  try {
    // 报告进度
    await reportProgress(request.id, '正在读取源文件...')

    // 尝试读取源文件
    let fileContent: string | undefined
    let language: string | undefined
    let sourceFile = request.element.sourceFile

    console.log(`[deepseek-worker] sourceFile: ${sourceFile || 'null'}`)
    console.log(`[deepseek-worker] pageUrl: ${request.element.pageUrl || 'null'}`)
    console.log(`[deepseek-worker] projectPath: ${request.element.projectPath || 'null'}`)
    console.log(`[deepseek-worker] model: ${request.element.model || 'null'}`)

    // 如果 React Fiber 没有提供源文件，尝试根据 URL 查找
    if (!sourceFile && request.element.pageUrl) {
      console.log(`[deepseek-worker] React Fiber 未提供源文件，根据 URL 查找: ${request.element.pageUrl}`)
      const foundFile = await findSourceFile(request.element.pageUrl, request.element.projectPath)
      console.log(`[deepseek-worker] 查找结果: ${foundFile || '未找到'}`)
      if (foundFile) {
        sourceFile = foundFile
      }
    }

    if (sourceFile) {
      const fileInfo = await readSourceFile(sourceFile)
      if (fileInfo) {
        fileContent = fileInfo.content
        language = fileInfo.language
        await reportProgress(request.id, `已读取文件: ${sourceFile.split('/').pop()}`)
      }
    }

    // 调用 DeepSeek（使用用户选择的模型）
    await reportProgress(request.id, '正在调用 DeepSeek API 生成修改方案...')
    const result = await callDeepSeek(request, fileContent, language, request.element.model)

    // 如果有文件修改，验证并写入文件
    if (result.modifiedFile && sourceFile) {
      // 验证修改是否正确
      if (fileContent) {
        await reportProgress(request.id, '正在验证修改是否正确...')
        const validation = await validateModification(
          fileContent,
          result.modifiedFile,
          request.userMessage,
          request.element.model
        )

        if (!validation.valid) {
          console.log(`[deepseek-worker] 修改验证失败: ${validation.reason}`)
          await completeRequest(request.id, {
            status: 'failed',
            error: `修改验证失败: ${validation.reason}`,
          })
          return
        }
      }

      await reportProgress(request.id, '正在写入文件...')
      const writeSuccess = await writeSourceFile(sourceFile, result.modifiedFile)

      if (writeSuccess) {
        await completeRequest(request.id, {
          status: 'completed',
          content: result.content,
          summary: `已修改文件: ${sourceFile.split('/').pop()}`,
          changedFiles: [sourceFile],
        })
      } else {
        await completeRequest(request.id, {
          status: 'failed',
          error: `文件写入失败: ${sourceFile}`,
        })
      }
    } else {
      // 只返回建议文本
      await completeRequest(request.id, {
        status: 'completed',
        content: result.content,
        summary: 'DeepSeek 处理完成',
      })
    }

    console.log(`[deepseek-worker] 请求完成: ${request.id}`)
  } catch (error) {
    console.error(`[deepseek-worker] 处理失败: ${request.id}`, error)

    await completeRequest(request.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 报告进度
 */
async function reportProgress(id: string, message: string): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/api/progress/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch {
    // 忽略进度报告错误
  }
}

/**
 * 完成请求
 */
async function completeRequest(id: string, payload: {
  status: 'completed' | 'failed'
  content?: string
  summary?: string
  changedFiles?: string[]
  error?: string
}): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/api/complete/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error(`[deepseek-worker] 完成请求失败: ${id}`, error)
  }
}

/**
 * 轮询队列领取请求
 */
async function pollForRequests(): Promise<void> {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/next?timeout=${POLL_INTERVAL_MS}&workerId=${encodeURIComponent(WORKER_ID)}`
    )

    if (!response.ok) {
      return
    }

    const data = await response.json() as { ok: boolean; request: DesignRequest | null }

    if (data.request) {
      // 有请求，处理它
      await processRequest(data.request)
    }
  } catch {
    // 服务器未运行时静默忽略
  }
}

/**
 * 主循环
 */
async function mainLoop(): Promise<void> {
  // 在运行时读取环境变量（确保 dotenv 已加载）
  DEEPSEEK_API_KEY = process.env['DEEPSEEK_API_KEY'] || ''
  DEEPSEEK_MODEL = process.env['DEEPSEEK_MODEL'] || 'deepseek-chat'
  DEEPSEEK_BASE_URL = process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com'

  console.log(`[deepseek-worker] 启动 DeepSeek 后台工作服务`)
  console.log(`[deepseek-worker] 模型: ${DEEPSEEK_MODEL}`)
  console.log(`[deepseek-worker] 轮询间隔: ${POLL_INTERVAL_MS}ms`)
  console.log(`[deepseek-worker] 并行处理: 最多 3 个请求同时处理`)

  if (!DEEPSEEK_API_KEY) {
    console.error('[deepseek-worker] 错误: 未设置 DEEPSEEK_API_KEY 环境变量')
    console.error('[deepseek-worker] 请在 .env 文件中设置: DEEPSEEK_API_KEY=你的密钥')
    return
  }

  // 并行处理：最多 3 个请求同时处理
  const MAX_CONCURRENT = 3
  const activeTasks = new Set<Promise<void>>()

  // 持续轮询
  while (true) {
    // 如果活跃任务数量小于最大并发数，尝试获取新请求
    if (activeTasks.size < MAX_CONCURRENT) {
      try {
        const response = await fetch(
          `${SERVER_URL}/api/next?timeout=${POLL_INTERVAL_MS}&workerId=${encodeURIComponent(WORKER_ID)}`
        )

        if (response.ok) {
          const data = await response.json() as { ok: boolean; request: DesignRequest | null }

          if (data.request) {
            // 有请求，创建任务处理它
            const task = processRequest(data.request).then(() => {
              activeTasks.delete(task)
            })
            activeTasks.add(task)
            console.log(`[deepseek-worker] 当前活跃任务: ${activeTasks.size}/${MAX_CONCURRENT}`)
          }
        }
      } catch {
        // 服务器未运行时静默忽略
      }
    }

    // 等待一下再轮询
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

/**
 * 启动 DeepSeek 后台工作服务
 */
export function startDeepSeekWorker(): void {
  // 在后台启动，不阻塞主进程
  mainLoop().catch(console.error)
}
