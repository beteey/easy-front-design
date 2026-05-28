/**
 * Content script entry — initializes inspect mode and WebSocket connection.
 */

import { InspectMode } from './inspect'
import { wsClient } from './ws'

// Connect WebSocket
wsClient.connect()

// Create inspect mode controller
const inspectMode = new InspectMode()

// Listen for messages from background/popup to toggle inspect mode
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'toggle-inspect') {
    if (inspectMode.isActive()) {
      inspectMode.disable()
    } else {
      inspectMode.enable()
    }
  }
})

// Also support keyboard shortcut (Ctrl+Shift+D / Cmd+Shift+D)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
    e.preventDefault()
    if (inspectMode.isActive()) {
      inspectMode.disable()
    } else {
      inspectMode.enable()
    }
  }
})

console.log('[easy-design] content script loaded')
