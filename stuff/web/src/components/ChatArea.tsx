import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { getMessages, getPinnedMessages, uploadFile, uploadFiles, formatFileSize, exportChannel } from '../api'
import { MessageBubble } from './MessageBubble'
import { Attachment, Message, MessageType } from '../types'
import { useDropzone } from 'react-dropzone'
import { normalizeMessage } from '../utils/message'

interface Props {
  send: (msg: object) => void
  onMobileMenuOpen?: () => void
  onMobileMembersOpen?: () => void
}

export function ChatArea({ send, onMobileMenuOpen, onMobileMembersOpen }: Props) {
  const {
    channels, activeChannelId, activeDmUserId, messages,
    setMessages, dmConversations, typingUsers, currentUser,
    onlineUsers, replyTo, setReplyTo, pinnedByChannel,
  } = useStore()

  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [forwarding, setForwarding] = useState<Message | null>(null)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const lastReadRef = useRef<string | null>(null)

  const inputRef2 = useRef(input)
  const activeChannelIdRef = useRef(activeChannelId)
  const activeDmUserIdRef = useRef(activeDmUserId)
  const pendingFilesRef = useRef(pendingFiles)
  const replyToRef = useRef(replyTo)
  const forwardingRef = useRef(forwarding)
  const sendRef = useRef(send)

  useEffect(() => { inputRef2.current = input }, [input])
  useEffect(() => { activeChannelIdRef.current = activeChannelId }, [activeChannelId])
  useEffect(() => { activeDmUserIdRef.current = activeDmUserId }, [activeDmUserId])
  useEffect(() => { pendingFilesRef.current = pendingFiles }, [pendingFiles])
  useEffect(() => { replyToRef.current = replyTo }, [replyTo])
  useEffect(() => { forwardingRef.current = forwarding }, [forwarding])
  useEffect(() => { sendRef.current = send }, [send])

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const activeDm = activeDmUserId ? dmConversations[activeDmUserId] : null
  const channelMessages = activeChannelId ? (messages[activeChannelId] ?? []) : []
  const dmMessages = activeDm?.messages ?? []
  const rootMessages = (activeDm ? dmMessages : channelMessages).filter(m => !m.thread_parent_id)
  const displayMessages = rootMessages
  const channelTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : []
  const pinned = activeChannelId ? (pinnedByChannel[activeChannelId] ?? []) : []

  useEffect(() => {
    if (!activeChannelId) return
    getMessages(activeChannelId).then(msgs =>
      setMessages(activeChannelId, msgs.map(normalizeMessage))
    )
    getPinnedMessages(activeChannelId).then(msgs =>
      useStore.getState().setPinned(activeChannelId, msgs.map(normalizeMessage))
    )
  }, [activeChannelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages.length])

  useEffect(() => {
    const last = displayMessages[displayMessages.length - 1]
    if (last && activeChannelId && last.id !== lastReadRef.current) {
      lastReadRef.current = last.id
      sendRef.current({ type: 'mark_read', channel_id: activeChannelId, message_id: last.id })
    }
  }, [displayMessages.length, activeChannelId])

  function sendTyping() {
    const chId = activeChannelIdRef.current
    if (!chId) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendRef.current({ type: 'typing', channel_id: chId })
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false
      sendRef.current({ type: 'stop_typing', channel_id: chId })
    }, 2000)
  }

  async function sendWithAttachment(
    uploaded: { url: string; filename: string; mime_type: string; size: number },
    caption: string,
    chId: string | null,
    dmId: string | null,
    currentSend: (msg: object) => void,
  ) {
    const mimeType = uploaded.mime_type
    let msgType: MessageType = 'file'
    if (mimeType.startsWith('image/')) msgType = 'image'
    else if (mimeType.startsWith('video/')) msgType = 'video'
    else if (mimeType.startsWith('audio/')) msgType = 'audio'

    const attachment: Attachment = {
      url: uploaded.url,
      filename: uploaded.filename,
      mime_type: mimeType,
      size: uploaded.size,
    }

    const reply = replyToRef.current
    const fwd = forwardingRef.current

    if (dmId) {
      currentSend({
        type: 'direct_message',
        recipient_id: dmId,
        content: caption || uploaded.filename,
        attachment,
        reply_to_id: reply?.id ?? null,
      })
    } else if (chId) {
      currentSend({
        type: 'send_message',
        channel_id: chId,
        content: caption || uploaded.filename,
        message_type: msgType,
        attachment,
        reply_to_id: reply?.id ?? null,
        thread_parent_id: null,
        forward_from_channel: fwd ? fwd.channel_id : null,
        forward_message_id: fwd?.id ?? null,
      })
    }
  }

  async function handleSend() {
    const text = inputRef2.current.trim()
    const chId = activeChannelIdRef.current
    const dmId = activeDmUserIdRef.current
    const files = pendingFilesRef.current
    const currentSend = sendRef.current

    if (files.length > 0) {
      setUploading(true)
      setUploadProgress(0)
      try {
        const uploads = files.length === 1
          ? [await uploadFile(files[0], setUploadProgress)]
          : await uploadFiles(files, setUploadProgress)

        for (const uploaded of uploads) {
          await sendWithAttachment(uploaded, text, chId, dmId, currentSend)
        }
        setPendingFiles([])
        setInput('')
        setReplyTo(null)
        setForwarding(null)
      } catch {
        useStore.getState().addNotification('❌ Upload failed')
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
      return
    }

    if (!text) return

    const reply = replyToRef.current
    const fwd = forwardingRef.current

    if (dmId) {
      currentSend({
        type: 'direct_message',
        recipient_id: dmId,
        content: text,
        attachment: null,
        reply_to_id: reply?.id ?? null,
      })
    } else if (chId) {
      currentSend({
        type: 'send_message',
        channel_id: chId,
        content: text,
        message_type: 'text',
        attachment: null,
        reply_to_id: reply?.id ?? null,
        thread_parent_id: null,
        forward_from_channel: fwd ? fwd.channel_id : null,
        forward_message_id: fwd?.id ?? null,
      })
    }

    setInput('')
    setReplyTo(null)
    setForwarding(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    isTypingRef.current = false
    if (typingTimer.current) clearTimeout(typingTimer.current)
    if (chId) currentSend({ type: 'stop_typing', channel_id: chId })
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) imageFiles.push(f)
      }
    }
    if (imageFiles.length) {
      e.preventDefault()
      setPendingFiles(prev => [...prev, ...imageFiles])
    }
  }

  async function startVoiceRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setPendingFiles([file])
        setRecording(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      useStore.getState().addNotification('❌ Microphone access denied')
    }
  }

  function stopVoiceRecord() {
    mediaRecorderRef.current?.stop()
  }

  async function handleExport(format: 'json' | 'txt') {
    if (!activeChannelId) return
    try {
      const blob = await exportChannel(activeChannelId, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `channel-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      useStore.getState().addNotification('❌ Export failed')
    }
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (files) => {
      const valid = files.filter(f => f.size <= 100 * 1024 * 1024)
      if (valid.length < files.length) {
        useStore.getState().addNotification('❌ Some files too large (max 100MB)')
      }
      if (valid.length) setPendingFiles(prev => [...prev, ...valid])
    },
    noClick: true,
    noKeyboard: true,
    multiple: true,
    maxSize: 100 * 1024 * 1024,
  })

  const headerTitle = activeDm
    ? `${activeDm.avatar_emoji} ${activeDm.username}`
    : activeChannel ? `# ${activeChannel.name}` : '# ...'

  const headerSub = activeDm ? 'Direct Message' : (activeChannel?.description ?? '')
  const readOnly = activeChannel?.permissions?.read_only && !currentUser?.is_admin

  if (!activeChannelId && !activeDmUserId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(240,230,255,0.3)' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🐱</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Pick a channel to start chatting</div>
        </div>
      </div>
    )
  }

  return (
    <div {...getRootProps()} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', minWidth: 0 }}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(168,85,247,0.18)', backdropFilter: 'blur(4px)',
          border: '2px dashed rgba(168,85,247,0.6)', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>📎</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#e9d5ff' }}>Drop files to share</div>
          </div>
        </div>
      )}

      <div style={{
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        background: 'rgba(13,10,26,0.6)', backdropFilter: 'blur(12px)',
      }}>
        <button
          className="mobile-menu-btn"
          onClick={onMobileMenuOpen}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: '#f0e6ff' }}>{headerTitle}</div>
          {headerSub && <div style={{ fontSize: '12px', color: 'rgba(240,230,255,0.45)' }}>{headerSub}</div>}
        </div>
        <div style={{ flex: 1 }} />
        {activeChannelId && (
          <button onClick={() => handleExport('json')} className="btn-ghost mobile-hide-export" style={{ padding: '6px 10px', fontSize: '11px' }} title="Export">
            💾
          </button>
        )}
        <div className="mobile-hide-online" style={{ fontSize: '12px', color: 'rgba(240,230,255,0.45)' }}>
          {onlineUsers.length} online
        </div>
        <button
          className="mobile-members-btn"
          onClick={onMobileMembersOpen}
          aria-label="Open members"
          title={`${onlineUsers.length} online`}
        >
          👥
          {onlineUsers.length > 0 && (
            <span className="mobile-members-count">{onlineUsers.length}</span>
          )}
        </button>
      </div>

      {pinned.length > 0 && (
        <div style={{
          padding: '8px 20px', background: 'rgba(168,85,247,0.08)',
          borderBottom: '1px solid rgba(168,85,247,0.2)', fontSize: '12px',
        }}>
          <span style={{ fontWeight: 700, color: '#c084fc' }}>📌 Pinned: </span>
          {pinned.map(p => (
            <span key={p.id} style={{ color: 'rgba(240,230,255,0.6)', marginRight: '12px' }}>
              {p.author_name}: {p.content.slice(0, 60)}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {displayMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(240,230,255,0.3)', marginTop: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🐾</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>No messages yet — say hello!</div>
          </div>
        )}

        {displayMessages.map((msg, i) => {
          const prev = displayMessages[i - 1]
          const grouped = !!prev
            && prev.author_id === msg.author_id
            && prev.message_type !== 'system'
            && msg.message_type !== 'system'
            && (new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5 * 60 * 1000
          return (
            <MessageBubble
              key={msg.id}
              message={normalizeMessage(msg)}
              isOwn={msg.author_id === currentUser?.id}
              grouped={grouped}
              send={send}
              onReply={setReplyTo}
              onForward={setForwarding}
            />
          )
        })}

        {channelTyping.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', color: 'rgba(240,230,255,0.5)', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
            <span>{channelTyping.slice(0, 3).join(', ')} typing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {(replyTo || forwarding) && (
        <div style={{
          margin: '0 20px 8px', padding: '8px 12px',
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>{forwarding ? '➡ Forwarding' : '↩ Replying to'} {(replyTo ?? forwarding)?.author_name}</span>
          <button onClick={() => { setReplyTo(null); setForwarding(null) }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>✕</button>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div style={{ margin: '0 20px 8px' }}>
          {pendingFiles.map((f, i) => (
            <div key={i} style={{
              padding: '8px 12px', marginBottom: '4px',
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
            }}>
              <span>📎 {f.name}</span>
              <span style={{ color: 'rgba(240,230,255,0.45)' }}>{formatFileSize(f.size)}</span>
              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {uploading && uploadProgress > 0 && (
        <div style={{ margin: '0 20px 8px' }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#a855f7', transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.45)', marginTop: '4px' }}>Uploading {uploadProgress}%</div>
        </div>
      )}

      <div style={{
        padding: '12px 20px 16px', flexShrink: 0,
        background: 'rgba(13,10,26,0.6)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        {readOnly ? (
          <div style={{ textAlign: 'center', color: 'rgba(240,230,255,0.4)', fontSize: '13px', padding: '8px' }}>
            📖 This channel is read-only
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button type="button" onClick={open} style={iconBtn}>📎</button>
            <button
              type="button"
              onMouseDown={startVoiceRecord}
              onMouseUp={stopVoiceRecord}
              onTouchStart={startVoiceRecord}
              onTouchEnd={stopVoiceRecord}
              style={{ ...iconBtn, background: recording ? 'rgba(239,68,68,0.2)' : iconBtn.background }}
              title="Hold to record voice"
            >🎤</button>
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => { setInput(e.target.value); sendTyping() }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={activeDm ? `Message ${activeDm.username}... (supports **bold**, @mentions)` : `Message #${activeChannel?.name}...`}
              rows={1}
              style={{ flex: 1, padding: '10px 14px', fontSize: '14px', resize: 'none', maxHeight: '120px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
            />
            <button type="button" onClick={handleSend}
              disabled={uploading || (!input.trim() && pendingFiles.length === 0)}
              className="btn-primary"
              style={{ padding: '10px 16px', fontSize: '18px', opacity: uploading ? 0.5 : 1 }}
            >
              {uploading ? '⏳' : '🐾'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontSize: '18px', flexShrink: 0,
}
