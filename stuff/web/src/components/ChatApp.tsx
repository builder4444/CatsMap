import { useEffect } from 'react'
import { useStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { Sidebar } from './Sidebar'
import { ChatArea } from './ChatArea'
import { MemberList } from './MemberList'
import { getOnlineUsers } from '../api'
import { MessageSearch } from './MessageSearch'

export function ChatApp() {
  const { send } = useWebSocket()
  const { setOnlineUsers, activeChannelId, channels, setActiveChannelId, searchOpen, setSearchOpen } = useStore()

  // Set initial active channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id)
    }
  }, [channels])

  // Poll online users
  useEffect(() => {
    const poll = async () => {
      const users = await getOnlineUsers()
      setOnlineUsers(users)
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Sidebar send={send} />
      <ChatArea send={send} />
      <MemberList send={send} />
      {searchOpen && (
        <MessageSearch
          onClose={() => setSearchOpen(false)}
          onSelectMessage={(msg) => {
            if (msg.channel_id.startsWith('dm_')) return
            setActiveChannelId(msg.channel_id)
          }}
        />
      )}
    </div>
  )
}
