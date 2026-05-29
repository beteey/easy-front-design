# easy-front-design

网页端设计辅助插件 — 在浏览器上选择元素，输入修改意见，AI 直接帮你改代码。

## 功能

- **元素选择** — 鼠标悬停高亮，点击选中网页元素
- **侧边信息面板** — 显示选中元素的组件层级、属性、样式、React Fiber 信息
- **AI 辅助修改** — 输入修改意见，自动生成代码改动（支持 Claude 和 OpenAI）
- **一键打开 VS Code** — 跳转到对应源码位置
- **快捷键支持** — `Cmd+Shift+D`（Mac）/ `Ctrl+Shift+D`（Windows）切换选择模式

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动本地服务器

```bash
npm run dev:server
```

服务器运行在 `http://127.0.0.1:3771`。

### 3. 安装 Chrome 扩展

```bash
npm run build:extension
```

然后在 Chrome 中：

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist` 目录

### 4. 使用

- 在任意网页按 `Cmd+Shift+D` 或点击工具栏图标开启选择模式
- 点击任意元素查看信息
- 输入修改意见，点击「建议」获取 AI 建议，或点击「开发」让 Claude Code 修改代码

### 5. 配置 AI（可选）

默认使用 Anthropic Claude。设置环境变量：

```bash
# 使用 Claude（默认）
export ANTHROPIC_API_KEY=your-key

# 或使用 OpenAI
export AI_PROVIDER=openai
export OPENAI_API_KEY=your-key
```

### 6. VS Code 集成（可选）

点击面板中的源码链接会尝试用 VS Code 打开对应文件。确保 `code` 命令可用：

- VS Code → 命令面板 → Shell Command: Install 'code' command in PATH

## 一键测试

扩展已预构建好（`extension/dist/`），可以快速测试：

```bash
# 1. 启动 server + 打开测试页面
bash test/start.sh
```

然后在 Chrome 中：

1. 打开 `chrome://extensions`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目目录下的 **`extension`** 文件夹（不是 `extension/dist`）
5. 回到测试页面，按 `Cmd+Shift+D` 开始体验

> 测试页面位于 `test/index.html`，包含多种 UI 元素（卡片、表单、布局），方便测试元素选择功能。

## 项目结构

```
easy-front-design/
├── extension/                 # 浏览器扩展
│   ├── manifest.json          # Chrome 扩展配置
│   ├── vite.config.ts         # Vite + crxjs 构建配置
│   └── src/
│       ├── content/
│       │   ├── index.ts       # 内容脚本入口
│       │   ├── inspect.ts     # 元素选择、高亮、面板 UI
│       │   ├── fiber.ts       # React Fiber 信息提取
│       │   └── ws.ts          # WebSocket 客户端
│       └── background/
│           └── index.ts       # 后台脚本（处理图标点击）
├── server/                    # Express + WebSocket 后端
│   └── src/
│       ├── index.ts           # 服务器入口
│       ├── app.ts             # Express + WebSocket 服务
│       ├── config.ts          # 配置管理
│       ├── mcp.ts             # MCP 协议桥接 Claude Code
│       ├── queue.ts           # 设计请求队列
│       ├── ai.ts              # Claude API 流式调用
│       ├── openai.ts          # OpenAI API 流式调用
│       ├── vscode.ts          # VS Code 集成
│       └── fileReader.ts      # 源文件读取
├── test/                      # 测试页面
│   ├── index.html             # 测试页面（多种 UI 元素）
│   └── start.sh               # 一键启动脚本
├── tests/                     # 测试文件
│   ├── unit/                  # 单元测试
│   ├── api/                   # API 集成测试
│   └── helpers/               # 测试辅助工具
└── vitest.config.ts           # Vitest 测试配置
```

## 技术栈

- **前端**: TypeScript, Preact, WebSocket, DOM API
- **后端**: Node.js, Express, WebSocket Server
- **协议**: MCP (Model Context Protocol)
- **构建**: Vite, @crxjs/vite-plugin
- **测试**: Vitest

## 开发

```bash
# 开发模式（服务器 + 扩展）
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

## 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Browser Page   │ ←───────────────→  │   Server        │
│  (content script)│                   │   (Express + WS) │
└─────────────────┘                    └────────┬────────┘
                                                │
                                           MCP  │  AI
                                                ↓
                                           ┌─────────┐
                                           │ Claude  │
                                           └─────────┘
```

## MCP 集成

项目包含一个 MCP 服务器，可以让 Claude Code 直接处理浏览器发来的设计请求：

```bash
# 启动 MCP 服务器
npm run start:mcp
```

在 Claude Code 的 `.claude/settings.local.json` 中配置：

```json
{
  "mcpServers": {
    "design-easily": {
      "command": "node",
      "args": ["server/dist/mcp.js"],
      "cwd": "<项目根目录绝对路径>"
    }
  }
}
```

## 相关资源

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [MCP 协议](https://modelcontextprotocol.io/)
- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
