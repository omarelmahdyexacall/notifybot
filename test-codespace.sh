#!/bin/bash
# Run this inside your Codespace to verify everything works

echo "=== 1. Node version ==="
node --version

echo ""
echo "=== 2. npm packages installed? ==="
if [ -d "node_modules" ]; then
  echo "YES - node_modules exists"
else
  echo "NO - running npm install..."
  npm install
fi

echo ""
echo "=== 3. Running tests ==="
npx vitest run

echo ""
echo "=== 4. CLI usage check ==="
node bin/notifybot.js 2>&1 || true

echo ""
echo "=== 5. Config validation check ==="
node bin/notifybot.js echo hello 2>&1 || true

echo ""
echo "=== Done! ==="
echo ""
echo "To test with Telegram:"
echo "  1. cp .env.example .env"
echo "  2. Fill in your bot token and chat ID"
echo "  3. Run: node bin/notifybot.js echo hello"
