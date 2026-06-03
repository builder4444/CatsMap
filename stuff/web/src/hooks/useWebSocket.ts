import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { WsServerMessage } from '../types'
import { normalizeMessage } from '../utils/message'

export function useWebSocket() {
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const sendRef = useRef<(msg: object) => void>(() => {})

  const currentUser = useStore(s => s.currentUser)
  const {
    addMessage, updateMessage, removeMessage, addOnlineUser, removeOnlineUser,
    setTyping, clearTyping, addDmMessage, addNotification,
    renameNetwork, addChannel, removeChannel, updateUserAdminStatus,
    updateUserStatus, setPinned, addReadReceipt, setCustomEmojis,
  } = useStore()

  const send = useCallback((msg: object) => {
    sendRef.current(msg)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!currentUser) return

    function connect() {
      if (!mountedRef.current) return

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${protocol}://${location.host}/ws?user_id=${currentUser!.id}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      sendRef.current = (msg: object) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        }
      }

      ws.onopen = () => {
        if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null }
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, 25_000)
      }

      ws.onmessage = (e) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(e.data) as WsServerMessage
          switch (msg.type) {
            case 'new_message':
              addMessage(normalizeMessage(msg.message))
              break
            case 'message_updated':
              updateMessage(normalizeMessage(msg.message))
              break
            case 'message_deleted':
              removeMessage(msg.channel_id, msg.message_id)
              break
            case 'mention':
              addMessage(normalizeMessage(msg.message))
              if (msg.mentioned_user_id === currentUser!.id) {
                addNotification(`📣 You were mentioned by ${msg.message.author_name}`)
              }
              break
            case 'user_joined':
              addOnlineUser({
                id: msg.user.id,
                username: msg.user.username,
                avatar_emoji: msg.user.avatar_emoji,
                color: msg.user.color,
                is_admin: msg.user.is_admin,
                status: msg.user.status ?? 'online',
                custom_status: msg.user.custom_status ?? '',
              })
              addNotification(`${msg.user.avatar_emoji} ${msg.user.username} joined!`)
              break
            case 'user_left':
              removeOnlineUser(msg.user_id)
              addNotification(`${msg.username} left the network`)
              break
            case 'user_status_changed':
              updateUserStatus(msg.user_id, msg.status, msg.custom_status)
              break
            case 'typing':
              setTyping(msg.channel_id, msg.user_id, msg.username)
              break
            case 'stop_typing':
              clearTyping(msg.channel_id, msg.user_id)
              break
            case 'direct_message': {
              const isOwn = msg.message.author_id === currentUser!.id
              const otherUserId = isOwn ? msg.recipient_id : msg.from_user.id
              const otherUser = isOwn
                ? useStore.getState().onlineUsers.find(u => u.id === msg.recipient_id)
                : msg.from_user
              addDmMessage(otherUserId, normalizeMessage(msg.message), otherUser)
              if (!isOwn) {
                addNotification(`💬 DM from ${msg.from_user.avatar_emoji} ${msg.from_user.username}`)
              }
              break
            }
            case 'read_receipt':
              addReadReceipt(msg.channel_id, msg.message_id, msg.user_id, msg.username)
              break
            case 'pinned_messages':
              setPinned(msg.channel_id, msg.messages.map(normalizeMessage))
              break
            case 'network_bridged':
              addNotification(`🌉 Bridged with ${msg.network_name}!`)
              break
            case 'network_renamed':
              renameNetwork(msg.name)
              addNotification(`📝 Network renamed to "${msg.name}"`)
              break
            case 'kicked':
              addNotification(`👢 ${msg.reason}`)
              useStore.getState().resetStore()
              break
            case 'user_promoted':
              updateUserAdminStatus(msg.user_id, true)
              if (msg.user_id === currentUser?.id) {
                addNotification('⭐ You were promoted to admin!')
              }
              break
            case 'channel_created':
              addChannel(msg.channel)
              addNotification(`#️⃣ New channel #${msg.channel.name} created`)
              break
            case 'channel_deleted':
              removeChannel(msg.channel_id)
              addNotification('🗑️ A channel was deleted')
              break
            case 'custom_emojis_updated':
              setCustomEmojis(msg.emojis)
              break
            case 'error':
              addNotification(`❌ ${msg.message}`)
              break
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
        if (mountedRef.current) {
          retryRef.current = setTimeout(connect, 2_000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      mountedRef.current = false
      if (pingRef.current)  clearInterval(pingRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
      wsRef.current?.close()
      sendRef.current = () => {}
    }
  }, [currentUser?.id])

  return { send }
}
