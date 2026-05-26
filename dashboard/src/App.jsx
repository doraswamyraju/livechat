import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5004'
  : window.location.origin;

function App() {
  // Authentication & Session state
  const [token, setToken] = useState(localStorage.getItem('letstrack_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('letstrack_user')) || null);
  const [tenant, setTenant] = useState(JSON.parse(localStorage.getItem('letstrack_tenant')) || null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, monitor, chat, customize, agents
  
  // DB & WebSockets State Arrays
  const [visitors, setVisitors] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Status Selector
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState(user?.status || 'Offline');

  // Input bindings
  const [chatInput, setChatInput] = useState('');
  const [visitorTypingStatus, setVisitorTypingStatus] = useState({}); // visitorId -> boolean

  // Widget settings configuration
  const [widgetSettings, setWidgetSettings] = useState({
    primaryColor: '#7C3AED',
    headingText: 'Chat with Us!',
    welcomeMessage: 'Hi there! How can we help you today?',
    preChatEnabled: false,
    position: 'bottom-right',
    headerTextColor: '#ffffff',
    gradientColor: '#312E81',
    useGradient: true,
    statusText: 'Typically replies instantly',
    borderRadius: 16,
    launcherText: 'Chat'
  });

  // Analytics summary state
  const [analytics, setAnalytics] = useState({
    totalVisitors: 0,
    onlineVisitors: 0,
    activeConversations: 0,
    unassignedConversations: 0,
    totalChats: 0,
    totalAgents: 0,
    onlineAgents: 0
  });

  // Auth Inputs
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [domain, setDomain] = useState('');
  const [agentInviteName, setAgentInviteName] = useState('');
  const [agentInviteEmail, setAgentInviteEmail] = useState('');
  const [agentInvitePassword, setAgentInvitePassword] = useState('');

  // UI Toast feedback
  const [toast, setToast] = useState(null);

  // References
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ============================================
  // AUTHENTICATION HANDLERS
  // ============================================
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return showToast('Please enter credentials', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('letstrack_token', data.token);
      localStorage.setItem('letstrack_user', JSON.stringify(data.user));
      localStorage.setItem('letstrack_tenant', JSON.stringify(data.tenant));

      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
      setAgentStatus(data.user.status);
      showToast('Logged in successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email || !password) return showToast('Please enter email and new password', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');

      showToast('Password updated! You can now log in.');
      setAuthMode('login');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRegisterTenant = async (e) => {
    e.preventDefault();
    if (!tenantName || !domain || !name || !email || !password) {
      return showToast('Please fill all registration fields', 'error');
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName,
          domain,
          adminName: name,
          email,
          password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('letstrack_token', data.token);
      localStorage.setItem('letstrack_user', JSON.stringify(data.user));
      localStorage.setItem('letstrack_tenant', JSON.stringify(data.tenant));

      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
      setAgentStatus(data.user.status);
      showToast('Account and Tenant initialized!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('letstrack_token');
    localStorage.removeItem('letstrack_user');
    localStorage.removeItem('letstrack_tenant');
    setToken(null);
    setUser(null);
    setTenant(null);
    setVisitors([]);
    setConversations([]);
    setAgents([]);
    setSelectedVisitor(null);
    setSelectedConversation(null);
    setMessages([]);
    showToast('Logged out.');
  };

  const handleInviteAgent = async (e) => {
    e.preventDefault();
    if (!agentInviteName || !agentInviteEmail || !agentInvitePassword) {
      return showToast('Fill all fields to invite agent', 'error');
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: agentInviteName,
          email: agentInviteEmail,
          password: agentInvitePassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agent');

      showToast('New Agent successfully registered!');
      setAgentInviteName('');
      setAgentInviteEmail('');
      setAgentInvitePassword('');
      
      // Update Agent List manually or wait for WS update
      if (socketRef.current) {
        socketRef.current.emit('agent-init', { tenantId: tenant.id, agentId: user.id });
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ============================================
  // REAL-TIME WEBSOCKET EFFECT
  // ============================================
  useEffect(() => {
    if (!token || !tenant || !user) return;

    // Connect to dashboard namespace
    const socket = io(`${BACKEND_URL}/dashboard`);
    socketRef.current = socket;

    // Init handshakes
    socket.emit('agent-init', {
      tenantId: tenant.id,
      agentId: user.id
    });

    // 1. Sync whole dashboard lists on connect
    socket.on('dashboard-sync', (data) => {
      setVisitors(data.visitors);
      setConversations(data.conversations);
      setAgents(data.agents);
      
      // Re-map agent status
      const self = data.agents.find(a => a._id === user.id);
      if (self) setAgentStatus(self.status);
    });

    // 2. A new visitor connects to the widget
    socket.on('visitor-connected', (visitor) => {
      setVisitors(prev => {
        const index = prev.findIndex(v => v._id === visitor._id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = visitor;
          return updated;
        }
        return [...prev, visitor];
      });
      
      // Play clean chime chime
      try {
        const audio = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audio.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audio.currentTime + 0.12); // E5
        gain.gain.setValueAtTime(0.08, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.3);
      } catch (e) {}

      showToast(`New visitor online: ${visitor.name}`);
    });

    // 3. Visitor navigates pages on host website
    socket.on('visitor-navigated', (data) => {
      setVisitors(prev => prev.map(v => v._id === data.visitorId ? { ...v, currentUrl: data.currentUrl, lastSeen: new Date() } : v));
    });

    // 4. Visitor goes offline
    socket.on('visitor-disconnected', (data) => {
      setVisitors(prev => prev.map(v => v._id === data.visitorId ? { ...v, isOnline: false } : v));
    });

    // 5. Visitor drafts typing indicator
    socket.on('visitor-typing', (data) => {
      setVisitorTypingStatus(prev => ({ ...prev, [data.visitorId]: data.isTyping }));
    });

    // 6. Incoming messages from Visitor
    socket.on('visitor-msg', (data) => {
      const { conversation, message, visitor } = data;
      
      // Sync conversation in list
      setConversations(prev => {
        const index = prev.findIndex(c => c._id === conversation._id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: conversation.status, updatedAt: conversation.updatedAt };
          return updated;
        }
        return [...prev, { ...conversation, visitorId: visitor }];
      });

      // Play ringing sound/notification for new message or unassigned queue
      if (conversation.status === 'Unassigned') {
        try {
          const audio = new AudioContext();
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(660.00, audio.currentTime); // E5
          osc.frequency.setValueAtTime(880.00, audio.currentTime + 0.1); // A5
          gain.gain.setValueAtTime(0.1, audio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(audio.destination);
          osc.start();
          osc.stop(audio.currentTime + 0.3);
        } catch (e) {}
      }

      // If active conversation matches, append message
      if (selectedConversation && selectedConversation._id === conversation._id) {
        setMessages(prev => [...prev, message]);
      }
    });

    // 7. Incoming message acknowledgment from other agents
    socket.on('agent-msg-received', (data) => {
      const { conversationId, message } = data;
      if (selectedConversation && selectedConversation._id === conversationId) {
        setMessages(prev => [...prev, message]);
      }
    });

    // 8. Dynamic conversation updates (like Employee Assignments)
    socket.on('chat-assigned-update', (data) => {
      const { conversation, systemMessage } = data;
      
      setConversations(prev => prev.map(c => c._id === conversation._id ? conversation : c));
      
      if (selectedConversation && selectedConversation._id === conversation._id) {
        setSelectedConversation(conversation);
        setMessages(prev => [...prev, systemMessage]);
      }
      
      showToast(`Conversation state updated: ${systemMessage.text}`);
    });

    // 9. Sync agent status changes
    socket.on('agent-status-changed', (data) => {
      setAgents(prev => prev.map(a => a._id === data.agentId ? { ...a, status: data.status } : a));
      if (data.agentId === user.id) {
        setAgentStatus(data.status);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, tenant, user, selectedConversation]);

  // Scroll active chats automatically
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load custom WidgetSettings & Analytics logs
  useEffect(() => {
    if (!token) return;
    
    // Fetch settings
    fetch(`${BACKEND_URL}/api/settings/widget?tenantId=${tenant.id}`)
      .then(res => res.json())
      .then(data => setWidgetSettings(data))
      .catch(err => console.error('Error fetching widget settings:', err));

    // Fetch analytics summary
    fetch(`${BACKEND_URL}/api/analytics/summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAnalytics(data))
      .catch(err => console.error('Error fetching analytics:', err));
      
  }, [token, activeTab]);

  // ============================================
  // INTERACTIVE CONTROLLERS
  // ============================================
  const selectConversationRoom = async (conv) => {
    setSelectedConversation(conv);
    setSelectedVisitor(visitors.find(v => v._id === conv.visitorId._id || v._id === conv.visitorId));
    
    // Fetch logs
    try {
      const res = await fetch(`${BACKEND_URL}/widget.js`); // Trigger websocket list fetch or direct REST API
      // Socket retrieves log details automatically upon joining rooms on server
      // But for REST ease we can fetch directly or read socket lists.
      // In this setup, models.js and socket.js stores message logs in MongoDB. We'll fetch message logs from database:
      // Let's use standard API retrieval for message log history
      // Wait, we didn't add REST API in server.js to get messages, because socket handles it on load.
      // But we can fetch messages via websocket trigger or write a simple route.
      // Wait! Let's do it via websocket: we can request socket to fetch messages, or write a simple REST route!
      // In models.js we have the Message model. Let's make a REST route or request. 
      // Wait, let's write a simple REST endpoint in server.js to retrieve messages! 
      // But let's check: we can fetch message history using `GET /api/conversations/:id/messages`.
      // Let's add that endpoint in server.js. Oh, since we can't edit files concurrently, we can easily fetch them!
      // Wait, let's check server.js. We don't have this API yet, but wait, the socket controller socket.js sends the chat-history automatically!
      // Wait, is there a simple way to load messages? Let's check:
      // In socket.js, on `visitor-init`, the socket loads and emits `chat-history` back to the visitor.
      // Let's check if we can query messages. To fetch messages for an active room in the dashboard:
      // We can add a rapid REST route for `GET /api/conversations/:id/messages` in server.js to load historical logs!
      // Wait, let's look at what endpoints are in server.js:
      // We have:
      // 1. `/api/auth/register-tenant`
      // 2. `/api/auth/login`
      // 3. `/api/auth/register-agent`
      // 4. `/api/settings/widget` (GET and PUT)
      // 5. `/api/analytics/summary`
      // 6. `/widget.js`
      // Let's add a REST endpoint in server.js to get historical messages! That is incredibly easy and clean to edit via replace_file_content!
      // Let's search server.js or modify it to fetch conversation logs. But wait! We can do it right now or check how to read it. Let's check if we can write a quick REST endpoint for conversation logs. Yes! That will make our code 100% robust. Let's do that!
    } catch (err) {
      console.error(err);
    }
  };

  // Wait! Let's check if we have another way: on room click, we can fetch messages by calling a quick API or simply fetching them. Let's write an API to retrieve conversation messages!
  // Let's check: we can fetch conversation messages by adding a route `GET /api/conversations/:conversationId/messages` in `server.js`.
  // Let's do this edit! Let's look at `server.js` first.
  // Wait, let's first check if task-36 is completed. We can check our files.
  // Let's inspect `server.js` structure. Let's write a small route in `server.js` to return conversation messages.
  // Let's find where to insert: right before analytics overview endpoint is a perfect spot!
  
  // Let's draft the message loading logic in App.jsx.
  const fetchConversationMessages = async (conversationId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    const vis = visitors.find(v => v._id === (conv.visitorId._id || conv.visitorId));
    setSelectedVisitor(vis);
    await fetchConversationMessages(conv._id);
  };

  const handleSendAgentMessage = () => {
    if (!chatInput.trim() || !selectedConversation) return;

    if (socketRef.current) {
      socketRef.current.emit('agent-msg', {
        conversationId: selectedConversation._id,
        visitorId: selectedConversation.visitorId._id || selectedConversation.visitorId,
        text: chatInput.trim()
      });
      setChatInput('');
    }
  };

  const handleClaimChat = () => {
    if (!selectedConversation) return;
    if (socketRef.current) {
      socketRef.current.emit('assign-chat', {
        conversationId: selectedConversation._id,
        assignedAgentId: user.id
      });
    }
  };

  const handleDelegateChat = (targetAgentId) => {
    if (!selectedConversation) return;
    if (socketRef.current) {
      socketRef.current.emit('assign-chat', {
        conversationId: selectedConversation._id,
        assignedAgentId: targetAgentId
      });
    }
  };

  const handleReleaseChat = () => {
    if (!selectedConversation) return;
    if (socketRef.current) {
      socketRef.current.emit('assign-chat', {
        conversationId: selectedConversation._id,
        assignedAgentId: null
      });
    }
  };

  const handleUpdateStatus = (newStatus) => {
    setAgentStatus(newStatus);
    setStatusDropdownOpen(false);
    if (socketRef.current) {
      socketRef.current.emit('agent-status-update', { status: newStatus });
    }
  };

  const handleSaveWidgetSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings/widget`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(widgetSettings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      showToast('Widget customizations synchronized successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ============================================
  // RENDER SECTIONS
  // ============================================
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-bg-blob top-left"></div>
        <div className="auth-bg-blob bottom-right"></div>
        
        <div className="auth-card glass-card">
          <div className="auth-title">LetsTrack Console</div>
          <div className="auth-subtitle">Real-time Visitor Tracking & Messaging Platform</div>

          {authMode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-btn">Access Console</button>
              
              <div className="auth-switch-text" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                <span className="auth-link" onClick={() => setAuthMode('register')}>
                  Create Tenant
                </span>
                <span className="auth-link" onClick={() => setAuthMode('reset')}>
                  Forgot Password?
                </span>
              </div>
            </form>
          ) : authMode === 'reset' ? (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-btn">Reset Password</button>
              
              <div className="auth-switch-text">
                Back to{' '}
                <span className="auth-link" onClick={() => setAuthMode('login')}>
                  Sign In
                </span>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterTenant}>
              <div className="form-group">
                <label className="form-label">Website / Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="My MERN Store"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website Domain</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://my-mern-app.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Administrator Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-btn">Initialize Platform</button>
              
              <div className="auth-switch-text">
                Already registered?{' '}
                <span className="auth-link" onClick={() => setAuthMode('login')}>
                  Sign In
                </span>
              </div>
            </form>
          )}
        </div>
        {toast && <div className={`toast-msg ${toast.type}`}>{toast.text}</div>}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="white"/></svg>
          </div>
          <div className="logo-text">LetsTrack</div>
        </div>

        <div className="sidebar-menu">
          <button className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
            Overview Panel
          </button>
          
          <button className={`menu-item ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            Active Monitor
          </button>

          <button className={`menu-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            Inbox Console
          </button>

          <button className={`menu-item ${activeTab === 'customize' ? 'active' : ''}`} onClick={() => setActiveTab('customize')}>
            <svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
            Widget Customizer
          </button>

          {user.role === 'Admin' && (
            <button className={`menu-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
              <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              Manage Employees
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TENANT API KEY</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--primary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tenant.apiKey}>
            {tenant.apiKey}
          </div>
        </div>
      </div>

      {/* 2. Main Frame */}
      <div className="main-frame">
        {/* Top Navbar */}
        <div className="top-navbar">
          <div className="navbar-title">
            {activeTab === 'analytics' && 'Operational Metrics Overview'}
            {activeTab === 'monitor' && 'Live Traffic Analytics'}
            {activeTab === 'chat' && 'Live Chat Dashboard'}
            {activeTab === 'customize' && 'Widget Configuration Center'}
            {activeTab === 'agents' && 'Employee Administration'}
          </div>

          <div className="navbar-profile">
            {/* Status Dropdown */}
            <div className="status-dropdown">
              <button className="status-trigger" onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}>
                <span className={`status-dot ${agentStatus.toLowerCase()}`}></span>
                {agentStatus}
              </button>
              
              <div className={`dropdown-menu ${statusDropdownOpen ? 'show' : ''}`}>
                <button className="dropdown-item" onClick={() => handleUpdateStatus('Online')}>
                  <span className="status-dot online"></span> Online
                </button>
                <button className="dropdown-item" onClick={() => handleUpdateStatus('Away')}>
                  <span className="status-dot away"></span> Away
                </button>
                <button className="dropdown-item" onClick={() => handleUpdateStatus('Offline')}>
                  <span className="status-dot offline"></span> Offline
                </button>
              </div>
            </div>

            <div className="agent-badge">
              <div className="agent-avatar">{user.name[0]}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{user.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.role}</div>
              </div>
            </div>
            
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', marginLeft: '12px', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Dynamic Viewport */}
        <div className="viewport-content">
          
          {/* A. ANALYTICS VIEW */}
          {activeTab === 'analytics' && (
            <div>
              <div className="analytics-stats-row">
                <div className="stat-card glass-card" onClick={() => setActiveTab('monitor')} style={{ cursor: 'pointer' }}>
                  <div className="stat-title">Online Visitors</div>
                  <div className="stat-value">{analytics.onlineVisitors}</div>
                  <div className="stat-footer">Across all site subpaths</div>
                </div>
                <div className="stat-card glass-card" onClick={() => setActiveTab('chat')} style={{ cursor: 'pointer' }}>
                  <div className="stat-title">Active Conversations</div>
                  <div className="stat-value">{analytics.activeConversations}</div>
                  <div className="stat-footer">Assigned to employees</div>
                </div>
                <div className="stat-card glass-card" onClick={() => setActiveTab('chat')} style={{ cursor: 'pointer' }}>
                  <div className="stat-title">Pending Queue</div>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>{analytics.unassignedConversations}</div>
                  <div className="stat-footer">Chats waiting for agents</div>
                </div>
                <div className="stat-card glass-card" onClick={() => user.role === 'Admin' ? setActiveTab('agents') : showToast('Access restricted to Admins only', 'error')} style={{ cursor: 'pointer' }}>
                  <div className="stat-title">Total Staff</div>
                  <div className="stat-value">{analytics.totalAgents}</div>
                  <div className="stat-footer">{analytics.onlineAgents} employees currently active</div>
                </div>
              </div>

              <div className="analytics-charts-grid">
                <div className="chart-card glass-card">
                  <h4 style={{ marginBottom: '20px' }}>Traffic Velocity (Historical Visits)</h4>
                  {/* Beautiful customized SVG chart */}
                  <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                    <svg viewBox="0 0 500 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="0" y1="70" x2="500" y2="70" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="0" y1="170" x2="500" y2="170" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      
                      {/* Chart Path Area */}
                      <path d="M 0 170 Q 100 130 200 150 T 400 60 T 500 40 L 500 170 L 0 170 Z" fill="url(#lineGrad)" />
                      {/* Chart Line */}
                      <path d="M 0 170 Q 100 130 200 150 T 400 60 T 500 40" fill="none" stroke="var(--primary)" strokeWidth="3" />
                      {/* Interactive dots */}
                      <circle cx="200" cy="150" r="5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                      <circle cx="400" cy="60" r="5" fill="#EC4899" stroke="white" strokeWidth="2" />
                      
                      {/* Text */}
                      <text x="180" y="130" fill="var(--text-secondary)" fontSize="10">Mon</text>
                      <text x="380" y="40" fill="var(--text-secondary)" fontSize="10">Today (Peak)</text>
                    </svg>
                  </div>
                </div>

                <div className="chart-card glass-card">
                  <h4 style={{ marginBottom: '20px' }}>Visitor Device Demographics</h4>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                    <svg width="150" height="150" viewBox="0 0 36 36" style={{ overflow: 'visible' }}>
                      {/* Pie sections using strokeDasharray */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      {/* Desktop - 60% */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--primary)" strokeWidth="3.2" strokeDasharray="60 40" strokeDashoffset="25" />
                      {/* Mobile - 30% */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EC4899" strokeWidth="3.2" strokeDasharray="30 70" strokeDashoffset="65" />
                      {/* Tablet - 10% */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--warning)" strokeWidth="3.2" strokeDasharray="10 90" strokeDashoffset="95" />
                    </svg>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }}></span>
                        Desktop - 60%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#EC4899' }}></span>
                        Mobile - 30%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--warning)' }}></span>
                        Tablet - 10%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. ACTIVE MONITOR */}
          {activeTab === 'monitor' && (
            <div className="monitor-grid">
              <div className="monitor-card glass-card">
                <div className="card-header">
                  <div className="card-title">Active Visitors online now</div>
                </div>
                <div className="card-body-scroll">
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Visitor Details</th>
                        <th>Device/OS</th>
                        <th>Current Subpath</th>
                        <th>Origin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map(visitor => (
                        <tr
                          key={visitor._id}
                          className={`visitor-row ${selectedVisitor?._id === visitor._id ? 'selected' : ''}`}
                          onClick={() => setSelectedVisitor(visitor)}
                        >
                          <td>
                            <div className="visitor-badge-info">
                              <div className="visitor-status-indicator">
                                <span className={`v-pulse ${visitor.isOnline ? 'anim' : ''}`} style={{ backgroundColor: visitor.isOnline ? 'var(--success)' : 'var(--text-muted)' }}></span>
                                <span className="v-pulse" style={{ backgroundColor: visitor.isOnline ? 'var(--success)' : 'var(--text-muted)' }}></span>
                              </div>
                              <div className="visitor-meta-text">{visitor.name}</div>
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {visitor.deviceType} • {visitor.browser} on {visitor.os}
                          </td>
                          <td>
                            <span className="path-tag">{visitor.currentUrl || '/'}</span>
                          </td>
                          <td style={{ fontSize: '13px' }}>
                            🌍 {visitor.city}, {visitor.country}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Panel details */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="card-title">Visitor Footprint Details</h3>
                {selectedVisitor ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-accent)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 10px auto' }}>
                        👤
                      </div>
                      <h4 style={{ fontSize: '18px' }}>{selectedVisitor.name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedVisitor.email || 'Email Capture Offline'}</p>
                    </div>

                    <div className="info-item">
                      <span className="info-item-label">Status</span>
                      <span className="info-item-value" style={{ color: selectedVisitor.isOnline ? 'var(--success)' : 'var(--text-muted)' }}>
                        {selectedVisitor.isOnline ? 'Active Online' : 'Offline Session'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">Origin Location</span>
                      <span className="info-item-value">{selectedVisitor.city}, {selectedVisitor.country}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">Active URL Path</span>
                      <span className="info-item-value" style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{selectedVisitor.currentUrl || '/'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">Referred From</span>
                      <span className="info-item-value">{selectedVisitor.referrer}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">Browser & OS</span>
                      <span className="info-item-value">{selectedVisitor.browser} ({selectedVisitor.os})</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Open chat and force find/create chat log room
                        setActiveTab('chat');
                        // Find or mimic conversation select
                        const existing = conversations.find(c => c.visitorId._id === selectedVisitor._id || c.visitorId === selectedVisitor._id);
                        if (existing) {
                          handleSelectConversation(existing);
                        } else {
                          // No active chat room exists yet, wait for them to text or force start one
                          showToast("Waiting for visitor to type or initiate conversation...", "warning");
                        }
                      }}
                      className="claim-btn"
                      style={{ marginTop: '20px' }}
                    >
                      Open Chat Thread
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                    Select a visitor from the active monitor table to view details.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* C. INBOX CONSOLE */}
          {activeTab === 'chat' && (
            <div className="inbox-container">
              {/* 1. Chats Rooms List */}
              <div className="pane-rooms">
                <div className="rooms-filter-tabs">
                  <button className="filter-tab active">All Queues</button>
                </div>
                <div className="rooms-list">
                  {conversations.map(conv => {
                    const vis = typeof conv.visitorId === 'object' ? conv.visitorId : visitors.find(v => v._id === conv.visitorId);
                    const agentName = conv.assignedAgentId ? conv.assignedAgentId.name : 'Unassigned';
                    
                    return (
                      <div
                        key={conv._id}
                        className={`room-card ${selectedConversation?._id === conv._id ? 'active' : ''}`}
                        onClick={() => handleSelectConversation(conv)}
                      >
                        <div className="room-card-header">
                          <span className="room-name">{vis?.name || 'VisitorSession'}</span>
                          <span className="room-time">
                            {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="room-preview">
                          {conv.status === 'Unassigned' ? 'Waiting for agent...' : 'Active chat in progress'}
                        </div>
                        <span className="room-assignee" style={{ borderLeft: `2px solid ${conv.assignedAgentId ? 'var(--primary)' : 'var(--warning)'}` }}>
                          👤 {agentName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Actual Chat Window */}
              <div className="pane-chat">
                {selectedConversation ? (
                  <>
                    <div className="chat-pane-header">
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>
                          {selectedVisitor?.name || 'Visitor Conversation'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Status:{' '}
                          <span style={{ color: selectedConversation.assignedAgentId ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>
                            {selectedConversation.assignedAgentId ? `Assigned to ${selectedConversation.assignedAgentId.name}` : 'Unassigned in Queue'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="chat-messages-board">
                      {messages.map((msg, i) => (
                        <div key={i} className={`db-msg-row ${msg.senderType.toLowerCase()}`}>
                          <div className="db-msg-bubble">{msg.text}</div>
                          <div className="db-msg-time">
                            {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                      
                      {/* Visitor typing indicator */}
                      {visitorTypingStatus[selectedConversation.visitorId._id || selectedConversation.visitorId] && (
                        <div className="db-msg-row visitor">
                          <div className="db-msg-bubble" style={{ display: 'flex', gap: '4px', padding: '10px 14px' }}>
                            <span className="typing-dot" style={{ animationDelay: '0s' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-bar">
                      <input
                        type="text"
                        className="chat-input-field"
                        placeholder="Text reply back to live visitor..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendAgentMessage();
                        }}
                      />
                      <button className="chat-send-btn" onClick={handleSendAgentMessage}>
                        Send
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                    <p style={{ fontSize: '14px' }}>Select an active chat log from the left pane.</p>
                  </div>
                )}
              </div>

              {/* 3. Right Details & Employee Allocator Drawer */}
              <div className="pane-details">
                {selectedConversation ? (
                  <>
                    <div>
                      <div className="detail-section-title">Visitor Location</div>
                      <div className="info-item">
                        <span className="info-item-label">IP Address</span>
                        <span className="info-item-value">{selectedVisitor?.ipAddress || '127.0.0.1'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Country</span>
                        <span className="info-item-value">🌍 {selectedVisitor?.country || 'Unknown'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">City</span>
                        <span className="info-item-value">{selectedVisitor?.city || 'Unknown'}</span>
                      </div>
                    </div>

                    <div>
                      <div className="detail-section-title">System Data</div>
                      <div className="info-item">
                        <span className="info-item-label">Current URL</span>
                        <span className="info-item-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', whiteSpace: 'nowrap' }} title={selectedVisitor?.currentUrl}>
                          {selectedVisitor?.currentUrl || '/'}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Device Type</span>
                        <span className="info-item-value">{selectedVisitor?.deviceType || 'Desktop'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">OS/Browser</span>
                        <span className="info-item-value">{selectedVisitor?.os} / {selectedVisitor?.browser}</span>
                      </div>
                    </div>

                    <div>
                      <div className="detail-section-title">Staff Assignment</div>
                      <div className="assignee-box">
                        {selectedConversation.assignedAgentId ? (
                          <>
                            <div style={{ fontSize: '13px' }}>
                              Assigned to:{' '}
                              <strong style={{ color: 'var(--primary)' }}>
                                {selectedConversation.assignedAgentId._id === user.id ? 'You (Mine)' : selectedConversation.assignedAgentId.name}
                              </strong>
                            </div>
                            <button className="claim-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }} onClick={handleReleaseChat}>
                              Release back to queue
                            </button>
                          </>
                        ) : (
                          <>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Chat is currently unassigned.</p>
                            <button className="claim-btn" onClick={handleClaimChat}>Claim Chat</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Agent invitation/delegation list */}
                    <div>
                      <div className="detail-section-title">Delegate Chat to Staff</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {agents
                          .filter(a => a._id !== selectedConversation.assignedAgentId?._id)
                          .map(agent => (
                            <div key={agent._id} className="agent-assign-row">
                              <div>
                                <strong>{agent.name}</strong>{' '}
                                <span className={`status-dot ${agent.status.toLowerCase()}`} style={{ width: '6px', height: '6px' }}></span>
                              </div>
                              <button className="assign-action-btn" onClick={() => handleDelegateChat(agent._id)}>
                                Assign
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
                    No conversation active.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* D. WIDGET CUSTOMIZER */}
          {activeTab === 'customize' && (
            <div className="customizer-grid">
              <div className="config-form">
                <h3 className="card-title" style={{ marginBottom: '10px' }}>Design Customizer</h3>
                
                <div className="form-group">
                  <label className="form-label">Theme Color (Primary HEX)</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      className="color-preview-box"
                      value={widgetSettings.primaryColor}
                      onChange={(e) => setWidgetSettings({ ...widgetSettings, primaryColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '120px' }}
                      value={widgetSettings.primaryColor}
                      onChange={(e) => setWidgetSettings({ ...widgetSettings, primaryColor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Header Text Color</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      className="color-preview-box"
                      value={widgetSettings.headerTextColor || '#ffffff'}
                      onChange={(e) => setWidgetSettings({ ...widgetSettings, headerTextColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '120px' }}
                      value={widgetSettings.headerTextColor || '#ffffff'}
                      onChange={(e) => setWidgetSettings({ ...widgetSettings, headerTextColor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Use Header Gradient</label>
                  <div className="switch-wrapper">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={widgetSettings.useGradient !== false}
                        onChange={(e) => setWidgetSettings({ ...widgetSettings, useGradient: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Apply visual gradient to the widget top header
                    </span>
                  </div>
                </div>

                {widgetSettings.useGradient !== false && (
                  <div className="form-group">
                    <label className="form-label">Gradient Color (Secondary HEX)</label>
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        className="color-preview-box"
                        value={widgetSettings.gradientColor || '#312E81'}
                        onChange={(e) => setWidgetSettings({ ...widgetSettings, gradientColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '120px' }}
                        value={widgetSettings.gradientColor || '#312E81'}
                        onChange={(e) => setWidgetSettings({ ...widgetSettings, gradientColor: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Header Title Message</label>
                  <input
                    type="text"
                    className="form-input"
                    value={widgetSettings.headingText}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, headingText: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status Subtitle text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={widgetSettings.statusText || 'Typically replies instantly'}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, statusText: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Welcome Message Text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={widgetSettings.welcomeMessage}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, welcomeMessage: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Launcher Bubble Button Text (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Chat"
                    value={widgetSettings.launcherText || ''}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, launcherText: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Corner Border Radius: {widgetSettings.borderRadius ?? 16}px</label>
                  <input
                    type="range"
                    min="0"
                    max="28"
                    step="2"
                    className="form-input"
                    style={{ padding: '0', cursor: 'pointer' }}
                    value={widgetSettings.borderRadius ?? 16}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, borderRadius: parseInt(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pre-Chat Survey Capture</label>
                  <div className="switch-wrapper">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={widgetSettings.preChatEnabled}
                        onChange={(e) => setWidgetSettings({ ...widgetSettings, preChatEnabled: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Require visitors to input Name/Email before connecting
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Widget Position</label>
                  <select
                    className="form-input"
                    value={widgetSettings.position}
                    onChange={(e) => setWidgetSettings({ ...widgetSettings, position: e.target.value })}
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <option value="bottom-right">Bottom Right corner</option>
                    <option value="bottom-left">Bottom Left corner</option>
                  </select>
                </div>

                <button className="auth-btn" onClick={handleSaveWidgetSettings} style={{ marginTop: '20px' }}>
                  Synchronize Live Design
                </button>
              </div>

              {/* Live Preview Mockup frame */}
              <div>
                <h3 className="card-title" style={{ marginBottom: '20px' }}>Interactive Mockup Preview</h3>
                <div className="preview-frame-container">
                  
                  {/* Floating Mockup Chat Box */}
                  <div style={{
                    width: '320px',
                    height: '420px',
                    borderRadius: `${widgetSettings.borderRadius ?? 16}px`,
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontFamily: 'sans-serif'
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '16px',
                      background: widgetSettings.useGradient !== false
                        ? `linear-gradient(135deg, ${widgetSettings.primaryColor}, ${widgetSettings.gradientColor || '#312E81'})`
                        : widgetSettings.primaryColor,
                      color: widgetSettings.headerTextColor || 'white'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '700' }}>{widgetSettings.headingText}</div>
                      <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#10B981', borderRadius: '50%' }}></span>
                        {widgetSettings.statusText || 'Typically replies instantly'}
                      </div>
                    </div>
                    {/* Body */}
                    <div style={{ flex: 1, backgroundColor: '#F8FAFC', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                      {widgetSettings.preChatEnabled ? (
                        <div style={{ padding: '10px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{widgetSettings.welcomeMessage}</p>
                          <input type="text" placeholder="Your Name" disabled style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #CBD5E1', borderRadius: '4px', marginBottom: '6px' }} />
                          <button style={{ width: '100%', padding: '6px', background: widgetSettings.primaryColor, color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>Start Live Chat</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ alignSelf: 'flex-start', maxWidth: '80%', padding: '8px 12px', background: '#E2E8F0', color: '#1E293B', borderRadius: '12px', fontSize: '12px', borderBottomLeftRadius: '2px' }}>
                            {widgetSettings.welcomeMessage}
                          </div>
                          <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '8px 12px', background: widgetSettings.primaryColor, color: 'white', borderRadius: '12px', fontSize: '12px', borderBottomRightRadius: '2px' }}>
                            Hello! I need assistance with checkout.
                          </div>
                        </>
                      )}
                    </div>
                    {/* Footer */}
                    <div style={{ padding: '8px 12px', backgroundColor: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                      <input type="text" placeholder="Type a message..." disabled style={{ flex: 1, border: 'none', fontSize: '12px', outline: 'none' }} />
                      <button style={{ background: 'none', border: 'none', color: widgetSettings.primaryColor, fontWeight: '700', fontSize: '12px' }}>Send</button>
                    </div>
                  </div>

                  {/* Floating Trigger button Mock */}
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: widgetSettings.position === 'bottom-right' ? '20px' : 'auto',
                    left: widgetSettings.position === 'bottom-left' ? '20px' : 'auto',
                    height: '48px',
                    borderRadius: widgetSettings.launcherText ? '24px' : '50%',
                    padding: widgetSettings.launcherText ? '0 20px' : '0',
                    minWidth: widgetSettings.launcherText ? 'auto' : '48px',
                    backgroundColor: widgetSettings.primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: '700'
                  }}>
                    <span>💬</span>
                    {widgetSettings.launcherText && (
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{widgetSettings.launcherText}</span>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* E. MANAGE EMPLOYEES VIEW */}
          {activeTab === 'agents' && (
            <div className="monitor-grid">
              <div className="monitor-card glass-card">
                <div className="card-header">
                  <div className="card-title">Registered Employees</div>
                </div>
                <div className="card-body-scroll">
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Email Username</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map(agent => (
                        <tr key={agent._id}>
                          <td>
                            <div className="visitor-badge-info">
                              <div className="agent-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>{agent.name[0]}</div>
                              <div style={{ fontWeight: '600' }}>{agent.name} {agent._id === user.id ? '(You)' : ''}</div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{agent.email}</td>
                          <td>
                            <span className="path-tag" style={{ color: agent.role === 'Admin' ? '#EC4899' : 'var(--primary)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                              {agent.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-dot ${agent.status.toLowerCase()}`} style={{ marginRight: '6px' }}></span>
                            {agent.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invite Employee Form */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 className="card-title" style={{ marginBottom: '20px' }}>Register New Employee</h3>
                
                <form className="auth-form" onSubmit={handleInviteAgent}>
                  <div className="form-group">
                    <label className="form-label">Employee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Jane Watson"
                      value={agentInviteName}
                      onChange={(e) => setAgentInviteName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="jane@company.com"
                      value={agentInviteEmail}
                      onChange={(e) => setAgentInviteEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password credentials</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="At least 6 characters"
                      value={agentInvitePassword}
                      onChange={(e) => setAgentInvitePassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="auth-btn" style={{ marginTop: '10px' }}>
                    Register Employee Account
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Toast popup */}
      {toast && <div className={`toast-msg ${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

export default App;
