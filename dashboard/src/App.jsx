import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import LandingPage from './components/LandingPage';
import DemoSandbox from './components/DemoSandbox';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5004'
  : window.location.origin;

const formatMessageText = (text) => {
  if (!text) return '';
  const regex = /\[timestamp:([^\]]+)\]/g;
  return text.replace(regex, (match, isoString) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  });
};

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
  
  const conversationsRef = useRef(conversations);
  const visitorsRef = useRef(visitors);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    visitorsRef.current = visitors;
  }, [visitors]);

  const [agents, setAgents] = useState([]);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inboxFilter, setInboxFilter] = useState('all'); // all, mine, unassigned, agent-<id>
  
  // Status Selector
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState(user?.status || 'Offline');

  // Input bindings
  const [chatInput, setChatInput] = useState('');
  const [visitorTypingStatus, setVisitorTypingStatus] = useState({}); // visitorId -> boolean

  // Widget settings configuration
  const [widgetSettings, setWidgetSettings] = useState({
    primaryColor: '#DC2626',
    headingText: 'Chat with Us!',
    welcomeMessage: 'Hi there! How can we help you today?',
    preChatEnabled: false,
    position: 'bottom-right',
    headerTextColor: '#ffffff',
    gradientColor: '#450A0A',
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
  const [authMode, setAuthMode] = useState('landing'); // landing | demo | login | register | reset

  const navigateAuthMode = (mode) => {
    setAuthMode(mode);
    if (mode === 'login') {
      window.location.hash = '#login';
    } else if (mode === 'register') {
      window.location.hash = '#register';
    } else if (mode === 'reset') {
      window.location.hash = '#reset';
    } else if (mode === 'demo') {
      window.location.hash = '#demo';
    } else {
      if (window.location.hash && ['#login', '#register', '#reset', '#demo'].includes(window.location.hash)) {
        window.history.pushState(null, '', window.location.pathname);
      }
    }
  };

  useEffect(() => {
    const handleRouteFromLocation = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (hash === '#demo' || path === '/demo') {
        setAuthMode('demo');
      } else if (hash === '#login' || path === '/login') {
        setAuthMode('login');
      } else if (hash === '#register' || hash === '#signup' || path === '/register') {
        setAuthMode('register');
      } else if (hash === '#reset' || path === '/reset') {
        setAuthMode('reset');
      } else if (!hash || hash === '#' || hash.startsWith('#features') || hash.startsWith('#pricing') || hash.startsWith('#faq') || hash.startsWith('#integrations')) {
        setAuthMode('landing');
      }
    };

    handleRouteFromLocation();
    window.addEventListener('hashchange', handleRouteFromLocation);
    window.addEventListener('popstate', handleRouteFromLocation);
    return () => {
      window.removeEventListener('hashchange', handleRouteFromLocation);
      window.removeEventListener('popstate', handleRouteFromLocation);
    };
  }, []);
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

  // Quick Replies states
  const [quickReplies, setQuickReplies] = useState([]);
  const [newShortcut, setNewShortcut] = useState('');
  const [newReplyText, setNewReplyText] = useState('');

  // Editable Visitor info
  const [editVisitorName, setEditVisitorName] = useState('');
  const [editVisitorEmail, setEditVisitorEmail] = useState('');
  const [editVisitorPhone, setEditVisitorPhone] = useState('');
  const [editVisitorMuted, setEditVisitorMuted] = useState(false);

  // Profile editing states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatarUrl || '');
  const [profilePassword, setProfilePassword] = useState('');

  // Integrations states
  const [integrations, setIntegrations] = useState({
    whatsappWeb: { enabled: false },
    whatsappApi: { enabled: false, phoneNumberId: '', accessToken: '', verifyToken: '' },
    meta: { enabled: false, pageId: '', instagramAccountId: '', pageAccessToken: '', verifyToken: '' }
  });
  const [waWebStatus, setWaWebStatus] = useState('DISCONNECTED');
  const [waWebQr, setWaWebQr] = useState(null);
  const [waWebLoading, setWaWebLoading] = useState(false);

  // Proactive New Chat modal states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatChannel, setNewChatChannel] = useState('whatsapp-web');
  const [newChatInitialMessage, setNewChatInitialMessage] = useState('');
  const [newChatLoading, setNewChatLoading] = useState(false);

  // Channel Category Tab Filter
  const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'webchat', 'whatsapp-web', 'whatsapp-api', 'social'

  // Billing & Subscriptions State
  const [billingData, setBillingData] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // SuperAdmin Master Console State
  const [superStats, setSuperStats] = useState(null);
  const [superTenants, setSuperTenants] = useState([]);
  const [superUsers, setSuperUsers] = useState([]);
  const [superPayments, setSuperPayments] = useState([]);
  const [superLogs, setSuperLogs] = useState([]);
  const [superActiveTab, setSuperActiveTab] = useState('tenants'); // 'tenants' | 'payments' | 'users' | 'logs'
  const [superSearch, setSuperSearch] = useState('');
  const [superLoading, setSuperLoading] = useState(false);
  const [manualPaymentModal, setManualPaymentModal] = useState(false);
  const [manualPayTenantId, setManualPayTenantId] = useState('');
  const [manualPayAmount, setManualPayAmount] = useState('299');
  const [manualPayPlan, setManualPayPlan] = useState('growth');
  const [manualPayMethod, setManualPayMethod] = useState('bank_transfer');
  const [manualPayNotes, setManualPayNotes] = useState('');

  // Dynamically load Razorpay SDK
  useEffect(() => {
    if (!document.getElementById('razorpay-checkout-sdk')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const fetchBillingData = async () => {
    if (!token) return;
    try {
      setBillingLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/billing/current`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
        if (data.plan && tenant) {
          setTenant(prev => ({ ...prev, plan: data.plan, maxAgents: data.maxAgents }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch billing info:', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleInitiateUpgrade = async (targetPlan) => {
    if (!token) return;
    try {
      setBillingLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/billing/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: targetPlan })
      });

      const orderData = await res.json();
      if (!res.ok) {
        showToast(orderData.error || 'Failed to initialize subscription order', 'error');
        setBillingLoading(false);
        return;
      }

      // If Razorpay SDK is available and live key is configured
      if (window.Razorpay && orderData.keyId && !orderData.keyId.includes('test_public_demo')) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: 'INR',
          name: 'LetsTrack Platform',
          description: `${targetPlan.toUpperCase()} Plan (₹${orderData.monthlyPrice}/mo + ₹${orderData.setupFee} Setup Fee)`,
          order_id: orderData.orderId,
          prefill: {
            name: orderData.userName || user?.name,
            email: orderData.userEmail || user?.email
          },
          theme: {
            color: '#dc2626'
          },
          handler: async function (response) {
            try {
              const verifyRes = await fetch(`${BACKEND_URL}/api/billing/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: targetPlan,
                  paymentMethod: 'razorpay_checkout'
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyRes.ok) {
                showToast(`🎉 Plan upgraded to ${targetPlan.toUpperCase()} successfully!`);
                fetchBillingData();
              } else {
                showToast(verifyData.error || 'Payment verification failed', 'error');
              }
            } catch (vErr) {
              showToast('Error verifying payment response', 'error');
            }
          },
          modal: {
            ondismiss: function () {
              setBillingLoading(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Instant Simulation / Test Mode Upgrade Confirmation
        const confirmTest = window.confirm(
          `⚡ Razorpay Checkout Simulation:\n\nAuthorizing mandate for ${targetPlan.toUpperCase()} Plan:\n• Monthly: ₹${orderData.monthlyPrice}/mo\n• One-Time Setup Fee: ₹${orderData.setupFee}\n• Total Initial: ₹${orderData.amount}\n\nConfirm to activate plan?`
        );
        if (confirmTest) {
          const verifyRes = await fetch(`${BACKEND_URL}/api/billing/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: orderData.orderId,
              razorpay_payment_id: 'pay_simulated_' + Date.now(),
              plan: targetPlan,
              paymentMethod: 'upi_autopay_mandate'
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            showToast(`🎉 Upgraded to ${targetPlan.toUpperCase()} plan!`);
            fetchBillingData();
          } else {
            showToast(verifyData.error || 'Upgrade failed', 'error');
          }
        }
      }
    } catch (err) {
      showToast('Error creating subscription checkout', 'error');
    } finally {
      setBillingLoading(false);
    }
  };

  // SuperAdmin Data Fetchers & Handlers
  const fetchSuperAdminData = async () => {
    if (!token || user?.role !== 'SuperAdmin') return;
    try {
      setSuperLoading(true);
      const [statsRes, tenantsRes, usersRes, paymentsRes, logsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/superadmin/overview`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/tenants`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/payments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/audit-logs`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok) setSuperStats(await statsRes.json());
      if (tenantsRes.ok) setSuperTenants(await tenantsRes.json());
      if (usersRes.ok) setSuperUsers(await usersRes.json());
      if (paymentsRes.ok) setSuperPayments(await paymentsRes.json());
      if (logsRes.ok) setSuperLogs(await logsRes.json());
    } catch (err) {
      console.error('SuperAdmin fetch error:', err);
    } finally {
      setSuperLoading(false);
    }
  };

  const handleSuperUpdateTenantPlan = async (tenantId, newPlan) => {
    const maxAgents = newPlan === 'growth' ? 3 : newPlan === 'business' ? 6 : newPlan === 'enterprise' ? 20 : 1;
    const planPrice = newPlan === 'growth' ? 299 : newPlan === 'business' ? 399 : newPlan === 'enterprise' ? 999 : 0;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: newPlan,
          planPrice,
          maxAgents,
          features: {
            liveActivityTracking: newPlan !== 'free',
            whitelabelBranding: newPlan !== 'free',
            socialMetaDm: newPlan === 'business' || newPlan === 'enterprise'
          }
        })
      });
      if (res.ok) {
        showToast('Tenant plan updated successfully!');
        fetchSuperAdminData();
      } else {
        showToast('Failed to update tenant plan', 'error');
      }
    } catch (err) {
      showToast('Error updating tenant', 'error');
    }
  };

  const handleSuperToggleSuspend = async (tenantId, currentSuspended) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isSuspended: !currentSuspended })
      });
      if (res.ok) {
        showToast(`Tenant ${!currentSuspended ? 'Suspended' : 'Activated'}!`);
        fetchSuperAdminData();
      }
    } catch (err) {
      showToast('Error updating suspension', 'error');
    }
  };

  const handleSuperImpersonate = async (tenantId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/${tenantId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('letstrack_token', data.token);
        localStorage.setItem('letstrack_user', JSON.stringify(data.user));
        localStorage.setItem('letstrack_tenant', JSON.stringify(data.tenant));
        setToken(data.token);
        setUser(data.user);
        setTenant(data.tenant);
        setActiveTab('analytics');
        showToast(`Logged in as Admin for ${data.tenant.name}`);
      } else {
        showToast(data.error || 'Impersonation failed', 'error');
      }
    } catch (err) {
      showToast('Error impersonating tenant', 'error');
    }
  };

  const handleSuperUpdateUserRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        showToast('User role updated!');
        fetchSuperAdminData();
      }
    } catch (err) {
      showToast('Error updating user role', 'error');
    }
  };

  const handleSuperToggleBanUser = async (userId, currentBanned) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isBanned: !currentBanned })
      });
      if (res.ok) {
        showToast(`User ${!currentBanned ? 'banned' : 'unbanned'}!`);
        fetchSuperAdminData();
      }
    } catch (err) {
      showToast('Error toggling ban status', 'error');
    }
  };

  const handleSuperResetPassword = async (userId, email) => {
    const newPass = window.prompt(`Enter new password for ${email}:`, 'Secret2026!');
    if (!newPass) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Password reset successfully!');
      } else {
        showToast(data.error || 'Password reset failed', 'error');
      }
    } catch (err) {
      showToast('Error resetting password', 'error');
    }
  };

  const handleSuperRecordManualPayment = async (e) => {
    e.preventDefault();
    if (!manualPayTenantId || !manualPayAmount) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId: manualPayTenantId,
          amount: manualPayAmount,
          plan: manualPayPlan,
          paymentMethod: manualPayMethod,
          notes: manualPayNotes
        })
      });
      if (res.ok) {
        showToast('Manual payment recorded & plan adjusted!');
        setManualPaymentModal(false);
        fetchSuperAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to record payment', 'error');
      }
    } catch (err) {
      showToast('Error saving payment', 'error');
    }
  };

  const fetchIntegrations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/integrations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  };

  const fetchWhatsAppWebStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/integrations/whatsapp-web/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWaWebStatus(data.status);
        setWaWebQr(data.qr);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp Web status:', err);
    }
  };

  const handleSaveIntegrations = async (updatedData) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/integrations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrations(data);
        showToast('Integrations updated successfully!');
      } else {
        showToast(data.error || 'Failed to update integrations', 'error');
      }
    } catch (err) {
      showToast('Error updating integrations', 'error');
    }
  };

  const connectWhatsAppWeb = async () => {
    setWaWebLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/integrations/whatsapp-web/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setWaWebStatus(data.status);
        setWaWebQr(data.qr);
        showToast('WhatsApp Web client initialization started!');
      } else {
        showToast(data.error || 'Failed to initialize WhatsApp Web', 'error');
      }
    } catch (err) {
      showToast('Error initializing WhatsApp Web', 'error');
    } finally {
      setWaWebLoading(false);
    }
  };

  const disconnectWhatsAppWeb = async () => {
    setWaWebLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/integrations/whatsapp-web/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setWaWebStatus('DISCONNECTED');
        setWaWebQr(null);
        showToast('WhatsApp Web client disconnected!');
      } else {
        showToast(data.error || 'Failed to disconnect WhatsApp Web', 'error');
      }
    } catch (err) {
      showToast('Error disconnecting WhatsApp Web', 'error');
    } finally {
      setWaWebLoading(false);
    }
  };

  const handleStartNewExternalChat = async (e) => {
    e.preventDefault();
    if (!newChatPhone || !newChatInitialMessage) {
      showToast('Phone number and initial message are required', 'error');
      return;
    }
    setNewChatLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/start-external`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          channel: newChatChannel,
          phoneNumber: newChatPhone,
          name: newChatName,
          text: newChatInitialMessage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start chat');

      showToast('Conversation started successfully!');
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatInitialMessage('');
      
      setConversations(prev => {
        const exists = prev.some(c => c._id === data.conversation._id);
        if (exists) return prev;
        return [data.conversation, ...prev];
      });
      setSelectedConversation(data.conversation);
      setMessages([data.message]);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setNewChatLoading(false);
    }
  };

  const handleArchiveConversation = async (convId, isArchivedState) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${convId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ archive: !isArchivedState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      showToast(data.message);
      setConversations(prev => prev.map(c => c._id === convId ? data.conversation : c));
      if (selectedConversation && selectedConversation._id === convId) {
        setSelectedConversation(data.conversation);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Are you sure you want to permanently delete this conversation and all its messages?')) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${convId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      showToast('Conversation deleted successfully');
      setConversations(prev => prev.filter(c => c._id !== convId));
      if (selectedConversation && selectedConversation._id === convId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // References
  const socketRef = useRef(null);
  const messagesContainerRef = useRef(null);

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

  const handleGoogleLogin = async (idTokenOrEmail) => {
    if (!idTokenOrEmail) return showToast('Please enter your Gmail address or login with Google', 'error');

    const isToken = idTokenOrEmail.length > 50;
    const body = isToken 
      ? { idToken: idTokenOrEmail, credential: idTokenOrEmail }
      : { email: idTokenOrEmail };

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google login failed');

      localStorage.setItem('letstrack_token', data.token);
      localStorage.setItem('letstrack_user', JSON.stringify(data.user));
      localStorage.setItem('letstrack_tenant', JSON.stringify(data.tenant));

      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
      setAgentStatus(data.user.status);
      showToast('Logged in with Gmail successfully!');
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

  const handle1ClickDemoLogin = () => {
    const demoUser = { id: 'demo-agent-01', name: 'Demo Agent (Sales)', email: 'demo@letstrack.io', role: 'Admin', status: 'Online' };
    const demoTenant = { id: 'demo-tenant-99', name: 'Demo Enterprise Store', domain: 'letstrack.manacity.in', apiKey: 'demo_api_key_8840' };
    const demoToken = 'demo_jwt_token_simulation_99201';

    localStorage.setItem('letstrack_token', demoToken);
    localStorage.setItem('letstrack_user', JSON.stringify(demoUser));
    localStorage.setItem('letstrack_tenant', JSON.stringify(demoTenant));

    setToken(demoToken);
    setUser(demoUser);
    setTenant(demoTenant);

    setVisitors([
      { _id: 'v1', name: 'Visitor #8402 (United States)', email: 'alex.m@example.com', phoneNumber: '+1 555-0192', location: 'San Francisco, USA', currentUrl: '/pricing', duration: 192, status: 'Active', isMuted: false, browser: 'Chrome on macOS', flag: '🇺🇸' },
      { _id: 'v2', name: 'Visitor #3194 (London, UK)', email: 'james.k@example.com', phoneNumber: '+44 7911-123456', location: 'London, UK', currentUrl: '/checkout', duration: 105, status: 'Active', isMuted: false, browser: 'Safari on iOS', flag: '🇬🇧' },
      { _id: 'v3', name: 'Visitor #1092 (Germany)', email: 'elena.r@example.com', phoneNumber: '+49 151-234567', location: 'Berlin, Germany', currentUrl: '/docs/wordpress', duration: 42, status: 'Active', isMuted: false, browser: 'Firefox on Windows', flag: '🇩🇪' }
    ]);

    setConversations([
      { _id: 'c1', visitorId: { _id: 'v1', name: 'Visitor #8402 (USA)' }, status: 'Unassigned', channel: 'webchat', unreadCount: 1, lastMessageText: 'Does your WordPress plugin support multisite?', updatedAt: new Date().toISOString() },
      { _id: 'c2', visitorId: { _id: 'v2', name: '@sarah_designs (Instagram DM)' }, status: 'Active', channel: 'instagram', unreadCount: 1, lastMessageText: 'Hi! Can I get a discount for 5 website licenses?', updatedAt: new Date().toISOString() },
      { _id: 'c3', visitorId: { _id: 'v3', name: 'Alex Rivers (FB Messenger)' }, status: 'Assigned', channel: 'facebook', unreadCount: 0, lastMessageText: 'Scheduling live demo for tomorrow!', updatedAt: new Date().toISOString() }
    ]);

    setAnalytics({
      totalVisitors: 1480,
      onlineVisitors: 14,
      activeConversations: 3,
      unassignedConversations: 1,
      totalChats: 248,
      totalAgents: 4,
      onlineAgents: 3
    });

    setWidgetSettings({
      primaryColor: '#dc2626',
      widgetTitle: 'LetsTrack Sales Support',
      welcomeMessage: 'Hi there! 👋 Welcome to Demo Store. How can we help your business today?',
      position: 'bottom-right',
      requirePreChatForm: true
    });

    showToast('Welcome to the Full LetsTrack Dashboard Console (Demo Mode)!');
  };

  const handleSimulateNewVisitor = () => {
    const id = String(Math.floor(1000 + Math.random() * 9000));
    const newVis = {
      _id: `v_${id}`,
      name: `Visitor #${id} (Canada)`,
      email: `visitor${id}@example.com`,
      location: 'Toronto, Canada',
      currentUrl: '/pricing',
      duration: 10,
      status: 'Active',
      browser: 'Chrome on macOS',
      flag: '🇨🇦'
    };
    setVisitors(prev => [newVis, ...prev]);
    showToast(`🔔 New Visitor #${id} landed on /pricing page!`);
  };

  const handleSimulateInstagramDM = () => {
    const id = Math.floor(1000 + Math.random() * 9000);
    const newConv = {
      _id: `c_${id}`,
      visitorId: { _id: `v_${id}`, name: `@user_${id} (Instagram DM)` },
      status: 'Unassigned',
      channel: 'instagram',
      unreadCount: 1,
      lastMessageText: 'Hey! Saw your story about LetsTrack. How fast is the WordPress setup?',
      updatedAt: new Date().toISOString()
    };
    setConversations(prev => [newConv, ...prev]);
    showToast(`📸 Incoming Instagram DM from @user_${id}!`);
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

    // Request native notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

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

    socket.on('whatsapp-web-status', (data) => {
      setWaWebStatus(data.status);
      setWaWebQr(data.qr);
    });

    socket.on('whatsapp-sync-complete', (data) => {
      setVisitors(data.visitors);
      setConversations(data.conversations);
      showToast('WhatsApp conversations synced successfully!');
    });

    // 2. A new visitor connects to the widget
    socket.on('visitor-connected', (visitor) => {
      setVisitors(prev => {
        const existing = prev.find(v => v._id === visitor._id);
        const isAlreadyOnline = existing && existing.isOnline;

        if (!isAlreadyOnline && !visitor.isMuted) {
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

          if ('Notification' in window && Notification.permission === 'granted') {
            const isNew = !existing;
            const title = isNew ? "🟢 New Visitor Online!" : "⚡️ Visitor Returned Online!";
            const body = isNew 
              ? `👤 ${visitor.name} has just landed on your website.`
              : `👤 ${visitor.name} has returned online.`;
            const notification = new Notification(title, {
              body: body,
              tag: `visitor-${visitor._id}`
            });
            notification.onclick = () => {
              window.focus();
              setActiveTab('chat');
              // Open this visitor's chat thread
              const existingConv = conversationsRef.current.find(c => {
                const vId = c.visitorId?._id || c.visitorId;
                return vId === visitor._id;
              });
              if (existingConv) {
                handleSelectConversation(existingConv);
              } else {
                if (socketRef.current) {
                  socketRef.current.emit('start-conversation', { visitorId: visitor._id });
                }
              }
            };
          }
        }

        const index = prev.findIndex(v => v._id === visitor._id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = visitor;
          return updated;
        }
        return [...prev, visitor];
      });
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

      // Show native notification if page is backgrounded or not actively viewing this conversation
      const isWindowActive = document.hasFocus() && activeTab === 'chat' && selectedConversation && selectedConversation._id === conversation._id;
      const shouldNotify = !isWindowActive && (!visitor || !visitor.isMuted) && 
        (conversation.status === 'Unassigned' || 
         (conversation.assignedAgentId && (conversation.assignedAgentId === user.id || conversation.assignedAgentId._id === user.id)));

      if (shouldNotify && 'Notification' in window && Notification.permission === 'granted') {
        const isUnassigned = conversation.status === 'Unassigned';
        const title = isUnassigned ? `⚡️ New Chat Request!` : `💬 Message from ${visitor?.name || 'Visitor'}`;
        const body = isUnassigned 
          ? `👤 ${visitor?.name || 'Visitor'} is waiting for assistance.`
          : message.text;
        const notification = new Notification(title, {
          body: body,
          tag: `conversation-${conversation._id}`
        });
        notification.onclick = () => {
          window.focus();
          setActiveTab('chat');
          const existingConv = conversationsRef.current.find(c => c._id === conversation._id);
          if (existingConv) {
            handleSelectConversation(existingConv);
          } else {
            handleSelectConversation({ ...conversation, visitorId: visitor });
          }
        };
      }

      // Play ringing sound/notification for new message or unassigned queue (skip if visitor is muted)
      if (conversation.status === 'Unassigned' && (!visitor || !visitor.isMuted)) {
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

    // 8. Dynamic conversation updates (like Employee Assignments or Archiving)
    socket.on('chat-assigned-update', (data) => {
      const { conversation, systemMessage } = data;
      
      setConversations(prev => prev.map(c => c._id === conversation._id ? conversation : c));
      
      if (selectedConversation && selectedConversation._id === conversation._id) {
        setSelectedConversation(conversation);
        setMessages(prev => [...prev, systemMessage]);
      }
      
      showToast(`Conversation state updated: ${systemMessage.text}`);
    });

    socket.on('conversation-updated', (updatedConv) => {
      setConversations(prev => prev.map(c => c._id === updatedConv._id ? updatedConv : c));
      if (selectedConversation && selectedConversation._id === updatedConv._id) {
        setSelectedConversation(updatedConv);
      }
    });

    socket.on('conversation-deleted', (data) => {
      setConversations(prev => prev.filter(c => c._id !== data.conversationId));
      if (selectedConversation && selectedConversation._id === data.conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    });

    // 9. Sync agent status changes
    socket.on('agent-status-changed', (data) => {
      setAgents(prev => prev.map(a => a._id === data.agentId ? { ...a, status: data.status } : a));
      if (data.agentId === user.id) {
        setAgentStatus(data.status);
      }
    });

    // 10. Listen to proactive conversation creation
    socket.on('conversation-created', (conversation) => {
      setConversations(prev => {
        if (prev.some(c => c._id === conversation._id)) return prev;
        return [...prev, conversation];
      });
    });

    socket.on('start-conversation-success', (data) => {
      const { conversation } = data;
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id === conversation._id);
        if (idx > -1) {
          const updated = [...prev];
          updated[idx] = conversation;
          return updated;
        }
        return [...prev, conversation];
      });
      handleSelectConversation(conversation);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, tenant, user, selectedConversation]);

  // Scroll active chats automatically
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
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

    // Fetch Quick Replies
    fetch(`${BACKEND_URL}/api/quick-replies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setQuickReplies(data))
      .catch(err => console.error('Error fetching quick replies:', err));

    // Fetch integration configurations
    fetchIntegrations();

    if (activeTab === 'billing') {
      fetchBillingData();
    }
    if (activeTab === 'superadmin' || user?.role === 'SuperAdmin') {
      fetchSuperAdminData();
    }
  }, [token, activeTab]);

  // Sync profile editing fields when user details load/change
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileAvatar(user.avatarUrl || '');
    }
  }, [user]);

  // Sync editable visitor info when selectedVisitor changes
  useEffect(() => {
    if (selectedVisitor) {
      setEditVisitorName(selectedVisitor.name || '');
      setEditVisitorEmail(selectedVisitor.email || '');
      setEditVisitorPhone(selectedVisitor.phoneNumber || '');
      setEditVisitorMuted(!!selectedVisitor.isMuted);
    }
  }, [selectedVisitor]);

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
    if (!conv) return;
    setSelectedConversation(conv);
    const visId = typeof conv.visitorId === 'object' ? conv.visitorId?._id : conv.visitorId;
    const vis = visitors.find(v => v._id === visId) || (typeof conv.visitorId === 'object' ? conv.visitorId : { _id: visId, name: visId });
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

  const handleUpdateVisitor = async () => {
    if (!selectedVisitor) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/visitors/${selectedVisitor._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editVisitorName,
          email: editVisitorEmail,
          phoneNumber: editVisitorPhone,
          isMuted: editVisitorMuted
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update visitor profile');
      
      // Update in visitors state
      setVisitors(prev => prev.map(v => v._id === data._id ? data : v));
      setSelectedVisitor(data);
      showToast('Visitor profile saved successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddQuickReply = async (e) => {
    e.preventDefault();
    if (!newShortcut || !newReplyText) return showToast('Please enter both shortcut and text', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/quick-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shortcut: newShortcut, text: newReplyText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quick reply');

      setQuickReplies(prev => [...prev, data]);
      setNewShortcut('');
      setNewReplyText('');
      showToast('Quick Reply registered successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteQuickReply = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/quick-replies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete quick reply');

      setQuickReplies(prev => prev.filter(qr => qr._id !== id));
      showToast('Quick Reply deleted successfully');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName) return showToast('Name is required', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName,
          avatarUrl: profileAvatar,
          password: profilePassword || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      localStorage.setItem('letstrack_user', JSON.stringify(data));
      setUser(data);
      setProfilePassword('');
      showToast('Your profile has been updated!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (token || authMode !== 'login') return;

    const initGoogleBtn = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: '931640963201-op9i4jmb31lcm8f4v5ggc0ik1oe1vvjk.apps.googleusercontent.com',
            callback: (response) => {
              if (response && response.credential) {
                handleGoogleLogin(response.credential);
              }
            }
          });
          const googleBtnParent = document.getElementById('g_id_signin');
          if (googleBtnParent) {
            googleBtnParent.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnParent, {
              theme: 'outline',
              size: 'large',
              width: 320,
              text: 'continue_with',
              shape: 'rectangular'
            });
          }
        } catch (err) {
          console.error('Google One-Tap initialization error:', err);
        }
      }
    };

    initGoogleBtn();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogleBtn();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [token, authMode]);

  // ============================================
  // RENDER SECTIONS
  // ============================================
  if (!token) {
    if (authMode === 'landing') {
      return (
        <LandingPage
          onNavigateToLogin={() => navigateAuthMode('login')}
          onNavigateToRegister={() => navigateAuthMode('register')}
          onNavigateToDemo={() => navigateAuthMode('demo')}
          on1ClickDemoLogin={handle1ClickDemoLogin}
        />
      );
    }

    if (authMode === 'demo') {
      return (
        <DemoSandbox
          onBackToLanding={() => navigateAuthMode('landing')}
          onNavigateToRegister={() => navigateAuthMode('register')}
          on1ClickDemoLogin={handle1ClickDemoLogin}
        />
      );
    }

    return (
      <div className="auth-wrapper">
        <div className="auth-bg-blob top-left"></div>
        <div className="auth-bg-blob bottom-right"></div>
        
        <div className="auth-card glass-card">
          <div style={{ marginBottom: '16px' }}>
            <span
              className="auth-link"
              onClick={() => navigateAuthMode('landing')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9ca3af' }}
            >
              ← Back to Product Overview
            </span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <img src="/logo-wide.png" alt="LetsTrack" style={{ height: '48px', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
          <div className="auth-subtitle">Real-time Visitor Tracking & Messaging Platform</div>

          {authMode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(15,23,42,0.9))', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '12px', padding: '12px', marginBottom: '16px', textAlignment: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  🚀 Want to explore without signing up?
                </div>
                <button 
                  type="button" 
                  className="auth-btn" 
                  onClick={handle1ClickDemoLogin}
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', padding: '8px 16px', fontSize: '13px' }}
                >
                  Launch Full Live Console (1-Click Demo)
                </button>
              </div>

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
              
              <div id="g_id_signin" style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}></div>

              
              <div className="auth-switch-text" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                <span className="auth-link" onClick={() => navigateAuthMode('register')}>
                  Create Tenant
                </span>
                <span className="auth-link" onClick={() => navigateAuthMode('reset')}>
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
                <span className="auth-link" onClick={() => navigateAuthMode('login')}>
                  Sign In
                </span>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterTenant}>
              <div className="form-group">
                <label className="form-label">Tenant / Business Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Acme Corp"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Domain Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Full Name</label>
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
                <label className="form-label">Admin Email Address</label>
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
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-btn">Register Free Account</button>
              
              <div className="auth-switch-text">
                Already have an account?{' '}
                <span className="auth-link" onClick={() => navigateAuthMode('login')}>
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
    <div className="app-container" style={{ paddingTop: user?.email === 'demo@letstrack.io' ? '46px' : undefined }}>
      {user?.email === 'demo@letstrack.io' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '46px', background: 'linear-gradient(90deg, #dc2626, #991b1b)', color: '#ffffff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 99999, fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 20px rgba(220,38,38,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚡</span>
            <span>YOU ARE IN DEMO MODE — Experiencing the 100% Actual LetsTrack Console Live!</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleSimulateNewVisitor} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              🔔 Simulate New Visitor
            </button>
            <button onClick={handleSimulateInstagramDM} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              📸 Simulate Instagram DM
            </button>
            <button onClick={() => { handleLogout(); navigateAuthMode('register'); }} style={{ background: '#ffffff', color: '#dc2626', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
              Create Account
            </button>
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
              Exit Demo
            </button>
          </div>
        </div>
      )}

      {/* 1. Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo" style={{ padding: '14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo-wide.png" alt="LetsTrack" style={{ maxHeight: '42px', maxWidth: '100%', objectFit: 'contain' }} />
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

          {(user.role === 'Admin' || user.role === 'SuperAdmin') && (
            <button className={`menu-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => { setActiveTab('billing'); fetchBillingData(); }}>
              <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
              Billing & Plan
            </button>
          )}

          {user.role === 'SuperAdmin' && (
            <button 
              className={`menu-item ${activeTab === 'superadmin' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('superadmin'); fetchSuperAdminData(); }}
              style={{ 
                background: activeTab === 'superadmin' ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'rgba(220, 38, 38, 0.12)', 
                border: '1px solid rgba(220, 38, 38, 0.4)',
                color: '#ffffff',
                fontWeight: 700,
                marginTop: '10px'
              }}
            >
              <span style={{ fontSize: '15px' }}>👑</span>
              Super Admin Console
            </button>
          )}

          <button className={`menu-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            Profile Settings
          </button>
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
            {activeTab === 'integrations' && 'Unified Inbox Integrations Hub'}
            {activeTab === 'billing' && 'Subscription & Billing Mandates'}
            {activeTab === 'superadmin' && 'Platform Super Admin Command Center'}
            {activeTab === 'profile' && 'Employee Profile Center'}
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
        <div className={`viewport-content ${activeTab === 'chat' ? 'chat-viewport' : ''}`}>
          
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
            <div>
              {(!tenant?.plan || tenant?.plan === 'free') && (
                <div style={{ 
                  background: 'linear-gradient(90deg, rgba(220,38,38,0.18), rgba(153,27,27,0.28))', 
                  border: '1px solid rgba(220,38,38,0.4)', 
                  borderRadius: '12px', 
                  padding: '14px 20px', 
                  marginBottom: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  flexWrap: 'wrap', 
                  gap: '12px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px' }}>🔒</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        Live Activity Radar & Visitor Journeys is a Pro Feature
                      </div>
                      <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '2px' }}>
                        Upgrade to <strong>Growth (₹299/mo)</strong> or <strong>Business (₹399/mo)</strong> to unlock real-time live page journeys and click tracking.
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('billing'); fetchBillingData(); }}
                    style={{ 
                      background: '#dc2626', 
                      color: '#ffffff', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220,38,38,0.4)'
                    }}
                  >
                    ⚡ Upgrade Plan (From ₹299/mo)
                  </button>
                </div>
              )}

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
                              <div className="visitor-meta-text">
                                {visitor.name}
                                {visitor.isMuted && <span title="Muted" style={{ marginLeft: '4px', color: '#EF4444' }}>🔇</span>}
                              </div>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Full Name</label>
                        <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorName} onChange={(e) => setEditVisitorName(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Address</label>
                        <input type="email" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorEmail} onChange={(e) => setEditVisitorEmail(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone Number</label>
                        <input type="tel" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorPhone} onChange={(e) => setEditVisitorPhone(e.target.value)} placeholder="e.g. +1 234 567 890" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <input type="checkbox" id="visitor-muted-check-1" checked={editVisitorMuted} onChange={(e) => setEditVisitorMuted(e.target.checked)} style={{ cursor: 'pointer' }} />
                        <label htmlFor="visitor-muted-check-1" className="form-label" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }}>Mute & Suppress Alerts</label>
                      </div>
                      <button className="claim-btn" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', backgroundColor: 'var(--primary)' }} onClick={handleUpdateVisitor}>Save Contact Info</button>
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
                    <div className="info-item">
                      <span className="info-item-label">First Seen</span>
                      <span className="info-item-value">
                        {selectedVisitor.firstSeen ? new Date(selectedVisitor.firstSeen).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">Last Active</span>
                      <span className="info-item-value">
                        {selectedVisitor.lastSeen ? new Date(selectedVisitor.lastSeen).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never'}
                      </span>
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
                          // Proactively start a conversation for this visitor
                          if (socketRef.current) {
                            socketRef.current.emit('start-conversation', { visitorId: selectedVisitor._id });
                          }
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
          </div>
        )}

          {/* C. INBOX CONSOLE */}
          {activeTab === 'chat' && (
            <div className="inbox-container">
              {/* 1. Chats Rooms List */}
              <div className="pane-rooms">
                <div className="rooms-filter-tabs" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setShowNewChatModal(true)}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    💬 + New Chat
                  </button>
                  
                  {/* Channel categories tabs */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(5, 1fr)', 
                    gap: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    padding: '3px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <button
                      onClick={() => setChannelFilter('all')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'all' ? 'var(--bg-secondary)' : 'transparent',
                        color: channelFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '10.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="All Channels"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setChannelFilter('webchat')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'webchat' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: channelFilter === 'webchat' ? '#818CF8' : 'var(--text-secondary)',
                        fontSize: '10.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Web Chat"
                    >
                      Web
                    </button>
                    <button
                      onClick={() => setChannelFilter('whatsapp-api')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'whatsapp-api' ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                        color: channelFilter === 'whatsapp-api' ? '#2DD4BF' : 'var(--text-secondary)',
                        fontSize: '10.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="WhatsApp Official API"
                    >
                      API
                    </button>
                    <button
                      onClick={() => setChannelFilter('social')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'social' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                        color: channelFilter === 'social' ? '#F472B6' : 'var(--text-secondary)',
                        fontSize: '10.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Messenger & Instagram"
                    >
                      Social
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className={`filter-tab ${inboxFilter === 'all' ? 'active' : ''}`} 
                      onClick={() => setInboxFilter('all')}
                      style={{ flex: 1, padding: '8px 4px' }}
                    >
                      All
                    </button>
                    <button 
                      className={`filter-tab ${inboxFilter === 'mine' ? 'active' : ''}`} 
                      onClick={() => setInboxFilter('mine')}
                      style={{ flex: 1, padding: '8px 4px' }}
                    >
                      Mine
                    </button>
                    <button 
                      className={`filter-tab ${inboxFilter === 'unassigned' ? 'active' : ''}`} 
                      onClick={() => setInboxFilter('unassigned')}
                      style={{ flex: 1, padding: '8px 4px' }}
                    >
                      Queue
                    </button>
                    <button 
                      className={`filter-tab ${inboxFilter === 'archived' ? 'active' : ''}`} 
                      onClick={() => setInboxFilter('archived')}
                      style={{ flex: 1, padding: '8px 4px' }}
                    >
                      Archived
                    </button>
                  </div>
                  
                  <select
                    value={inboxFilter.startsWith('agent-') ? inboxFilter : ''}
                    onChange={(e) => setInboxFilter(e.target.value || 'all')}
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    <option value="">Filter by Employee...</option>
                    {agents.map(a => (
                      <option key={a._id} value={`agent-${a._id}`}>
                        👤 {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rooms-list">
                  {(() => {
                    let filtered = [...conversations];
                    
                    // Filter by Channel Type
                    if (channelFilter === 'webchat') {
                      filtered = filtered.filter(c => !c.source || c.source === 'webchat');
                    } else if (channelFilter === 'whatsapp-web') {
                      filtered = filtered.filter(c => c.source === 'whatsapp-web');
                    } else if (channelFilter === 'whatsapp-api') {
                      filtered = filtered.filter(c => c.source === 'whatsapp-api');
                    } else if (channelFilter === 'social') {
                      filtered = filtered.filter(c => c.source === 'facebook' || c.source === 'instagram');
                    }

                    // Archive filter logic
                    if (inboxFilter === 'archived') {
                      filtered = filtered.filter(c => c.isArchived || c.status === 'Archived');
                    } else {
                      // Hide archived conversations in normal tabs unless requested
                      filtered = filtered.filter(c => !c.isArchived && c.status !== 'Archived');
                      
                      if (inboxFilter === 'mine') {
                        filtered = filtered.filter(c => c.assignedAgentId && (c.assignedAgentId._id === user.id || c.assignedAgentId === user.id));
                      } else if (inboxFilter === 'unassigned') {
                        filtered = filtered.filter(c => c.status === 'Unassigned');
                      } else if (inboxFilter.startsWith('agent-')) {
                        const agentId = inboxFilter.split('agent-')[1];
                        filtered = filtered.filter(c => c.assignedAgentId && (c.assignedAgentId._id === agentId || c.assignedAgentId === agentId));
                      }
                    }
                    
                    // Sort conversations: Live/online users and latest messages/activity ALWAYS on top
                    const sorted = filtered.sort((a, b) => {
                      const visA = typeof a.visitorId === 'object' ? a.visitorId : visitors.find(v => v._id === a.visitorId);
                      const visB = typeof b.visitorId === 'object' ? b.visitorId : visitors.find(v => v._id === b.visitorId);
                      
                      const isOnlineA = visA?.isOnline ? 1 : 0;
                      const isOnlineB = visB?.isOnline ? 1 : 0;

                      if (isOnlineA !== isOnlineB) {
                        return isOnlineB - isOnlineA; // Live online users first
                      }

                      // Primary timestamp sorting by latest updated activity
                      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                      return timeB - timeA;
                    });

                    return sorted.map(conv => {
                      const vis = typeof conv.visitorId === 'object' ? conv.visitorId : visitors.find(v => v._id === conv.visitorId);
                      const agentName = conv.assignedAgentId ? conv.assignedAgentId.name : 'Unassigned';
                      
                      const renderSourceBadge = () => {
                        let text = 'Web Chat';
                        let bg = 'rgba(99, 102, 241, 0.15)'; 
                        let color = '#818CF8';
                        let icon = '💬';

                        switch (conv.source) {
                          case 'whatsapp-web':
                            text = 'WA Linked';
                            bg = 'rgba(16, 185, 129, 0.15)'; 
                            color = '#34D399';
                            icon = '🟢';
                            break;
                          case 'whatsapp-api':
                            text = 'WA API';
                            bg = 'rgba(20, 184, 166, 0.15)'; 
                            color = '#2DD4BF';
                            icon = '🧪';
                            break;
                          case 'instagram':
                            text = 'Instagram';
                            bg = 'rgba(236, 72, 153, 0.15)'; 
                            color = '#F472B6';
                            icon = '📸';
                            break;
                          case 'facebook':
                            text = 'Messenger';
                            bg = 'rgba(59, 130, 246, 0.15)'; 
                            color = '#60A5FA';
                            icon = '🔵';
                            break;
                        }

                        return (
                          <span 
                            style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              backgroundColor: bg, 
                              color: color, 
                              fontSize: '10px', 
                              fontWeight: '600',
                              marginLeft: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            {icon} {text}
                          </span>
                        );
                      };

                      return (
                        <div
                          key={conv._id}
                          className={`room-card ${selectedConversation?._id === conv._id ? 'active' : ''}`}
                          onClick={() => handleSelectConversation(conv)}
                          style={{ position: 'relative' }}
                        >
                          <div className="room-card-header">
                            <span className="room-name">
                              {vis?.isOnline && <span title="Live Online" style={{ marginRight: '4px', color: '#10B981', fontSize: '10px' }}>🟢</span>}
                              {vis?.name || 'VisitorSession'}
                              {renderSourceBadge()}
                              {vis?.isMuted && <span title="Muted" style={{ marginLeft: '4px', color: '#EF4444' }}>🔇</span>}
                            </span>
                            <span className="room-time">
                              {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="room-preview">
                            {conv.status === 'Unassigned' ? 'Waiting for agent...' : conv.status === 'Archived' || conv.isArchived ? 'Archived conversation' : 'Active chat in progress'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span className="room-assignee" style={{ borderLeft: `2px solid ${conv.assignedAgentId ? 'var(--primary)' : 'var(--warning)'}` }}>
                              👤 {agentName}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleArchiveConversation(conv._id, conv.isArchived || conv.status === 'Archived')}
                                title={conv.isArchived || conv.status === 'Archived' ? "Unarchive Inbox" : "Archive Inbox"}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', padding: '2px' }}
                              >
                                {conv.isArchived || conv.status === 'Archived' ? '📥' : '📦'}
                              </button>
                              <button
                                onClick={() => handleDeleteConversation(conv._id)}
                                title="Delete Inbox Message"
                                style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', padding: '2px' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 2. Actual Chat Window */}
              <div className="pane-chat">
                {selectedConversation ? (
                  <>
                    <div className="chat-pane-header">
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center' }}>
                          {selectedVisitor?.isOnline && <span title="Live Online" style={{ marginRight: '6px', color: '#10B981' }}>🟢</span>}
                          {selectedVisitor?.name || 'Visitor Conversation'}
                          {(() => {
                            let text = 'Web Chat';
                            let bg = 'rgba(99, 102, 241, 0.15)'; 
                            let color = '#818CF8';
                            let icon = '💬';

                            switch (selectedConversation.source) {
                              case 'whatsapp-web':
                                text = 'WA Linked';
                                bg = 'rgba(16, 185, 129, 0.15)'; 
                                color = '#34D399';
                                icon = '🟢';
                                break;
                              case 'whatsapp-api':
                                text = 'WA API';
                                bg = 'rgba(20, 184, 166, 0.15)'; 
                                color = '#2DD4BF';
                                icon = '🧪';
                                break;
                              case 'instagram':
                                text = 'Instagram';
                                bg = 'rgba(236, 72, 153, 0.15)'; 
                                color = '#F472B6';
                                icon = '📸';
                                break;
                              case 'facebook':
                                text = 'Messenger';
                                bg = 'rgba(59, 130, 246, 0.15)'; 
                                color = '#60A5FA';
                                icon = '🔵';
                                break;
                            }

                            return (
                              <span 
                                style={{ 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  backgroundColor: bg, 
                                  color: color, 
                                  fontSize: '10px', 
                                  fontWeight: '600',
                                  marginLeft: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                {icon} {text}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Status:{' '}
                          <span style={{ color: selectedConversation.assignedAgentId ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>
                            {selectedConversation.assignedAgentId ? `Assigned to ${selectedConversation.assignedAgentId.name}` : 'Unassigned in Queue'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleArchiveConversation(selectedConversation._id, selectedConversation.isArchived || selectedConversation.status === 'Archived')}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '605',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {selectedConversation.isArchived || selectedConversation.status === 'Archived' ? '📥 Unarchive' : '📦 Archive'}
                        </button>
                        <button
                          onClick={() => handleDeleteConversation(selectedConversation._id)}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#EF4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '605',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    <div className="chat-messages-board" ref={messagesContainerRef}>
                      {messages.map((msg, i) => (
                        <div key={i} className={`db-msg-row ${msg.senderType.toLowerCase()}`}>
                          <div className="db-msg-bubble">{formatMessageText(msg.text)}</div>
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
                    </div>

                    {/* Canned Quick Replies pills */}
                    <div className="quick-replies-bar" style={{ display: 'flex', gap: '8px', padding: '8px 16px', overflowX: 'auto', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      {quickReplies.length > 0 ? (
                        quickReplies.map(qr => (
                          <button
                            key={qr._id}
                            className="quick-reply-pill"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              border: '1px solid var(--primary)',
                              backgroundColor: 'rgba(124, 58, 237, 0.05)',
                              color: 'var(--primary)',
                              fontSize: '11px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s'
                            }}
                            title={qr.text}
                            onClick={() => setChatInput(qr.text)}
                          >
                            <strong>{qr.shortcut}</strong>: {qr.text.substring(0, 20)}{qr.text.length > 20 ? '...' : ''}
                          </button>
                        ))
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          No quick replies configured. Add them in Profile Settings.
                        </span>
                      )}
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
                      <div className="detail-section-title">Visitor Contact Info</div>
                      <div className="form-group" style={{ marginBottom: '8px', padding: '0 12px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Full Name</label>
                        <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorName} onChange={(e) => setEditVisitorName(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px', padding: '0 12px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Address</label>
                        <input type="email" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorEmail} onChange={(e) => setEditVisitorEmail(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px', padding: '0 12px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone Number</label>
                        <input type="tel" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }} value={editVisitorPhone} onChange={(e) => setEditVisitorPhone(e.target.value)} placeholder="e.g. +1 234 567 890" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '0 12px' }}>
                        <input type="checkbox" id="visitor-muted-check-2" checked={editVisitorMuted} onChange={(e) => setEditVisitorMuted(e.target.checked)} style={{ cursor: 'pointer' }} />
                        <label htmlFor="visitor-muted-check-2" className="form-label" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }}>Mute & Suppress Alerts</label>
                      </div>
                      <div style={{ padding: '0 12px', marginBottom: '12px' }}>
                        <button className="claim-btn" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', width: '100%', backgroundColor: 'var(--primary)' }} onClick={handleUpdateVisitor}>Save Contact Info</button>
                      </div>
                    </div>

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
                      <div className="info-item">
                        <span className="info-item-label">First Seen</span>
                        <span className="info-item-value">
                          {selectedVisitor?.firstSeen ? new Date(selectedVisitor.firstSeen).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never'}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Last Active</span>
                        <span className="info-item-value">
                          {selectedVisitor?.lastSeen ? new Date(selectedVisitor.lastSeen).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never'}
                        </span>
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
                         <th>Active Chats Handled</th>
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
                             <span className="path-tag" style={{ color: agent.role === 'Admin' ? '#EF4444' : 'var(--primary)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                               {agent.role}
                             </span>
                           </td>
                           <td>
                             <span className="path-tag" style={{ color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                               {conversations.filter(c => c.assignedAgentId && (c.assignedAgentId._id === agent._id || c.assignedAgentId === agent._id)).length} active
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

          {/* F. PROFILE & SETTINGS VIEW */}
          {activeTab === 'profile' && (
            <div className="monitor-grid">
              {/* Profile details */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 className="card-title" style={{ marginBottom: '20px' }}>Your Profile Info</h3>
                
                <form className="auth-form" onSubmit={handleUpdateProfile}>
                  <div className="form-group">
                    <label className="form-label">Employee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address (Username)</label>
                    <input
                      type="email"
                      className="form-input"
                      value={user.email}
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Avatar Image URL</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://example.com/avatar.png"
                      value={profileAvatar}
                      onChange={(e) => setProfileAvatar(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Change Password (leave empty to keep current)</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="At least 6 characters"
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="auth-btn" style={{ marginTop: '10px' }}>
                    Save Profile Changes
                  </button>
                </form>
              </div>

              {/* Quick Replies management */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="card-title">Canned Quick Replies</h3>
                
                <form className="auth-form" onSubmit={handleAddQuickReply} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Shortcut</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. /hello"
                        value={newShortcut}
                        onChange={(e) => setNewShortcut(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">Response Text</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Hello! How can I help you today?"
                        value={newReplyText}
                        onChange={(e) => setNewReplyText(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="auth-btn" style={{ marginTop: '10px' }}>
                    Add Quick Reply
                  </button>
                </form>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Configured Quick Replies</h4>
                  {quickReplies.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {quickReplies.map(qr => (
                        <div key={qr._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <strong style={{ color: 'var(--primary)' }}>{qr.shortcut}</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{qr.text}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuickReply(qr._id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                      No quick replies defined yet. Create one above!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* G. INTEGRATIONS HUB VIEW */}
          {activeTab === 'integrations' && (
            <div className="integrations-grid">
              
              {/* WhatsApp Cloud API (Official) */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">WhatsApp Cloud API (Official)</h3>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={integrations.whatsappApi?.enabled || false}
                        onChange={(e) => {
                          const updated = {
                            ...integrations,
                            whatsappApi: { ...integrations.whatsappApi, enabled: e.target.checked }
                          };
                          handleSaveIntegrations(updated);
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span style={{ fontSize: '13px' }}>{integrations.whatsappApi?.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Connect to the official Meta WhatsApp Business Cloud API.
                  </p>
                </div>

                {integrations.whatsappApi?.enabled && (
                  <form 
                    className="auth-form" 
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveIntegrations(integrations);
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label">Phone Number ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 10484729104859"
                        value={integrations.whatsappApi?.phoneNumberId || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          whatsappApi: { ...integrations.whatsappApi, phoneNumberId: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Access Token (Permanent/System User)</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="EAABw..."
                        value={integrations.whatsappApi?.accessToken || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          whatsappApi: { ...integrations.whatsappApi, accessToken: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Verify Token (Custom Secret for Meta Webhooks)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. my_custom_secret_verify_token"
                        value={integrations.whatsappApi?.verifyToken || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          whatsappApi: { ...integrations.whatsappApi, verifyToken: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Meta Webhook Callback URL</label>
                      <input
                        type="text"
                        className="form-input"
                        value={`${BACKEND_URL.replace('localhost', 'your-domain')}/api/webhooks/whatsapp-api`}
                        disabled
                        style={{ opacity: 0.7, cursor: 'copy' }}
                      />
                    </div>
                    <button type="submit" className="auth-btn">Save API Configuration</button>
                  </form>
                )}
              </div>

              {/* Meta Integrations (Facebook & Instagram) */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">Meta (Facebook & Instagram)</h3>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={integrations.meta?.enabled || false}
                        onChange={(e) => {
                          const updated = {
                            ...integrations,
                            meta: { ...integrations.meta, enabled: e.target.checked }
                          };
                          handleSaveIntegrations(updated);
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span style={{ fontSize: '13px' }}>{integrations.meta?.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Receive messages from Facebook Messenger and Instagram Direct.
                  </p>
                </div>

                {integrations.meta?.enabled && (
                  <form 
                    className="auth-form" 
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveIntegrations(integrations);
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label">Facebook Page ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 10928472910"
                        value={integrations.meta?.pageId || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          meta: { ...integrations.meta, pageId: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Instagram Business Account ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 17841400000000"
                        value={integrations.meta?.instagramAccountId || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          meta: { ...integrations.meta, instagramAccountId: e.target.value }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Page Access Token</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="EAABw..."
                        value={integrations.meta?.pageAccessToken || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          meta: { ...integrations.meta, pageAccessToken: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Verify Token (Custom Secret for Meta Webhooks)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. my_custom_secret_verify_token"
                        value={integrations.meta?.verifyToken || ''}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          meta: { ...integrations.meta, verifyToken: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Meta Webhook Callback URL</label>
                      <input
                        type="text"
                        className="form-input"
                        value={`${BACKEND_URL.replace('localhost', 'your-domain')}/api/webhooks/meta`}
                        disabled
                        style={{ opacity: 0.7, cursor: 'copy' }}
                      />
                    </div>
                    <button type="submit" className="auth-btn">Save Meta Configuration</button>
                  </form>
                )}
              </div>

              {/* 4. Diagnostics & Live Logs Card */}
              {user?.role === 'Admin' && (
                <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 className="card-title">Diagnostics & Server Logs</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Monitor the backend process logs and WhatsApp connection handshake states.
                  </p>
                  <div style={{ marginTop: '10px' }}>
                    <a 
                      href={`${BACKEND_URL}/api/debug/logs?token=${encodeURIComponent(token)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="auth-btn"
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '6px',
                        textDecoration: 'none',
                        width: 'auto',
                        padding: '10px 20px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      🔍 Stream Live Server Logs
                    </a>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* F. BILLING & SUBSCRIPTION VIEW */}
          {activeTab === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Current Active Plan Overview */}
              <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                        Current Subscription: {tenant?.plan ? tenant.plan.toUpperCase() : 'FREE'}
                      </h3>
                      <span style={{ 
                        background: tenant?.plan === 'business' ? '#10b981' : tenant?.plan === 'growth' ? '#dc2626' : '#6b7280', 
                        color: 'white', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: 700 
                      }}>
                        {tenant?.subscription?.status === 'active' ? '● Active Mandate' : '● Free Forever'}
                      </span>
                    </div>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {tenant?.plan === 'business' 
                        ? 'Omnichannel tier with 1 Admin + 5 Employees, Live Activity Radar, and Social Media DMs (Instagram + FB).'
                        : tenant?.plan === 'growth'
                        ? 'Growth tier with 1 Admin + 2 Employees, Live Visitor Radar, and Custom Whitelabel Widget.'
                        : 'Free Single-User Plan with standard Live Chat messaging. Upgrade to unlock Team Seats and Live Radar.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RECURRING PRICE</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                        ₹{billingData?.planPrice || (tenant?.plan === 'business' ? 399 : tenant?.plan === 'growth' ? 299 : 0)} / month
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quota Progress Bar */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span>Team Seats Allocated</span>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>
                      {billingData?.usedSeats || 1} / {tenant?.maxAgents || 1} Seats Used
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.min(100, ((billingData?.usedSeats || 1) / (tenant?.maxAgents || 1)) * 100)}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, #dc2626, #ef4444)',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                </div>
              </div>

              {/* Upgrade Tiers Comparison Grid */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '14px' }}>
                  Available Subscription Plans
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  {/* Growth Plan Card */}
                  <div className="glass-card" style={{ 
                    padding: '24px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    border: tenant?.plan === 'growth' ? '2px solid #dc2626' : '1px solid rgba(255,255,255,0.08)',
                    position: 'relative'
                  }}>
                    {tenant?.plan === 'growth' && (
                      <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        CURRENT PLAN
                      </span>
                    )}
                    <div>
                      <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                        🔥 Special Offer: First 1,000 Users
                      </div>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>Growth Plan</h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 16px 0' }}>
                        Ideal for small teams requiring real-time live visitor radar and custom widget branding.
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px', color: '#9ca3af', textDecoration: 'line-through' }}>₹999</span>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff' }}>₹299</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ month</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '16px' }}>
                        + ₹999 one-time onboarding fee
                      </div>

                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#e5e7eb' }}>
                        <li>✓ <strong>1 Admin + 2 Employees</strong> (3 Team Seats)</li>
                        <li>✓ <strong>Real-Time Live Visitor Radar</strong> & Journeys</li>
                        <li>✓ <strong>100% Whitelabel Widget</strong> (Remove Branding)</li>
                        <li>✓ Custom Colors, Themes & Headers</li>
                        <li>✓ Mobile Push Notifications (Android & iOS)</li>
                        <li>✓ Pre-Chat Lead Capture</li>
                      </ul>
                    </div>

                    <button 
                      onClick={() => handleInitiateUpgrade('growth')} 
                      disabled={billingLoading || tenant?.plan === 'growth'}
                      className="auth-btn"
                      style={{ 
                        background: tenant?.plan === 'growth' ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                        color: 'white',
                        cursor: tenant?.plan === 'growth' ? 'default' : 'pointer'
                      }}
                    >
                      {tenant?.plan === 'growth' ? 'Active Plan' : 'Subscribe to Growth (₹299/mo)'}
                    </button>
                  </div>

                  {/* Business Plan Card */}
                  <div className="glass-card" style={{ 
                    padding: '24px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    border: tenant?.plan === 'business' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                    position: 'relative'
                  }}>
                    {tenant?.plan === 'business' && (
                      <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        CURRENT PLAN
                      </span>
                    )}
                    <div>
                      <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                        ⚡ Omnichannel Pro
                      </div>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>Business Plan</h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 16px 0' }}>
                        For modern brands managing Website Chat + Instagram DMs and Facebook Messenger.
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px', color: '#9ca3af', textDecoration: 'line-through' }}>₹1,499</span>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff' }}>₹399</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ month</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#34d399', marginBottom: '16px' }}>
                        + ₹999 one-time onboarding fee
                      </div>

                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#e5e7eb' }}>
                        <li>✓ <strong>1 Admin + 5 Employees</strong> (6 Team Seats)</li>
                        <li>✓ <strong>Everything in Growth Plan</strong></li>
                        <li>✓ <strong>Instagram Direct & Facebook Messenger Sync</strong></li>
                        <li>✓ <strong>100% Whitelabel & Custom Widget</strong></li>
                        <li>✓ High Volume Real-Time Routing</li>
                        <li>✓ Priority Mobile Push & Email Alerts</li>
                      </ul>
                    </div>

                    <button 
                      onClick={() => handleInitiateUpgrade('business')} 
                      disabled={billingLoading || tenant?.plan === 'business'}
                      className="auth-btn"
                      style={{ 
                        background: tenant?.plan === 'business' ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        cursor: tenant?.plan === 'business' ? 'default' : 'pointer'
                      }}
                    >
                      {tenant?.plan === 'business' ? 'Active Plan' : 'Subscribe to Business (₹399/mo)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment History / Invoices */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Payment History & Receipts</h4>
                {(!billingData?.paymentHistory || billingData.paymentHistory.length === 0) ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    No payment transactions recorded yet.
                  </div>
                ) : (
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Plan</th>
                        <th>Payment Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.paymentHistory.map(p => (
                        <tr key={p._id}>
                          <td>{new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 700 }}>₹{p.amount}</td>
                          <td><span style={{ textTransform: 'capitalize' }}>{p.plan}</span></td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.paymentMethod}</td>
                          <td>
                            <span style={{ 
                              color: p.status === 'success' ? '#10b981' : '#ef4444', 
                              fontWeight: 700, 
                              fontSize: '12px' 
                            }}>
                              ● {p.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* G. SUPER ADMIN MASTER CONSOLE VIEW */}
          {activeTab === 'superadmin' && user?.role === 'SuperAdmin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SuperAdmin Overview Stat Grid */}
              <div className="analytics-stats-row">
                <div className="stat-card glass-card">
                  <div className="stat-title">Total Businesses</div>
                  <div className="stat-value">{superStats?.totalTenants || 0}</div>
                  <div className="stat-footer">Registered Websites</div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-title">Global Users</div>
                  <div className="stat-value">{superStats?.totalUsers || 0}</div>
                  <div className="stat-footer">Admins & Agents</div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-title">Active Mandates</div>
                  <div className="stat-value" style={{ color: '#10b981' }}>{superStats?.activeMandates || 0}</div>
                  <div className="stat-footer">Razorpay Auto-Debits</div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-title">Total Revenue</div>
                  <div className="stat-value" style={{ color: '#f59e0b' }}>₹{superStats?.totalRevenueINR || 0}</div>
                  <div className="stat-footer">Subscriptions & Setup Fees</div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-title">Early Bird Quota</div>
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {superStats?.earlyBird?.claimed || 0} / 1000
                  </div>
                  <div className="stat-footer">{superStats?.earlyBird?.remaining || 1000} slots remaining</div>
                </div>
              </div>

              {/* SuperAdmin Sub-Navigation Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'tenants', label: '🏢 Businesses & Tenants', count: superTenants.length },
                    { key: 'payments', label: '💳 Payment Ledger', count: superPayments.length },
                    { key: 'users', label: '👥 Global Users', count: superUsers.length },
                    { key: 'logs', label: '📊 Audit & Telemetry', count: superLogs.length }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSuperActiveTab(tab.key)}
                      style={{
                        background: superActiveTab === tab.key ? '#dc2626' : 'rgba(255,255,255,0.06)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="form-input"
                    style={{ width: '220px', padding: '6px 12px', fontSize: '13px' }}
                    value={superSearch}
                    onChange={(e) => setSuperSearch(e.target.value)}
                  />
                  {superActiveTab === 'payments' && (
                    <button
                      onClick={() => setManualPaymentModal(true)}
                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Record Manual Payment
                    </button>
                  )}
                  <button
                    onClick={fetchSuperAdminData}
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* Sub-Tab 1: Tenants List */}
              {superActiveTab === 'tenants' && (
                <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Business Name</th>
                        <th>Domain / API Key</th>
                        <th>Plan & Seats</th>
                        <th>Admin Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superTenants
                        .filter(t => !superSearch || t.name.toLowerCase().includes(superSearch.toLowerCase()) || t.domain?.toLowerCase().includes(superSearch.toLowerCase()) || t.adminEmail?.toLowerCase().includes(superSearch.toLowerCase()))
                        .map(t => (
                          <tr key={t.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#ffffff' }}>{t.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created: {new Date(t.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td>
                              <div style={{ fontSize: '13px' }}>{t.domain || 'N/A'}</div>
                              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--primary)' }}>{t.apiKey}</div>
                            </td>
                            <td>
                              <select
                                value={t.plan}
                                onChange={(e) => handleSuperUpdateTenantPlan(t.id, e.target.value)}
                                style={{ background: '#1f2937', color: 'white', border: '1px solid #374151', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                              >
                                <option value="free">Free (1 Seat)</option>
                                <option value="growth">Growth - ₹299 (3 Seats)</option>
                                <option value="business">Business - ₹399 (6 Seats)</option>
                                <option value="enterprise">Enterprise - Custom</option>
                              </select>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Seats: {t.userCount} / {t.maxAgents}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '13px' }}>{t.adminEmail}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.adminName}</div>
                            </td>
                            <td>
                              <span style={{ 
                                background: t.isSuspended ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', 
                                color: t.isSuspended ? '#ef4444' : '#10b981', 
                                padding: '3px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px', 
                                fontWeight: 700 
                              }}>
                                {t.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleSuperImpersonate(t.id)}
                                  title="Login as Tenant Admin"
                                  style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  🔑 Login As
                                </button>
                                <button
                                  onClick={() => handleSuperToggleSuspend(t.id, t.isSuspended)}
                                  style={{ background: t.isSuspended ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: t.isSuspended ? '#34d399' : '#f87171', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {t.isSuspended ? 'Activate' : 'Suspend'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 2: Payment Ledger */}
              {superActiveTab === 'payments' && (
                <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Business</th>
                        <th>Amount (INR)</th>
                        <th>Plan</th>
                        <th>Method / Txn ID</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superPayments
                        .filter(p => !superSearch || p.tenantId?.name?.toLowerCase().includes(superSearch.toLowerCase()) || p.razorpayPaymentId?.toLowerCase().includes(superSearch.toLowerCase()))
                        .map(p => (
                          <tr key={p._id}>
                            <td>{new Date(p.createdAt).toLocaleString()}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{p.tenantId?.name || 'Deleted Tenant'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.tenantId?.domain}</div>
                            </td>
                            <td style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>₹{p.amount}</td>
                            <td><span style={{ textTransform: 'capitalize' }}>{p.plan}</span> ({p.type})</td>
                            <td>
                              <div style={{ fontSize: '12px' }}>{p.paymentMethod}</div>
                              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.razorpayPaymentId}</div>
                            </td>
                            <td>
                              <span style={{ 
                                color: p.status === 'success' ? '#10b981' : '#ef4444', 
                                fontWeight: 700, 
                                fontSize: '12px' 
                              }}>
                                ● {p.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 3: Global Users */}
              {superActiveTab === 'users' && (
                <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Email</th>
                        <th>Associated Business</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superUsers
                        .filter(u => !superSearch || u.name?.toLowerCase().includes(superSearch.toLowerCase()) || u.email?.toLowerCase().includes(superSearch.toLowerCase()) || u.tenantId?.name?.toLowerCase().includes(superSearch.toLowerCase()))
                        .map(u => (
                          <tr key={u._id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#ffffff' }}>{u.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Active: {new Date(u.lastActive || u.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td>{u.email}</td>
                            <td>{u.tenantId?.name || 'Platform Admin'}</td>
                            <td>
                              <select
                                value={u.role}
                                onChange={(e) => handleSuperUpdateUserRole(u._id, e.target.value)}
                                style={{ background: '#1f2937', color: 'white', border: '1px solid #374151', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' }}
                              >
                                <option value="SuperAdmin">SuperAdmin</option>
                                <option value="Admin">Admin</option>
                                <option value="Agent">Agent</option>
                              </select>
                            </td>
                            <td>
                              <span style={{ 
                                background: u.isBanned ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', 
                                color: u.isBanned ? '#ef4444' : '#10b981', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontSize: '11px', 
                                fontWeight: 700 
                              }}>
                                {u.isBanned ? 'BANNED' : u.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleSuperResetPassword(u._id, u.email)}
                                  style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                  🔑 Reset Pass
                                </button>
                                <button
                                  onClick={() => handleSuperToggleBanUser(u._id, u.isBanned)}
                                  style={{ background: u.isBanned ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: u.isBanned ? '#34d399' : '#f87171', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                  {u.isBanned ? 'Unban' : 'Ban'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 4: Security & Audit Logs */}
              {superActiveTab === 'logs' && (
                <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
                  <table className="visitor-list-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Business</th>
                        <th>Actor</th>
                        <th>Event Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superLogs.map(l => (
                        <tr key={l._id}>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td>
                          <td>
                            <span style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                              {l.action}
                            </span>
                          </td>
                          <td>{l.tenantId?.name || 'System / Platform'}</td>
                          <td style={{ fontSize: '12px' }}>{l.actorEmail || 'system'}</td>
                          <td style={{ fontSize: '11px', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {JSON.stringify(l.details || {})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* Manual Offline Payment Modal for SuperAdmin */}
          {manualPaymentModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999
            }}>
              <div className="glass-card" style={{ padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>Record Offline / Manual Payment</h3>
                
                <form onSubmit={handleSuperRecordManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Select Business / Tenant</label>
                    <select
                      className="form-input"
                      value={manualPayTenantId}
                      onChange={(e) => setManualPayTenantId(e.target.value)}
                      required
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="">-- Choose Tenant --</option>
                      {superTenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.domain || t.adminEmail})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Amount (INR)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={manualPayAmount}
                      onChange={(e) => setManualPayAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Upgrade Plan Target</label>
                    <select
                      className="form-input"
                      value={manualPayPlan}
                      onChange={(e) => setManualPayPlan(e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="growth">Growth (₹299/mo - 3 Seats)</option>
                      <option value="business">Business (₹399/mo - 6 Seats + Social DM)</option>
                      <option value="enterprise">Enterprise (Custom Seats)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Payment Method</label>
                    <select
                      className="form-input"
                      value={manualPayMethod}
                      onChange={(e) => setManualPayMethod(e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="bank_transfer">Direct Bank Transfer / NEFT / IMPS</option>
                      <option value="upi_manual">Manual UPI QR</option>
                      <option value="cash">Cash / Cheque</option>
                      <option value="complimentary">Complimentary / VIP Sponsorship</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Reference Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Invoice #102, Bank UTR 918239120"
                      value={manualPayNotes}
                      onChange={(e) => setManualPayNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="claim-btn"
                      onClick={() => setManualPaymentModal(false)}
                      style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="claim-btn"
                      style={{ flex: 1, backgroundColor: '#10b981' }}
                    >
                      Save & Activate Plan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* New Chat Modal */}
      {showNewChatModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card" style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>Proactive New WhatsApp Chat</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              Initiate a 1-to-1 conversation by entering the customer's phone number.
            </p>
            
            <form onSubmit={handleStartNewExternalChat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Channel Source</label>
                <select
                  className="form-input"
                  value={newChatChannel}
                  onChange={(e) => setNewChatChannel(e.target.value)}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="whatsapp-web">WhatsApp Web (Linked Devices)</option>
                  <option value="whatsapp-api">WhatsApp Official API</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Customer Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +919876543210"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Customer Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Initial Message Text</label>
                <textarea
                  className="form-input"
                  placeholder="Type initial message to send..."
                  value={newChatInitialMessage}
                  onChange={(e) => setNewChatInitialMessage(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="claim-btn"
                  onClick={() => setShowNewChatModal(false)}
                  style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="claim-btn"
                  disabled={newChatLoading}
                  style={{ flex: 1, backgroundColor: 'var(--primary)' }}
                >
                  {newChatLoading ? 'Starting...' : 'Start Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast popup */}
      {toast && <div className={`toast-msg ${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

export default App;
