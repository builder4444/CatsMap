import { useState } from 'react'
import { Message } from '../types'
import { formatFileSize, pinMessage, unpinMessage } from '../api'
import { format, isToday, isYesterday } from 'date-fns'
import { useStore } from '../store'
import { MarkdownContent } from '../utils/markdown'

interface Props {
  message: Message
  isOwn: boolean
  grouped?: boolean
  send: (msg: object) => void
  onReply: (msg: Message) => void
  onForward?: (msg: Message) => void
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🐱']

function formatTime(ts: string) {
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

export function MessageBubble({ message, isOwn, grouped, send, onReply, onForward }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const [showActions, setShowActions] = useState(false)
  const { currentUser, networkId, customEmojis, readReceipts, activeChannelId } = useStore()

  if (message.message_type === 'system') {
    return (
      <div className="message-enter" style={{ textAlign: 'center', padding: '6px 12px', margin: '4px 0' }}>
        <span style={{
          fontSize: '12px', color: 'rgba(240,230,255,0.35)', fontWeight: 600,
          background: 'rgba(255,255,255,0.04)', padding: '3px 12px', borderRadius: '99px',
        }}>
          {message.content}
        </span>
      </div>
    )
  }

  const readers = activeChannelId
    ? (readReceipts[activeChannelId]?.[message.id] ?? [])
    : []

  function toggleReaction(emoji: string) {
    const existing = message.reactions.find(r => r.emoji === emoji)
    const hasMine = existing?.user_ids.includes(currentUser?.id ?? '')
    send({
      type: hasMine ? 'remove_reaction' : 'add_reaction',
      message_id: message.id,
      channel_id: message.channel_id,
      emoji,
    })
  }

  function saveEdit() {
    if (editText.trim() && editText !== message.content) {
      send({
        type: 'edit_message',
        message_id: message.id,
        channel_id: message.channel_id,
        content: editText.trim(),
      })
    }
    setEditing(false)
  }

  function deleteMsg() {
    if (confirm('Delete this message?')) {
      send({ type: 'delete_message', message_id: message.id, channel_id: message.channel_id })
    }
  }

  async function handlePin() {
    if (!currentUser?.is_admin || !activeChannelId) return
    try {
      if (message.pinned) {
        await unpinMessage(currentUser.id, activeChannelId, message.id)
      } else {
        await pinMessage(currentUser.id, activeChannelId, message.id)
      }
    } catch {
      useStore.getState().addNotification('❌ Pin failed')
    }
  }

  return (
    <>
      <div
        className="message-enter"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        style={{
          display: 'flex', gap: '10px', padding: grouped ? '2px 0' : '6px 0',
          alignItems: 'flex-start', position: 'relative',
        }}
      >
        <div style={{ width: '36px', flexShrink: 0, paddingTop: '2px' }}>
          {!grouped && (
            <div className="avatar tooltip" data-tip={message.author_name} style={{
              width: '36px', height: '36px',
              background: message.author_color + '25',
              border: `2px solid ${message.author_color}50`,
              fontSize: '18px',
            }}>
              {message.author_emoji}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!grouped && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: message.author_color }}>
                {message.author_name}
              </span>
              {message.pinned && <span title="Pinned">📌</span>}
              {message.forwarded_from && (
                <span style={{ fontSize: '10px', color: 'rgba(240,230,255,0.4)' }}>
                  ↪ {message.forwarded_from}
                </span>
              )}
              {message.network_id && message.network_id !== networkId && message.author_network_name && (
                <span style={{
                  fontSize: '10px', background: 'rgba(168,85,247,0.2)', color: '#d946ef',
                  padding: '1px 6px', borderRadius: '6px', fontWeight: 700,
                }}>
                  🌉 {message.author_network_name}
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'rgba(240,230,255,0.35)', fontWeight: 500 }}>
                {formatTime(message.timestamp)}
                {message.edited && ' (edited)'}
              </span>
            </div>
          )}

          {message.reply_preview && (
            <div style={{
              borderLeft: '3px solid rgba(168,85,247,0.5)',
              paddingLeft: '10px', marginBottom: '6px',
              fontSize: '12px', color: 'rgba(240,230,255,0.5)',
            }}>
              <strong>{message.reply_preview.author_name}</strong>
              <div style={{ opacity: 0.8 }}>{message.reply_preview.content}</div>
            </div>
          )}

          {editing ? (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <textarea
                className="chat-input"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '14px', minHeight: '60px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveEdit} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Save</button>
                <button onClick={() => setEditing(false)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }}>Cancel</button>
              </div>
            </div>
          ) : message.content && !message.deleted && (
            <div style={{
              fontSize: '14px', lineHeight: '1.5',
              color: 'rgba(240,230,255,0.9)', wordBreak: 'break-word', margin: 0,
            }}>
              <MarkdownContent text={message.content} />
            </div>
          )}

