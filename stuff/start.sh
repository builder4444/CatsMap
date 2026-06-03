#!/bin/bash
# CatsMap production start — builds and runs everything on a single port
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"

# ── Admin credentials — edit these before starting ───────────────────────────
CATSMAP_ADMIN_USERNAME="Flynn"
CATSMAP_ADMIN_PASSWORD="0725"

export CATSMAP_ADMIN_USERNAME
export CATSMAP_ADMIN_PASSWORD

echo ""
echo "  🐱  Starting CatsMap..."
echo "  Admin user: $CATSMAP_ADMIN_USERNAME"
echo ""

# Stop the systemd service if it's occupying the port
if systemctl is-active --quiet catsmap 2>/dev/null; then
  echo "  ⏹  Stopping installed CatsMap service..."
  sudo systemctl stop catsmap || true
fi

# Check deps
if ! command -v cargo &>/dev/null; then
  echo "  ❌  Rust not found — install from https://rustup.rs"; exit 1
fi
if ! command -v node &>/dev/null; then
  echo "  ❌  Node.js not found — install from https://nodejs.org"; exit 1
fi

# Build web UI
echo "  🌐  Building web UI..."
cd "$SCRIPT_DIR/web"
[ ! -d node_modules ] && npm install --silent
npm run build

# Copy dist so the server can serve it
mkdir -p "$SCRIPT_DIR/server/web"
cp -r dist/. "$SCRIPT_DIR/server/web/"

# Build server
echo "  🦀  Building server..."
cd "$SCRIPT_DIR/server"
cargo build --release

echo ""
echo "  ✅  CatsMap ready!"
echo "  Login with: $CATSMAP_ADMIN_USERNAME / (your password)"
echo ""

# Print LAN IPs (IPv4 only)
for IP in $(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'); do
  echo "  Open:  http://$IP:3001"
done
echo "  Also:  http://localhost:3001"
echo ""

CATSMAP_WEB_DIR="./web" ./target/release/catsmap
