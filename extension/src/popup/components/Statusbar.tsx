import { useStatus } from '../hooks/useStatus'

function StatusIcon({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <svg class="status-icon status-icon--on" viewBox="0 0 16 16" width="14" height="14">
        <circle cx="8" cy="8" r="7" fill="#34C759" />
        <path d="M4.5 8.5 L7 11 L11.5 5.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    )
  }
  return <span class="status-icon status-icon--off" />
}

export function Statusbar() {
  const { serverOnline, wsConnected } = useStatus()

  return (
    <div class="statusbar">
      <div class="status-item">
        <StatusIcon connected={serverOnline} />
        服务器
      </div>
      <div class="status-item">
        <StatusIcon connected={wsConnected} />
        WebSocket
      </div>
      <div class="status-item">
        <StatusIcon connected={serverOnline} />
        MCP
      </div>
    </div>
  )
}
