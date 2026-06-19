/**
 * Entry point — starts the HTTP + WebSocket server.
 */

import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// 从项目根目录加载 .env 文件
const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../.env') })

import createApp from './app.js'
import { config } from './config.js'
import { startDeepSeekWorker } from './deepseek-worker.js'

const { httpServer } = createApp()

httpServer.listen(config.port, () => {
  console.log(`[design-easily] server running on http://127.0.0.1:${config.port}`)
  console.log(`[design-easily] AI provider: ${config.aiProvider}`)

  // 启动 DeepSeek 后台工作服务（如果配置了）
  if (process.env['DEEPSEEK_API_KEY']) {
    startDeepSeekWorker()
  }
})
