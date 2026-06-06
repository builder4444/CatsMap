# 🐱 CatsMap

> Cute, private LAN chat — like Discord, but yours.

CatsMap is a self-hosted LAN chat server. One PC per WiFi network acts as the host ("Map"). Everyone on the network connects via browser. Share codes let two networks bridge securely.

## Structure

```
CatsMap/
├── server/          # Rust (Axum) backend — the Map server
├── web/             # React + TypeScript frontend — the glassy UI
├── installer/       # Electron GUI installer wizard
└── mobile/          # Expo Go scaffold (future)
```

## Quick Start
0. Setup An admin psswd
1. Run the installer or `cd server && cargo run`
2. Open `http://localhost:3000` on any device on the same WiFi
3. Login, Pick a cat name 🐱 and start chatting

## Share Codes

Network admins can generate a Share Code in Settings. When two admins both enter each other's codes, their networks bridge and users can chat cross-network.
