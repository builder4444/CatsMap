import { useState } from 'react'
import { useStore } from '../store'
import { kickUser, promoteUser, demoteUser } from '../api'
import type { UserStatus } from '../types'

function statusColor(status: UserStatus = 'online') {
  switch (status) {
    case 'away': return '#fbbf24'
    case 'busy': return '#f87171'
    case 'offline': return '#6b7280'
    default: return '#34d399'
  }
}

interface Props {
  send: (msg: object) => void
  onMobileClose?: () => void
}

export function MemberList({ send, onMobileClose }: Props) {
  const { onlineUsers, currentUser, setActiveDmUserId, addNotification } = useStore()
  const [loading, setLoading] = useState<string | null>(null)

  const sorted = [...onlineUsers].sort((a, b) => {
    if (a.is_admin && !b.is_admin) return -1
    if (!a.is_admin && b.is_admin) return 1
    return a.username.localeCompare(b.username)
  })

  function openDM(userId: string) {
    if (userId === currentUser?.id) return
    setActiveDmUserId(userId)
  }

  return (
    <div className="member-list-panel" style={{
      width: '220px',
      flexShrink: 0,
      height: '100%',
      background: 'rgba(13,10,26,0.75)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: 'rgba(240,230,255,0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Online — {sorted.length}
          </div>
          <button className="member-list-close-btn" onClick={onMobileClose} aria-label="Close members">✕</button>
        </div>
        {currentUser && (
          <select
            className="chat-input"
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
            defaultValue={currentUser.status ?? 'online'}
            onChange={e => send({ type: 'set_status', status: e.target.value, custom_status: currentUser.custom_status })}
          >
            <option value="online">🟢 Online</option>
            <option value="away">🟡 Away</option>
            <option value="busy">🔴 Busy</option>
          </select>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {sorted.map(user => {
          const isSelf = user.id === currentUser?.id
          const isCurrentUserAdmin = currentUser?.is_admin
          const showAdminActions = isCurrentUserAdmin && !isSelf

          async function handleKick() {
            if (!currentUser || isSelf) return
            if (!window.confirm(`Kick ${user.username}? They'll be disconnected from the network.`)) return
            setLoading(user.id)
            try {
              await kickUser(currentUser.id, user.id)
              addNotification(`👢 Kicked ${user.username}`)
            } catch {
              addNotification('❌ Failed to kick user')
            } finally {
              setLoading(null)
            }
          }

          async function handlePromote(promote = true) {
            if (!currentUser || isSelf) return
            const action = promote ? 'promote' : 'demote'
            const message = promote
              ? `Promote ${user.username} to admin? They'll gain admin privileges.`
              : `Demote ${user.username}? They'll lose admin privileges.`
            if (!window.confirm(message)) return
            setLoading(user.id)
            try {
              if (promote) {
                await promoteUser(currentUser.id, user.id)
                addNotification(`⭐ Promoted ${user.username} to admin`)
              } else {
                await demoteUser(currentUser.id, user.id)
                addNotification(`⬇️ Demoted ${user.username}`)
              }
            } catch {
              addNotification(`❌ Failed to ${action} user`)
            } finally {
              setLoading(null)
            }
          }

          return (
            <div
              key={user.id}
              onClick={() => !isSelf && openDM(user.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 8px',
                borderRadius: '8px',
                cursor: isSelf ? 'default' : 'pointer',
                transition: 'background 0.12s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isSelf) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Avatar with online dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  className="avatar"
                  style={{
                    width: '32px', height: '32px',
                    background: user.color + '25',
                    border: `2px solid ${user.color}50`,
                    fontSize: '16px',
                  }}
                >
                  {user.avatar_emoji}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '-1px', right: '-1px',
                  width: '10px', height: '10px',
                  borderRadius: '50%',
                  background: statusColor(user.status),
                  border: '2px solid #0d0a1a',
                }} title={user.custom_status || user.status}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: isSelf ? 700 : 500,
                  color: isSelf ? '#e9d5ff' : 'rgba(240,230,255,0.75)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {user.username}
                  {isSelf && <span style={{ fontSize: '10px', color: 'rgba(240,230,255,0.35)' }}>(you)</span>}
                </div>
                {user.custom_status ? (
                  <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.4)' }}>{user.custom_status}</div>
                ) : user.is_admin ? (
                  <div style={{ fontSize: '10px', color: '#d946ef', fontWeight: 700 }}>⭐ Admin</div>
                ) : null}
              </div>

              {/* Admin actions or DM hint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {showAdminActions && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleKick(); }}
                      disabled={loading === user.id}
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '6px',
                        width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        flexShrink: 0,
                        opacity: loading === user.id ? 0.5 : 1,
                      }}
                      title="Kick user"
                    >
                      {loading === user.id ? '⏳' : '👢'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePromote(!user.is_admin); }}
                      disabled={loading === user.id}
                      style={{
                        background: user.is_admin ? 'rgba(234,179,8,0.2)' : 'rgba(168,85,247,0.2)',
                        border: user.is_admin ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(168,85,247,0.3)',
                        borderRadius: '6px',
                        width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px',
                        color: user.is_admin ? '#eab308' : '#d946ef',
                        cursor: 'pointer',
                        flexShrink: 0,
                        opacity: loading === user.id ? 0.5 : 1,
                      }}
                      title={user.is_admin ? "Demote from admin" : "Promote to admin"}
                    >
                      {loading === user.id ? '⏳' : (user.is_admin ? '⬇️' : '⭐')}
                    </button>
                  </>
                )}
                {!isSelf && !showAdminActions && (
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(240,230,255,0.2)',
                    fontWeight: 600,
                    padding: '4px',
                  }}>
                    💬
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(240,230,255,0.25)', fontSize: '12px', padding: '20px 8px' }}>
            No one else online yet 😿
          </div>
        )}
      </div>
    </div>
  )
}
