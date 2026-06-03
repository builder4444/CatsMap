import { create } from 'zustand'
import { User, Channel, Message, OnlineUser, CustomEmoji, UserStatus } from './types'

// ── Session persistence keys ──────────────────────────────────────────────────
const SESSION_KEY = 'catsmap_session'

interface PersistedSession {
  currentUser: User
  networkId: string
  networkName: string
  channels: Channel[]
  activeChannelId: string | null
}

export function saveSession(data: PersistedSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch {}
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSession
  } catch { return null }
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DMConversation {
  userId: string
  username: string
  avatar_emoji: string
  color: string
  messages: Message[]
  unread: number
}

interface AppStore {
  // Auth state
  currentUser: User | null
  setCurrentUser: (u: User) => void

  // Network
  networkId: string
  networkName: string
  setNetwork: (id: string, name: string) => void
  renameNetwork: (name: string) => void

  // Channels
  channels: Channel[]
  setChannels: (c: Channel[]) => void
  addChannel: (channel: Channel) => void
  removeChannel: (channelId: string) => void
  activeChannelId: string | null
  setActiveChannelId: (id: string | null) => void

  // Messages per channel
  messages: Record<string, Message[]>
  addMessage: (msg: Message) => void
  updateMessage: (msg: Message) => void
  removeMessage: (channelId: string, messageId: string) => void
  setMessages: (channelId: string, msgs: Message[]) => void
  unreadCounts: Record<string, number>
  markRead: (channelId: string) => void
  pinnedByChannel: Record<string, Message[]>
  setPinned: (channelId: string, msgs: Message[]) => void
  readReceipts: Record<string, Record<string, string[]>>
  addReadReceipt: (channelId: string, messageId: string, userId: string, username: string) => void

  // Reply / search UI
  replyTo: Message | null
  setReplyTo: (msg: Message | null) => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void

  // Custom emojis
  customEmojis: CustomEmoji[]
  setCustomEmojis: (e: CustomEmoji[]) => void

  // Online users
  onlineUsers: OnlineUser[]
  setOnlineUsers: (u: OnlineUser[]) => void
  addOnlineUser: (u: OnlineUser) => void
  removeOnlineUser: (userId: string) => void
  updateUserAdminStatus: (userId: string, isAdmin: boolean) => void
  updateUserStatus: (userId: string, status: UserStatus, customStatus: string) => void

  // Typing indicators  channelId → username[]
  typingUsers: Record<string, string[]>
  setTyping: (channelId: string, userId: string, username: string) => void
  clearTyping: (channelId: string, userId: string) => void

  // DMs
  dmConversations: Record<string, DMConversation>
  activeDmUserId: string | null
  setActiveDmUserId: (id: string | null) => void
  addDmMessage: (fromUserId: string, msg: Message, fromUser?: { username: string; avatar_emoji: string; color: string }) => void

  // UI state
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  memberListOpen: boolean
  setMemberListOpen: (v: boolean) => void

  // Notifications (toast)
  notifications: Array<{ id: number; text: string }>
  addNotification: (msg: string) => void
  clearNotification: (id: number) => void

  // Session helpers
  persistSession: () => void
  resetStore: () => void
}

let notifCounter = 0

