const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const { execFile, spawn } = require('child_process')
const os = require('os')

let mainWindow
let serverProcess = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  720,
    height: 560,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-system-info', () => ({
  platform:  process.platform,
  hostname:  os.hostname(),
  homedir:   os.homedir(),
  networkInterfaces: getLocalIPs(),
}))

ipcMain.handle('choose-install-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose install directory',
  })
  return result.filePaths[0] ?? null
})

ipcMain.handle('install', async (_event, config) => {
  // In a real installer, this would extract bundled binaries, write config, etc.
  // Here we simulate the steps and write a launch script.

  const installDir = config.installDir || path.join(os.homedir(), 'CatsMap')
  fs.mkdirSync(installDir, { recursive: true })
  fs.mkdirSync(path.join(installDir, 'uploads'), { recursive: true })

  // Write config file
  const serverConfig = {
    network_name: config.networkName,
    port: config.port || 3001,
    web_port: config.webPort || 3000,
    install_dir: installDir,
    autostart: config.autostart || false,
  }
  fs.writeFileSync(
    path.join(installDir, 'config.json'),
    JSON.stringify(serverConfig, null, 2)
  )

  // Write a platform-appropriate launch script
  if (process.platform === 'win32') {
    const bat = `@echo off\ncd "${installDir}"\ncatsmap.exe\n`
    fs.writeFileSync(path.join(installDir, 'start-catsmap.bat'), bat)
  } else {
    const sh = `#!/bin/bash\ncd "${installDir}"\n./catsmap\n`
    const scriptPath = path.join(installDir, 'start-catsmap.sh')
    fs.writeFileSync(scriptPath, sh)
    fs.chmodSync(scriptPath, '755')
  }

  return { success: true, installDir }
})

ipcMain.handle('open-browser', (_event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('window-close', () => {
  mainWindow.close()
})

ipcMain.handle('window-minimize', () => {
  mainWindow.minimize()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocalIPs() {
  const interfaces = os.networkInterfaces()
  const ips = []
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address })
      }
    }
  }
  return ips
}
