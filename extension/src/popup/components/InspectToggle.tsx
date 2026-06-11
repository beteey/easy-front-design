import { useInspectState } from '../hooks/useInspectState'

export function InspectToggle() {
  const { active, toggle } = useInspectState()

  return (
    <div class="inspect-toggle">
      <span class="inspect-label">
        {active ? '🎯 选择模式已激活' : '🎯 选择模式'}
      </span>
      <button
        class={`toggle-btn ${active ? 'active' : ''}`}
        onClick={toggle}
        title={active ? '关闭选择模式' : '开启选择模式'}
      />
    </div>
  )
}
