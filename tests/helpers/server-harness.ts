/**
 * Test server harness — starts a test instance of the design-easily server
 * and provides WebSocket connection helpers.
 */

import { type AddressInfo } from 'node:net'
import WebSocket from 'ws'
import createApp from '../../server/src/app.js'

export interface TestServer {
  baseUrl: string
  wsUrl: string
  close: () => Promise<void>
}

export async function startTestServer(): Promise<TestServer> {
  const { httpServer } = createApp()

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))

  const addr = httpServer.address() as AddressInfo
  const port = addr.port
  const baseUrl = `http://127.0.0.1:${port}`
  const wsUrl = `ws://127.0.0.1:${port}`

  return {
    baseUrl,
    wsUrl,
    close: () =>
      new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}

export function teardownTestServer(): void {
  // Cleanup is handled by close()
}

export async function wsConnect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

export function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = (data: WebSocket.RawData) => {
      ws.off('message', handler)
      resolve(JSON.parse(data.toString()))
    }
    ws.on('message', handler)
  })
}

export function wsSend(ws: WebSocket, msg: unknown): void {
  ws.send(JSON.stringify(msg))
}
