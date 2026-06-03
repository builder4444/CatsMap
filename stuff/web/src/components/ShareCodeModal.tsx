import { useState } from 'react'
import { generateShareCode, connectShareCode } from '../api'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

export function ShareCodeModal({ onClose }: Props) {
  const [tab, setTab] = useState<'generate' | 'connect'>('generate')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [connectCode, setConnectCode]     = useState('')
  const [remoteUrl, setRemoteUrl]         = useState('')
  const [loading, setLoading]             = useState(false)
  const [result, setResult]               = useState('')
  const { addNotification } = useStore()

  async function handleGenerate() {
    setLoading(true)
    try {
      const data = await generateShareCode()
      setGeneratedCode(data.code)
    } catch {
      setResult('Failed to generate code')
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    if (!connectCode.trim() || !remoteUrl.trim()) return
    setLoading(true)
    try {
      const data = await connectShareCode(connectCode.trim(), remoteUrl.trim())
      setResult(data.message)
      addNotification(`🌉 ${data.message}`)
    } catch {
      setResult('Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      addNotification('📋 Code copied to clipboard!')
    }
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
          maxWidth: '460px',
          animation: 'bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontWeight: 900, fontSize: '20px', color: '#f0e6ff', marginBottom: '4px' }}>
            🔗 Share Code
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.5)' }}>
            Bridge two networks so users can chat across your LAN islands
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '10px',
          padding: '3px',
          marginBottom: '20px',
          gap: '3px',
        }}>
          {(['generate', 'connect'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: tab === t ? 'rgba(168,85,247,0.25)' : 'transparent',
                color: tab === t ? '#e9d5ff' : 'rgba(240,230,255,0.5)',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'generate' ? '✨ Generate Code' : '🌉 Connect Code'}
            </button>
          ))}
        </div>

        {tab === 'generate' && (
          <div>
            <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.55)', marginBottom: '16px', lineHeight: 1.6 }}>
              Generate a code and share it with another network admin. When they enter it on their end too, your networks bridge together!
            </p>
            {generatedCode ? (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  background: 'rgba(168,85,247,0.12)',
                  border: '1px solid rgba(168,85,247,0.35)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                  onClick={copyCode}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(168,85,247,0.12)'}
                >
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#e879f9',
                    letterSpacing: '0.1em',
                    marginBottom: '6px',
                  }}>
                    {generatedCode}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>Click to copy</div>
                </div>
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={handleGenerate}
                disabled={loading}
                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
              >
                {loading ? '⏳ Generating...' : '✨ Generate Code'}
              </button>
            )}
            {generatedCode && (
              <button
                className="btn-ghost"
                onClick={handleGenerate}
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                🔄 Generate new code
              </button>
            )}
          </div>
        )}

        {tab === 'connect' && (
          <div>
            <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.55)', marginBottom: '16px', lineHeight: 1.6 }}>
              Enter the share code from another network admin and their server address to bridge your networks.
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '6px',
              }}>
                Share Code
              </label>
              <input
                className="chat-input"
                value={connectCode}
                onChange={e => setConnectCode(e.target.value.toUpperCase())}
                placeholder="PURR-MEOW-1234"
                style={{ width: '100%', padding: '10px 14px', fontSize: '15px',
                  fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '6px',
              }}>
                Remote Server URL
              </label>
              <input
                className="chat-input"
                value={remoteUrl}
                onChange={e => setRemoteUrl(e.target.value)}
                placeholder="http://192.168.1.50:3001"
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
              />
            </div>
            {result && (
              <div style={{
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid rgba(52,211,153,0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#6ee7b7',
                marginBottom: '12px',
              }}>
                {result}
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleConnect}
              disabled={loading || !connectCode.trim() || !remoteUrl.trim()}
              style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            >
              {loading ? '⏳ Connecting...' : '🌉 Bridge Networks'}
            </button>
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="btn-ghost"
          style={{ width: '100%', padding: '10px', fontSize: '13px', marginTop: '12px' }}
        >
          ✕ Close
        </button>
      </div>
    </div>
  )
}
