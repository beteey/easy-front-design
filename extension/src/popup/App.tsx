import { useState } from 'preact/hooks'
import { Statusbar } from './components/Statusbar'
import { InspectToggle } from './components/InspectToggle'
import { Settings } from './components/Settings'

export function App() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <Statusbar />
      <InspectToggle />

      {/* 设置按钮 */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #e5e7eb',
      }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            width: '100%',
            padding: '8px',
            background: showSettings ? '#f3f4f6' : 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          {showSettings ? '收起设置' : '⚙️ DeepSeek 设置'}
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && <Settings />}
    </>
  )
}
