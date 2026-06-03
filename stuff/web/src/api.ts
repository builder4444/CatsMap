import { Channel, Message, OnlineUser, User, CustomEmoji, AccountInfo } from './types'

const BASE = '/api'

export async function login(username: string, password: string): Promise<{
  user: User
  network_id: string
  network_name: string
  channels: Channel[]
  is_admin: boolean
  custom_emojis: CustomEmoji[]
}> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status === 401) throw new Error('Invalid username or password')
  if (!res.ok) throw new Error('Failed to connect')
  return res.json()
}

/** @deprecated use login */
export const joinNetwork = login

export async function getMessages(channelId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/messages/${channelId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getPinnedMessages(channelId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/messages/${channelId}/pinned`)
  if (!res.ok) return []
  return res.json()
}

export async function searchMessages(query: string, limit = 50): Promise<Message[]> {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  if (!res.ok) return []
  return res.json()
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
  const res = await fetch(`${BASE}/online-users`)
  if (!res.ok) return []
  return res.json()
}

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{
  url: string
  filename: string
  mime_type: string
  size: number
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file, file.name)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Invalid response'))
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.open('POST', `${BASE}/upload`)
    xhr.send(form)
  })
}

export async function uploadFiles(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<Array<{ url: string; filename: string; mime_type: string; size: number }>> {
  const results = []
  for (let i = 0; i < files.length; i++) {
    const pct = (i / files.length) * 100
    const r = await uploadFile(files[i], (p) => {
      if (onProgress) onProgress(Math.round(pct + p / files.length))
    })
    results.push(r)
  }
  return results
}

export async function generateShareCode(): Promise<{ code: string; network_id: string }> {
  const res = await fetch(`${BASE}/share-code/generate`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to generate code')
  return res.json()
}

export async function connectShareCode(code: string, remoteUrl: string): Promise<{
  success: boolean
  message: string
}> {
  const res = await fetch(`${BASE}/share-code/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, remote_url: remoteUrl }),
  })
  if (!res.ok) throw new Error('Connection failed')
  return res.json()
}

export async function rejoinNetwork(userId: string): Promise<{
  found: boolean
  user: User | null
  network_id: string
  network_name: string
  channels: Channel[]
}> {
  const res = await fetch(`${BASE}/rejoin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) return { found: false, user: null, network_id: '', network_name: '', channels: [] }
  return res.json()
}

export async function getNetworkInfo() {
  const res = await fetch(`${BASE}/network-info`)
  if (!res.ok) return null
  return res.json()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function exportChannel(channelId: string, format: 'json' | 'txt' = 'json') {
  const res = await fetch(`${BASE}/messages/${channelId}/export?format=${format}`)
  if (!res.ok) throw new Error('Export failed')
  return res.blob()
}

export async function updateProfile(data: {
  user_id: string
  display_name?: string
  avatar_emoji?: string
  bio?: string
  custom_status?: string
}) {
  const res = await fetch(`${BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update profile')
  return res.json()
}

// ── Admin API ────────────────────────────────────────────────────────────────

export async function renameNetwork(requesterId: string, newName: string) {
  const res = await fetch(`${BASE}/admin/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, name: newName }),
  })
  if (!res.ok) throw new Error('Failed to rename network')
  return res.json()
}

export async function kickUser(requesterId: string, targetId: string) {
  const res = await fetch(`${BASE}/admin/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, target_id: targetId }),
  })
  if (!res.ok) throw new Error('Failed to kick user')
  return res.json()
}

export async function promoteUser(requesterId: string, targetId: string) {
  const res = await fetch(`${BASE}/admin/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, target_id: targetId }),
  })
  if (!res.ok) throw new Error('Failed to promote user')
  return res.json()
}

export async function demoteUser(requesterId: string, targetId: string) {
  const res = await fetch(`${BASE}/admin/demote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, target_id: targetId }),
  })
  if (!res.ok) throw new Error('Failed to demote user')
  return res.json()
}

export async function createChannel(
  requesterId: string,
  name: string,
  description?: string,
  category?: string,
  readOnly?: boolean,
  adminOnly?: boolean,
): Promise<Channel> {
  const res = await fetch(`${BASE}/admin/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester_id: requesterId,
      name,
      description,
      category,
      read_only: readOnly,
      admin_only: adminOnly,
    }),
  })
  if (!res.ok) throw new Error('Failed to create channel')
  return res.json()
}

export async function deleteChannel(requesterId: string, channelId: string) {
  const res = await fetch(`${BASE}/admin/channels/${channelId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId }),
  })
  if (!res.ok) throw new Error('Failed to delete channel')
  return res.json()
}

export async function listAccounts(requesterId: string): Promise<AccountInfo[]> {
  const res = await fetch(`${BASE}/admin/accounts?requester_id=${encodeURIComponent(requesterId)}`)
  if (!res.ok) throw new Error('Failed to list accounts')
  return res.json()
}

export async function createAccount(
  requesterId: string,
  username: string,
  password: string,
  displayName?: string,
  avatarEmoji?: string,
  isAdmin?: boolean,
) {
  const res = await fetch(`${BASE}/admin/accounts/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester_id: requesterId,
      username,
      password,
      display_name: displayName,
      avatar_emoji: avatarEmoji,
      is_admin: isAdmin,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || 'Failed to create account')
  }
  return res.json()
}

export async function deleteAccount(requesterId: string, accountId: string) {
  const res = await fetch(`${BASE}/admin/accounts/${accountId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId }),
  })
  if (!res.ok) throw new Error('Failed to delete account')
  return res.json()
}

export async function resetAccountPassword(requesterId: string, accountId: string, newPassword: string) {
  const res = await fetch(`${BASE}/admin/accounts/${accountId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, new_password: newPassword }),
  })
  if (!res.ok) throw new Error('Failed to reset password')
  return res.json()
}

export async function pinMessage(requesterId: string, channelId: string, messageId: string) {
  const res = await fetch(`${BASE}/admin/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, channel_id: channelId, message_id: messageId }),
  })
  if (!res.ok) throw new Error('Failed to pin')
  return res.json()
}

export async function unpinMessage(requesterId: string, channelId: string, messageId: string) {
  const res = await fetch(`${BASE}/admin/unpin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: requesterId, channel_id: channelId, message_id: messageId }),
  })
  if (!res.ok) throw new Error('Failed to unpin')
  return res.json()
}
