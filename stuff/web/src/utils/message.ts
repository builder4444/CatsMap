import type { Message } from '../types'

export function normalizeMessage(m: Message): Message {
  return {
    ...m,
    reactions: m.reactions ?? [],
    mentions: m.mentions ?? [],
    deleted: m.deleted ?? false,
    pinned: m.pinned ?? false,
    edited: m.edited ?? false,
  }
}
