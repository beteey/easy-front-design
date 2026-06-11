import { useRef, useEffect } from 'preact/hooks'
import { useChat } from '../hooks/useChat'
import { useInspectState } from '../hooks/useInspectState'

export function Chat() {
  const { messages, send, pending } = useChat()
  const { active } = useInspectState()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = inputRef.current?.value.trim()
    if (!text) return
    send(text, 'develop')
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`
    }
  }

  return (
    <div class="chat-area">
      <div class="chat-messages">
        {messages.length === 0 && (
          <div class="chat-empty">
            {active
              ? '在页面上选择元素，输入修改意见'
              : '请先开启选择模式'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} class={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div class="chat-input-row">
        <textarea
          ref={inputRef}
          class="chat-input"
          placeholder={active ? '描述你想改什么...' : '请先开启选择模式'}
          rows={1}
          disabled={!active || pending}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
        />
        <button
          class="send-btn"
          disabled={!active || pending}
          onClick={handleSend}
        >
          发送
        </button>
      </div>
    </div>
  )
}
