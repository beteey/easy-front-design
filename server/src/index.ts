/**
 * Entry point — starts the HTTP + WebSocket server.
 */

import createApp from './app.js'
import { config } from './config.js'

const { httpServer } = createApp()

httpServer.listen(config.port, () => {
  console.log(`[design-easily] server running on http://127.0.0.1:${config.port}`)
  console.log(`[design-easily] AI provider: ${config.aiProvider}`)
})
