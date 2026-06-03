import { useState } from 'react'
import { useStore } from '../store'
import { ShareCodeModal } from './ShareCodeModal'
import { AdminPanel } from './AdminPanel'
import { DesktopSettingsModal } from './DesktopSettingsModal'

interface Props {
  send: (msg: object) => void
  onMobileClose?: () => void
}

export function Sidebar({ send, onMobileClose }: Props) {
  const {
    networkName, channels, activeChannelId, setActiveChannelId,
    activeDmUserId, dmConversations, unreadCounts, currentUser, setSearchOpen,
  } = useStore()
  const [showShareCode, setShowShareCode] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showDesktopSettings, setShowDesktopSettings] = useState(false)

  const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name))
  const dmList = Object.values(dmConversations)
  const categories = [...new Set(sortedChannels.map(c => c.category || 'Channels'))]

  function handleChannelClick(channelId: string) {
    setActiveChannelId(channelId)
    onMobileClose?.()
  }

  function handleDmClick(userId: string) {
    useStore.getState().setActiveDmUserId(userId)
    onMobileClose?.()
  }

  function renderChannel(channel: typeof channels[0]) {
    const unread = unreadCounts[channel.id] ?? 0
    const isActive = activeChannelId === channel.id
    return (
      <div
        key={channel.id}
        className={`channel-item ${isActive ? 'active' : ''}`}
        onClick={() => handleChannelClick(channel.id)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', gap: '6px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ color: 'rgba(240,230,255,0.4)', fontSize: '15px' }}>#</span>
          <span style={{ fontSize: '14px', fontWeight: isActive ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {channel.name}
          </span>
          {channel.permissions?.read_only && <span title="Read-only">📖</span>}
        </div>
        {unread > 0 && !isActive && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
      </div>
    )
  }

  return (
    <>
      <div className="sidebar-panel">

        {/* Network header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #d946ef, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}>
              🗺️
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 800, fontSize: '14px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                color: '#f0e6ff',
              }}>
                {networkName || 'My Network'}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.45)', fontWeight: 500 }}>
                LAN Network 🐾
              </div>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={onMobileClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '8px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(240,230,255,0.45)', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            🔍 Search messages...
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 800, color: 'rgba(240,230,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 8px 4px',
              }}>
                {cat}
              </div>
              {sortedChannels.filter(c => (c.category || 'Channels') === cat).map(renderChannel)}
            </div>
          ))}

          {dmList.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'rgba(240,230,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '8px 8px 4px',
              }}>
                Direct Messages
              </div>
              {dmList.map(dm => {
                const isActive = activeDmUserId === dm.userId
                return (
                  <div
                    key={dm.userId}
                    className={`channel-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleDmClick(dm.userId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div className="avatar" style={{
                        width: '22px', height: '22px',
                        background: dm.color + '30',
                        fontSize: '13px',
                      }}>
                        {dm.avatar_emoji}
                      </div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: isActive ? 700 : 500,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {dm.username}
                      </span>
                    </div>
                    {dm.unread > 0 && !isActive && (
                      <span className="unread-badge">{dm.unread}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* User footer */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {currentUser && (
            <>
              <div className="avatar" style={{
                width: '32px', height: '32px',
                background: currentUser.color + '30',
                border: `2px solid ${currentUser.color}60`,
                fontSize: '18px',
                flexShrink: 0,
              }}>
                {currentUser.avatar_emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px', fontWeight: 700,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: '#f0e6ff',
                }}>
                  {currentUser.username}
                </div>
                {currentUser.is_admin && (
                  <div style={{ fontSize: '10px', color: '#d946ef', fontWeight: 700 }}>
                    ⭐ Admin
                  </div>
                )}
              </div>

              {currentUser.is_admin && (
                <>
                  <button
                    onClick={() => setShowAdminPanel(true)}
                    className="tooltip"
                    data-tip="Admin Panel"
                    style={{
                      background: 'rgba(251,146,60,0.2)',
                      border: '1px solid rgba(251,146,60,0.3)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#fb923c',
                      flexShrink: 0,
                    }}
                  >
                    ⭐
                  </button>
                  <button
                    onClick={() => setShowShareCode(true)}
                    className="tooltip"
                    data-tip="Share Code"
                    style={{
                      background: 'rgba(168,85,247,0.2)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#d946ef',
                      flexShrink: 0,
                    }}
                  >
                    🔗
                  </button>
                </>
              )}
              {window.catsmapDesktop && (
                <button
                  onClick={() => setShowDesktopSettings(true)}
                  className="tooltip"
                  data-tip="Server Settings"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'rgba(240,230,255,0.7)',
                    flexShrink: 0,
                  }}
                >
                  ⚙️
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showShareCode && <ShareCodeModal onClose={() => setShowShareCode(false)} />}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {showDesktopSettings && <DesktopSettingsModal onClose={() => setShowDesktopSettings(false)} />}
    </>
  )
}
