import { useState, useEffect, useCallback } from 'preact/hooks'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const [tabId, setTabId] = useState<number | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.id) setTabId(tab.id)
    })
  }, [])

  // Listen for WebSocket messages forwarded by content script
  useEffect(() => {
    const listener = (msg: { type: string; data?: any }) => {
      if (msg.type !== 'ws-message' || !msg.data) return
      const data = msg.data

      if (data.type === 'design:queued') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = '⏳ 已发送，等待 Claude Code...'
          }
          return updated
        })
      }

      if (data.type === 'design:processing') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = '⚙️ Claude Code 处理中...'
          }
          return [...updated]
        })
      }

      if (data.type === 'design:progress') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = `⚙️ ${data.message}`
          }
          return [...updated]
        })
      }

      if (data.type === 'design:retry') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = `🔄 ${data.message}`
          }
          return [...updated]
        })
      }

      if (data.type === 'design:done') {
        const text = data.action === 'suggest'
          ? (data.content ?? '(未返回内容)')
          : `✅ 已修改：${(data.changedFiles ?? []).join(', ') || (data.summary ?? '完成')}`
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = text
          }
          return [...updated]
        })
        setPending(false)
      }

      if (data.type === 'design:failed') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = `❌ 失败：${data.error}`
          }
          return [...updated]
        })
        setPending(false)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const send = useCallback((text: string, action: 'suggest' | 'develop' = 'develop') => {
    if (!text.trim() || pending || !tabId) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '⏳ 已发送，等待 Claude Code...' },
    ])
    setPending(true)

    chrome.tabs.sendMessage(tabId, {
      type: 'popup-chat-send',
      text,
      action,
    }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            last.content = `❌ ${response?.error ?? '发送失败，请先在页面上选择一个元素'}`
          }
          return [...updated]
        })
        setPending(false)
      }
    })
  }, [tabId, pending])

  return { messages, send, pending }
}
