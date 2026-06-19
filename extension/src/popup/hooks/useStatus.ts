import { useState, useEffect } from 'preact/hooks'

interface Status {
  serverOnline: boolean
  wsConnected: boolean
  mcpConnected: boolean
}

export function useStatus(): Status {
  const [status, setStatus] = useState<Status>({
    serverOnline: false,
    wsConnected: false,
    mcpConnected: false,
  })

  useEffect(() => {
    // Read initial values
    chrome.storage.local.get(['serverOnline', 'wsConnected', 'mcpConnected'], (data) => {
      setStatus({
        serverOnline: data.serverOnline ?? false,
        wsConnected: data.wsConnected ?? false,
        mcpConnected: data.mcpConnected ?? false,
      })
    })

    // Listen for changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      setStatus((prev) => ({
        serverOnline: changes.serverOnline?.newValue ?? prev.serverOnline,
        wsConnected: changes.wsConnected?.newValue ?? prev.wsConnected,
        mcpConnected: changes.mcpConnected?.newValue ?? prev.mcpConnected,
      }))
    }
    chrome.storage.onChanged.addListener(listener)

    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return status
}
