/**
 * Background script — server health monitoring, status storage, message relay.
 */

const SERVER_HEALTH_URL = 'http://127.0.0.1:3771/health'
const HEALTH_CHECK_INTERVAL = 10_000 // 10 seconds

let lastOnline: boolean | null = null

// ─── Health Check ──────────────────────────────────────────────────────────────

async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(SERVER_HEALTH_URL, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

function updateBadge(online: boolean): void {
  if (online) {
    chrome.action.setBadgeText({ text: '' })
  } else {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#E53E3E' })
  }
}

async function notifyAllTabs(online: boolean): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'server-status', online })
        } catch {
          // content script not injected on this tab
        }
      }
    }
  } catch {
    // ignore query errors
  }
}

async function pollHealth(): Promise<void> {
  const online = await checkServerHealth()

  if (online !== lastOnline) {
    lastOnline = online
    updateBadge(online)
    notifyAllTabs(online)
    chrome.storage.local.set({ serverOnline: online })
  }

  // 检查 MCP 连接状态：服务器在线时查询活跃 worker 数量
  if (online) {
    try {
      const res = await fetch('http://127.0.0.1:3771/api/workers', { signal: AbortSignal.timeout(3000) })
      const data = await res.json() as { ok: boolean; count: number }
      chrome.storage.local.set({ mcpConnected: data.ok && data.count > 0 })
    } catch {
      chrome.storage.local.set({ mcpConnected: false })
    }
  } else {
    chrome.storage.local.set({ mcpConnected: false })
  }
}

// Initial check + periodic polling
pollHealth()
setInterval(pollHealth, HEALTH_CHECK_INTERVAL)

// ─── Message Handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ws-status') {
    chrome.storage.local.set({ wsConnected: msg.connected })
  }
  if (msg.type === 'inspect-status') {
    chrome.storage.local.set({ inspectDisabled: !msg.active })
  }
})
