import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'

const CAT_EMOJIS = ['🐱','😸','😹','😺','😻','😼','🐈','🐈‍⬛']

export default function ConnectScreen() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.1:3001')
  const [username, setUsername]   = useState('')
  const [emoji, setEmoji]         = useState('🐱')

  async function connect() {
    if (!username.trim() || !serverUrl.trim()) return
    // Navigate to chat (scaffold — full WS logic mirrors web)
    router.push({ pathname: '/chat', params: { serverUrl, username, emoji } })
  }

  return (
    <LinearGradient colors={['#0d0a1a', '#1a0a2e', '#0d0a1a']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <Text style={styles.logo}>🐱</Text>
          <Text style={styles.title}>CatsMap</Text>
          <Text style={styles.subtitle}>Connect to your LAN network</Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.label}>Pick your cat</Text>
            <View style={styles.emojiRow}>
              {CAT_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Cat Name</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. Luna, Mittens..."
              placeholderTextColor="rgba(240,230,255,0.35)"
              maxLength={32}
            />

            <Text style={styles.label}>Server Address</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.x.x:3001"
              placeholderTextColor="rgba(240,230,255,0.35)"
              autoCapitalize="none"
              keyboardType="url"
            />

            <TouchableOpacity
              style={[styles.btn, (!username.trim()) && styles.btnDisabled]}
              onPress={connect}
              disabled={!username.trim()}
            >
              <Text style={styles.btnText}>{emoji} Enter the Map</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>No internet needed — stays on your WiFi 🔒</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  inner:      { flex: 1 },
  scroll:     { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo:       { fontSize: 64, marginBottom: 8 },
  title:      { fontSize: 36, fontWeight: '900', color: '#e879f9', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: 'rgba(240,230,255,0.5)', marginBottom: 28 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(240,230,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  emojiBtn: {
    width: 42, height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: {
    borderColor: 'rgba(168,85,247,0.8)',
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  emojiText:  { fontSize: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#f0e6ff',
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  btn: {
    backgroundColor: '#d946ef',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, color: 'rgba(240,230,255,0.3)', marginTop: 20 },
})
