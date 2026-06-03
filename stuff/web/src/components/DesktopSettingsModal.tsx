import { useState, useEffect } from 'react'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

export function DesktopSettingsModal({ onClose }: Props) {
  const { addNotification } = useStore()
  const [networkName, setNetworkName] = useState('')
  const [serverPort, setServerPort] = useState(3001)
  const [originalPort, setOriginalPort] = useState(3001)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  
  const [lanUrls, setLanUrls] = useState<Array<{ name: string; url: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    async function loadDesktopData() {
      if (!window.catsmapDesktop) return
      try {
        const settings = await window.catsmapDesktop.getSettings()
        setNetworkName(settings.networkName)
        setServerPort(settings.serverPort)
        setOriginalPort(settings.serverPort)
        setMinimizeToTray(settings.minimizeToTray)
        setAutoStart(settings.autoStart ?? false)

        const urls = await window.catsmapDesktop.getLanUrls()
        setLanUrls(urls)
      } catch (err) {
        addNotification('❌ Failed to load desktop settings')
      } finally {
        setLoading(false)
      }
    }
    loadDesktopData()
  }, [])

  async function handleSaveAndRestart() {
    if (!window.catsmapDesktop) return
    if (!networkName.trim()) {
      addNotification('⚠️ Network name cannot be empty')
      return
    }
    if (serverPort < 1024 || serverPort > 65535) {
      addNotification('⚠️ Port must be between 1024 and 65535')
      return
    }

    setSaving(true)
    try {
      const saveRes = await window.catsmapDesktop.saveSettings({
        networkName: networkName.trim(),
        serverPort,
        minimizeToTray,
        autoStart,
      })

      if (saveRes.ok) {
        addNotification('💾 Settings saved!')
        if (saveRes.restart_needed) {
          setRestarting(true)
          await window.catsmapDesktop.restartServer()
          
          // Wait for server to reboot
          setTimeout(() => {
            if (serverPort !== originalPort) {
              // Port changed! Redirect client to new port URL
              window.location.href = `http://localhost:${serverPort}`
            } else {
              // Port remains same, just reload
              window.location.reload()
            }
          }, 3000)
        } else {
          onClose()
        }
      }
    } catch {
      addNotification('❌ Failed to save desktop settings')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url)
    addNotification('📋 Copied sharing URL to clipboard!')
  }

  function handleOpenUrl(url: string) {
    if (window.catsmapDesktop) {
      window.catsmapDesktop.openUrl(url)
    }
  }

  if (restarting) {
    return (
      <div className="modal-backdrop">
        <div className="glass" style={{ borderRadius: '20px', padding: '36px', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'float 2s ease-in-out infinite' }}>
            🔄
          </div>
          <h2 style={{ fontWeight: 900, fontSize: '20px', color: '#f0e6ff', marginBottom: '8px' }}>
            Restarting Server...
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.5)', lineHeight: 1.5 }}>
            CatsMap server is rebooting on port <span style={{ color: '#d946ef', fontWeight: 700 }}>{serverPort}</span>.
            The desktop client will automatically reconnect in a moment 🐾
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass"
        onClick={e => e.stopPropagation()}
        style={{
          borderRadius: '20px',
          padding: '28px',
          width: '100%',
          maxWidth: '480px',
          animation: 'bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontWeight: 900, fontSize: '20px', color: '#f0e6ff', marginBottom: '4px' }}>
            🖥️ Desktop Server Settings
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.5)' }}>
            Configure the local CatsMap server process and options
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(240,230,255,0.4)' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⌛</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading settings...</div>
          </div>
        ) : (
          <div>
            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 700,
                  color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '6px',
                }}>
                  Network Name
                </label>
                <input
                  className="chat-input"
                  value={networkName}
                  onChange={e => setNetworkName(e.target.value)}
                  placeholder="My CatsMap Network"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: '11px', fontWeight: 700,
                    color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: '6px',
                  }}>
                    Server Port
                  </label>
                  <input
                    className="chat-input"
                    type="number"
                    value={serverPort}
                    onChange={e => setServerPort(Number(e.target.value))}
                    min={1024}
                    max={65535}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '13px', color: 'rgba(240,230,255,0.7)',
                    cursor: 'pointer', userSelect: 'none', fontWeight: 600
                  }}>
                    <input
                      type="checkbox"
                      checked={minimizeToTray}
                      onChange={e => setMinimizeToTray(e.target.checked)}
                      style={{
                        accentColor: '#a855f7',
                        width: '16px', height: '16px',
                        cursor: 'pointer',
                      }}
                    />
                    Minimize to Tray
                  </label>
                </div>
              </div>
            </div>

            {/* LAN Sharing Info */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(240,230,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                📱 Share with other devices on WiFi
              </h3>
              
              {lanUrls.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'rgba(240,230,255,0.35)', fontStyle: 'italic' }}>
                  No network interfaces found. Make sure you are connected to WiFi!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lanUrls.map(lan => (
                    <div
                      key={lan.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.4)', fontWeight: 700 }}>
                          Interface: {lan.name}
                        </div>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '13px',
                          color: '#e9d5ff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}>
                          {lan.url}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(lan.url)}
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}
                          title="Copy Link"
                        >
                          📋 Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenUrl(lan.url)}
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}
                          title="Open in default browser"
                        >
                          🌐 Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveAndRestart}
                disabled={saving}
                style={{ flex: 1, padding: '12px', fontSize: '14px' }}
              >
                {saving ? '⏳ Saving...' : '💾 Apply & Restart Server'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '12px 18px', fontSize: '14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