          {message.deleted && (
            <p style={{ fontSize: '13px', color: 'rgba(240,230,255,0.35)', fontStyle: 'italic', margin: 0 }}>
              [message deleted]
            </p>
          )}

          {message.attachment && !message.deleted && (
            <div style={{ marginTop: message.content ? '6px' : '0' }}>
              <AttachmentPreview
                attachment={message.attachment}
                messageType={message.message_type}
                onLightbox={setLightboxUrl}
              />
            </div>
          )}

          {message.reactions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {message.reactions.map(r => (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(r.emoji)}
                  style={{
                    background: r.user_ids.includes(currentUser?.id ?? '')
                      ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '2px 8px', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  {r.emoji} {r.user_ids.length}
                </button>
              ))}
            </div>
          )}

          {readers.length > 0 && isOwn && (
            <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.3)', marginTop: '4px' }}>
              Seen by {readers.length}
            </div>
          )}
        </div>

        {showActions && !message.deleted && (
          <div style={{
            position: 'absolute', right: '8px', top: '0',
            display: 'flex', gap: '4px', background: 'rgba(13,10,26,0.95)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px',
          }}>
            {QUICK_REACTIONS.map(e => (
              <button key={e} onClick={() => toggleReaction(e)} style={actionBtn}>{e}</button>
            ))}
            <button onClick={() => onReply(message)} style={actionBtn} title="Reply">↩</button>
            {onForward && (
              <button onClick={() => onForward(message)} style={actionBtn} title="Forward">➡</button>
            )}
            {isOwn && (
              <>
                <button onClick={() => { setEditText(message.content); setEditing(true) }} style={actionBtn}>✏️</button>
                <button onClick={deleteMsg} style={actionBtn}>🗑️</button>
              </>
            )}
            {currentUser?.is_admin && activeChannelId && (
              <button onClick={handlePin} style={actionBtn}>{message.pinned ? '📌' : '📍'}</button>
            )}
          </div>
        )}
      </div>

      {lightboxUrl && (
        <div className="modal-backdrop" onClick={() => setLightboxUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={lightboxUrl} alt="Full size" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </>
  )
}

const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px 6px',
}

function AttachmentPreview({ attachment, messageType, onLightbox }: {
  attachment: NonNullable<Message['attachment']>
  messageType: Message['message_type']
  onLightbox: (url: string) => void
}) {
  if (messageType === 'image') {
    return (
      <div className="media-thumb" onClick={() => onLightbox(attachment.url)} style={{ display: 'inline-block' }}>
        <img src={attachment.url} alt={attachment.filename}
          style={{ maxWidth: '320px', maxHeight: '240px', display: 'block', borderRadius: '10px' }} loading="lazy" />
      </div>
    )
  }
  if (messageType === 'video') {
    return (
      <div style={{ maxWidth: '380px', borderRadius: '10px', overflow: 'hidden' }}>
        <video controls style={{ width: '100%', borderRadius: '10px', background: '#000' }} preload="metadata">
          <source src={attachment.url} type={attachment.mime_type} />
        </video>
      </div>
    )
  }
  if (messageType === 'audio') {
    return (
      <div style={{
        background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: '10px', padding: '12px', maxWidth: '360px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🎵</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e9d5ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {attachment.filename}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>{formatFileSize(attachment.size)}</span>
        </div>
        <audio controls style={{ width: '100%' }}>
          <source src={attachment.url} type={attachment.mime_type} />
        </audio>
      </div>
    )
  }
  return (
    <a href={attachment.url} download={attachment.filename} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '10px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', maxWidth: '300px',
      }}>
        <span style={{ fontSize: '24px' }}>📎</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e9d5ff' }}>{attachment.filename}</div>
          <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.4)' }}>{formatFileSize(attachment.size)} · Download</div>
        </div>
      </div>
    </a>
  )
}
