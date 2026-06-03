export type UserStatus = 'online' | 'away' | 'busy' | 'offline'

export interface User {
  id: string
  username: string
  avatar_emoji: string
  color: string
  network_id: string
  is_admin: boolean
  status?: UserStatus
  bio?: string
  custom_status?: string
}

export interface ChannelPermissions {
  read_only: boolean
  admin_only: boolean
}

export interface Channel {
  id: string
  name: string
  description: string
  network_id: string
  category?: string | null
  permissions?: ChannelPermissions
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'audio' | 'system'

export interface Attachment {
  url: string
  filename: string
  mime_type: string
  size: number
  thumbnail_url?: string
}

export interface ReplyPreview {
  id: string
  author_name: string
  content: string
}

export interface Reaction {
  emoji: string
  user_ids: string[]
}

export interface Message {
  id: string
  channel_id: string
  author_id: string
  author_name: string
  author_emoji: string
  author_color: string
  content: string
  message_type: MessageType
  attachment?: Attachment
  timestamp: string
  edited: boolean
  deleted: boolean
  network_id: string
  author_network_name?: string
  reply_to_id?: string | null
  reply_preview?: ReplyPreview | null
  reactions: Reaction[]
  pinned: boolean
  thread_parent_id?: string | null
  mentions: string[]
  forwarded_from?: string | null
}

export interface CustomEmoji {
  id: string
  name: string
  url: string
}

export interface AccountInfo {
  id: string
  username: string
  display_name: string
  avatar_emoji: string
  is_admin: boolean
}

export interface OnlineUser {
  id: string
  username: string
  avatar_emoji: string
  color: string
  is_admin: boolean
  status: UserStatus
  custom_status: string
}

export type WsServerMessage =
  | { type: 'new_message'; message: Message }
  | { type: 'message_updated'; message: Message }
  | { type: 'message_deleted'; message_id: string; channel_id: string }
  | { type: 'mention'; message: Message; mentioned_user_id: string }
  | { type: 'user_joined'; user: User }
  | { type: 'user_left'; user_id: string; username: string }
  | { type: 'user_status_changed'; user_id: string; status: UserStatus; custom_status: string }
  | { type: 'typing'; user_id: string; username: string; channel_id: string }
  | { type: 'stop_typing'; user_id: string; channel_id: string }
  | { type: 'direct_message'; message: Message; from_user: User; recipient_id: string }
  | { type: 'read_receipt'; channel_id: string; message_id: string; user_id: string; username: string }
  | { type: 'pinned_messages'; channel_id: string; messages: Message[] }
  | { type: 'network_bridged'; network_name: string }
  | { type: 'network_renamed'; name: string }
  | { type: 'kicked'; reason: string }
  | { type: 'user_promoted'; user_id: string }
  | { type: 'channel_created'; channel: Channel }
  | { type: 'channel_deleted'; channel_id: string }
  | { type: 'custom_emojis_updated'; emojis: CustomEmoji[] }
  | { type: 'pong' }
  | { type: 'error'; message: string }

export interface DesktopSettings {
  networkName: string
  serverPort: number
  minimizeToTray: boolean
  autoStart: boolean
}

export interface ServerStatus {
  running: boolean
  ready: boolean
  port: number
}

export interface SystemInfo {
  platform: string
  release: string
  arch: string
  hostname: string
  uptime: number
  cpuModel: string
  cpuCores: number
  totalMemMb: number
  freeMemMb: number
  usedMemPct: number
  appVersion: string
  electronVersion: string
  nodeVersion: string
  userData: string
}

export interface ServerLogEntry {
  ts: string
  line: string
}

declare global {
  interface Window {
    catsmapDesktop?: {
      getLanUrls:      () => Promise<Array<{ name: string; url: string }>>
      getSettings:     () => Promise<DesktopSettings>
      saveSettings:    (s: DesktopSettings) => Promise<{ ok: boolean; restart_needed: boolean }>
      restartServer:   () => Promise<{ ok: boolean }>
      stopServer:      () => Promise<{ ok: boolean }>
      getServerStatus: () => Promise<ServerStatus>
      getServerLogs:   () => Promise<ServerLogEntry[]>
      onServerLog:     (cb: (entry: ServerLogEntry) => void) => void
      offServerLog:    () => void
      getSystemInfo:   () => Promise<SystemInfo>
      openConfigDir:   () => Promise<void>
      saveDialog:      (opts: object) => Promise<{ canceled: boolean; filePath?: string }>
      openUrl:         (url: string) => Promise<void>
      minimizeWindow:  () => Promise<void>
      maximizeWindow:  () => Promise<void>
      onAdminTab:      (cb: (tab: string) => void) => void
      offAdminTab:     () => void
      isDesktop: boolean
    }
  }
}
