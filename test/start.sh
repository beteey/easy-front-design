#!/bin/bash
# Easy Design - 一键启动脚本
# 启动 server + 打开测试页面

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Easy Design - 启动测试环境"
echo "================================"

# 1. 启动 server
echo ""
echo "📡 启动 Server (端口 3771)..."
cd "$PROJECT_DIR"
npm run start &
SERVER_PID=$!

# 等 server 启动
echo "   等待 Server 就绪..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:3771/health > /dev/null 2>&1; then
    echo "   ✅ Server 已就绪"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "   ❌ Server 启动超时"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
  sleep 0.5
done

# 2. 打开测试页面
echo ""
echo "🌐 打开测试页面..."
open "$SCRIPT_DIR/index.html"

echo ""
echo "================================"
echo "✅ 测试环境已就绪！"
echo ""
echo "接下来请在 Chrome 中："
echo "  1. 打开 chrome://extensions"
echo "  2. 开启「开发者模式」"
echo "  3. 点击「加载已解压的扩展程序」"
echo "  4. 选择项目目录下的 extension/ 文件夹"
echo "  5. 回到测试页面，按 Cmd+Shift+D 开始体验"
echo ""
echo "按 Ctrl+C 停止 Server"
echo "================================"

# 捕获 Ctrl+C，停止 server
trap "echo ''; echo '🛑 停止 Server...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

# 等待 server 进程
wait $SERVER_PID
