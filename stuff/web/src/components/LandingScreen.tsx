import { useState } from 'react'
import { login, getMessages, getOnlineUsers } from '../api'
import { useStore } from '../store'
import { DesktopSettingsModal } from './DesktopSettingsModal'
import { normalizeMessage } from '../utils/message'

export function LandingScreen() {
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [showDesktopSettings, setShowDesktopSettings] = useState(false)

  const { setCurrentUser, setNetwork, setChannels, setOnlineUsers, setMessages, setCustomEmojis } = useStore()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const data = await login(username.trim(), password)
      setNetwork(data.network_id, data.network_name)
      setChannels(data.channels)
      setCurrentUser(data.user)
      setCustomEmojis(data.custom_emojis ?? [])

      const users = await getOnlineUsers()
      setOnlineUsers(users)

      if (data.channels.length > 0) {
        const msgs = await getMessages(data.channels[0].id)
        setMessages(data.channels[0].id, msgs.map(normalizeMessage))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
    }}>
      {window.catsmapDesktop && (
        <button
          type="button"
          onClick={() => setShowDesktopSettings(true)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'rgba(240,230,255,0.7)',
            zIndex: 10,
          }}
          title="Server Host Settings"
        >
          ⚙️
        </button>
      )}
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '72px', lineHeight: 1, marginBottom: '12px', display: 'inline-block' }}>🐱</div>
          <h1 className="gradient-text" style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px' }}>
            CatsMap
          </h1>
          <p style={{ color: 'rgba(240,230,255,0.55)', fontSize: '15px', fontWeight: 500 }}>
            Sign in to your private LAN chat 🗺️
          </p>
        </div>

        <div className="glass" style={{ borderRadius: '20px', padding: '32px' }}>
          <h2 style={{ fontWeight: 800, fontSize: '18px', marginBottom: '20px', color: '#e9d5ff' }}>
            Login
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(240,230,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Username
              </label>
              <input
                className="chat-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your account username"
                autoComplete="username"
                style={{ width: '100%', padding: '12px 16px', fontSize: '15px' }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(240,230,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Password
              </label>
              <input
                className="chat-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ width: '100%', padding: '12px 16px', fontSize: '15px' }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#fca5a5',
                marginBottom: '16px',
                textAlign: 'left',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !username.trim() || !password}
              style={{ width: '100%', padding: '14px', fontSize: '16px', opacity: (!username.trim() || !password || loading) ? 0.6 : 1 }}
            >
              {loading ? '🐾 Signing in...' : '🐱 Enter the Map'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '20px', fontSize: '12px', color: 'rgba(240,230,255,0.3)', fontWeight: 500 }}>
          Accounts are managed by your network admin · Set credentials in start.sh
        </p>
      </div>
      {showDesktopSettings && (
        <DesktopSettingsModal onClose={() => setShowDesktopSettings(false)} />
      )}
    </div>
  )
}
