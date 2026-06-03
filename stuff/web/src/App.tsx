import { useEffect, useState } from 'react'
import { useStore, loadSession } from './store'
import { LandingScreen } from './components/LandingScreen'
import { ChatApp } from './components/ChatApp'
import { NotificationStack } from './components/NotificationStack'
import { rejoinNetwork, getMessages, getOnlineUsers } from './api'
import { normalizeMessage } from './utils/message'

type RestoreState = 'checking' | 'ready'

export default function App() {
  const currentUser = useStore(s => s.currentUser)
  const { setCurrentUser, setNetwork, setChannels, setActiveChannelId,
          setMessages, setOnlineUsers, addNotification } = useStore()
  const [restoreState, setRestoreState] = useState<RestoreState>('checking')

  // On first load: check if we have a saved session and try to rejoin silently
  useEffect(() => {
    async function tryRestore() {
      const session = loadSession()
      if (!session?.currentUser?.id) {
        setRestoreState('ready')
        return
      }

      try {
        const result = await rejoinNetwork(session.currentUser.id)
        if (result.found && result.user) {
          // Server still has us — restore the session
          setCurrentUser(result.user)
          setNetwork(result.network_id, result.network_name)
          setChannels(result.channels)

          // Restore last active channel (prefer saved, fallback to first)
          const channelToLoad = session.activeChannelId
            ?? result.channels[0]?.id
            ?? null
          if (channelToLoad) setActiveChannelId(channelToLoad)

          // Reload users and messages in background
          getOnlineUsers().then(setOnlineUsers).catch(() => {})
          if (channelToLoad) {
            getMessages(channelToLoad).then(msgs => {
              setMessages(channelToLoad, msgs.map(normalizeMessage))
            }).catch(() => {})
          }

          addNotification('🐾 Welcome back!')
        } else {
          // Server doesn't know us (e.g. server restarted) — need to re-join
          useStore.getState().resetStore()
        }
      } catch {
        // Network error — show landing, let user re-join
        useStore.getState().resetStore()
      }

      setRestoreState('ready')
    }

    tryRestore()
  }, [])

  if (restoreState === 'checking') {
    return (
      <>
        <div className="bg-orbs" />
        <div style={{
          position: 'relative', zIndex: 1, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'float 2s ease-in-out infinite' }}>
              🐱
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(240,230,255,0.4)', fontWeight: 600 }}>
              Reconnecting...
            </div>
          </div>
        </div>
        <NotificationStack />
      </>
    )
  }

  return (
    <>
      <div className="bg-orbs" />
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
        {currentUser ? <ChatApp /> : <LandingScreen />}
      </div>
      <NotificationStack />
    </>
  )
}
