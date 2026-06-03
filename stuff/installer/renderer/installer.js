const { ipcRenderer } = require('electron')
const path = require('path')
const os = require('os')

// ── State ─────────────────────────────────────────────────────────────────────
const config = {
  networkName: '',
  port:        3001,
  webPort:     3000,
  installDir:  path.join(os.homedir(), 'CatsMap'),
  autostart:   false,
}

let currentPage = 0

// ── Navigation ────────────────────────────────────────────────────────────────
function goTo(pageIndex) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  const pages = ['page-welcome','page-network','page-ports','page-dir','page-review','page-installing','page-done']
  document.getElementById(pages[pageIndex]).classList.add('active')
  currentPage = pageIndex

  if (pageIndex === 2) loadIPs()
  if (pageIndex === 3) {
    document.getElementById('input-dir').value = config.installDir
  }
  if (pageIndex === 4) buildReview()
}

// ── Validation helpers ─────────────────────────────────────────────────────────
function validateNetwork() {
  const val = document.getElementById('input-network-name').value.trim()
  if (!val) {
    shake('input-network-name')
    return
  }
  config.networkName = val
  goTo(2)
}

function validateDir() {
  config.installDir  = document.getElementById('input-dir').value.trim() || config.installDir
  config.autostart   = document.getElementById('input-autostart').checked
  goTo(4)
}

// ── IP detection ──────────────────────────────────────────────────────────────
async function loadIPs() {
  const info = await ipcRenderer.invoke('get-system-info')
  config.port    = parseInt(document.getElementById('input-port').value)    || 3001
  config.webPort = parseInt(document.getElementById('input-web-port').value) || 3000

  const el = document.getElementById('ip-list')
  if (!info.networkInterfaces.length) {
    el.textContent = 'No network interfaces found'
    return
  }
  el.innerHTML = info.networkInterfaces
    .map(i => `🌐 <strong>${i.name}</strong> → http://${i.address}:${config.webPort}`)
    .join('<br/>')
}

// ── Browse install dir ─────────────────────────────────────────────────────────
async function browseDir() {
  const dir = await ipcRenderer.invoke('choose-install-dir')
  if (dir) {
    config.installDir = dir
    document.getElementById('input-dir').value = dir
  }
}

// ── Review page ────────────────────────────────────────────────────────────────
function buildReview() {
  config.port    = parseInt(document.getElementById('input-port').value)    || 3001
  config.webPort = parseInt(document.getElementById('input-web-port').value) || 3000
  config.autostart = document.getElementById('input-autostart').checked

  const rows = [
    ['Network name', config.networkName],
    ['Server port',  config.port],
    ['Web port',     config.webPort],
    ['Install dir',  config.installDir],
    ['Auto-start',   config.autostart ? 'Yes' : 'No'],
  ]

  document.getElementById('review-card').innerHTML = rows.map(([k, v]) =>
    `<div class="review-row"><span class="review-key">${k}</span><span class="review-val">${v}</span></div>`
  ).join('')
}

// ── Install ────────────────────────────────────────────────────────────────────
async function startInstall() {
  goTo(5)

  const steps = [
    [10, 'Creating directories...'],
    [30, 'Writing configuration...'],
    [55, 'Setting up server...'],
    [75, 'Installing web files...'],
    [90, 'Finalizing...'],
    [100, 'Done! 🎉'],
  ]

  for (const [pct, label] of steps) {
    await delay(400 + Math.random() * 300)
    setProgress(pct, label)
  }

  try {
    const result = await ipcRenderer.invoke('install', config)
    await delay(400)
    showDone(result.installDir)
  } catch (err) {
    setProgress(0, `Error: ${err.message}`)
  }
}

function setProgress(pct, label) {
  document.getElementById('progress-bar').style.width = pct + '%'
  document.getElementById('progress-label').textContent = label
}

function showDone(installDir) {
  document.getElementById('done-desc').textContent =
    `CatsMap was installed to ${installDir}`

  document.getElementById('done-steps').innerHTML = `
    1. Start the server: run <code style="font-family:monospace;color:#e879f9">start-catsmap.sh</code> (or <code style="font-family:monospace;color:#e879f9">.bat</code> on Windows)<br/>
    2. Open your browser to <strong>http://localhost:${config.webPort}</strong><br/>
    3. Share that URL with anyone on your WiFi 🐾<br/>
    4. The admin gets a 🔗 Share Code button to bridge other networks
  `
  goTo(6)
}

async function openBrowser() {
  await ipcRenderer.invoke('open-browser', `http://localhost:${config.webPort}`)
}

function closeWindow() {
  ipcRenderer.invoke('window-close')
}

// ── Window controls ────────────────────────────────────────────────────────────
document.getElementById('btn-close').addEventListener('click', () => {
  ipcRenderer.invoke('window-close')
})
document.getElementById('btn-minimize').addEventListener('click', () => {
  ipcRenderer.invoke('window-minimize')
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

function shake(id) {
  const el = document.getElementById(id)
  el.style.animation = 'none'
  el.getBoundingClientRect() // reflow
  el.style.animation = 'shake 0.4s ease'
  el.style.borderColor = 'rgba(239,68,68,0.6)'
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = '' }, 600)
}

// Add shake keyframes dynamically
const style = document.createElement('style')
style.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}
`
document.head.appendChild(style)