export const useStore = create<AppStore>((set, get) => ({
  currentUser: null,
  setCurrentUser: (u) => {
    set({ currentUser: u })
    get().persistSession()
  },

  networkId:   '',
  networkName: '',
  setNetwork: (id, name) => {
    set({ networkId: id, networkName: name })
    get().persistSession()
  },
  renameNetwork: (name) => {
    set({ networkName: name })
    get().persistSession()
  },

  channels: [],
  setChannels: (c) => {
    set({ channels: c })
    get().persistSession()
  },
  addChannel: (channel) => {
    set((s) => ({ channels: [...s.channels, channel] }))
    get().persistSession()
  },
  removeChannel: (channelId) => {
    set((s) => ({ 
      channels: s.channels.filter(c => c.id !== channelId),
      // If active channel was deleted, switch to first available channel
      activeChannelId: s.activeChannelId === channelId 
        ? (s.channels.find(c => c.id !== channelId)?.id || null)
        : s.activeChannelId
    }))
    get().persistSession()
  },

  activeChannelId: null,
  setActiveChannelId: (id) => {
    set({ activeChannelId: id, activeDmUserId: null })
    if (id) get().markRead(id)
    get().persistSession()
  },

  messages: {},
  addMessage: (msg) => {
    const { messages, activeChannelId, unreadCounts } = get()
    const list = messages[msg.channel_id] ?? []
    if (list.some(m => m.id === msg.id)) return
    const newUnread = msg.channel_id !== activeChannelId
      ? { ...unreadCounts, [msg.channel_id]: (unreadCounts[msg.channel_id] ?? 0) + 1 }
      : unreadCounts
    set({
      messages: { ...messages, [msg.channel_id]: [...list, msg] },
      unreadCounts: newUnread,
    })
  },
  updateMessage: (msg) => {
    const { messages } = get()
    const list = messages[msg.channel_id] ?? []
    set({
      messages: {
        ...messages,
        [msg.channel_id]: list.map(m => m.id === msg.id ? msg : m),
      },
    })
    const { dmConversations } = get()
    const updatedDms: typeof dmConversations = {}
    for (const [k, conv] of Object.entries(dmConversations)) {
      updatedDms[k] = {
        ...conv,
        messages: conv.messages.map(m => m.id === msg.id ? msg : m),
      }
    }
    set({ dmConversations: updatedDms })
  },
  removeMessage: (channelId, messageId) => {
    const { messages } = get()
    const list = messages[channelId] ?? []
    set({
      messages: {
        ...messages,
        [channelId]: list.map(m =>
          m.id === messageId ? { ...m, deleted: true, content: '[message deleted]' } : m
        ),
      },
    })
  },
  setMessages: (channelId, msgs) => {
    set({ messages: { ...get().messages, [channelId]: msgs } })
  },
  pinnedByChannel: {},
  setPinned: (channelId, msgs) => {
    set({ pinnedByChannel: { ...get().pinnedByChannel, [channelId]: msgs } })
  },
  readReceipts: {},
  addReadReceipt: (channelId, messageId, userId, username) => {
    const receipts = get().readReceipts
    const ch = receipts[channelId] ?? {}
    const readers = ch[messageId] ?? []
    if (readers.includes(userId)) return
    set({
      readReceipts: {
        ...receipts,
        [channelId]: { ...ch, [messageId]: [...readers, userId] },
      },
    })
  },
  replyTo: null,
  setReplyTo: (msg) => set({ replyTo: msg }),
  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),
  customEmojis: [],
  setCustomEmojis: (e) => set({ customEmojis: e }),
  unreadCounts: {},
  markRead: (channelId) => {
    const { unreadCounts } = get()
    if (!unreadCounts[channelId]) return
    set({ unreadCounts: { ...unreadCounts, [channelId]: 0 } })
  },

  onlineUsers: [],
  setOnlineUsers: (u) => set({ onlineUsers: u }),
  addOnlineUser: (u) => {
    const existing = get().onlineUsers.filter(x => x.id !== u.id)
    set({
      onlineUsers: [...existing, {
        id: u.id,
        username: u.username,
        avatar_emoji: u.avatar_emoji,
        color: u.color,
        is_admin: u.is_admin,
        status: u.status ?? 'online',
        custom_status: u.custom_status ?? '',
      }],
    })
  },
  updateUserStatus: (userId: string, status: UserStatus, customStatus: string) => {
    set(s => ({
      onlineUsers: s.onlineUsers.map(u =>
        u.id === userId ? { ...u, status, custom_status: customStatus } : u
      ),
    }))
  },
  removeOnlineUser: (userId) => {
    set({ onlineUsers: get().onlineUsers.filter(u => u.id !== userId) })
  },
  updateUserAdminStatus: (userId, isAdmin) => {
    set((s) => ({
      onlineUsers: s.onlineUsers.map(u => 
        u.id === userId ? { ...u, is_admin: isAdmin } : u
      ),
      // Also update currentUser if it's the logged in user
      currentUser: s.currentUser?.id === userId 
        ? { ...s.currentUser, is_admin: isAdmin }
        : s.currentUser
    }))
    get().persistSession()
  },

  typingUsers: {},
  setTyping: (channelId, _userId, username) => {
    const typing = get().typingUsers
    const list = typing[channelId] ?? []
    if (!list.includes(username)) {
      set({ typingUsers: { ...typing, [channelId]: [...list, username] } })
    }
    // Auto-clear after 4s as a safety net
    setTimeout(() => {
      const t = get().typingUsers
      const updated = (t[channelId] ?? []).filter(n => n !== username)
      set({ typingUsers: { ...t, [channelId]: updated } })
    }, 4000)
  },
  clearTyping: (channelId, userId) => {
    const typing = get().typingUsers
    const user = get().onlineUsers.find(u => u.id === userId)
    if (user) {
      const list = (typing[channelId] ?? []).filter(n => n !== user.username)
      set({ typingUsers: { ...typing, [channelId]: list } })
    }
  },

  dmConversations: {},
  activeDmUserId: null,
  setActiveDmUserId: (id) => set({ activeDmUserId: id, activeChannelId: null }),
  addDmMessage: (fromUserId, msg, fromUser) => {
    const { dmConversations, activeDmUserId, currentUser } = get()
    const otherId = msg.author_id === currentUser?.id ? fromUserId : msg.author_id
    const existing = dmConversations[otherId]
    set({
      dmConversations: {
        ...dmConversations,
        [otherId]: {
          userId: otherId,
          username:     fromUser?.username     ?? existing?.username     ?? 'Unknown',
          avatar_emoji: fromUser?.avatar_emoji ?? existing?.avatar_emoji ?? '🐱',
          color:        fromUser?.color        ?? existing?.color        ?? '#a78bfa',
          messages: [...(existing?.messages ?? []), msg],
          unread: activeDmUserId === otherId ? 0 : (existing?.unread ?? 0) + 1,
        },
      },
    })
  },

  sidebarOpen:    true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  memberListOpen:    true,
  setMemberListOpen: (v) => set({ memberListOpen: v }),

  notifications: [],
  addNotification: (text) => {
    const id = ++notifCounter
    set(s => ({ notifications: [...s.notifications, { id, text }] }))
    setTimeout(() => {
      set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
    }, 4500)
  },
  clearNotification: (id) => {
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
  },

  persistSession: () => {
    const { currentUser, networkId, networkName, channels, activeChannelId } = get()
    if (currentUser) {
      saveSession({ currentUser, networkId, networkName, channels, activeChannelId })
    }
  },

  resetStore: () => {
    clearSession()
    set({
      currentUser: null, networkId: '', networkName: '',
      channels: [], activeChannelId: null,
      messages: {}, unreadCounts: {},
      onlineUsers: [], typingUsers: {},
      dmConversations: {}, activeDmUserId: null,
      notifications: [],
      pinnedByChannel: {}, readReceipts: {},
      replyTo: null, searchOpen: false, customEmojis: [],
    })
  },
}))
