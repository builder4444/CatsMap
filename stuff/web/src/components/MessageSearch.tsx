import { useState } from 'react'
import { searchMessages } from '../api'
import { useStore } from '../store'
import { Message } from '../types'
import { normalizeMessage } from '../utils/message'

interface Props {
  onClose: () => void
  onSelectMessage: (msg: Message) => void
}

export function MessageSearch({ onClose, onSelectMessage }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const channels = useStore(s => s.channels)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const msgs = await searchMessages(query.trim())
      setResults(msgs.map(normalizeMessage))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '520px',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <h3 style={{ fontWeight: 800, color: '#e9d5ff', marginBottom: '12px' }}>🔍 Search messages</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            className="chat-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all channels and DMs..."
            style={{ flex: 1, padding: '10px 14px' }}
            autoFocus
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '10px 16px' }}>
            {loading ? '...' : 'Go'}
          </button>
        </form>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.map(msg => {
            const ch = channels.find(c => c.id === msg.channel_id)
            return (
              <div
                key={msg.id}
                onClick={() => { onSelectMessage(msg); onClose() }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  marginBottom: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(240,230,255,0.45)', marginBottom: '4px' }}>
                  {ch ? `#${ch.name}` : 'DM'} · {msg.author_name}
                </div>
                <div style={{ fontSize: '13px', color: '#f0e6ff', wordBreak: 'break-word' }}>
                  {msg.deleted ? '[deleted]' : msg.content.slice(0, 200)}
                </div>
              </div>
            )
          })}
          {results.length === 0 && query && !loading && (
            <div style={{ textAlign: 'center', color: 'rgba(240,230,255,0.35)', padding: '20px' }}>
              No messages found
            </div>
          )}
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ marginTop: '12px', width: '100%', padding: '10px' }}>
          Close
        </button>
      </div>
    </div>
  )
}
