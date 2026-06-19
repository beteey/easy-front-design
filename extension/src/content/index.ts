/**
 * Content script entry — initializes selection mode, WebSocket connection,
 * and handles communication with the popup.
 */

import { InspectMode, getCurrentElementContext } from './inspect'
import { wsClient } from './ws'

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** 安全发送消息，防止扩展上下文失效时崩溃 */
function safeSendMessage(message: Record<string, unknown>): void {
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError // 消除 "Receiving end does not exist" 警告
    })
  } catch {
    // 扩展上下文已失效，忽略
  }
}

// ─── 初始化 ────────────────────────────────────────────────────────────────────

// Connect WebSocket
wsClient.connect()

// Report WebSocket status to background for popup display
wsClient.onStatusChange((online) => {
  safeSendMessage({ type: 'ws-status', connected: online })
})

// Listen for server status from background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'server-status') {
    // Server status received — no toast needed
  }
})

// Create selection mode controller
const inspectMode = new InspectMode()

function toggleInspect(): void {
  if (inspectMode.isActive()) {
    inspectMode.disable()
    chrome.storage.local.set({ inspectDisabled: true })
  } else {
    inspectMode.enable()
    chrome.storage.local.set({ inspectDisabled: false })
  }
  safeSendMessage({ type: 'inspect-status', active: inspectMode.isActive() })
}

// 页面加载后不自动开启选择模式，需要用户手动点击插件开启

// ─── Message handling for popup ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Popup queries selection mode state
  if (msg.type === 'get-inspect-status') {
    sendResponse({ active: inspectMode.isActive() })
    return true
  }

  // Popup sends a chat/design request
  if (msg.type === 'popup-chat-send') {
    const ctx = getCurrentElementContext()
    if (!ctx) {
      sendResponse({ error: '请先在页面上选择一个元素' })
      return true
    }
    const { text, action } = msg as { text: string; action: 'suggest' | 'develop' }
    wsClient.send({
      type: 'design:request',
      action: action ?? 'develop',
      userMessage: text,
      element: {
        tag: ctx.tag,
        id: ctx.id,
        classList: ctx.classList,
        textContent: ctx.textContent,
        computedStyles: ctx.computedStyles,
        sourceFile: ctx.fiber.sourceFile,
        sourceLine: ctx.fiber.sourceLine,
      },
    })
    sendResponse({ ok: true })
    return true
  }

  // Toggle selection mode from popup
  if (msg.type === 'toggle-inspect') {
    toggleInspect()
    sendResponse({ active: inspectMode.isActive() })
    return true
  }
})

// Forward WebSocket responses to popup
wsClient.onMessage((msg) => {
  if (['ai:chunk', 'ai:done', 'ai:error', 'design:queued', 'design:processing', 'design:progress', 'design:retry', 'design:done', 'design:failed'].includes(msg.type)) {
    safeSendMessage({ type: 'ws-message', data: msg })
  }
})

// Keyboard shortcut (Ctrl+Shift+D / Cmd+Shift+D)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
    e.preventDefault()
    toggleInspect()
  }
})

console.log('[easy-design] content script loaded')
