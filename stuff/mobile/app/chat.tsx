import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, router } from 'expo-router'

interface Message {
  id: string
  author: string
  emoji: string
  color: string
  content: string
  time: string
  isSystem?: boolean
}

const COLORS = ['#f472b6','#a78bfa','#34d399','#60a5fa','#fb923c']

export default function ChatScreen() {
  const { serverUrl, username, emoji } = useLocalSearchParams<{
    serverUrl: string; username: string; emoji: string
  }>()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [channels, setChannels] = useState<any[]>([])
  const [activeChannel, setChannel] = useState<any>(null)
  const [userId, setUserId]     = useState('')
  const [userColor]             = useState(COLORS[Math.floor(Math.random() * COLORS.length)])
  const wsRef = useRef<WebSocket | null>(null)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    joinAndConnect()
    return () => wsRef.current?.close()
  }, [])

  async function joinAndConnect() {
    try {
      const res = await fetch(`${serverUrl}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatar_emoji: emoji }),
      })
      const data = await res.json()
      setUserId(data.user.id)
      setChannels(data.channels)
      if (data.channels.length > 0) {
        setChannel(data.channels[0])
        loadMessages(data.channels[0].id)
      }

      // Connect WebSocket
      const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws?user_id=${data.user.id}`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'new_message') {
          setMessages(prev => [...prev, {
            id: msg.message.id,
            author: msg.message.author_name,
            emoji: msg.message.author_emoji,
            color: msg.message.author_color,
            content: msg.message.content,
            time: new Date(msg.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: msg.message.message_type === 'system',
          }])
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
        }
      }
    } catch (err) {
      console.error('Connection failed', err)
    }
  }

  async function loadMessages(channelId: string) {
    try {
      const res = await fetch(`${serverUrl}/api/messages/${channelId}`)
      const data = await res.json()
      setMessages(data.map((m: any) => ({
        id: m.id,
        author: m.author_name,
        emoji: m.author_emoji,
        color: m.author_color,
        content: m.content,
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: m.message_type === 'system',
      })))
    } catch {}
  }

  function sendMessage() {
    const text = input.trim()
    if (!text || !activeChannel || !wsRef.current) return
    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      channel_id: activeChannel.id,
      content: text,
      message_type: 'text',
      attachment: null,
    }))
    setInput('')
  }

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.isSystem) {
      return (
        <View style={styles.systemMsg}>
          <Text style={styles.systemMsgText}>{item.content}</Text>
        </View>
      )
    }
    return (
      <View style={styles.msgRow}>
        <View style={[styles.avatar, { backgroundColor: item.color + '30', borderColor: item.color + '60' }]}>
          <Text style={styles.avatarEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.msgContent}>
          <View style={styles.msgHeader}>
            <Text style={[styles.msgAuthor, { color: item.color }]}>{item.author}</Text>
            <Text style={styles.msgTime}>{item.time}</Text>
          </View>
          <Text style={styles.msgText}>{item.content}</Text>
        </View>
      </View>
    )
  }

  return (
    <LinearGradient colors={['#0d0a1a', '#130f24']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerName}>
              {activeChannel ? `# ${activeChannel.name}` : 'Connecting...'}
            </Text>
            <Text style={styles.headerNetwork}>CatsMap</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: userColor + '30', borderColor: userColor + '60', width: 32, height: 32 }]}>
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
          </View>
        </View>

        {/* Channel tabs */}
        {channels.length > 0 && (
          <View style={styles.channelBar}>
            {channels.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => { setChannel(c); loadMessages(c.id) }}
                style={[styles.channelTab, activeChannel?.id === c.id && styles.channelTabActive]}
              >
                <Text style={[styles.channelTabText, activeChannel?.id === c.id && styles.channelTabTextActive]}>
                  #{c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={`Message ${activeChannel ? '#' + activeChannel.name : '...'}...`}
              placeholderTextColor="rgba(240,230,255,0.35)"
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <Text style={styles.sendBtnText}>🐾</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(13,10,26,0.7)',
  },
  backBtn: { padding: 4, marginRight: 8 },
  backBtnText: { fontSize: 20, color: '#c4b5fd' },
  headerTitle: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '800', color: '#f0e6ff' },
  headerNetwork: { fontSize: 11, color: 'rgba(240,230,255,0.45)' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: 18 },
  channelBar: {
    flexDirection: 'row',
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(13,10,26,0.5)',
  },
  channelTab: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  channelTabActive: { backgroundColor: 'rgba(168,85,247,0.22)' },
  channelTabText:  { fontSize: 12, fontWeight: '600', color: 'rgba(240,230,255,0.55)' },
  channelTabTextActive: { color: '#f0e6ff', fontWeight: '800' },
  messageList: { padding: 14, gap: 4 },
  msgRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  msgContent: { flex: 1 },
  msgHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  msgAuthor: { fontSize: 13, fontWeight: '700' },
  msgTime: { fontSize: 10, color: 'rgba(240,230,255,0.35)' },
  msgText: { fontSize: 14, color: 'rgba(240,230,255,0.9)', lineHeight: 20 },
  systemMsg: { alignItems: 'center', paddingVertical: 6 },
  systemMsgText: {
    fontSize: 12, color: 'rgba(240,230,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: 99,
  },
  inputRow: {
    flexDirection: 'row', gap: 8,
    padding: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(13,10,26,0.8)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, color: '#f0e6ff',
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#d946ef',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 20 },
})
