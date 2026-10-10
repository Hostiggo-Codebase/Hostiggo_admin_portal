import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { io, Socket } from 'socket.io-client'
import { supabase } from '../lib/supabase'

type DemoUser = {
  id: string
  name: string
  email: string
  phone: string
}

type SupportMessage = {
  id: string
  ticket_id: string
  sender_id: string
  sender_type: 'user' | 'agent' | 'system'
  body: string
  is_internal_note?: boolean
  created_at: string
}

const DEMO_USERS: DemoUser[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98765 43210' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91 91234 56789' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Vikram Malhotra', email: 'vikram.m@example.com', phone: '+91 99887 76655' },
]

const STARTERS = [
  'Hi! I need help with my booking.',
  'I want to report an issue.',
  'Can someone help me with payment?',
  'I need help from support.',
]

const DEFAULT_CATEGORY_ID = 'ca222222-2222-2222-2222-222222222222'
const ACTIVE_STATUSES = ['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_ON_USER', 'REOPENED']

function getSocketUrl(): string {
  return process.env.EXPO_PUBLIC_SOCKET_URL || 'https://hostiggoadminportal-production.up.railway.app'
}

function getAdminApiUrl(): string {
  if (process.env.EXPO_PUBLIC_ADMIN_API_URL) return process.env.EXPO_PUBLIC_ADMIN_API_URL
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return 'http://localhost:3000'
  return 'https://hostiggoadminportal-production.up.railway.app'
}

let socketInstance: Socket | null = null

function getSupportSocket(): Socket {
  if (!socketInstance) {
    const socketUrl = getSocketUrl()
    console.log('[SupportDummy2] Connecting socket:', socketUrl)
    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketInstance.on('connect', () => {
      console.log('[SupportDummy2] Connected:', {
        id: socketInstance?.id,
        transport: socketInstance?.io.engine.transport.name,
      })
    })

    socketInstance.on('disconnect', (reason) => {
      console.warn('[SupportDummy2] Disconnected:', reason)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('[SupportDummy2] Connect error:', err.message)
    })
  }
  return socketInstance
}

function normalizeUser(user: any, fallbackName = ''): DemoUser {
  return {
    id: user.user_id || user.id,
    name: user.name || user.display_name || fallbackName,
    email: user.email,
    phone: user.phone || '',
  }
}

export default function MainAppStyleSupportDummy() {
  const [activeUser, setActiveUser] = useState<DemoUser>(DEMO_USERS[0])
  const [customUsers, setCustomUsers] = useState<DemoUser[]>([])
  const [showLogin, setShowLogin] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStartingChat, setIsStartingChat] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const appendMessage = (message: SupportMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev
      return [...prev, message].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    })
  }

  const loadMessages = async (id: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.log('[SupportDummy2] message load failed:', error.message)
      return
    }
    setMessages((data || []).filter((msg) => !msg.is_internal_note))
  }

  const ensureSupportTicketFromSupabase = async (user: DemoUser) => {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()

    if (!existingUser) {
      await supabase.from('users').insert({
        user_id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      })
    }

    const { data: activeTickets, error: activeError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)

    if (activeError) throw activeError

    let ticket = activeTickets?.[0]
    if (!ticket) {
      const { data: newTicket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          category_id: DEFAULT_CATEGORY_ID,
          subject: 'App Support Chat',
          description: 'Support chat started from the mobile app.',
          priority_label: 'General',
          priority: 3,
          status: 'QUEUED',
        })
        .select()
        .single()

      if (ticketError) throw ticketError
      ticket = newTicket
    }

    setTicketId(ticket.ticket_id)
    setTicketNumber(ticket.ticket_number || null)
    await loadMessages(ticket.ticket_id)
  }

  const ensureSupportTicket = async (user: DemoUser) => {
    setIsStartingChat(true)
    try {
      const response = await fetch(`${getAdminApiUrl()}/api/mobile/start-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to start support chat')

      setTicketId(result.ticket_id)
      setTicketNumber(result.ticket?.ticket_number || null)
      await loadMessages(result.ticket_id)
    } catch (error) {
      console.log('[SupportDummy2] start-chat API fallback:', error)
      await ensureSupportTicketFromSupabase(user)
    } finally {
      setIsStartingChat(false)
    }
  }

  useEffect(() => {
    const socket = getSupportSocket()
    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    setIsConnected(socket.connected)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  useEffect(() => {
    setTicketId(null)
    setTicketNumber(null)
    setMessages([])
    ensureSupportTicket(activeUser)
  }, [activeUser])

  useEffect(() => {
    if (!ticketId) return

    const socket = getSupportSocket()
    const joinTicket = () => {
      console.log('[SupportDummy2] Joining ticket room:', ticketId)
      socket.emit('join_ticket', { ticket_id: ticketId })
    }

    const handleNewMessage = (msg: SupportMessage) => {
      if (!msg || msg.ticket_id !== ticketId || msg.is_internal_note) return
      appendMessage(msg)
    }

    const handleGlobalActivity = (event: any) => {
      const msg = event?.message as SupportMessage | undefined
      if (event?.ticket_id !== ticketId || !msg || msg.is_internal_note) return
      appendMessage(msg)
    }

    socket.on('new_message', handleNewMessage)
    socket.on('global_chat_activity', handleGlobalActivity)
    socket.on('connect', joinTicket)
    if (socket.connected) joinTicket()
    else socket.connect()

    loadMessages(ticketId)

    return () => {
      socket.emit('leave_ticket', { ticket_id: ticketId })
      socket.off('new_message', handleNewMessage)
      socket.off('global_chat_activity', handleGlobalActivity)
      socket.off('connect', joinTicket)
    }
  }, [ticketId])

  useEffect(() => {
    const socket = getSupportSocket()

    const handleReady = ({ ticket_id, ticket, message }: any) => {
      if (ticket?.user_id && ticket.user_id !== activeUser.id) return
      if (ticket_id) setTicketId(ticket_id)
      if (ticket?.ticket_number) setTicketNumber(ticket.ticket_number)
      if (message && !message.is_internal_note) appendMessage(message)
    }

    const handleError = ({ error }: any) => {
      console.error('[SupportDummy2] send_message_error:', error)
    }

    socket.on('support_chat_ready', handleReady)
    socket.on('send_message_error', handleError)
    return () => {
      socket.off('support_chat_ready', handleReady)
      socket.off('send_message_error', handleError)
    }
  }, [activeUser])

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const socket = getSupportSocket()
    if (!socket.connected) socket.connect()

    socket.emit('send_message', {
      ticket_id: ticketId || undefined,
      sender_id: activeUser.id,
      sender_type: 'user',
      body: trimmed,
      email: activeUser.email,
      name: activeUser.name,
      phone: activeUser.phone,
    })
  }

  const handleSend = () => {
    if (!messageText.trim()) return
    sendMessage(messageText)
    setMessageText('')
  }

  const formatTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleLogin = async () => {
    const email = loginEmail.trim().toLowerCase()
    const name = loginName.trim()
    const phone = loginPhone.trim() || ''

    if (!email || !name) {
      console.warn('[SupportDummy2] name and email are required')
      return
    }

    setIsLoggingIn(true)
    try {
      let user: any = null
      const { data: byEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (byEmail) {
        user = byEmail
        const userId = byEmail.user_id || byEmail.id
        const { data: updatedUser } = await supabase
          .from('users')
          .update({ name, phone: phone || null })
          .eq(byEmail.user_id ? 'user_id' : 'id', userId)
          .select()
          .maybeSingle()
        if (updatedUser) user = updatedUser
      } else {
        let authUserId: string | null = null

        const { data: signInRes } = await supabase.auth.signInWithPassword({
          email,
          password: 'Password123!',
        })
        if (signInRes?.user?.id) {
          authUserId = signInRes.user.id
        }

        if (!authUserId) {
          const { data: signUpRes } = await supabase.auth.signUp({
            email,
            password: 'Password123!',
          })
          if (signUpRes?.user?.id) {
            authUserId = signUpRes.user.id
          }
        }

        const insertPayload: any = {
          name,
          email,
          phone: phone || null,
        }
        if (authUserId) insertPayload.user_id = authUserId

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(insertPayload)
          .select()
          .single()

        if (insertError) {
          const { data: conflictedUser } = await supabase
            .from('users')
            .select('*')
            .eq(authUserId ? 'user_id' : 'email', authUserId || email)
            .maybeSingle()
          if (!conflictedUser) throw insertError
          user = conflictedUser
        } else {
          user = insertedUser
        }
      }

      const normalized = normalizeUser(user, name)
      setCustomUsers((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== normalized.id)
        return [normalized, ...withoutCurrent]
      })
      setActiveUser(normalized)
      setShowLogin(false)
      setLoginName('')
      setLoginEmail('')
      setLoginPhone('')
    } catch (error: any) {
      console.error('[SupportDummy2] login failed:', error?.message || error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.userStrip}>
          {[...customUsers, ...DEMO_USERS].map((user) => (
            <TouchableOpacity
              key={user.id}
              style={[styles.userChip, activeUser.id === user.id && styles.userChipActive]}
              onPress={() => setActiveUser(user)}
            >
              <Text style={[styles.userChipText, activeUser.id === user.id && styles.userChipTextActive]}>
                {user.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.userChip, styles.loginChip]}
            onPress={() => setShowLogin((value) => !value)}
          >
            <Text style={[styles.userChipText, styles.loginChipText]}>+ Login</Text>
          </TouchableOpacity>
        </View>

        {showLogin && (
          <View style={styles.loginPanel}>
            <Text style={styles.loginTitle}>Login / Register Test User</Text>
            <TextInput
              style={styles.loginInput}
              value={loginName}
              onChangeText={setLoginName}
              placeholder="Name"
              placeholderTextColor="#8b98a8"
            />
            <TextInput
              style={styles.loginInput}
              value={loginEmail}
              onChangeText={setLoginEmail}
              placeholder="Email"
              placeholderTextColor="#8b98a8"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.loginInput}
              value={loginPhone}
              onChangeText={setLoginPhone}
              placeholder="Phone optional"
              placeholderTextColor="#8b98a8"
            />
            <TouchableOpacity
              style={[styles.loginButton, isLoggingIn && styles.sendButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoggingIn}
            >
              <Text style={styles.loginButtonText}>{isLoggingIn ? 'Saving...' : 'Use This User'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>H</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Hostiggo Support</Text>
            <Text style={styles.subtitle}>
              {ticketNumber || (isStartingChat ? 'Starting chat...' : 'Support chat')} | {isConnected ? 'Live' : 'Reconnecting...'}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {isStartingChat && messages.length === 0 ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#008BDF" />
              <Text style={styles.centerText}>Connecting to support...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.starters}>
              <Text style={styles.startersTitle}>Start the conversation</Text>
              {STARTERS.map((starter) => (
                <TouchableOpacity key={starter} style={styles.starterChip} onPress={() => sendMessage(starter)}>
                  <Text style={styles.starterText}>{starter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            messages.map((message) => {
              const isUser = message.sender_id === activeUser.id || message.sender_type === 'user'
              return (
                <View key={message.id} style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowSupport]}>
                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.supportBubble]}>
                    <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.supportMessageText]}>
                      {message.body}
                    </Text>
                    {!isUser && <Text style={styles.supportFooter}>- Hostiggo Support</Text>}
                  </View>
                  <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampSupport]}>
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message"
            placeholderTextColor="#8b98a8"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim()}
          >
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  userStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f5',
  },
  userChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8e1ea',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  userChipActive: {
    borderColor: '#008BDF',
    backgroundColor: '#EAF7FF',
  },
  userChipText: {
    color: '#526173',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  userChipTextActive: {
    color: '#005f99',
  },
  loginChip: {
    flex: 0.7,
    borderColor: '#008BDF',
    backgroundColor: '#008BDF',
  },
  loginChipText: {
    color: '#fff',
  },
  loginPanel: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f5',
    backgroundColor: '#fff',
  },
  loginTitle: {
    color: '#152536',
    fontSize: 14,
    fontWeight: '800',
  },
  loginInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e1ea',
    paddingHorizontal: 12,
    color: '#152536',
    backgroundColor: '#f8fafc',
  },
  loginButton: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008BDF',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f5',
    backgroundColor: '#fff',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008BDF',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#152536',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#637284',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    padding: 16,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  centerText: {
    color: '#637284',
    fontSize: 14,
  },
  starters: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  startersTitle: {
    color: '#637284',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  starterChip: {
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8e1ea',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '92%',
  },
  starterText: {
    color: '#213245',
    fontSize: 14,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 14,
    maxWidth: '82%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowSupport: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#edf1f5',
  },
  supportBubble: {
    backgroundColor: '#008BDF',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userMessageText: {
    color: '#152536',
  },
  supportMessageText: {
    color: '#fff',
  },
  supportFooter: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
  },
  timestampUser: {
    color: '#8b98a8',
    textAlign: 'right',
  },
  timestampSupport: {
    color: '#8b98a8',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    borderTopWidth: 1,
    borderTopColor: '#edf1f5',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    backgroundColor: '#f5f8fb',
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#152536',
    fontSize: 15,
  },
  sendButton: {
    height: 42,
    minWidth: 68,
    borderRadius: 21,
    backgroundColor: '#008BDF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
})
