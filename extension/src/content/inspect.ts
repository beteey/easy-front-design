/**
 * Inspect mode — hover highlight + click to select + right-side info panel.
 * Frosted glass Apple-style UI.
 */

import { extractFiberInfo, getComponentBreadcrumb, type FiberInfo } from './fiber'
import { wsClient } from './ws'

// ─── Highlight overlay ────────────────────────────────────────────────────────

const HIGHLIGHT_ID = 'de-highlight-overlay'

function getOrCreateHighlight(): HTMLElement {
  let el = document.getElementById(HIGHLIGHT_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = HIGHLIGHT_ID
    Object.assign(el.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '2147483640',
      border: '2px solid #007AFF',
      borderRadius: '4px',
      background: 'rgba(0, 122, 255, 0.06)',
      transition: 'top 0.08s ease, left 0.08s ease, width 0.08s ease, height 0.08s ease',
      display: 'none',
      boxSizing: 'border-box',
    })
    document.body.appendChild(el)
  }
  return el
}

function positionHighlight(el: HTMLElement, target: Element): void {
  const rect = target.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  Object.assign(el.style, {
    display: 'block',
    top: `${rect.top + scrollY}px`,
    left: `${rect.left + scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  })
}

function hideHighlight(): void {
  const el = document.getElementById(HIGHLIGHT_ID)
  if (el) el.style.display = 'none'
}

// ─── Element context ──────────────────────────────────────────────────────────

export interface ElementContext {
  tag: string
  id: string
  classList: string[]
  textContent: string
  fiber: FiberInfo
  breadcrumb: string[]
  computedStyles: Record<string, string>
  rect: DOMRect
}

const RELEVANT_STYLES = [
  'display', 'flexDirection', 'alignItems', 'justifyContent',
  'padding', 'margin',
  'width', 'height',
  'fontSize', 'fontWeight', 'lineHeight', 'color',
  'backgroundColor', 'borderRadius', 'border',
  'position', 'opacity', 'boxShadow',
]

function buildContext(target: Element): ElementContext {
  const computed = window.getComputedStyle(target)
  const styles: Record<string, string> = {}
  for (const key of RELEVANT_STYLES) {
    const val = computed.getPropertyValue(key.replace(/([A-Z])/g, '-$1').toLowerCase())
    if (val && val !== 'initial' && val !== 'normal' && (val !== 'auto' || key.startsWith('margin'))) {
      styles[key] = val
    }
  }

  return {
    tag: target.tagName.toLowerCase(),
    id: target.id,
    classList: Array.from(target.classList),
    textContent: target.textContent?.trim().slice(0, 200) ?? '',
    fiber: extractFiberInfo(target),
    breadcrumb: getComponentBreadcrumb(target),
    computedStyles: styles,
    rect: target.getBoundingClientRect(),
  }
}

// ─── Info panel ───────────────────────────────────────────────────────────────

const PANEL_STYLES = `
  :host {
    all: initial;
    position: fixed;
    top: 64px;
    right: 16px;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
    width: 320px;
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
  }
  .panel {
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.16), 0 1px 0 rgba(255,255,255,0.8) inset;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 80px);
  }
  .panel-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(0,0,0,0.07);
    flex-shrink: 0;
  }
  .component-name {
    font-size: 15px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0 0 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .component-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(0,122,255,0.1);
    color: #007AFF;
    letter-spacing: 0.2px;
  }
  .breadcrumb {
    font-size: 11px;
    color: rgba(0,0,0,0.4);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .panel-body {
    overflow-y: auto;
    flex: 1;
    padding: 0 0 8px;
  }
  .section {
    padding: 10px 16px 4px;
  }
  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: rgba(0,0,0,0.35);
    margin: 0 0 6px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    font-size: 12px;
  }
  .row-key {
    color: rgba(0,0,0,0.45);
    flex-shrink: 0;
    width: 110px;
  }
  .row-val {
    color: #1c1c1e;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
    font-family: "SF Mono", "Menlo", monospace;
    font-size: 11px;
  }
  .source-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    cursor: pointer;
    border-top: 1px solid rgba(0,0,0,0.06);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .source-row:hover {
    background: rgba(0,122,255,0.05);
  }
  .source-icon {
    font-size: 13px;
  }
  .source-info {
    flex: 1;
    overflow: hidden;
  }
  .source-file {
    font-size: 11px;
    font-family: "SF Mono", "Menlo", monospace;
    color: #007AFF;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .source-line {
    font-size: 10px;
    color: rgba(0,0,0,0.4);
  }
  .source-no-info {
    font-size: 11px;
    color: rgba(0,0,0,0.3);
    padding: 8px 16px;
  }
  .chat-area {
    border-top: 1px solid rgba(0,0,0,0.07);
    padding: 10px 12px;
    flex: 1;
    min-height: 180px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 80px;
  }
  .msg {
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.4;
    max-width: 90%;
  }
  .msg.user {
    background: #007AFF;
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .msg.assistant {
    background: rgba(0,0,0,0.06);
    color: #1c1c1e;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
    font-family: "SF Mono", "Menlo", monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.loading {
    background: rgba(0,0,0,0.04);
    color: rgba(0,0,0,0.35);
    align-self: flex-start;
    font-size: 11px;
    font-style: italic;
  }
  .chat-input-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  .chat-input {
    flex: 1;
    min-width: 0;
    height: 48px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 12px;
    padding: 0 14px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    background: rgba(255,255,255,0.7);
    color: #1c1c1e;
    transition: border-color 0.15s;
  }
  .chat-input:focus {
    border-color: #007AFF;
  }
  .chat-buttons {
    flex-shrink: 0;
  }
  .btn-develop {
    flex-shrink: 0;
    height: 48px;
    padding: 0 18px;
    border-radius: 12px;
    background: #007AFF;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  .btn-develop:hover { opacity: 0.8; }
  .btn-develop:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ── Mode Tabs ── */
  .mode-tabs {
    display: flex;
    border-bottom: 1px solid rgba(0,0,0,0.07);
    flex-shrink: 0;
  }
  .mode-tab {
    flex: 1;
    padding: 8px 0;
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: rgba(0,0,0,0.35);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
  }
  .mode-tab.active {
    color: #007AFF;
    border-bottom-color: #007AFF;
  }

  /* ── Style Editor ── */
  .editor-body {
    overflow-y: auto;
    flex: 1;
    padding: 12px 14px;
  }
  .editor-section {
    margin-bottom: 12px;
  }
  .editor-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: rgba(0,0,0,0.35);
    margin: 0 0 8px;
  }
  .editor-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .editor-label {
    font-size: 12px;
    color: rgba(0,0,0,0.55);
    flex-shrink: 0;
    width: 70px;
  }
  .editor-control {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .editor-input {
    width: 64px;
    padding: 4px 6px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 6px;
    font-size: 11px;
    font-family: "SF Mono", "Menlo", monospace;
    text-align: right;
    outline: none;
    color: #1c1c1e;
    background: rgba(255,255,255,0.7);
  }
  .editor-input:focus {
    border-color: #007AFF;
  }
  .editor-color {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 6px;
    padding: 2px;
    cursor: pointer;
    background: none;
  }
  .editor-unit {
    font-size: 10px;
    color: rgba(0,0,0,0.3);
    width: 16px;
  }
  .editor-select {
    padding: 4px 6px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 6px;
    font-size: 11px;
    outline: none;
    color: #1c1c1e;
    background: rgba(255,255,255,0.7);
  }
  .btn-apply {
    width: 100%;
    padding: 10px;
    margin-top: 16px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-apply:hover {
    opacity: 0.9;
  }
  .btn-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

/**
 * 元素检查面板 —— 注入页面的 Shadow DOM 浮层
 * 功能：显示选中元素的信息、与 AI 对话、发送设计修改请求
 */
export class InspectPanel {
  private host: HTMLElement          // 宿主元素，挂载到 document.body
  private shadow: ShadowRoot         // Shadow DOM 根节点，隔离样式
  private ctx: ElementContext | null = null  // 当前选中的元素上下文
  private selectedEl: Element | null = null  // 真实的 DOM 元素引用
  private messages: Array<{ role: 'user' | 'assistant'; content: string }> = []  // 聊天记录
  private pendingRequestId: string | null = null  // 等待响应的请求 ID
  private pendingMode: 'suggest' | 'develop' | null = null  // 当前请求的模式
  private wsUnsubscribe: (() => void) | null = null  // WebSocket 取消订阅函数
  private aiChatId = 0
  private panelMode: 'chat' | 'editor' = 'chat'  // 面板模式：对话 / 编辑

  constructor() {
    // 创建 Shadow DOM 宿主并挂载到页面
    this.host = document.createElement('div')
    this.host.setAttribute('data-design-easily', 'panel')
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `<style>${PANEL_STYLES}</style>`
    this.host.style.display = 'none'
    document.body.appendChild(this.host)

    // 监听 WebSocket 消息，处理 AI 响应和队列状态更新
    this.wsUnsubscribe = wsClient.onMessage((msg) => {
      // ── AI 直接聊天响应（建议模式）──
      if (msg.type === 'ai:chunk') {
        if (msg.requestId !== this.pendingRequestId) return
        const last = this.messages[this.messages.length - 1]
        if (last && last.role === 'assistant') {
          last.content += msg.text
          this.updateLastAssistantMessage(last.content)
        }
      }
      if (msg.type === 'ai:done') {
        if (msg.requestId !== this.pendingRequestId) return
        this.pendingRequestId = null
        this.pendingMode = null
        this.setButtonsDisabled(false)
      }
      if (msg.type === 'ai:error') {
        if (msg.requestId !== this.pendingRequestId) return
        this.updateLastAssistantMessage(`❌ AI 错误：${msg.error}`)
        this.pendingRequestId = null
        this.pendingMode = null
        this.setButtonsDisabled(false)
      }

      // ── 队列响应（开发模式）──
      if (msg.type === 'design:queued') {
        this.pendingRequestId = msg.id
        this.updateLastAssistantMessage('⏳ 已发送，等待 Claude Code...')
      }
      if (msg.type === 'design:processing') {
        if (msg.id !== this.pendingRequestId) return
        this.updateLastAssistantMessage('⚙️ Claude Code 处理中...')
      }
      if (msg.type === 'design:progress') {
        if (msg.id !== this.pendingRequestId) return
        this.updateLastAssistantMessage(`⚙️ ${msg.message}`)
      }
      if (msg.type === 'design:retry') {
        if (msg.id !== this.pendingRequestId) return
        this.updateLastAssistantMessage(`🔄 ${msg.message}`)
      }
      if (msg.type === 'design:done') {
        if (msg.id !== this.pendingRequestId) return
        const text = msg.action === 'suggest'
          ? (msg.content ?? '(未返回内容)')
          : `✅ 已修改：${(msg.changedFiles ?? []).join(', ') || (msg.summary ?? '完成')}`
        this.updateLastAssistantMessage(text)
        this.pendingRequestId = null
        this.pendingMode = null
        this.setButtonsDisabled(false)
        this.focusInput()
      }
      if (msg.type === 'design:failed') {
        if (msg.id !== this.pendingRequestId) return
        this.updateLastAssistantMessage(`❌ 失败：${msg.error}`)
        this.pendingRequestId = null
        this.pendingMode = null
        this.setButtonsDisabled(false)
        this.focusInput()
      }
    })
  }

  /** 显示面板，传入元素上下文和真实 DOM 元素 */
  show(ctx: ElementContext, el: Element): void {
    this.ctx = ctx
    this.selectedEl = el
    this.host.style.display = ''
    this.renderPanel()
  }

  /** 隐藏面板 */
  hide(): void {
    this.host.style.display = 'none'
    this.ctx = null
  }

  /** 渲染面板内容（对话模式 + 编辑模式） */
  private renderPanel(): void {
    const ctx = this.ctx!
    const { fiber, tag, id, classList } = ctx

    const sourceFile = fiber.sourceFile
    const sourceLine = fiber.sourceLine
    const shortFile = sourceFile ? sourceFile.split('/').slice(-2).join('/') : null

    const sourceSection = shortFile
      ? `<div class="source-row" data-action="open-vscode">
          <span class="source-icon">⌨️</span>
          <div class="source-info">
            <div class="source-file" title="${sourceFile}">${shortFile}</div>
            <div class="source-line">第 ${sourceLine} 行 · 在 VS Code 中打开</div>
          </div>
          <span>›</span>
        </div>`
      : ''

    // ── 对话模式内容 ──
    const messagesHtml = this.messages.map((m) =>
      `<div class="msg ${m.role}">${this.escapeHtml(m.content)}</div>`
    ).join('')

    const chatContent = `
      ${sourceSection}
      <div class="chat-area">
        <div class="chat-messages">${messagesHtml}</div>
        <div class="chat-input-row">
          <input class="chat-input" type="text" placeholder="描述你想改什么...">
          <button class="btn-develop" data-action="develop">⚡ 让 Claude Code 改</button>
        </div>
      </div>
    `

    // ── 编辑模式内容（Figma 风格编辑器）──
    const el = this.getEl()
    const cs = el ? window.getComputedStyle(el) : null
    const editorContent = el && cs ? this.buildEditorHtml(cs) : '<div class="editor-body"><p style="color:rgba(0,0,0,0.3);font-size:12px;text-align:center;padding:24px 0;">无法读取元素样式</p></div>'

    this.shadow.innerHTML = `
      <style>${PANEL_STYLES}</style>
      <div class="panel">
        <div class="mode-tabs">
          <button class="mode-tab ${this.panelMode === 'chat' ? 'active' : ''}" data-mode="chat">💬 对话</button>
          <button class="mode-tab ${this.panelMode === 'editor' ? 'active' : ''}" data-mode="editor">🎨 编辑</button>
        </div>
        ${this.panelMode === 'chat' ? chatContent : editorContent}
      </div>
    `

    this.bindEvents()
    if (this.panelMode === 'chat') this.scrollChatToBottom()
  }

  /** 获取当前选中的 DOM 元素 */
  private getEl(): Element | null {
    return this.selectedEl
  }

  /** 构建编辑器 HTML */
  private buildEditorHtml(cs: CSSStyleDeclaration): string {
    const num = (v: string) => {
      const m = v.match(/([\d.]+)/)
      return m ? m[1] : ''
    }
    const colorToHex = (v: string): string => {
      if (v.startsWith('#')) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v
      const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (!m) return '#000000'
      const r = parseInt(m[1]).toString(16).padStart(2, '0')
      const g = parseInt(m[2]).toString(16).padStart(2, '0')
      const b = parseInt(m[3]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`
    }

    const row = (label: string, input: string) => `
      <div class="editor-row">
        <span class="editor-label">${label}</span>
        <div class="editor-control">${input}</div>
      </div>`

    const numInput = (prop: string, val: string, unit: string = 'px') =>
      `<input class="editor-input" type="number" data-prop="${prop}" value="${num(val)}" min="0" step="1"><span class="editor-unit">${unit}</span>`

    const colorInput = (prop: string, val: string) =>
      `<input class="editor-color" type="color" data-prop="${prop}" value="${colorToHex(val)}">`

    const weightSelect = (val: string) => {
      const weights = ['400', '500', '600', '700']
      const current = num(val) || '400'
      return `<select class="editor-select" data-prop="fontWeight">${weights.map(w => `<option value="${w}" ${w === current ? 'selected' : ''}>${w}</option>`).join('')}</select>`
    }

    return `
      <div class="editor-body">
        <div class="editor-section">
          <p class="editor-section-title">文字</p>
          ${row('字号', numInput('fontSize', cs.fontSize))}
          ${row('字重', weightSelect(cs.fontWeight))}
          ${row('行高', numInput('lineHeight', cs.lineHeight))}
          ${row('颜色', colorInput('color', cs.color))}
        </div>
        <div class="editor-section">
          <p class="editor-section-title">背景</p>
          ${row('背景色', colorInput('backgroundColor', cs.backgroundColor))}
        </div>
        <div class="editor-section">
          <p class="editor-section-title">间距</p>
          ${row('内边距', numInput('padding', cs.padding))}
          ${row('外边距', numInput('margin', cs.margin))}
          ${row('圆角', numInput('borderRadius', cs.borderRadius))}
        </div>
        <div class="editor-section">
          <p class="editor-section-title">尺寸</p>
          ${row('宽度', numInput('width', cs.width))}
          ${row('高度', numInput('height', cs.height))}
        </div>
        <button class="btn-apply" data-action="apply-editor">⚡ 应用到源码</button>
      </div>
    `
  }

  /** 绑定面板内的交互事件（VS Code 跳转、输入框、按钮、模式切换、编辑器） */
  private bindEvents(): void {
    // 模式切换标签
    this.shadow.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.panelMode = (tab as HTMLElement).dataset.mode as 'chat' | 'editor'
        this.renderPanel()
      })
    })

    // 编辑器：实时修改元素样式
    this.shadow.querySelectorAll('.editor-input, .editor-color, .editor-select').forEach((input) => {
      input.addEventListener('input', () => {
        const prop = (input as HTMLElement).dataset.prop
        if (!prop) return
        const el = this.getEl()
        if (!el) {
          console.log(`[编辑器] 错误: selectedEl 是 null`)
          return
        }
        const val = (input as HTMLInputElement | HTMLSelectElement).value
        const unit = prop === 'color' || prop === 'backgroundColor' ? '' : 'px'
        // 把 camelCase 转换成 kebab-case（如 backgroundColor → background-color）
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        console.log(`[编辑器] 修改样式: ${cssProp} = ${val}${unit}, 元素:`, el)

        // 对于 font-size，同时修改所有子元素（因为子元素可能有自己的 font-size）
        if (prop === 'fontSize') {
          const allElements = [el, ...el.querySelectorAll('*')]
          allElements.forEach((element) => {
            ;(element as HTMLElement).style.setProperty(cssProp, val + unit)
          })
        } else {
          ;(el as HTMLElement).style.setProperty(cssProp, val + unit)
        }
      })
    })

    // 编辑器：应用到源码按钮
    const applyBtn = this.shadow.querySelector('[data-action="apply-editor"]')
    applyBtn?.addEventListener('click', () => {
      this.applyEditorChanges()
    })

    // 点击源文件链接 → 在 VS Code 中打开
    const sourceRow = this.shadow.querySelector('[data-action="open-vscode"]')
    if (sourceRow && this.ctx?.fiber.sourceFile) {
      sourceRow.addEventListener('click', () => {
        wsClient.send({
          type: 'vscode:open',
          file: this.ctx!.fiber.sourceFile!,
          line: this.ctx!.fiber.sourceLine ?? 1,
        })
      })
    }

    // 输入框：Enter 发送
    const input = this.shadow.querySelector<HTMLInputElement>('.chat-input')
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.sendDesignRequest('develop')
      }
    })

    // 发送按钮
    this.shadow.querySelector<HTMLButtonElement>('[data-action="develop"]')
      ?.addEventListener('click', () => this.sendDesignRequest('develop'))
  }

  /** 发送设计修改请求到服务器队列 */
  private sendDesignRequest(action: 'suggest' | 'develop'): void {
    const input = this.shadow.querySelector<HTMLInputElement>('.chat-input')
    const text = input?.value.trim()
    if (!text || this.pendingRequestId) return

    // 显示用户消息并清空输入框
    this.addMessage('user', text)
    if (input) input.value = ''
    this.setButtonsDisabled(true)

    // 开发模式：走队列，等 Claude Code 处理
    this.addMessage('assistant', '⏳ 已发送，等待处理...')
    this.pendingMode = 'develop'

    // 从 storage 获取用户配置
    chrome.storage.local.get('deepseekSettings', (result) => {
      const settings = result.deepseekSettings || {}
      const projectPath = settings.projectPath || ''
      const model = settings.model || 'deepseek-chat'

      // 收集元素上下文并发送
      const { tag, id, classList, computedStyles, textContent, fiber } = this.ctx!
      wsClient.send({
        type: 'design:request',
        action: 'develop',
        userMessage: text,
        element: {
          tag,
          id,
          classList,
          textContent,
          computedStyles,
          sourceFile: fiber.sourceFile,
          sourceLine: fiber.sourceLine,
          pageUrl: window.location.href,
          projectPath,
          model,
        },
      })
    })
  }

  /** 应用编辑器中的修改到源码 */
  private applyEditorChanges(): void {
    if (!this.getEl() || this.pendingRequestId) return

    // 收集编辑器中的所有修改
    const changes: string[] = []
    this.shadow.querySelectorAll('.editor-input, .editor-color, .editor-select').forEach((input) => {
      const prop = (input as HTMLElement).dataset.prop
      const val = (input as HTMLInputElement | HTMLSelectElement).value
      if (prop && val) {
        const unit = prop === 'color' || prop === 'backgroundColor' ? '' : 'px'
        changes.push(`${prop}: ${val}${unit}`)
      }
    })

    if (changes.length === 0) {
      this.addMessage('assistant', '⚠️ 没有修改任何样式')
      return
    }

    // 构建用户消息
    const userMessage = `应用以下样式修改：\n${changes.join('\n')}`

    // 切换到对话模式并显示消息
    this.panelMode = 'chat'
    this.addMessage('user', userMessage)
    this.addMessage('assistant', '⏳ 已发送，等待处理...')
    this.pendingMode = 'develop'

    // 从 storage 获取用户配置
    chrome.storage.local.get('deepseekSettings', (result) => {
      const settings = result.deepseekSettings || {}
      const projectPath = settings.projectPath || ''
      const model = settings.model || 'deepseek-chat'

      // 收集元素上下文并发送
      const { tag, id, classList, computedStyles, textContent, fiber } = this.ctx!
      wsClient.send({
        type: 'design:request',
        action: 'develop',
        userMessage,
        element: {
          tag,
          id,
          classList,
          textContent,
          computedStyles,
          sourceFile: fiber.sourceFile,
          sourceLine: fiber.sourceLine,
          pageUrl: window.location.href,
          projectPath,
          model,
        },
      })
    })
  }

  /** 添加聊天消息并重新渲染面板 */
  private addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content })
    this.renderPanel()
  }

  /** 局部更新最后一条助手消息（避免整面板重建） */
  private updateLastAssistantMessage(content: string): void {
    const lastIdx = this.messages.length - 1
    if (lastIdx >= 0 && this.messages[lastIdx].role === 'assistant') {
      this.messages[lastIdx].content = content
      const msgs = this.shadow.querySelectorAll('.msg.assistant')
      const last = msgs[msgs.length - 1]
      if (last) last.textContent = content
      this.scrollChatToBottom()
    }
  }

  /** 滚动聊天区域到底部 */
  private scrollChatToBottom(): void {
    const chatMsgs = this.shadow.querySelector('.chat-messages')
    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight
  }

  /** 批量禁用/启用输入控件（发送期间防止重复提交） */
  private setButtonsDisabled(disabled: boolean): void {
    const develop = this.shadow.querySelector<HTMLButtonElement>('.btn-develop')
    if (develop) develop.disabled = disabled
    const input = this.shadow.querySelector<HTMLInputElement>('.chat-input')
    if (input) input.disabled = disabled
  }

  /** 清空并聚焦输入框，方便用户输入下一条消息 */
  private focusInput(): void {
    const input = this.shadow.querySelector<HTMLInputElement>('.chat-input')
    if (input) {
      input.value = ''
      input.focus()
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }

  destroy(): void {
    this.wsUnsubscribe?.()
    this.host.remove()
  }
}

// ─── 选择模式控制器 ────────────────────────────────────────────────────────────

/** 当前选中元素的上下文（供 content script 读取） */
let currentElementContext: ElementContext | null = null

export function getCurrentElementContext(): ElementContext | null {
  return currentElementContext
}

/**
 * 选择模式控制器
 * 管理元素高亮、点击选择、面板显示/隐藏
 */
export class InspectMode {
  private panel: InspectPanel       // 元素信息面板
  private highlight: HTMLElement    // 悬停高亮覆盖层
  private selectedEl: Element | null = null  // 当前选中的元素
  private active = false            // 选择模式是否激活

  constructor() {
    this.panel = new InspectPanel()
    this.highlight = getOrCreateHighlight()
  }

  /** 开启选择模式：监听鼠标事件，显示十字光标 */
  enable(): void {
    this.active = true
    document.addEventListener('mouseover', this.onHover, true)
    document.addEventListener('click', this.onClick, true)
    window.addEventListener('scroll', this.onScroll, true)
    document.body.style.cursor = 'crosshair'
  }

  /** 关闭选择模式：移除监听，隐藏高亮和面板 */
  disable(): void {
    this.active = false
    document.removeEventListener('mouseover', this.onHover, true)
    document.removeEventListener('click', this.onClick, true)
    window.removeEventListener('scroll', this.onScroll, true)
    document.body.style.cursor = ''
    hideHighlight()
    this.panel.hide()
    this.selectedEl = null
  }

  private isInsidePanel(el: Element | null): boolean {
    if (!el) return false
    // 检查元素是否在面板内（包括 Shadow DOM 内部）
    if (el.closest?.('[data-design-easily]')) return true
    // Shadow DOM 内部事件的 target 是 shadow root，检查 host
    const root = el.getRootNode?.()
    if (root instanceof ShadowRoot) {
      const host = root.host
      if (host?.getAttribute?.('data-design-easily')) return true
    }
    return false
  }

  /** 鼠标悬停时高亮元素（选中元素后停止跟随） */
  private onHover = (e: MouseEvent): void => {
    if (this.selectedEl) return

    const target = e.target as Element
    if (!target || this.isInsidePanel(target)) return

    positionHighlight(this.highlight, target)
  }

  /** 点击元素 → 收集上下文 → 显示面板 */
  private onClick = (e: MouseEvent): void => {
    const target = e.target as Element
    if (!target || this.isInsidePanel(target)) return

    e.preventDefault()
    e.stopPropagation()

    this.selectedEl = target
    const ctx = buildContext(target)
    currentElementContext = ctx
    this.panel.show(ctx, target)

    // 选中后保持高亮
    positionHighlight(this.highlight, target)
  }

  private onScroll = (): void => {
    // 滚动时更新高亮位置
    if (this.selectedEl) {
      positionHighlight(this.highlight, this.selectedEl)
    }
  }

  isActive(): boolean {
    return this.active
  }

  destroy(): void {
    this.disable()
    this.panel.destroy()
    this.highlight.remove()
  }
}
