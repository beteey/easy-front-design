# easy-front-design

网页端设计辅助 Chrome 插件 — 在浏览器上选择元素，通过对话或可视化编辑器修改样式，Claude Code 直接帮你改源码。

## 使用流程

```
1. 打开任意网页
2. 点击插件图标 → 开启选择模式
3. 鼠标悬停元素 → 高亮显示
4. 点击元素 → 右侧弹出操作面板
5. 选择操作模式：
   - 💬 对话模式：输入自然语言需求，Claude Code 修改源码
   - 🎨 编辑模式：可视化调节字号、颜色、间距等，实时预览效果
6. 刷新页面查看源码修改效果
7. 选择模式自动恢复，继续编辑下一个元素
```

## 功能

- **元素选择** — 鼠标悬停高亮，点击选中网页元素
- **双模式面板** — 对话模式（自然语言）+ 编辑模式（可视化样式调节）
- **Claude Code 集成** — 通过 MCP 协议连接 Claude Code，直接修改源码
- **实时预览** — 编辑模式下修改样式即时生效
- **状态持久化** — 选择模式在页面刷新后自动恢复
- **快捷键** — `Cmd+Shift+D`（Mac）/ `Ctrl+Shift+D`（Windows）切换选择模式

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 AI

复制 `.env.example` 为 `.env` 并填入 API Key：

```bash
cp .env.example .env
# 编辑 .env，填入你的 Anthropic API Key
```

### 3. 构建并启动

```bash
# 构建全部（服务器 + 扩展）
npm run build

# 启动服务器
npm start
```

服务器运行在 `http://127.0.0.1:3771`。

### 4. 安装 Chrome 扩展

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist` 目录

### 5. 启动 Claude Code

在项目目录下启动 Claude Code，它会自动连接 MCP 服务器并开始监听设计请求。

```bash
claude
```

## 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     HTTP      ┌──────────────┐
│  Chrome 扩展     │ ←───────────────→  │   Server        │ ←───────────→ │  Claude Code │
│  (content script)│                    │   (Express + WS)│    MCP       │  (处理请求)   │
│                 │                    │                 │              │              │
│  ┌───────────┐  │                    │  ┌───────────┐  │              │  读写源文件   │
│  │ Inspect   │  │                    │  │  Queue    │  │              │              │
│  │ Panel     │  │                    │  │  (请求队列)│  │              └──────────────┘
│  │ 对话/编辑  │  │                    │  └───────────┘  │
│  └───────────┘  │                    └─────────────────┘
└─────────────────┘
```

### 工作原理

1. **Chrome 扩展**：注入 content script 到页面，提供元素选择和操作面板
2. **Server**：Express + WebSocket 服务器，管理设计请求队列
3. **MCP 桥接**：通过 Model Context Protocol 连接 Claude Code
4. **Claude Code**：监听队列，读取源文件，根据需求修改代码

## 项目结构

```
easy-front-design/
├── extension/                 # Chrome 扩展
│   ├── manifest.json          # 扩展配置
│   └── src/
│       ├── content/
│       │   ├── index.ts       # Content script 入口
│       │   ├── inspect.ts     # 元素选择 + 操作面板（Shadow DOM）
│       │   ├── fiber.ts       # React Fiber 信息提取
│       │   └── ws.ts          # WebSocket 客户端
│       ├── popup/             # 扩展弹窗（状态显示 + 开关）
│       └── background/
│           └── index.ts       # 后台脚本（健康检查、状态存储）
├── server/                    # Express + WebSocket 后端
│   └── src/
│       ├── index.ts           # 服务器入口
│       ├── app.ts             # Express + WebSocket 服务 + API
│       ├── mcp.ts             # MCP 协议桥接 Claude Code
│       ├── queue.ts           # 设计请求队列
│       ├── ai.ts              # Anthropic API 流式调用
│       ├── openai.ts          # OpenAI API 流式调用
│       ├── config.ts          # 配置管理
│       ├── vscode.ts          # VS Code 集成
│       └── fileReader.ts      # 源文件读取
├── test/                      # 测试页面
│   └── index.html             # 测试页面（多种 UI 元素）
├── scripts/
│   └── agent.mjs              # 独立 agent（无需 Claude Code）
└── .claude/
    └── settings.json          # MCP 服务器配置
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/` | 测试页面 |
| GET | `/api/pending` | 查询待处理请求数量 |
| GET | `/api/next?timeout=&workerId=` | 长轮询获取下一个请求（Claude Code 用） |
| POST | `/api/complete/:id` | 提交处理结果 |
| POST | `/api/progress/:id` | 报告处理进度 |
| POST | `/api/heartbeat/:id` | 保持请求存活 |
| GET | `/api/requests/:id` | 查询请求状态 |

## MCP 工具

Claude Code 通过以下 MCP 工具与服务器交互：

| 工具 | 说明 |
|------|------|
| `watch_design_requests` | 监听并获取设计请求 |
| `complete_design_request` | 提交处理结果 |
| `report_design_progress` | 报告处理进度 |
| `heartbeat_design_request` | 保持请求存活 |

## 开发

```bash
# 开发模式
npm run dev

# 仅服务器
npm run dev:server

# 仅扩展
npm run dev:extension

# 构建
npm run build

# 测试
npm test
```

## 技术栈

- **扩展**: TypeScript, Preact, Shadow DOM, WebSocket
- **后端**: Node.js, Express, WebSocket Server
- **协议**: MCP (Model Context Protocol)
- **构建**: Vite, @crxjs/vite-plugin
- **测试**: Vitest

## 相关资源

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [MCP 协议](https://modelcontextprotocol.io/)
- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
