import { useState, useEffect } from 'preact/hooks'

interface Settings {
  projectPath: string
  model: string
}

const DEFAULT_SETTINGS: Settings = {
  projectPath: '',
  model: 'deepseek-chat',
}

const MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat (快速)' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 PRO (强大)' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (平衡)' },
]

export function Settings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // 从 storage 加载设置
    chrome.storage.local.get('deepseekSettings', (result) => {
      if (result.deepseekSettings) {
        setSettings(result.deepseekSettings)
      }
    })
  }, [])

  const handleSave = () => {
    chrome.storage.local.set({ deepseekSettings: settings }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div style={{
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
        ⚙️ DeepSeek 设置
      </h3>

      {/* 项目路径 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 500,
          marginBottom: '6px',
          color: '#374151',
        }}>
          项目根目录路径
        </label>
        <input
          type="text"
          value={settings.projectPath}
          onChange={(e) => setSettings({ ...settings, projectPath: (e.target as HTMLInputElement).value })}
          placeholder="/Users/xxx/my-project"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{
          margin: '4px 0 0 0',
          fontSize: '11px',
          color: '#6b7280',
        }}>
          留空则自动查找 easy-front-design 项目
        </p>
      </div>

      {/* 模型选择 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 500,
          marginBottom: '6px',
          color: '#374151',
        }}>
          AI 模型
        </label>
        <select
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: (e.target as HTMLSelectElement).value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '12px',
            outline: 'none',
            background: 'white',
          }}
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '10px',
          background: saved ? '#10b981' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {saved ? '✓ 已保存' : '保存设置'}
      </button>
    </div>
  )
}
