# easy-front-design

网页端设计辅助 Chrome 插件 — 在浏览器上选择元素，通过对话或可视化编辑器修改样式，AI 直接帮你改源码。

## ✨ 特性

- 🎯 **元素选择** — 鼠标悬停高亮，点击选中网页元素
- 💬 **双模式面板** — 对话模式（自然语言）+ 编辑模式（可视化样式调节）
- 🤖 **AI 自动处理** — DeepSeek Worker 自动监听请求并修改文件
- ✅ **验证机制** — 自动验证修改是否正确，防止错误修改
- ⚡ **并行处理** — 同时处理多个请求，提高效率
- 📁 **多项目支持** — 可配置任意项目路径
- 🎨 **实时预览** — 编辑模式下修改样式即时生效
- ⌨️ **快捷键** — `Cmd+Shift+D`（Mac）/ `Ctrl+Shift+D`（Windows）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 AI

复制 `.env.example` 为 `.env` 并填入 API Key：

```bash
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

**获取 API Key：**
- 访问 [DeepSeek 官网](https://platform.deepseek.com/) 注册账号
- 在控制台获取 API Key
- 支持的模型：`deepseek-chat`、`deepseek-v4-pro`、`deepseek-v4-flash`

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

### 5. 配置插件

1. 点击插件图标
2. 点击「⚙️ DeepSeek 设置」
3. 输入项目根目录路径（如 `/Users/xxx/my-project`）
4. 选择 AI 模型
5. 点击「保存设置」

### 6. 使用插件

1. 打开任意网页（支持 `http://` 和 `file://` 协议）
2. 点击插件图标 → 开启选择模式
3. 鼠标悬停元素 → 高亮显示
4. 点击元素 → 右侧弹出操作面板
5. 输入修改指令，点击「⚡ 让 Claude Code 改」
6. 等待 AI 处理完成，刷新页面查看效果

## 🏗️ 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     HTTP      ┌──────────────┐
│  Chrome 扩展     │ ←───────────────→  │   Server        │ ←───────────→ │  DeepSeek    │
│  (content script)│                    │   (Express + WS)│              │  API         │
│                 │                    │                 │              │              │
│  ┌───────────┐  │                    │  ┌───────────┐  │              │  生成修改    │
│  │ Inspect   │  │                    │  │  Queue    │  │              │              │
│  │ Panel     │  │                    │  │  (请求队列)│  │              └──────────────┘
│  │ 对话/编辑  │  │                    │  └───────────┘  │
│  └───────────┘  │                    │  ┌───────────┐  │
│                 │                    │  │  Worker   │  │
│                 │                    │  │ (自动处理) │  │
│                 │                    │  └───────────┘  │
└─────────────────┘                    └─────────────────┘
```

### 工作原理

1. **Chrome 扩展**：注入 content script 到页面，提供元素选择和操作面板
2. **Server**：Express + WebSocket 服务器，管理设计请求队列
3. **DeepSeek Worker**：自动轮询队列，调用 DeepSeek API 处理请求
4. **文件修改**：直接读写源文件，无需额外工具

### 与原版项目的区别

| 特性 | 原版 (Claude Code) | 我们的版本 (DeepSeek) |
|------|-------------------|----------------------|
| 处理方式 | 依赖 Claude Code CLI | DeepSeek API 自动处理 |
| API Key | 不需要（用本地 Claude Code） | 需要配置 DeepSeek API Key |
| 项目路径 | 自动获取 | 需要用户配置 |
| 响应速度 | 取决于 Claude Code 启动速度 | 2 秒轮询 + API 调用 |
| 并行处理 | ❌ 不支持 | ✅ 最多 3 个并行 |
| 验证机制 | Claude Code 自动验证 | DeepSeek API 验证 |

## 📁 项目结构

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
│       ├── popup/             # 扩展弹窗（状态显示 + 设置）
│       │   ├── App.tsx
│       │   └── components/
│       │       ├── Statusbar.tsx
│       │       ├── InspectToggle.tsx
│       │       └── Settings.tsx  # DeepSeek 设置面板
│       └── background/
│           └── index.ts       # 后台脚本（健康检查、状态存储）
├── server/                    # Express + WebSocket 后端
│   └── src/
│       ├── index.ts           # 服务器入口
│       ├── app.ts             # Express + WebSocket 服务 + API
│       ├── mcp.ts             # MCP 协议桥接（兼容原版）
│       ├── queue.ts           # 设计请求队列
│       ├── deepseek-worker.ts # DeepSeek 后台工作服务
│       ├── ai.ts              # Anthropic API 流式调用
│       ├── openai.ts          # OpenAI API 流式调用
│       ├── config.ts          # 配置管理
│       ├── vscode.ts          # VS Code 集成
│       └── fileReader.ts      # 源文件读取
├── test/                      # 测试页面
│   └── index.html             # 测试页面（多种 UI 元素）
├── .env                       # 环境变量配置
├── .env.example               # 环境变量示例
├── CLAUDE.md                  # Claude Code 项目规范
└── README.md                  # 项目说明
```

## 🔧 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/` | 测试页面 |
| GET | `/api/pending` | 查询待处理请求数量 |
| GET | `/api/next?timeout=&workerId=` | 长轮询获取下一个请求 |
| POST | `/api/complete/:id` | 提交处理结果 |
| POST | `/api/progress/:id` | 报告处理进度 |
| POST | `/api/heartbeat/:id` | 保持请求存活 |
| GET | `/api/requests/:id` | 查询请求状态 |

## 🛠️ 开发

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

# 启动 DeepSeek Worker（自动随服务器启动）
npm start
```

## 📋 技术栈

- **扩展**: TypeScript, Preact, Shadow DOM, WebSocket
- **后端**: Node.js, Express, WebSocket Server
- **AI**: DeepSeek API（OpenAI 兼容）
- **构建**: Vite, @crxjs/vite-plugin
- **测试**: Vitest

## ⚠️ 注意事项

- **DeepSeek API Key 必须配置**，否则无法处理设计请求
- **项目路径必须配置**，否则无法找到源文件
- **端口 3771 全链路硬编码** — 服务端支持 `PORT` 环境变量，但 Chrome 扩展和 MCP 服务器均硬编码了 `3771`
- **支持的协议** — `http://`、`https://`、`file://`（本地文件）

## 🔍 故障排查

### 问题：请求超时失败

**可能原因：**
- DeepSeek API Key 无效
- 网络连接问题
- 项目路径配置错误

**解决方法：**
1. 检查 `.env` 文件中的 API Key
2. 测试 API 连接：`curl https://api.deepseek.com/models -H "Authorization: Bearer YOUR_API_KEY"`
3. 检查插件设置中的项目路径

### 问题：找不到源文件

**可能原因：**
- 项目路径配置错误
- 文件不存在

**解决方法：**
1. 检查插件设置中的项目路径是否正确
2. 确保文件存在于指定路径

### 问题：修改未生效

**可能原因：**
- 需要刷新页面查看效果
- 修改验证失败

**解决方法：**
1. 刷新页面
2. 查看控制台日志，检查是否有验证失败信息

## 📊 性能优化

- **并行处理**：最多同时处理 3 个请求
- **验证机制**：自动验证修改正确性，防止错误修改
- **智能文件查找**：自动定位项目根目录
- **优化 Prompt**：提高修改准确性和代码质量

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
