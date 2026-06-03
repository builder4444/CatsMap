import { useStore } from '../store'

export function NotificationStack() {
  const { notifications, clearNotification } = useStore()
  if (notifications.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '8px',
      pointerEvents: 'none',
      maxWidth: '320px',
    }}>
      {notifications.map(n => (
        <div
          key={n.id}
          className="glass"
          onClick={() => clearNotification(n.id)}
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#f0e6ff',
            animation: 'slideIn 0.2s ease-out',
            borderColor: 'rgba(168,85,247,0.3)',
            pointerEvents: 'auto',
            cursor: 'pointer',
            wordBreak: 'break-word',
          }}
        >
          {n.text}
        </div>
      ))}
    </div>
  )
}
