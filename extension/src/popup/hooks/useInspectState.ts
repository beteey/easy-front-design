import { useState, useEffect, useCallback } from 'preact/hooks'

export function useInspectState() {
  const [active, setActive] = useState(false)
  const [tabId, setTabId] = useState<number | null>(null)

  // 获取当前 tab id 并查询 inspect 状态（带重试，等待 content script 就绪）
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id) return
      setTabId(tab.id)

      // content script 可能还没注册消息监听器，重试几次
      let retries = 0
      const maxRetries = 5
      const tryQuery = () => {
        chrome.tabs.sendMessage(tab.id!, { type: 'get-inspect-status' }, (response) => {
          if (chrome.runtime.lastError) {
            if (retries < maxRetries) {
              retries++
              setTimeout(tryQuery, 200)
            }
            return
          }
          if (response?.active !== undefined) {
            setActive(response.active)
          }
        })
      }
      tryQuery()
    })
  }, [])

  // Listen for status changes from content script
  useEffect(() => {
    const listener = (msg: { type: string; active?: boolean }) => {
      if (msg.type === 'inspect-status' && msg.active !== undefined) {
        setActive(msg.active)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const toggle = useCallback(() => {
    if (!tabId) return
    chrome.tabs.sendMessage(tabId, { type: 'toggle-inspect' }, (response) => {
      if (chrome.runtime.lastError) return
      if (response?.active !== undefined) {
        setActive(response.active)
      }
    })
  }, [tabId])

  return { active, toggle }
}
