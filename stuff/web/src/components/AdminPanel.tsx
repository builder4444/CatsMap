import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import {
  renameNetwork, kickUser, promoteUser, demoteUser,
  createChannel, deleteChannel, getOnlineUsers,
  listAccounts, createAccount, deleteAccount, resetAccountPassword,
} from '../api'
import type { ServerLogEntry, SystemInfo, ServerStatus, DesktopSettings } from '../types'

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */
const pill = (color: string, text: string) => (
  <span style={{
    background: color + '22',
    color,
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
  }}>{text}</span>
)

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '18px',
      flex: 1,
      minWidth: '140px',
    }}>
      <div style={{ fontSize: '26px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: 900, color: '#f0e6ff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)', marginTop: '2px' }}>{sub}</div>}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,230,255,0.4)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}

/* ─── LOG LINE COLORS ───────────────────────────────────────────────────────── */
function logColor(line: string): string {
  if (line.includes('ERROR') || line.includes('error') || line.includes('[exit]')) return '#f87171'
  if (line.includes('WARN')  || line.includes('warn'))  return '#fbbf24'
  if (line.includes('INFO')  || line.includes('info'))  return '#a3e635'
  if (line.includes('[ctrl]'))  return '#38bdf8'
  return 'rgba(240,230,255,0.6)'
}

/* ─── TABS ──────────────────────────────────────────────────────────────────── */
type Tab = 'overview' | 'users' | 'accounts' | 'rooms' | 'server' | 'logs' | 'settings'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',  icon: '📊', label: 'Overview'  },
  { id: 'users',     icon: '👥', label: 'Online'    },
  { id: 'accounts',  icon: '🔐', label: 'Accounts' },
  { id: 'rooms',     icon: '#️⃣',  label: 'Rooms'    },
  { id: 'server',    icon: '🖥️',  label: 'Server'   },
  { id: 'logs',      icon: '📋', label: 'Logs'      },
  { id: 'settings',  icon: '⚙️',  label: 'Settings' },
]

/* ═══════════════════════════════════════════════════════════════════════════ */
interface Props { onClose: () => void; initialTab?: Tab }

export function AdminPanel({ onClose, initialTab = 'overview' }: Props) {
  const { currentUser, networkName, channels, onlineUsers, setOnlineUsers, addNotification } = useStore()
  const [tab, setTab] = useState<Tab>(initialTab)

  // Refresh online users
  useEffect(() => {
    const refresh = async () => {
      try { setOnlineUsers(await getOnlineUsers()) } catch {}
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  // Listen for main-process navigation events
  useEffect(() => {
    window.catsmapDesktop?.onAdminTab((t) => setTab(t as Tab))
    return () => window.catsmapDesktop?.offAdminTab()
  }, [])

  if (!currentUser?.is_admin) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="glass" onClick={e => e.stopPropagation()} style={{ borderRadius: '20px', padding: '32px', maxWidth: '360px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontWeight: 900, fontSize: '20px', color: '#f0e6ff', marginBottom: '10px' }}>Admin Access Required</h2>
          <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.5)', marginBottom: '20px', lineHeight: 1.5 }}>
            You need admin privileges to access this panel.
          </p>
          <button onClick={onClose} className="btn-ghost" style={{ width: '100%', padding: '12px', fontSize: '13px' }}>
            ✕ Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '900px',
          height: '85vh', maxHeight: '700px',
          background: 'rgba(13,10,26,0.97)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: '24px',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          animation: 'bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* ── Sidebar nav ─────────────────────────────────────────────── */}
        <div style={{
          width: '200px',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
          gap: '4px',
        }}>
          {/* Header */}
          <div style={{ padding: '0 4px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#f0e6ff', lineHeight: 1.2 }}>⚙️ Admin</div>
            <div style={{ fontSize: '11px', color: '#d946ef', fontWeight: 700, marginTop: '2px' }}>
              {currentUser.username}
            </div>
          </div>

          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: tab === t.id ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: tab === t.id ? '#e9d5ff' : 'rgba(240,230,255,0.5)',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '15px' }}>{t.icon}</span>
              {t.label}
              {tab === t.id && (
                <span style={{
                  marginLeft: 'auto',
                  width: '4px', height: '4px',
                  borderRadius: '50%',
                  background: '#d946ef',
                }} />
              )}
            </button>
          ))}

          {/* Close at bottom */}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '100%', padding: '10px', fontSize: '13px', marginTop: 'auto' }}
          >
            ✕ Close
          </button>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          {tab === 'overview'  && <OverviewTab  currentUser={currentUser} networkName={networkName} channels={channels} onlineUsers={onlineUsers} />}
          {tab === 'users'     && <UsersTab     currentUser={currentUser} onlineUsers={onlineUsers} addNotification={addNotification} />}
          {tab === 'accounts'  && <AccountsTab  currentUser={currentUser} addNotification={addNotification} />}
          {tab === 'rooms'     && <RoomsTab     currentUser={currentUser} channels={channels} addNotification={addNotification} />}
          {tab === 'server'    && <ServerTab    addNotification={addNotification} />}
          {tab === 'logs'      && <LogsTab      addNotification={addNotification} />}
          {tab === 'settings'  && <SettingsTab  currentUser={currentUser} networkName={networkName} addNotification={addNotification} />}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* OVERVIEW TAB                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ currentUser, networkName, channels, onlineUsers }: any) {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [srvStatus, setSrvStatus] = useState<ServerStatus | null>(null)

  useEffect(() => {
    window.catsmapDesktop?.getSystemInfo().then(setSysInfo).catch(() => {})
    window.catsmapDesktop?.getServerStatus().then(setSrvStatus).catch(() => {})
    const id = setInterval(() => {
      window.catsmapDesktop?.getServerStatus().then(setSrvStatus).catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [])

  function uptime(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h}h ${m}m`
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>📊 Overview</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '24px' }}>
        Live snapshot of your CatsMap network and server.
      </p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard icon="👥" label="Users Online"  value={onlineUsers.length} />
        <StatCard icon="#️⃣" label="Rooms"         value={channels.length} />
        <StatCard icon="🟢" label="Server"        value={srvStatus?.running ? 'Running' : 'Stopped'}
                  sub={srvStatus?.running ? `Port ${srvStatus.port}` : undefined} />
        {sysInfo && <StatCard icon="🧠" label="Memory" value={`${sysInfo.usedMemPct}%`} sub={`${sysInfo.freeMemMb} MB free`} />}
      </div>

      {/* Network info card */}
      <div style={{
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.2)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Network
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>Network Name</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0e6ff' }}>{networkName || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>Your Role</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#d946ef' }}>⭐ Admin</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>Your Username</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0e6ff' }}>{currentUser?.username}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>Network ID</div>
            <div style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(240,230,255,0.6)' }}>
              {useStore.getState().networkId.slice(0, 16)}…
            </div>
          </div>
        </div>
      </div>

      {/* System info */}
      {sysInfo && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            System
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              ['OS',       `${sysInfo.platform} ${sysInfo.arch}`],
              ['CPU',      `${sysInfo.cpuCores}× ${sysInfo.cpuModel.split(' ').slice(0, 3).join(' ')}`],
              ['RAM',      `${sysInfo.totalMemMb} MB total`],
              ['Uptime',   uptime(sysInfo.uptime)],
              ['Electron', `v${sysInfo.electronVersion}`],
              ['App',      `v${sysInfo.appVersion}`],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                <div style={{ fontSize: '13px', color: 'rgba(240,230,255,0.75)', fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* USERS TAB                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function UsersTab({ currentUser, onlineUsers, addNotification }: any) {
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = onlineUsers.filter((u: any) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  async function handleKick(id: string, name: string) {
    if (id === currentUser.id) return
    if (!window.confirm(`Kick ${name}?`)) return
    setLoading(true)
    try {
      await kickUser(currentUser.id, id)
      addNotification(`👢 Kicked ${name}`)
    } catch { addNotification('❌ Failed to kick user') }
    finally { setLoading(false) }
  }

  async function handleToggleAdmin(id: string, name: string, isAdmin: boolean) {
    if (id === currentUser.id) return
    const msg = isAdmin ? `Demote ${name}?` : `Promote ${name} to admin?`
    if (!window.confirm(msg)) return
    setLoading(true)
    try {
      if (isAdmin) {
        await demoteUser(currentUser.id, id)
        addNotification(`⬇️ Demoted ${name}`)
      } else {
        await promoteUser(currentUser.id, id)
        addNotification(`⭐ Promoted ${name} to admin`)
      }
    } catch { addNotification('❌ Failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>👥 User Management</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '20px' }}>
        {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} currently connected to your network.
      </p>

      {/* Search */}
      <input
        className="chat-input"
        placeholder="🔍 Search users…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(240,230,255,0.3)' }}>
          {onlineUsers.length === 0 ? '👻 No users online' : '🔍 No matches'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((user: any) => {
            const isMe = user.id === currentUser.id
            return (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: isMe ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isMe ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '12px',
                  transition: 'background 0.15s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px',
                  borderRadius: '50%',
                  background: user.color + '25',
                  border: `2px solid ${user.color}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0,
                }}>
                  {user.avatar_emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f0e6ff' }}>{user.username}</span>
                    {user.is_admin && pill('#d946ef', '⭐ Admin')}
                    {isMe && pill('#34d399', 'You')}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.35)', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {user.id.slice(0, 16)}…
                  </div>
                </div>

                {/* Actions */}
                {!isMe && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-ghost"
                      onClick={() => handleToggleAdmin(user.id, user.username, user.is_admin)}
                      disabled={loading}
                      title={user.is_admin ? 'Demote' : 'Promote to Admin'}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {user.is_admin ? '⬇️ Demote' : '⭐ Promote'}
                    </button>
                    <button
                      onClick={() => handleKick(user.id, user.username)}
                      disabled={loading}
                      title="Kick user"
                      style={{
                        padding: '6px 12px', fontSize: '12px',
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '8px',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: 700,
                      }}
                    >
                      👢 Kick
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ROOMS TAB                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function RoomsTab({ currentUser, channels, addNotification }: any) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createChannel(currentUser.id, name.trim(), desc.trim() || undefined)
      addNotification(`#️⃣ Created room #${name}`)
      setName(''); setDesc('')
    } catch { addNotification('❌ Failed to create room') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string, cname: string) {
    if (channels.length <= 1) { addNotification('⚠️ Need at least one room'); return }
    if (!window.confirm(`Delete #${cname}? All messages will be lost.`)) return
    setLoading(true)
    try {
      await deleteChannel(currentUser.id, id)
      addNotification(`🗑️ Deleted #${cname}`)
    } catch { addNotification('❌ Failed to delete room') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>#️⃣ Room Management</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '24px' }}>
        Create and manage chat rooms (channels) on your network.
      </p>

      {/* Create room */}
      <div style={{
        background: 'rgba(168,85,247,0.07)',
        border: '1px solid rgba(168,85,247,0.2)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.6)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ➕ Create New Room
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            className="chat-input"
            value={name}
            onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="room-name"
            style={{ flex: 1, padding: '10px 14px', fontSize: '14px' }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <input
          className="chat-input"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Optional description…"
          style={{ width: '100%', padding: '10px 14px', fontSize: '14px', marginBottom: '12px' }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          style={{ width: '100%', padding: '11px', fontSize: '14px' }}
        >
          {loading ? '⏳ Creating…' : '➕ Create Room'}
        </button>
      </div>

      {/* Room list */}
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        All Rooms ({channels.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {channels.map((ch: any) => (
          <div
            key={ch.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
            }}
          >
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: 'rgba(168,85,247,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
            }}>
              #
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f0e6ff' }}>#{ch.name}</div>
              {ch.description && (
                <div style={{ fontSize: '12px', color: 'rgba(240,230,255,0.4)', marginTop: '2px' }}>{ch.description}</div>
              )}
            </div>
            {channels.length > 1 && (
              <button
                onClick={() => handleDelete(ch.id, ch.name)}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '8px',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '12px', color: 'rgba(240,230,255,0.25)', marginTop: '12px' }}>
        ⚠️ At least one room must always exist.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SERVER TAB  (desktop-only features)                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */
function ServerTab({ addNotification }: any) {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [lanUrls, setLanUrls] = useState<Array<{ name: string; url: string }>>([])
  const [restarting, setRestarting] = useState(false)

  const refresh = () => {
    window.catsmapDesktop?.getServerStatus().then(setStatus).catch(() => {})
    window.catsmapDesktop?.getLanUrls().then(setLanUrls).catch(() => {})
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  async function handleRestart() {
    setRestarting(true)
    try {
      await window.catsmapDesktop?.restartServer()
      addNotification('🔄 Server restarting…')
      setTimeout(() => { setRestarting(false); refresh() }, 4000)
    } catch {
      addNotification('❌ Restart failed')
      setRestarting(false)
    }
  }

  async function handleStop() {
    if (!window.confirm('Stop the server? Users will be disconnected.')) return
    try {
      await window.catsmapDesktop?.stopServer()
      addNotification('🛑 Server stopped')
      refresh()
    } catch { addNotification('❌ Failed to stop server') }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    addNotification('📋 Copied to clipboard!')
  }

  if (!window.catsmapDesktop) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(240,230,255,0.3)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌐</div>
        <p style={{ fontSize: '14px' }}>Server controls are only available in the desktop app.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>🖥️ Server Control</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '24px' }}>
        Manage the embedded Rust server process.
      </p>

      {/* Status card */}
      <div style={{
        background: status?.running ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${status?.running ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{ fontSize: '32px' }}>{status?.running ? '🟢' : '🔴'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f0e6ff' }}>
            {restarting ? 'Restarting…' : status?.running ? 'Server Running' : 'Server Stopped'}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(240,230,255,0.5)', marginTop: '4px' }}>
            {status?.running ? `Listening on port ${status.port}` : 'The server process is not running'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-primary"
            onClick={handleRestart}
            disabled={restarting}
            style={{ padding: '9px 16px', fontSize: '13px' }}
          >
            {restarting ? '⏳' : '🔄 Restart'}
          </button>
          {status?.running && (
            <button
              onClick={handleStop}
              disabled={restarting}
              style={{
                padding: '9px 16px', fontSize: '13px',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '10px',
                color: '#f87171',
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
              }}
            >
              🛑 Stop
            </button>
          )}
        </div>
      </div>

      {/* LAN URLs */}
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        📱 Share with Devices on WiFi
      </div>
      {lanUrls.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'rgba(240,230,255,0.3)', fontStyle: 'italic', marginBottom: '20px' }}>
          No external network interfaces found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
          {lanUrls.map(lan => (
            <div
              key={lan.name}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {lan.name}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#e9d5ff', marginTop: '2px' }}>
                  {lan.url}
                </div>
              </div>
              <button
                className="btn-ghost"
                onClick={() => copyUrl(lan.url)}
                style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
              >
                📋 Copy
              </button>
              <button
                className="btn-ghost"
                onClick={() => window.catsmapDesktop?.openUrl(lan.url)}
                style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
              >
                🌐 Open
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Open config folder */}
      <button
        className="btn-ghost"
        onClick={() => window.catsmapDesktop?.openConfigDir()}
        style={{ width: '100%', padding: '11px', fontSize: '13px' }}
      >
        📁 Open App Data Folder
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* LOGS TAB                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
function LogsTab({ addNotification }: any) {
  const [logs, setLogs] = useState<ServerLogEntry[]>([])
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.catsmapDesktop?.getServerLogs().then(setLogs).catch(() => {})
    window.catsmapDesktop?.onServerLog((entry) => {
      setLogs(prev => {
        const next = [...prev, entry]
        return next.length > 500 ? next.slice(-500) : next
      })
    })
    return () => window.catsmapDesktop?.offServerLog()
  }, [])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const filtered = filter
    ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs

  async function exportLogs() {
    const content = filtered.map(l => `[${l.ts}] ${l.line}`).join('\n')
    const result = await window.catsmapDesktop?.saveDialog({
      defaultPath: 'catsmap-server.log',
      filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
    })
    if (result && !result.canceled && result.filePath) {
      addNotification('💾 Logs exported!')
    }
  }

  if (!window.catsmapDesktop) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(240,230,255,0.3)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
        <p style={{ fontSize: '14px' }}>Logs are only available in the desktop app.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>📋 Server Logs</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '16px' }}>
        Live output from the embedded Rust server process.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          className="chat-input"
          placeholder="🔍 Filter logs…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: 'rgba(240,230,255,0.6)',
          cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
          padding: '0 8px',
        }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            style={{ accentColor: '#a855f7' }}
          />
          Auto-scroll
        </label>
        <button
          className="btn-ghost"
          onClick={() => setLogs([])}
          style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
        >
          🧹 Clear
        </button>
        <button
          className="btn-ghost"
          onClick={exportLogs}
          style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
        >
          💾 Export
        </button>
      </div>

      {/* Log viewer */}
      <div style={{
        flex: 1,
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        overflow: 'auto',
        padding: '12px',
        fontFamily: 'JetBrains Mono, "Fira Code", monospace',
        fontSize: '12px',
        lineHeight: 1.6,
      }}>
        {filtered.length === 0 ? (
          <div style={{ color: 'rgba(240,230,255,0.3)', textAlign: 'center', padding: '20px' }}>
            No log entries yet.
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '1px' }}>
              <span style={{ color: 'rgba(240,230,255,0.25)', flexShrink: 0, fontSize: '11px' }}>
                {entry.ts.slice(11, 19)}
              </span>
              <span style={{ color: logColor(entry.line), wordBreak: 'break-all' }}>
                {entry.line}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.25)', marginTop: '6px' }}>
        {filtered.length} line{filtered.length !== 1 ? 's' : ''}{filter ? ` (filtered from ${logs.length})` : ''}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SETTINGS TAB                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */
function SettingsTab({ currentUser, networkName: initialNetworkName, addNotification }: any) {
  const [loading, setLoading] = useState(false)

  // Network-level settings
  const [netName, setNetName] = useState(initialNetworkName)

  // Desktop app settings (only when in Electron)
  const [dsSettings, setDsSettings] = useState<DesktopSettings | null>(null)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    setNetName(initialNetworkName)
  }, [initialNetworkName])

  useEffect(() => {
    window.catsmapDesktop?.getSettings().then(setDsSettings).catch(() => {})
  }, [])

  async function handleSaveNetwork() {
    if (!netName.trim() || netName.trim() === initialNetworkName) return
    setLoading(true)
    try {
      await renameNetwork(currentUser.id, netName.trim())
      addNotification(`📝 Network renamed to "${netName}"`)
    } catch { addNotification('❌ Failed to rename network') }
    finally { setLoading(false) }
  }

  async function handleSaveDesktop() {
    if (!dsSettings || !window.catsmapDesktop) return
    if (!dsSettings.networkName.trim()) { addNotification('⚠️ Network name cannot be empty'); return }
    if (dsSettings.serverPort < 1024 || dsSettings.serverPort > 65535) {
      addNotification('⚠️ Port must be 1024–65535'); return
    }
    setLoading(true)
    try {
      const res = await window.catsmapDesktop.saveSettings(dsSettings)
      if (res.ok) {
        addNotification('💾 Desktop settings saved!')
        if (res.restart_needed) {
          setRestarting(true)
          await window.catsmapDesktop.restartServer()
          setTimeout(() => {
            window.location.href = `http://localhost:${dsSettings.serverPort}`
          }, 3500)
        }
      }
    } catch { addNotification('❌ Failed to save desktop settings') }
    finally { setLoading(false) }
  }

  if (restarting) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'float 2s ease-in-out infinite' }}>🔄</div>
        <h3 style={{ fontWeight: 900, fontSize: '20px', color: '#f0e6ff', marginBottom: '8px' }}>Restarting Server…</h3>
        <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.5)' }}>
          Reconnecting on port <strong style={{ color: '#d946ef' }}>{dsSettings?.serverPort}</strong>…
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '6px' }}>⚙️ Settings</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '24px' }}>
        Network preferences and application configuration.
      </p>

      {/* Network settings */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
          🌐 Network
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="chat-input"
            value={netName}
            onChange={e => setNetName(e.target.value)}
            placeholder="My CatsMap Network"
            style={{ flex: 1, padding: '10px 14px', fontSize: '14px' }}
          />
          <button
            className="btn-primary"
            onClick={handleSaveNetwork}
            disabled={loading || !netName.trim() || netName.trim() === initialNetworkName}
            style={{ padding: '10px 18px', fontSize: '13px', flexShrink: 0 }}
          >
            {loading ? '⏳' : 'Save'}
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(240,230,255,0.3)', marginTop: '8px' }}>
          This name is shown to all users on the network.
        </p>
      </div>

      {/* Desktop-only settings */}
      {window.catsmapDesktop && dsSettings && (
        <div style={{
          background: 'rgba(168,85,247,0.07)',
          border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(240,230,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            🖥️ Desktop App
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(240,230,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Server Port
              </label>
              <input
                className="chat-input"
                type="number"
                value={dsSettings.serverPort}
                onChange={e => setDsSettings({ ...dsSettings, serverPort: Number(e.target.value) })}
                min={1024} max={65535}
                style={{ width: '160px', padding: '10px 14px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '11px', color: 'rgba(240,230,255,0.3)', marginTop: '4px' }}>
                Changing the port will restart the server.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {([
                ['minimizeToTray', 'Minimize to system tray on close'],
                ['autoStart',      'Launch CatsMap at login'],
              ] as const).map(([key, label]) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  fontSize: '14px', color: 'rgba(240,230,255,0.75)',
                  cursor: 'pointer', userSelect: 'none', fontWeight: 600,
                }}>
                  <input
                    type="checkbox"
                    checked={!!(dsSettings as any)[key]}
                    onChange={e => setDsSettings({ ...dsSettings, [key]: e.target.checked })}
                    style={{ accentColor: '#a855f7', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={handleSaveDesktop}
            disabled={loading || restarting}
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
          >
            {loading ? '⏳ Saving…' : '💾 Apply & Restart Server'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ACCOUNTS TAB — managed username/password logins                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
function AccountsTab({ currentUser, addNotification }: { currentUser: { id: string }; addNotification: (m: string) => void }) {
  const [accounts, setAccounts] = useState<Array<{ id: string; username: string; display_name: string; avatar_emoji: string; is_admin: boolean }>>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    try {
      setAccounts(await listAccounts(currentUser.id))
    } catch {
      addNotification('❌ Failed to load accounts')
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    try {
      await createAccount(currentUser.id, username.trim(), password, displayName || username, '🐱', false)
      addNotification(`✅ Account "${username}" created`)
      setUsername('')
      setPassword('')
      setDisplayName('')
      refresh()
    } catch (err) {
      addNotification(`❌ ${err instanceof Error ? err.message : 'Create failed'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#f0e6ff', marginBottom: '8px' }}>🔐 User Accounts</h2>
      <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.45)', marginBottom: '24px', lineHeight: 1.5 }}>
        Create username/password accounts for your network. The bootstrap admin is set in start.sh.
      </p>

      <form onSubmit={handleCreate} style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px', padding: '20px', marginBottom: '24px',
      }}>
        <h3 style={{ fontWeight: 800, fontSize: '14px', color: '#e9d5ff', marginBottom: '14px' }}>Create account</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <input className="chat-input" placeholder="Username (login)" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '10px' }} />
          <input className="chat-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px' }} />
        </div>
        <input className="chat-input" placeholder="Display name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '12px' }} />
        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Creating...' : '+ Create Account'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {accounts.map(acc => (
          <div key={acc.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px', padding: '12px 16px',
          }}>
            <span style={{ fontSize: '24px' }}>{acc.avatar_emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#f0e6ff' }}>{acc.display_name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(240,230,255,0.4)' }}>@{acc.username}{acc.is_admin ? ' · admin' : ''}</div>
            </div>
            <button
              className="btn-ghost"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={async () => {
                const pw = prompt(`New password for ${acc.username}:`)
                if (!pw) return
                try {
                  await resetAccountPassword(currentUser.id, acc.id, pw)
                  addNotification(`🔑 Password reset for ${acc.username}`)
                } catch {
                  addNotification('❌ Reset failed')
                }
              }}
            >🔑</button>
            {!acc.is_admin && (
              <button
                className="btn-ghost"
                style={{ padding: '6px 10px', fontSize: '12px', color: '#f87171' }}
                onClick={async () => {
                  if (!confirm(`Delete account ${acc.username}?`)) return
                  try {
                    await deleteAccount(currentUser.id, acc.id)
                    addNotification(`🗑 Deleted ${acc.username}`)
                    refresh()
                  } catch {
                    addNotification('❌ Delete failed')
                  }
                }}
              >🗑</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
