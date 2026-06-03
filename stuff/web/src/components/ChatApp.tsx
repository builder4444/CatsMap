import { useEffect, useState } from 'react'
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id)
    }
  }, [channels])

  useEffect(() => {
    const poll = async () => {
      const users = await getOnlineUsers()
      setOnlineUsers(users)
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [])

  function closeMobileSidebar() {
    setMobileSidebarOpen(false)
  }

  return (
    <div className={`chat-app-layout${mobileSidebarOpen ? ' mobile-sidebar-open' : ''}`}>
      {mobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={closeMobileSidebar} />
      )}
      <Sidebar send={send} onMobileClose={closeMobileSidebar} />
      <ChatArea send={send} onMobileMenuOpen={() => setMobileSidebarOpen(true)} />
      <MemberList send={send} />
      {searchOpen && (
        <MessageSearch
          onClose={() => setSearchOpen(false)}
          onSelectMessage={(msg) => {
            if (msg.channel_id.startsWith('dm_')) return
            setActiveChannelId(msg.channel_id)
            closeMobileSidebar()
          }}
        />
      )}
    </div>
  )
}
