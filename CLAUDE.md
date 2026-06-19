# 项目规范

## 沟通规范

- **解释技术名词时，必须附带中文说明。** 不要只写英文术语，要在后面用括号或破折号标注中文含义。例如：`WebSocket（一种浏览器与服务器之间的持久连接协议）`、`MCP（Model Context Protocol，模型上下文协议）`、`STALE_MS（过期时间，单位毫秒）`。

## 项目概述

- **easy-front-design** 是一个网页端设计辅助 Chrome 插件
- 架构：Chrome 扩展 + 本地 Node.js 服务器 + Claude Code（通过 MCP 协议连接）
- 用户在浏览器中选择元素，通过对话或可视化编辑器修改样式，Claude Code 直接修改源码

## 关键路径

- `extension/` — Chrome 扩展（Preact + Shadow DOM + WebSocket）
- `server/` — Express + WebSocket 服务器（端口 3771）
- `server/src/mcp.ts` — MCP 协议桥接，连接 Claude Code
- `server/src/queue.ts` — 设计请求队列，管理请求状态
- `extension/src/content/inspect.ts` — 元素选择 + 操作面板
- `extension/src/content/ws.ts` — WebSocket 客户端，与服务器通信

## 开发注意事项

- **Claude Code 必须在项目根目录下启动**，否则 MCP（Model Context Protocol，模型上下文协议）配置不会被加载
- **端口 3771 全链路硬编码** — 服务端支持 `PORT` 环境变量，但 Chrome 扩展和 MCP 服务器均硬编码了 3771
- **MCP 自动启动依赖硬编码路径** — `server/src/mcp.ts` 中自动启动 HTTP 服务器的路径写死了开发者本机路径，其他用户克隆后需先手动启动服务器（`npm start`）
