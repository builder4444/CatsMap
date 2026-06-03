#!/bin/bash
# CatsMap dev mode
# - Rust server (API + WS) on :3001
# - Vite dev server (hot-reload UI) on :3000  ← use this URL
#
# In production (start.sh / .deb install) the server serves the
# built web files itself on a single port.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CARGO="${HOME}/.cargo/bin/cargo"
if ! command -v cargo &>/dev/null && [ -x "$CARGO" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

echo ""
echo "  🐱  CatsMap — dev mode"
echo ""

# Install web deps if needed
if [ ! -d "$SCRIPT_DIR/web/node_modules" ]; then
  echo "  📦  Installing web dependencies..."
  cd "$SCRIPT_DIR/web" && npm install
fi

# Start Rust server in background
echo "  🦀  Starting API server on :3001..."
cd "$SCRIPT_DIR/server"
if command -v cargo-watch &>/dev/null; then
  cargo watch -x run &
else
  cargo run &
fi
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Start Vite dev server in background
echo "  🌐  Starting Vite on :3000..."
cd "$SCRIPT_DIR/web" && npm run dev &
WEB_PID=$!

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  Open  http://localhost:3000  in browser    │"
echo "  │  Share with others on the same WiFi  🐾     │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Press Ctrl+C to stop"

trap "echo '  Stopping...'; kill $WEB_PID $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait
