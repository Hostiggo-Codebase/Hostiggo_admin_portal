import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { io, Socket } from 'socket.io-client'

function getMobileSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000'
  }
  return 'https://hostiggoadminportal-production.up.railway.app'
}

function getAdminApiUrl(): string {
  if (process.env.EXPO_PUBLIC_ADMIN_API_URL) {
    return process.env.EXPO_PUBLIC_ADMIN_API_URL
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000'
  }
  return 'https://hostiggoadminportal-production.up.railway.app'
}

let mobileSocket: Socket | null = null

function getMobileSocket(): Socket {
  if (!mobileSocket) {
    const socketUrl = getMobileSocketUrl()
    console.log('🔌 [Socket.io Mobile] Connecting to WebSocket Server:', socketUrl)

    mobileSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    mobileSocket.on('connect', () => {
      console.log('🟢 [Socket.io Mobile] Connected to Live Socket Server. Messages can arrive via Socket.io now.', {
        id: mobileSocket?.id,
        transport: mobileSocket?.io.engine.transport.name,
      })
    })

    mobileSocket.io.engine.on('upgrade', (transport) => {
      console.log('[Socket.io Mobile] Transport upgraded:', transport.name)
    })

    mobileSocket.on('disconnect', (reason) => {
      console.warn('[Socket.io Mobile] Disconnected from Socket.io server:', reason)
    })

    mobileSocket.io.on('reconnect', (attempt) => {
      console.log('[Socket.io Mobile] Reconnected to Socket.io server after attempt:', attempt)
    })

    mobileSocket.on('connect_error', (err) => {
      console.error('🔴 [Socket.io Mobile] Connection Error:', err.message)
    })

    mobileSocket.on('support_chat_ready', ({ ticket_id, ticket }) => {
      console.log('[Socket.io Mobile] Support chat ready from Socket.io server:', { ticket_id })
    })

    mobileSocket.on('send_message_error', ({ error }) => {
      console.error('[Socket.io Mobile] Server rejected message:', error)
    })
  }
  return mobileSocket
}



// Simulated User Profiles
const DEMO_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98765 43210' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91 91234 56789' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Vikram Malhotra', email: 'vikram.m@example.com', phone: '+91 99887 76655' },
]

const DEMO_BOOKINGS = [
  { id: 'ba111111-1111-1111-1111-111111111111', code: 'HG-BK-8821', title: 'Luxury Villa Goa (3 Nights)' },
  { id: 'ba222222-2222-2222-2222-222222222222', code: 'HG-BK-9043', title: 'Mountain Chalet Manali (2 Nights)' },
]

const CATEGORIES = [
  { id: 'ca111111-1111-1111-1111-111111111111', name: 'Payment' },
  { id: 'ca222222-2222-2222-2222-222222222222', name: 'Booking Help' },
  { id: 'ca333333-3333-3333-3333-333333333333', name: 'Property Issue' },
  { id: 'ca444444-4444-4444-4444-444444444444', name: 'Refund Request' },
]

const DEFAULT_CHAT_CATEGORY_ID = 'ca222222-2222-2222-2222-222222222222'
const ACTIVE_CHAT_STATUSES = ['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_ON_USER', 'REOPENED']

function normalizeUser(user: any, fallbackName = '') {
  return {
    ...user,
    id: user.user_id || user.id,
    name: user.name || user.display_name || fallbackName,
    email: user.email,
    phone: user.phone || '',
  }
}

export default function DummyMobileApp() {
  const [activeUser, setActiveUser] = useState(DEMO_USERS[0])
  const [activeTab, setActiveTab] = useState<'create' | 'tickets' | 'sync'>('tickets')

  // Custom User Login Form State
  const [customUsers, setCustomUsers] = useState<any[]>([])
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Ticket Creation Form State
  const [category, setCategory] = useState(CATEGORIES[0])
  const [priorityLabel, setPriorityLabel] = useState('Booking Help')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(DEMO_BOOKINGS[0])
  const [submitting, setSubmitting] = useState(false)

  // Tickets & Chat State
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')

  // Sync Simulation Log State
  const [syncLogs, setSyncLogs] = useState<string[]>([])

  const handleCustomLogin = async () => {
    if (!loginEmail.trim() || !loginName.trim()) {
      alertError('Email and Name are required for login')
      return
    }

    const email = loginEmail.trim().toLowerCase()
    const name = loginName.trim()
    const phone = loginPhone.trim() || null

    setLoggingIn(true)
    try {
      // 1. Check if user already exists in hostiggo_testing_schema.users / users view
      let existingUser: any = null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (!error && data) {
        existingUser = data
      }

      if (!existingUser) {
        let userId: string | null = null

        // 1. Try to sign in first (if user already registered in auth.users)
        try {
          const { data: signInRes } = await supabase.auth.signInWithPassword({
            email,
            password: 'Password123!',
          })
          if (signInRes?.user?.id) {
            userId = signInRes.user.id
          }
        } catch (e) {
          // Ignore sign in error
        }

        // 2. If sign in didn't return a user ID, sign up
        if (!userId) {
          try {
            const { data: signUpRes } = await supabase.auth.signUp({
              email,
              password: 'Password123!',
            })
            if (signUpRes?.user?.id) {
              userId = signUpRes.user.id
            }
          } catch (e) {
            console.log('Auth signUp note:', e)
          }
        }

        if (userId) {
          const { data: authLinkedUser } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()

          if (authLinkedUser) {
            existingUser = authLinkedUser
          }
        }

        if (!existingUser) {
          // 3. Prepare payload for hostiggo_testing_schema.users table/view.
          const insertPayload: any = {
            email,
            name,
            phone,
          }
          if (userId) {
            insertPayload.user_id = userId
          }

          const { data: newUser, error: insertErr } = await supabase
            .from('users')
            .insert(insertPayload)
            .select()
            .single()

          if (insertErr) {
            const { data: conflictedUser } = await supabase
              .from('users')
              .select('*')
              .eq(userId ? 'user_id' : 'email', userId || email)
              .maybeSingle()

            if (conflictedUser) {
              existingUser = conflictedUser
            } else {
              const { data: emailUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle()

              if (emailUser) {
                existingUser = emailUser
              }
            }

            if (!existingUser) {
              console.error('User insert error:', insertErr.message)
              throw insertErr
            }
          } else {
            existingUser = newUser
          }
        }

        if (existingUser) {
          const existingId = existingUser.user_id || existingUser.id
          const updatePayload: any = { name, phone }

          const { data: updatedUser, error: updateErr } = await supabase
            .from('users')
            .update(updatePayload)
            .eq(existingUser.user_id ? 'user_id' : 'id', existingId)
            .select()
            .maybeSingle()

          if (!updateErr && updatedUser) {
            existingUser = updatedUser
          }
        }
      }

      if (existingUser) {
        existingUser = normalizeUser(existingUser, name)
      } else {
        throw new Error('Could not create or load user')
      }

      setCustomUsers((prev) => [...prev.filter((u) => u.id !== existingUser.id), existingUser])
      setActiveUser(existingUser)
      setShowLoginModal(false)
      setLoginEmail('')
      setLoginName('')
      setLoginPhone('')
      alertSuccess(`Logged in successfully as ${existingUser.name}!`)
    } catch (err: any) {
      alertError(err.message || 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  // Connect Socket.io eagerly on app load
  useEffect(() => {
    getMobileSocket()
  }, [])

  useEffect(() => {
    const socket = getMobileSocket()

    const handleSupportChatReady = ({ ticket_id, ticket, message }: any) => {
      console.log('[Socket.io Mobile] Support chat ready for UI:', { ticket_id })
      if (ticket?.user_id && ticket.user_id !== activeUser.id) {
        console.log('[Socket.io Mobile] Ignoring support chat for inactive user:', {
          ticketUserId: ticket.user_id,
          activeUserId: activeUser.id,
        })
        return
      }
      if (ticket) {
        setSelectedTicket(ticket)
        setTickets((prev) => {
          const withoutCurrent = prev.filter((t) => t.ticket_id !== ticket.ticket_id)
          return [ticket, ...withoutCurrent]
        })
      }
      if (message) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === message.id)) return prev
          return [...prev, message]
        })
      }
      if (ticket_id) {
        fetchTicketMessages(ticket_id)
      }
    }

    socket.on('support_chat_ready', handleSupportChatReady)
    return () => {
      socket.off('support_chat_ready', handleSupportChatReady)
    }
  }, [activeUser])

  // Fetch Tickets for active user
  useEffect(() => {
    setSelectedTicket(null)
    setMessages([])
    setTickets([])
    ensureDefaultChatTicket(activeUser)
  }, [activeUser])


  // Subscribe to Socket.io Realtime Chat Messages for selected ticket with 1.5s live sync fallback
  useEffect(() => {
    if (!selectedTicket) return

    const ticketId = selectedTicket.ticket_id
    fetchTicketMessages(ticketId)

    const handleNewMessage = (msg: any) => {
      if (msg?.ticket_id && msg.ticket_id !== ticketId) return
      console.log('[Socket.io Mobile] Message received from Socket.io ticket room:', {
        ticketId,
        messageId: msg?.id,
        senderType: msg?.sender_type,
        transport: socket.io.engine.transport.name,
      })
      fetchTicketMessages(ticketId)
    }

    const socket = getMobileSocket()
    const joinTicket = () => {
      console.log('[Socket.io Mobile] Joining ticket room on Socket.io server:', {
        ticketId,
        connected: socket.connected,
        transport: socket.io.engine.transport.name,
      })
      socket.emit('join_ticket', { ticket_id: ticketId })
    }

    socket.on('new_message', handleNewMessage)
    socket.on('connect', joinTicket)
    if (socket.connected) {
      joinTicket()
    } else {
      socket.connect()
    }

    const pollInterval = setInterval(() => {
      console.log('[Polling Mobile] Refreshing messages fallback:', ticketId)
      fetchTicketMessages(ticketId)
    }, 1500)

    return () => {
      console.log('[Socket.io Mobile] Leaving ticket room on Socket.io server:', ticketId)
      socket.emit('leave_ticket', { ticket_id: ticketId })
      socket.off('new_message', handleNewMessage)
      socket.off('connect', joinTicket)
      clearInterval(pollInterval)
    }
  }, [selectedTicket])

  const fetchUserTickets = async (user = activeUser) => {
    setLoadingTickets(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        // Fallback demo tickets if DB is clean
        console.log('Error or empty tickets:', error.message)
      } else {
        setTickets(data || [])
        if (data && data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0])
        }
      }
    } catch (err) {
      console.log('Fetch error:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  const ensureDefaultChatTicket = async (user = activeUser) => {
    setStartingChat(true)
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
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start chat')
      }

      const ticket = result.ticket
      setSelectedTicket(ticket)
      setTickets((prev) => {
        const withoutCurrent = prev.filter((t) => t.ticket_id !== ticket.ticket_id)
        return [ticket, ...withoutCurrent]
      })
      fetchTicketMessages(ticket.ticket_id)
      return ticket
    } catch (err) {
      console.log('Start chat API fallback:', err)
      return ensureDefaultChatTicketFromSupabase(user)
    } finally {
      setStartingChat(false)
    }
  }

  const ensureDefaultChatTicketFromSupabase = async (user = activeUser) => {
    let appUser = user

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()

    if (existingUser) {
      appUser = normalizeUser(existingUser, user.name)
    } else {
      const { data: insertedUser, error: userInsertError } = await supabase
        .from('users')
        .insert({
          user_id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
        })
        .select()
        .single()

      if (userInsertError) throw userInsertError
      appUser = normalizeUser(insertedUser, user.name)
    }

    const { data: activeTickets, error: activeTicketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', appUser.id)
      .in('status', ACTIVE_CHAT_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)

    if (activeTicketError) throw activeTicketError

    const activeTicket = activeTickets?.[0]
    if (activeTicket) {
      setSelectedTicket(activeTicket)
      setTickets([activeTicket])
      fetchTicketMessages(activeTicket.ticket_id)
      return activeTicket
    }

    const { data: newTicket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: appUser.id,
        category_id: DEFAULT_CHAT_CATEGORY_ID,
        subject: 'App Support Chat',
        description: 'Support chat started from the mobile app.',
        priority_label: 'General',
        priority: 3,
        status: 'QUEUED',
      })
      .select()
      .single()

    if (ticketError) throw ticketError

    setSelectedTicket(newTicket)
    setTickets([newTicket])
    fetchTicketMessages(newTicket.ticket_id)
    return newTicket
  }

  const fetchTicketMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data)
      }
    } catch (err) {
      console.log('Messages fetch error:', err)
    }
  }

  const handleCreateTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      if (Platform.OS === 'web') {
        alert('Please fill in both subject and description.')
      } else {
        Alert.alert('Required', 'Please fill in both subject and description.')
      }
      return
    }

    setSubmitting(true)
    try {
      // Call create_ticket RPC or direct insert
      const { data, error } = await supabase.rpc('create_ticket', {
        p_category_id: category.id,
        p_subject: subject,
        p_description: description,
        p_priority_label: priorityLabel,
        p_booking_id: selectedBooking.id,
      })

      let newTicketObj: any = null

      if (error) {
        // Direct insert fallback if RPC not deployed on this instance
        const { data: insertData, error: insertErr } = await supabase
          .from('support_tickets')
          .insert({
            user_id: activeUser.id,
            category_id: category.id,
            subject,
            description,
            priority_label: priorityLabel,
            booking_id: selectedBooking.id,
            status: 'QUEUED',
          })
          .select()
          .single()

        if (insertErr) throw insertErr

        if (insertData) {
          newTicketObj = insertData
          // Insert initial opening message into chat_messages
          await supabase.from('chat_messages').insert({
            ticket_id: insertData.ticket_id,
            sender_id: activeUser.id,
            sender_type: 'user',
            body: description,
          })
        }
        alertSuccess('Ticket Created Successfully!')
      } else {
        newTicketObj = data
        alertSuccess('Ticket Created Successfully!')
      }

      setSubject('')
      setDescription('')
      if (newTicketObj && newTicketObj.ticket_id) {
        setSelectedTicket(newTicketObj)
      }
      fetchUserTickets()
      setActiveTab('tickets')
    } catch (err: any) {
      alertError(err.message || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    const messageText = newMessage.trim()
    setNewMessage('')

    try {
      const socket = getMobileSocket()
      if (!socket.connected) {
        console.warn('[Socket.io Mobile] Socket was disconnected while sending. Reconnecting before send_message.')
        socket.connect()
      }

      console.log('[Socket.io Mobile] Sending user message to Socket.io server:', {
        ticketId: selectedTicket?.ticket_id || null,
        userId: activeUser.id,
        connected: socket.connected,
        transport: socket.io.engine.transport.name,
      })

      socket.emit('send_message', {
        ticket_id: selectedTicket?.ticket_id,
        sender_id: activeUser.id,
        sender_type: 'user',
        body: messageText,
        email: activeUser.email,
        name: activeUser.name,
        phone: activeUser.phone,
      })
    } catch (err: any) {
      alertError('Failed to send message: ' + err.message)
    }
  }

  const handleRateTicket = async () => {
    if (!selectedTicket) return
    try {
      const { error } = await supabase.rpc('rate_ticket', {
        p_ticket_id: selectedTicket.ticket_id,
        p_rating: rating,
        p_comment: ratingComment,
      })
      if (error) throw error
      alertSuccess('Thank you for your rating!')
    } catch (err: any) {
      alertError('Rating failed: ' + err.message)
    }
  }

  const handleSimulateSync = () => {
    const timestamp = new Date().toLocaleTimeString()
    const log = `[${timestamp}] Sync Engine: Polling Production DB -> Admin DB checkpoint at ${new Date().toISOString()}`
    setSyncLogs((prev) => [log, ...prev])
  }

  const alertSuccess = (msg: string) => {
    if (Platform.OS === 'web') alert('✅ ' + msg)
    else Alert.alert('Success', msg)
  }

  const alertError = (msg: string) => {
    if (Platform.OS === 'web') alert('❌ ' + msg)
    else Alert.alert('Error', msg)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & User Switcher */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>📱 Hostiggo Mobile App (Dummy)</Text>
        <Text style={styles.subTitle}>Simulated Production Client</Text>

        <View style={styles.userPickerContainer}>
          <Text style={styles.userPickerLabel}>Active User:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userScrollView}>
            {[...customUsers, ...DEMO_USERS].map((user) => (
              <TouchableOpacity
                key={user.id}
                style={[styles.userChip, activeUser.id === user.id && styles.userChipActive]}
                onPress={() => setActiveUser(user)}
              >
                <Text style={[styles.userChipText, activeUser.id === user.id && styles.userChipTextActive]}>
                  👤 {user.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.userChip, { backgroundColor: '#4F46E5' }]}
              onPress={() => setShowLoginModal(true)}
            >
              <Text style={[styles.userChipText, { color: '#FFF' }]}>🔑 + Login / Register</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {showLoginModal && (
          <View style={{ backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#334155' }}>
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>🔑 User Login / Register (hostiggo_testing_schema)</Text>
            <TextInput
              style={{ backgroundColor: '#0F172A', color: '#FFF', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}
              placeholder="Display Name (e.g. Vinit Gautam)"
              placeholderTextColor="#64748B"
              value={loginName}
              onChangeText={setLoginName}
            />
            <TextInput
              style={{ backgroundColor: '#0F172A', color: '#FFF', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}
              placeholder="Email Address (e.g. vinit@example.com)"
              placeholderTextColor="#64748B"
              value={loginEmail}
              onChangeText={setLoginEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={{ backgroundColor: '#0F172A', color: '#FFF', padding: 8, borderRadius: 6, marginBottom: 10, fontSize: 12 }}
              placeholder="Phone Number (optional)"
              placeholderTextColor="#64748B"
              value={loginPhone}
              onChangeText={setLoginPhone}
            />
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => setShowLoginModal(false)}
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#334155' }}
              >
                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomLogin}
                disabled={loggingIn}
                style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#10B981' }}
              >
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>
                  {loggingIn ? 'Logging in…' : 'Login / Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Direct Support Chat Header */}
      <View style={styles.tabsBar}>
        <TouchableOpacity
          style={[styles.tabButton, styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('tickets')
            ensureDefaultChatTicket()
          }}
        >
          <Text style={[styles.tabText, styles.tabTextActive]}>💬 Support Chat</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: CREATE TICKET */}
      {activeTab === 'create' && (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sectionHeading}>Raise a Support Complaint</Text>

          <Text style={styles.label}>Select Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, category.id === cat.id && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category.id === cat.id && styles.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Priority Level</Text>
          <View style={styles.chipRow}>
            {['Urgent', 'Payment-Refund', 'Booking Help', 'General'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, priorityLabel === p && styles.chipActive]}
                onPress={() => setPriorityLabel(p)}
              >
                <Text style={[styles.chipText, priorityLabel === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Related Booking</Text>
          <View style={styles.chipRow}>
            {DEMO_BOOKINGS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.chip, selectedBooking.id === b.id && styles.chipActive]}
                onPress={() => setSelectedBooking(b)}
              >
                <Text style={[styles.chipText, selectedBooking.id === b.id && styles.chipTextActive]}>
                  {b.code}: {b.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. AC not working in master bedroom"
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>Detailed Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Explain the issue in detail..."
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateTicket} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>🚀 Submit Complaint</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TAB 2: MY TICKETS & CHAT */}
      {activeTab === 'tickets' && (
        <View style={styles.splitChatView}>
          <View style={styles.chatThreadCol}>
            {selectedTicket ? (
              <>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatHeaderTitle}>Support Chat</Text>
                  <Text style={styles.chatHeaderSub}>
                    {selectedTicket.ticket_number || 'Connecting to support...'}
                  </Text>
                </View>

                {/* Messages List */}
                <ScrollView style={styles.messagesScroll}>
                  {messages.map((m, idx) => {
                    const isUser = m.sender_type === 'user'
                    const isSystem = m.sender_type === 'system'
                    if (isSystem) {
                      return (
                        <View key={m.id || idx} style={styles.systemBubble}>
                          <Text style={styles.systemText}>⚙️ {m.body}</Text>
                        </View>
                      )
                    }
                    return (
                      <View key={m.id || idx} style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
                        <Text style={styles.bubbleSender}>{isUser ? 'You' : 'Support Agent'}</Text>
                        <Text style={[styles.bubbleBody, isUser ? styles.userBubbleText : styles.agentBubbleText]}>
                          {m.body}
                        </Text>
                      </View>
                    )
                  })}
                </ScrollView>

                {/* Rating Banner if Resolved */}
                {selectedTicket.status === 'RESOLVED' && (
                  <View style={styles.ratingBox}>
                    <Text style={styles.ratingTitle}>Rate Support Experience</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)}>
                          <Text style={styles.starText}>{star <= rating ? '⭐' : '☆'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.rateSubmitButton} onPress={handleRateTicket}>
                      <Text style={styles.rateSubmitText}>Submit Rating ({rating}/5)</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Chat Input */}
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Type message to agent..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                  />
                  <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                    <Text style={styles.sendButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyChatCenter}>
                {startingChat ? (
                  <>
                    <ActivityIndicator style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyText}>Starting support chat...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyText}>Support chat is ready.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => ensureDefaultChatTicket(activeUser)}>
                      <Text style={styles.primaryButtonText}>Open Chat</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* TAB 3: DATA SYNC SIMULATOR */}
      {activeTab === 'sync' && (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sectionHeading}>Production ➔ Admin Database Sync Test</Text>
          <Text style={styles.bodyDesc}>
            This screen tests the Incremental Sync Service checkpoint flow. Changes made in this dummy app hit
            the simulated Production DB, which then syncs to the Hostiggo Admin Portal DB.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Simulated Production Entities</Text>
            <Text style={styles.cardItem}>👤 User: {activeUser.name} ({activeUser.email})</Text>
            <Text style={styles.cardItem}>🏠 Active Booking: {selectedBooking.code} - {selectedBooking.title}</Text>
            <Text style={styles.cardItem}>🎫 Total Tickets Created: {tickets.length}</Text>
          </View>

          <TouchableOpacity style={styles.syncButton} onPress={handleSimulateSync}>
            <Text style={styles.syncButtonText}>⚡ Trigger Incremental Sync</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 20 }]}>Sync Execution Log</Text>
          <View style={styles.logContainer}>
            {syncLogs.length === 0 ? (
              <Text style={styles.logPlaceholder}>Press button above to trigger sync event...</Text>
            ) : (
              syncLogs.map((log, i) => (
                <Text key={i} style={styles.logLine}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1e293b',
    padding: 16,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  subTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  userPickerContainer: {
    marginTop: 12,
  },
  userPickerLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 6,
  },
  userScrollView: {
    flexDirection: 'row',
  },
  userChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  userChipActive: {
    backgroundColor: '#2563eb',
  },
  userChipText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  userChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderColor: '#2563eb',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipActive: {
    backgroundColor: '#2563eb',
  },
  chipText: {
    color: '#334155',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  splitChatView: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  ticketListCol: {
    width: Platform.OS === 'web' ? 280 : '100%',
    height: Platform.OS === 'web' ? '100%' : 160,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  colHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  ticketItem: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ticketItemActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  ticketNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  ticketSubject: {
    fontSize: 13,
    color: '#0f172a',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chatThreadCol: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  chatHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatHeaderSub: {
    fontSize: 12,
    color: '#64748b',
  },
  messagesScroll: {
    flex: 1,
    padding: 12,
  },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
  },
  bubbleSender: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
  bubbleBody: {
    fontSize: 13,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  agentBubbleText: {
    color: '#0f172a',
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  systemText: {
    fontSize: 11,
    color: '#92400e',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyChatCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardItem: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
  },
  bodyDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  syncButton: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  logContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
  },
  logPlaceholder: {
    color: '#64748b',
    fontSize: 12,
  },
  logLine: {
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    marginBottom: 4,
  },
  ratingBox: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#fef3c7',
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  starRow: {
    flexDirection: 'row',
    marginVertical: 6,
    gap: 8,
  },
  starText: {
    fontSize: 20,
  },
  rateSubmitButton: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rateSubmitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
})
