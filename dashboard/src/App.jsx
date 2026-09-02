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
  
  // Hash-based Navigation Mapping (ensures URL updates on tab switch)
  const tabToHash = {
    analytics: 'overview',
    monitor: 'monitor',
    chat: 'inbox',
    whatsapp: 'whatsapp',
    agents: 'team',
    customize: 'widget',
    billing: 'billing',
    superadmin: 'superadmin',
    profile: 'profile'
  };
  const hashToTab = {
    overview: 'analytics',
    monitor: 'monitor',
    inbox: 'chat',
    whatsapp: 'whatsapp',
    team: 'agents',
    widget: 'customize',
    billing: 'billing',
    superadmin: 'superadmin',
    profile: 'profile'
  };

  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return hashToTab[hash] || 'analytics';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (tabToHash[tab]) {
      window.location.hash = tabToHash[tab];
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hashToTab[hash]) {
        setActiveTabState(hashToTab[hash]);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Collapsible Layouts State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('letstrack_sidebar_collapsed') === 'true');
  const [chatDetailsCollapsed, setChatDetailsCollapsed] = useState(() => localStorage.getItem('letstrack_chat_details_collapsed') === 'true');

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('letstrack_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleChatDetails = () => {
    setChatDetailsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('letstrack_chat_details_collapsed', String(next));
      return next;
    });
  };
  
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

  const selectedConversationRef = useRef(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Channel SVG Icon Component Helper
  const renderChannelIcon = (source, size = 14) => {
    let rawSource = typeof source === 'object' && source !== null 
      ? (source.source || source.channel) 
      : source;
      
    if (typeof rawSource === 'string') {
      rawSource = rawSource.toLowerCase().trim();
    }

    switch (rawSource) {
      case 'whatsapp-web':
      case 'whatsapp-api':
      case 'whatsapp':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}>
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.19 8.19 0 0 1-5.82 2.42c-1.46 0-2.89-.39-4.14-1.13l-.3-.18-3.11.82.83-3.03-.2-.31a8.21 8.21 0 0 1-1.26-4.41c0-4.54 3.7-8.24 8.24-8.24zm4.8 11.66c-.2-.1-.7-.35-.8-.4-.1-.05-.18-.08-.25.08-.08.15-.3.4-.38.48-.08.08-.15.1-.25.05-.7-.35-1.35-.76-1.89-1.32-.42-.44-.75-.95-.98-1.5-.08-.18.08-.27.18-.37.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34h-.38c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66 0 .98.71 1.93.81 2.06.1.13 1.4 2.14 3.39 3 1.99.86 1.99.57 2.35.54.36-.03 1.16-.47 1.32-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.38-.23z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="#0084FF" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.47 5.43 3.77 7.05V22l3.78-2.08c.79.22 1.61.34 2.45.34 5.52 0 10-4.03 10-9s-4.48-9-10-9zm1.06 12.14l-2.73-2.91-5.33 2.91 5.86-6.22 2.78 2.91 5.28-2.91-5.86 6.22z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="#E1306C" style={{ flexShrink: 0 }}>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      case 'webchat':
      case 'web':
      case 'website':
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="#6366F1" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        );
    }
  };

  const renderSourceBadge = (source) => {
    let rawSource = typeof source === 'object' && source !== null 
      ? (source.source || source.channel) 
      : source;
    
    if (typeof rawSource === 'string') {
      rawSource = rawSource.toLowerCase().trim();
    }
    
    let label = 'Web';
    let bg = '#eef2ff';
    let color = '#4f46e5';

    switch (rawSource) {
      case 'whatsapp-web':
      case 'whatsapp':
        label = 'WhatsApp';
        bg = '#dcfce7';
        color = '#16a34a';
        break;
      case 'whatsapp-api':
        label = 'WA API';
        bg = '#ccfbf1';
        color = '#0d9488';
        break;
      case 'facebook':
        label = 'Messenger';
        bg = '#eff6ff';
        color = '#2563eb';
        break;
      case 'instagram':
        label = 'Instagram';
        bg = '#fdf2f8';
        color = '#db2777';
        break;
      case 'webchat':
      case 'web':
      case 'website':
      default:
        label = 'Web';
        bg = '#eef2ff';
        color = '#4f46e5';
        break;
    }

    return (
      <span 
        className="channel-tag-pill" 
        style={{ backgroundColor: bg, color: color, fontWeight: 700 }}
      >
        {renderChannelIcon(rawSource, 12)} {label}
      </span>
    );
  };
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
  const [agentInviteRole, setAgentInviteRole] = useState('Agent');
  const [seatInfo, setSeatInfo] = useState({ used: 1, max: 1, plan: 'free' });
  const [inboxSearchQuery, setInboxSearchQuery] = useState('');

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
      { _id: 'c1', visitorId: { _id: 'v1', name: 'Visitor #8402 (USA)' }, status: 'Unassigned', source: 'webchat', channel: 'webchat', unreadCount: 1, lastMessageText: 'Does your WordPress plugin support multisite?', updatedAt: new Date().toISOString() },
      { _id: 'c2', visitorId: { _id: 'v2', name: '@sarah_designs (Instagram DM)' }, status: 'Active', source: 'instagram', channel: 'instagram', unreadCount: 1, lastMessageText: 'Hi! Can I get a discount for 5 website licenses?', updatedAt: new Date().toISOString() },
      { _id: 'c3', visitorId: { _id: 'v3', name: 'Alex Rivers (FB Messenger)' }, status: 'Assigned', source: 'facebook', channel: 'facebook', unreadCount: 0, lastMessageText: 'Scheduling live demo for tomorrow!', updatedAt: new Date().toISOString() }
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
      city: 'Toronto',
      country: 'Canada',
      currentUrl: '/pricing',
      duration: 10,
      status: 'Active',
      isOnline: true,
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'Desktop',
      flag: '🇨🇦'
    };

    const newConv = {
      _id: `c_${id}`,
      visitorId: newVis,
      status: 'Unassigned',
      source: 'webchat',
      channel: 'webchat',
      unreadCount: 1,
      lastMessageText: 'Hi! I am browsing the /pricing page and have a question about the Growth plan.',
      updatedAt: new Date().toISOString()
    };

    setVisitors(prev => [newVis, ...prev]);
    setConversations(prev => [newConv, ...prev]);
    setSelectedVisitor(newVis);
    setSelectedConversation(newConv);
    setMessages([
      {
        _id: `m_${id}`,
        conversationId: `c_${id}`,
        senderType: 'visitor',
        senderName: `Visitor #${id}`,
        text: 'Hi! I am browsing the /pricing page and have a question about the Growth plan.',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ]);
    showToast(`🔔 New Visitor #${id} landed on /pricing and joined Live Inbox!`);
  };

  const handleSimulateInstagramDM = () => {
    const id = Math.floor(1000 + Math.random() * 9000);
    const newVisitor = {
      _id: `v_${id}`,
      name: `@user_${id} (Instagram DM)`,
      source: 'instagram',
      city: 'Direct',
      country: 'Instagram',
      deviceType: 'Instagram App',
      browser: 'In-App Browser',
      os: 'iOS/Android',
      isOnline: true
    };
    const newConv = {
      _id: `c_${id}`,
      visitorId: newVisitor,
      status: 'Unassigned',
      source: 'instagram',
      channel: 'instagram',
      unreadCount: 1,
      lastMessageText: 'Hey! Saw your story about LetsTrack. How fast is the WordPress setup?',
      updatedAt: new Date().toISOString()
    };
    setVisitors(prev => [newVisitor, ...prev]);
    setConversations(prev => [newConv, ...prev]);
    setSelectedVisitor(newVisitor);
    setSelectedConversation(newConv);
    setMessages([
      {
        _id: `m_${id}`,
        conversationId: `c_${id}`,
        senderType: 'visitor',
        senderName: `@user_${id}`,
        text: 'Hey! Saw your story about LetsTrack. How fast is the WordPress setup?',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ]);
    showToast(`📸 Incoming Instagram DM from @user_${id}!`);
  };

  const fetchAgentsData = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        if (data.seatInfo) {
          setSeatInfo(data.seatInfo);
        }
      }
    } catch (err) {
      console.error('Error fetching agents data:', err);
    }
  };

  const handleInviteAgent = async (e) => {
    e.preventDefault();
    if (!agentInviteName || !agentInviteEmail || !agentInvitePassword) {
      return showToast('Fill all fields to invite staff member', 'error');
    }

    if (seatInfo.used >= seatInfo.max && user?.role !== 'SuperAdmin') {
      showToast(`Team seat limit reached (${seatInfo.used}/${seatInfo.max} seats used). Upgrade plan to add more agents!`, 'error');
      setActiveTab('billing');
      return;
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
          password: agentInvitePassword,
          role: agentInviteRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agent');

      showToast(`Staff member ${agentInviteName} added successfully!`);
      setAgentInviteName('');
      setAgentInviteEmail('');
      setAgentInvitePassword('');
      setAgentInviteRole('Agent');
      fetchAgentsData();
      
      // Update Agent List via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('agent-init', { tenantId: tenant.id, agentId: user.id });
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAgent = async (agentId, agentName) => {
    if (!window.confirm(`Are you sure you want to remove "${agentName}"? This will reclaim 1 team seat.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete agent');
      showToast(data.message || 'Staff member removed successfully');
      fetchAgentsData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetAgentPassword = async (agentId, agentName) => {
    const newPass = window.prompt(`Enter new password for ${agentName} (minimum 6 characters):`, 'Secret2026!');
    if (!newPass) return;
    if (newPass.length < 6) return showToast('Password must be at least 6 characters', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/${agentId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      showToast(data.message || 'Password reset successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCleanupDemoAccounts = async () => {
    if (!window.confirm('Clean up and remove all demo/test accounts created during initial testing?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/cleanup-demo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cleanup demo accounts');
      showToast(data.message || 'Demo accounts cleaned up');
      fetchAgentsData();
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
      
      const isCurrentlyActive = selectedConversationRef.current && selectedConversationRef.current._id === conversation._id && activeTab === 'chat' && document.hasFocus();

      // Sync conversation in list and update unread count
      setConversations(prev => {
        const index = prev.findIndex(c => c._id === conversation._id);
        const unreadInc = isCurrentlyActive ? 0 : (conversation.unreadCount || 1);

        if (index > -1) {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            status: conversation.status, 
            updatedAt: conversation.updatedAt || new Date(),
            lastMessageText: message.text,
            unreadCount: isCurrentlyActive ? 0 : ((updated[index].unreadCount || 0) + 1)
          };
          return updated;
        }
        return [...prev, { ...conversation, visitorId: visitor, lastMessageText: message.text, unreadCount: unreadInc }];
      });

      // Show native notification if page is backgrounded or not actively viewing this conversation
      const isWindowActive = document.hasFocus() && activeTab === 'chat' && selectedConversationRef.current && selectedConversationRef.current._id === conversation._id;
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

      // If active conversation, append message to message board immediately
      if (selectedConversationRef.current && selectedConversationRef.current._id === conversation._id) {
        setMessages(prev => [...prev, message]);
      }
    });

    // 7. Conversation Marked as Read
    socket.on('conversation-read', (data) => {
      setConversations(prev => prev.map(c => c._id === data.conversationId ? { ...c, unreadCount: 0 } : c));
    });

    // 8. Incoming message acknowledgment from other agents
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
    fetchAgentsData();

    if (activeTab === 'billing') {
      fetchBillingData();
    }
    if (activeTab === 'agents') {
      fetchAgentsData();
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

    // Immediately mark conversation as read in state
    setConversations(prev => prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c));

    // Emit socket event to notify other agent dashboards
    if (socketRef.current) {
      socketRef.current.emit('mark-conversation-read', { conversationId: conv._id });
    }

    // Persist read state to backend
    fetch(`${BACKEND_URL}/api/conversations/${conv._id}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(err => console.error('Error marking conversation read:', err));

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
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" style={{ padding: '14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <img src="/logo-wide.png" alt="LetsTrack" style={{ maxHeight: '40px', maxWidth: sidebarCollapsed ? '32px' : '130px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
          <button 
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="sidebar-collapse-btn"
            style={{ padding: '4px 6px', fontSize: '11px' }}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        <div className="sidebar-menu">
          <button className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')} title="Overview Panel">
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
            <span>Overview Panel</span>
          </button>
          
          <button className={`menu-item ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')} title="Active Monitor">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            <span>Active Monitor</span>
          </button>

          <button className={`menu-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')} title="Inbox Console">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            <span>Inbox Console</span>
          </button>

          {/* New WhatsApp Business API tab (Coming Soon) */}
          <button className={`menu-item ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')} title="WhatsApp Business API (Coming Soon)">
            <svg viewBox="0 0 24 24" style={{ fill: '#25D366' }}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.58 3.67 20.28 7.37 20.28 11.92C20.28 16.46 16.58 20.17 12.05 20.17C10.58 20.17 9.15 19.78 7.91 19.05L7.61 18.87L4.5 19.69L5.33 16.65L5.13 16.34C4.34 15.08 3.8 13.53 3.8 11.92C3.8 7.37 7.5 3.67 12.05 3.67Z"/></svg>
            <span>WhatsApp API</span>
            <span style={{ 
              marginLeft: 'auto', 
              fontSize: '9.5px', 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, #25D366, #128C7E)', 
              color: '#ffffff', 
              padding: '2px 6px', 
              borderRadius: '8px', 
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)' 
            }}>
              🚀 Soon
            </span>
          </button>

          <button className={`menu-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => { setActiveTab('agents'); fetchAgentsData(); }} title="Team & Staff">
            <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span>Team & Staff</span>
            <span style={{ 
              marginLeft: 'auto', 
              fontSize: '10px', 
              fontWeight: 700, 
              background: seatInfo.used >= seatInfo.max ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.06)', 
              color: seatInfo.used >= seatInfo.max ? '#dc2626' : 'var(--text-secondary)',
              padding: '2px 7px', 
              borderRadius: '10px' 
            }}>
              {seatInfo.used}/{seatInfo.max}
            </span>
          </button>

          <button className={`menu-item ${activeTab === 'customize' ? 'active' : ''}`} onClick={() => setActiveTab('customize')} title="Widget Customizer">
            <svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
            <span>Widget Customizer</span>
          </button>

          {(user.role === 'Admin' || user.role === 'SuperAdmin') && (
            <button className={`menu-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => { setActiveTab('billing'); fetchBillingData(); }} title="Billing & Plan">
              <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
              <span>Billing & Plan</span>
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
              title="Super Admin Console"
            >
              <span style={{ fontSize: '15px' }}>👑</span>
              <span>Super Admin Console</span>
            </button>
          )}

          <button className={`menu-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} title="Profile Settings">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>Profile Settings</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              onClick={toggleSidebar}
              className="sidebar-collapse-btn"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              ☰
            </button>
            <div className="navbar-title">
              {activeTab === 'analytics' && 'Operational Metrics Overview'}
              {activeTab === 'monitor' && 'Live Traffic Analytics'}
              {activeTab === 'chat' && 'Live Chat Dashboard'}
              {activeTab === 'whatsapp' && 'Meta WhatsApp Business API Hub'}
              {activeTab === 'customize' && 'Widget Configuration Center'}
              {activeTab === 'agents' && 'Employee Administration'}
              {activeTab === 'integrations' && 'Unified Inbox Integrations Hub'}
              {activeTab === 'billing' && 'Subscription & Billing Mandates'}
              {activeTab === 'superadmin' && 'Platform Super Admin Command Center'}
              {activeTab === 'profile' && 'Employee Profile Center'}
            </div>
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
                  background: '#fef2f2', 
                  border: '1px solid #fecdd3', 
                  borderRadius: '12px', 
                  padding: '14px 20px', 
                  marginBottom: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  flexWrap: 'wrap', 
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.06)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px' }}>🔒</span>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#991b1b' }}>
                        Live Activity Radar & Visitor Journeys is a Pro Feature
                      </div>
                      <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>
                        Upgrade to <strong>Growth (₹299/mo)</strong> or <strong>Business (₹399/mo)</strong> to unlock real-time live page journeys and click tracking.
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('billing'); fetchBillingData(); }}
                    style={{ 
                      background: 'linear-gradient(135deg, #dc2626, #b91c1c)', 
                      color: '#ffffff', 
                      border: 'none', 
                      padding: '8px 18px', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '12.5px', 
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220,38,38,0.25)'
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Top Action: Glowing Open Chat Thread CTA */}
                    <button
                      onClick={() => {
                        setActiveTab('chat');
                        const existing = conversations.find(c => (c.visitorId?._id || c.visitorId) === selectedVisitor._id);
                        if (existing) {
                          handleSelectConversation(existing);
                        } else {
                          const tempConv = {
                            _id: `c_${selectedVisitor._id}`,
                            visitorId: selectedVisitor,
                            status: 'Unassigned',
                            source: selectedVisitor.source || 'webchat',
                            channel: selectedVisitor.source || 'webchat',
                            unreadCount: 0,
                            lastMessageText: `Chat session with ${selectedVisitor.name}`,
                            updatedAt: new Date().toISOString()
                          };
                          setConversations(prev => [tempConv, ...prev.filter(c => (c.visitorId?._id || c.visitorId) !== selectedVisitor._id)]);
                          handleSelectConversation(tempConv);
                          if (socketRef.current) {
                            socketRef.current.emit('start-conversation', { visitorId: selectedVisitor._id });
                          }
                        }
                      }}
                      style={{ 
                        background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #b91c1c 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '13px 18px',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 6px 20px rgba(220, 38, 38, 0.35), 0 0 0 1px rgba(220, 38, 38, 0.2)',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>💬</span>
                        <span>Open Live Chat Thread</span>
                      </div>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                        {selectedVisitor.isOnline ? '🟢 Live' : 'Offline'}
                      </span>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Full Name</label>
                        <input type="text" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorName} onChange={(e) => setEditVisitorName(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Address</label>
                        <input type="email" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorEmail} onChange={(e) => setEditVisitorEmail(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone Number</label>
                        <input type="tel" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorPhone} onChange={(e) => setEditVisitorPhone(e.target.value)} placeholder="e.g. +1 234 567 890" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <input type="checkbox" id="visitor-muted-check-1" checked={editVisitorMuted} onChange={(e) => setEditVisitorMuted(e.target.checked)} style={{ cursor: 'pointer' }} />
                        <label htmlFor="visitor-muted-check-1" className="form-label" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }}>Mute & Suppress Alerts</label>
                      </div>
                      <button 
                        style={{ 
                          padding: '10px 16px', 
                          fontSize: '13px', 
                          fontWeight: 700, 
                          marginTop: '4px', 
                          background: 'linear-gradient(135deg, #dc2626, #b91c1c)', 
                          color: '#ffffff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          width: '100%',
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }} 
                        onClick={handleUpdateVisitor}
                      >
                        💾 Save Contact Info
                      </button>
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
                      <span className="info-item-value">{selectedVisitor.referrer || 'Direct / Organic'}</span>
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
                <div className="rooms-filter-tabs" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
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
                      boxShadow: '0 0 10px rgba(220, 38, 38, 0.25)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    💬 + New Chat
                  </button>

                  {/* Search Filter Input */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      className="inbox-search-input"
                      placeholder="Search name, phone, message..."
                      value={inboxSearchQuery}
                      onChange={(e) => setInboxSearchQuery(e.target.value)}
                      style={{ width: '100%', paddingLeft: '28px', paddingRight: inboxSearchQuery ? '24px' : '10px' }}
                    />
                    <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      🔍
                    </span>
                    {inboxSearchQuery && (
                      <button
                        onClick={() => setInboxSearchQuery('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {/* Channel categories tabs with Official Icons */}
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
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
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
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        transition: 'all 0.2s'
                      }}
                      title="Web Chat"
                    >
                      {renderChannelIcon('webchat', 13)}
                      <span>Web</span>
                    </button>
                    <button
                      onClick={() => setChannelFilter('whatsapp')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'whatsapp' ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
                        color: channelFilter === 'whatsapp' ? '#25D366' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        transition: 'all 0.2s'
                      }}
                      title="WhatsApp (Linked & API)"
                    >
                      {renderChannelIcon('whatsapp-web', 13)}
                      <span>WA</span>
                    </button>
                    <button
                      onClick={() => setChannelFilter('facebook')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'facebook' ? 'rgba(0, 132, 255, 0.15)' : 'transparent',
                        color: channelFilter === 'facebook' ? '#60A5FA' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        transition: 'all 0.2s'
                      }}
                      title="Facebook Messenger"
                    >
                      {renderChannelIcon('facebook', 13)}
                      <span>FB</span>
                    </button>
                    <button
                      onClick={() => setChannelFilter('instagram')}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelFilter === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'transparent',
                        color: channelFilter === 'instagram' ? '#F472B6' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        transition: 'all 0.2s'
                      }}
                      title="Instagram DM"
                    >
                      {renderChannelIcon('instagram', 13)}
                      <span>Insta</span>
                    </button>
                  </div>
                  
                  {/* Filter Sub-Tabs with Counts */}
                  {(() => {
                    const activeConvs = conversations.filter(c => !c.isArchived && c.status !== 'Archived');
                    const countAll = activeConvs.length;
                    const countMine = activeConvs.filter(c => c.assignedAgentId && (c.assignedAgentId._id === user.id || c.assignedAgentId === user.id)).length;
                    const countQueue = activeConvs.filter(c => c.status === 'Unassigned' || !c.assignedAgentId).length;
                    const countArchived = conversations.filter(c => c.isArchived || c.status === 'Archived').length;

                    return (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          className={`filter-tab ${inboxFilter === 'all' ? 'active' : ''}`} 
                          onClick={() => setInboxFilter('all')}
                          style={{ flex: 1, padding: '7px 2px', fontSize: '11.5px' }}
                        >
                          All <span className="inbox-count-badge">{countAll}</span>
                        </button>
                        <button 
                          className={`filter-tab ${inboxFilter === 'mine' ? 'active' : ''}`} 
                          onClick={() => setInboxFilter('mine')}
                          style={{ flex: 1, padding: '7px 2px', fontSize: '11.5px' }}
                        >
                          Mine <span className="inbox-count-badge">{countMine}</span>
                        </button>
                        <button 
                          className={`filter-tab ${inboxFilter === 'unassigned' ? 'active' : ''}`} 
                          onClick={() => setInboxFilter('unassigned')}
                          style={{ flex: 1, padding: '7px 2px', fontSize: '11.5px' }}
                        >
                          Queue <span className="inbox-count-badge">{countQueue}</span>
                        </button>
                        <button 
                          className={`filter-tab ${inboxFilter === 'archived' ? 'active' : ''}`} 
                          onClick={() => setInboxFilter('archived')}
                          style={{ flex: 1, padding: '7px 2px', fontSize: '11.5px' }}
                        >
                          Archived <span className="inbox-count-badge">{countArchived}</span>
                        </button>
                      </div>
                    );
                  })()}
                  
                  {/* Supervisor Filter by Employee */}
                  <select
                    value={inboxFilter.startsWith('agent-') ? inboxFilter : ''}
                    onChange={(e) => setInboxFilter(e.target.value || 'all')}
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      fontSize: '11.5px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    <option value="">👤 Filter by Staff Member...</option>
                    {agents.map(a => (
                      <option key={a._id} value={`agent-${a._id}`}>
                        👤 {a.name} ({a.role}) {a.status === 'Online' ? '🟢' : '⚪'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conversation List */}
                <div className="rooms-list">
                  {(() => {
                    let filtered = [...conversations];
                    
                    // Filter by Channel Type
                    if (channelFilter === 'webchat') {
                      filtered = filtered.filter(c => !c.source || c.source === 'webchat');
                    } else if (channelFilter === 'whatsapp') {
                      filtered = filtered.filter(c => c.source === 'whatsapp-web' || c.source === 'whatsapp-api');
                    } else if (channelFilter === 'facebook') {
                      filtered = filtered.filter(c => c.source === 'facebook');
                    } else if (channelFilter === 'instagram') {
                      filtered = filtered.filter(c => c.source === 'instagram');
                    }

                    // Archive filter logic
                    if (inboxFilter === 'archived') {
                      filtered = filtered.filter(c => c.isArchived || c.status === 'Archived');
                    } else {
                      filtered = filtered.filter(c => !c.isArchived && c.status !== 'Archived');
                      
                      if (inboxFilter === 'mine') {
                        filtered = filtered.filter(c => c.assignedAgentId && (c.assignedAgentId._id === user.id || c.assignedAgentId === user.id));
                      } else if (inboxFilter === 'unassigned') {
                        filtered = filtered.filter(c => c.status === 'Unassigned' || !c.assignedAgentId);
                      } else if (inboxFilter.startsWith('agent-')) {
                        const agentId = inboxFilter.split('agent-')[1];
                        filtered = filtered.filter(c => c.assignedAgentId && (c.assignedAgentId._id === agentId || c.assignedAgentId === agentId));
                      }
                    }

                    // Real-time Search Query Filter
                    if (inboxSearchQuery.trim()) {
                      const q = inboxSearchQuery.toLowerCase().trim();
                      filtered = filtered.filter(c => {
                        const vis = typeof c.visitorId === 'object' ? c.visitorId : visitors.find(v => v._id === c.visitorId);
                        const visName = vis?.name?.toLowerCase() || '';
                        const visEmail = vis?.email?.toLowerCase() || '';
                        const visPhone = vis?.phoneNumber?.toLowerCase() || '';
                        const lastMsg = c.lastMessageText?.toLowerCase() || '';
                        const agentName = c.assignedAgentId?.name?.toLowerCase() || '';
                        return visName.includes(q) || visEmail.includes(q) || visPhone.includes(q) || lastMsg.includes(q) || agentName.includes(q);
                      });
                    }
                    
                    // Sort conversations:
                    // 1. Pending unread messages ALWAYS on top
                    // 2. Live Web visitors (ONLY for webchat with active socket)
                    // 3. WhatsApp/Meta follow offline order and are sorted by most recent chat time
                    const sorted = filtered.sort((a, b) => {
                      const visA = typeof a.visitorId === 'object' ? a.visitorId : visitors.find(v => v._id === a.visitorId);
                      const visB = typeof b.visitorId === 'object' ? b.visitorId : visitors.find(v => v._id === b.visitorId);

                      // Priority 1: Unread pending messages count
                      const unreadA = a.unreadCount || 0;
                      const unreadB = b.unreadCount || 0;
                      if (unreadA !== unreadB) {
                        return unreadB - unreadA;
                      }

                      // Priority 2: Real-time Live Web visitors (only webchat has active online presence)
                      const isLiveWebA = (!a.source || a.source === 'webchat') && visA?.isOnline ? 1 : 0;
                      const isLiveWebB = (!b.source || b.source === 'webchat') && visB?.isOnline ? 1 : 0;
                      if (isLiveWebA !== isLiveWebB) {
                        return isLiveWebB - isLiveWebA;
                      }

                      // Priority 3: Latest chat timestamp
                      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                      return timeB - timeA;
                    });

                    if (sorted.length === 0) {
                      return (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          <p>No conversations found.</p>
                          {inboxSearchQuery && <span style={{ fontSize: '11px' }}>Try clearing the search filter</span>}
                        </div>
                      );
                    }

                    return sorted.map(conv => {
                      const vis = typeof conv.visitorId === 'object' ? conv.visitorId : visitors.find(v => v._id === conv.visitorId);
                      const agentName = conv.assignedAgentId ? conv.assignedAgentId.name : 'Unassigned';
                      const isLiveWeb = (!conv.source || conv.source === 'webchat') && vis?.isOnline;
                      const hasUnread = (conv.unreadCount || 0) > 0;

                      return (
                        <div
                          key={conv._id}
                          className={`room-card ${selectedConversation?._id === conv._id ? 'active' : ''}`}
                          onClick={() => handleSelectConversation(conv)}
                          style={{ 
                            position: 'relative',
                            borderLeft: hasUnread ? '3px solid #DC2626' : undefined,
                            background: hasUnread ? 'rgba(220, 38, 38, 0.05)' : undefined
                          }}
                        >
                          <div className="room-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: isLiveWeb ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--bg-accent)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                position: 'relative',
                                flexShrink: 0,
                                border: isLiveWeb ? '1.5px solid #10B981' : '1px solid var(--border-color)'
                              }}>
                                {(vis?.name || 'V')[0]?.toUpperCase()}
                                {isLiveWeb ? (
                                  <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid var(--bg-secondary)' }}></span>
                                ) : (
                                  <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {renderChannelIcon(conv.source, 10)}
                                  </span>
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="room-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 700 : 600, color: hasUnread ? 'var(--text-primary)' : undefined }}>
                                    {vis?.name || 'Visitor'}
                                  </span>
                                  {renderSourceBadge(conv.source)}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="room-time" style={{ color: hasUnread ? '#F87171' : undefined, fontWeight: hasUnread ? 700 : undefined }}>
                                {new Date(conv.updatedAt || conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {hasUnread && (
                                <span className="unread-pill-badge" title={`${conv.unreadCount} unread message(s)`}>
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="room-preview" style={{ paddingLeft: '42px', fontWeight: hasUnread ? 600 : 400, color: hasUnread ? 'var(--text-primary)' : undefined }}>
                            {conv.status === 'Unassigned' && !hasUnread ? (
                              <span style={{ color: '#F59E0B' }}>⚡ Waiting for agent...</span>
                            ) : conv.status === 'Archived' || conv.isArchived ? (
                              <span style={{ color: 'var(--text-muted)' }}>📦 Archived conversation</span>
                            ) : (
                              conv.lastMessageText || 'Active chat in progress'
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingLeft: '42px' }}>
                            <span 
                              className="room-assignee" 
                              style={{ 
                                borderLeft: `2px solid ${conv.assignedAgentId ? 'var(--success)' : 'var(--warning)'}`,
                                color: conv.assignedAgentId ? 'var(--text-primary)' : 'var(--warning)',
                                fontWeight: 500
                              }}
                            >
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {(() => {
                          const isLiveWeb = (!selectedConversation.source || selectedConversation.source === 'webchat') && selectedVisitor?.isOnline;
                          return (
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: isLiveWeb ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--bg-accent)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '14px',
                              position: 'relative',
                              border: isLiveWeb ? '1.5px solid #10B981' : '1px solid var(--border-color)'
                            }}>
                              {(selectedVisitor?.name || 'V')[0]?.toUpperCase()}
                              {isLiveWeb ? (
                                <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid var(--bg-secondary)' }}></span>
                              ) : (
                                <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {renderChannelIcon(selectedConversation.source, 11)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {((!selectedConversation.source || selectedConversation.source === 'webchat') && selectedVisitor?.isOnline) && (
                              <span title="Live Online" style={{ color: '#10B981', fontSize: '10px' }}>🟢</span>
                            )}
                            <span>{selectedVisitor?.name || 'Visitor Conversation'}</span>
                            {renderSourceBadge(selectedConversation.source)}
                          </div>
                          
                          {/* Live Supervisor Quick Reassign */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11.5px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Assigned to:</span>
                            <select
                              value={selectedConversation.assignedAgentId?._id || selectedConversation.assignedAgentId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  handleDelegateChat(val);
                                } else {
                                  handleReleaseChat();
                                }
                              }}
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: selectedConversation.assignedAgentId ? 'var(--success)' : 'var(--warning)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">⚠️ Unassigned (In Queue)</option>
                              {agents.map(a => (
                                <option key={a._id} value={a._id}>
                                  👤 {a.name} ({a.role}) {a.status === 'Online' ? '🟢' : '⚪'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={toggleChatDetails}
                          style={{
                            backgroundColor: chatDetailsCollapsed ? '#fee2e2' : 'var(--bg-tertiary)',
                            color: chatDetailsCollapsed ? '#dc2626' : 'var(--text-primary)',
                            border: chatDetailsCollapsed ? '1px solid #fca5a5' : '1px solid var(--border-color)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title={chatDetailsCollapsed ? "Expand Customer Profile Drawer" : "Collapse Customer Profile Drawer"}
                        >
                          👤 {chatDetailsCollapsed ? 'Show Details' : 'Hide Details'}
                        </button>
                        <button
                          onClick={() => handleArchiveConversation(selectedConversation._id, selectedConversation.isArchived || selectedConversation.status === 'Archived')}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
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
                            fontWeight: '600',
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

                    {/* Live Activity Radar & Journey Strip inside Chat */}
                    <div style={{
                      background: '#f8fafc',
                      borderBottom: '1px solid var(--border-color)',
                      padding: '9px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      fontSize: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '5px', 
                          background: '#fee2e2', 
                          color: '#dc2626', 
                          padding: '2px 8px', 
                          borderRadius: '6px', 
                          fontWeight: 800, 
                          fontSize: '10.5px',
                          letterSpacing: '0.04em'
                        }}>
                          <span className="v-pulse" style={{ backgroundColor: '#dc2626', width: '6px', height: '6px' }}></span>
                          LIVE RADAR
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Viewing:
                        </span>
                        <span className="path-tag" style={{ fontSize: '11.5px', padding: '2px 8px' }}>
                          {selectedVisitor?.currentUrl || '/pricing'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                          ⏱️ {selectedVisitor?.duration ? `${selectedVisitor.duration}s on page` : 'Active on site'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: '#059669', background: '#ecfdf5', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '10.5px' }}>
                          ⚡ High Intent
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Trail:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>/</span>
                          <span style={{ color: 'var(--text-muted)' }}>➔</span>
                          <span style={{ color: 'var(--text-muted)' }}>/features</span>
                          <span style={{ color: 'var(--text-muted)' }}>➔</span>
                          <span style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>
                            {selectedVisitor?.currentUrl || '/pricing'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="chat-messages-board" ref={messagesContainerRef}>
                      {/* 1. Agent-Only Privacy Notice Banner */}
                      <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '10px',
                        padding: '9px 16px',
                        margin: '0 auto 10px auto',
                        width: '100%',
                        maxWidth: '92%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        fontSize: '12px',
                        color: '#166534',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px' }}>🔒</span>
                          <span>
                            <strong>Agent-Only Telemetry View:</strong> This real-time visitor activity trail and device footprint is 100% private to your dashboard. Your customer's chat widget is clean, minimal, and contains none of this background data.
                          </span>
                        </div>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          🛡️ Internal Only
                        </span>
                      </div>

                      {/* 2. Initial Real-Time Footprint Summary in Chat Stream */}
                      <div style={{ 
                        background: '#ffffff', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '12px', 
                        padding: '14px 18px', 
                        margin: '0 auto 10px auto', 
                        width: '100%', 
                        maxWidth: '92%', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            <span>🛰️ Live Visitor Telemetry & Device Footprint</span>
                            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Active Online</span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            🌍 {selectedVisitor?.city || 'Toronto'}, {selectedVisitor?.country || 'Canada'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Device: </span>
                            <strong>{selectedVisitor?.deviceType || 'Desktop'} ({selectedVisitor?.os || 'macOS'})</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Browser: </span>
                            <strong>{selectedVisitor?.browser || 'Chrome'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Referral: </span>
                            <strong style={{ color: 'var(--primary)' }}>{selectedVisitor?.referrer || 'Google Organic'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Active URL: </span>
                            <strong style={{ fontFamily: 'monospace', color: '#dc2626' }}>{selectedVisitor?.currentUrl || '/pricing'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* 3. Live 5-Step Action & Journey Trail */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '14px 18px',
                        margin: '0 auto 14px auto',
                        width: '100%',
                        maxWidth: '92%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}>📡</span>
                            <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Live Visitor Journey & Action Log (5 Steps Tracked)</strong>
                          </div>
                          <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 800, background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                            ● Live Tracking Stream
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', paddingLeft: '18px', borderLeft: '2px dashed #e2e8f0', marginLeft: '6px' }}>
                          <div style={{ position: 'relative', fontSize: '12px', lineHeight: 1.4 }}>
                            <span style={{ position: 'absolute', left: '-24px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: '2px solid white' }}></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>12:54:10</span>
                            <strong>📍 Landed on Homepage</strong> <span className="path-tag" style={{ fontSize: '11px', padding: '1px 6px' }}>/</span> <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>via Google Search organic search</span>
                          </div>
                          <div style={{ position: 'relative', fontSize: '12px', lineHeight: 1.4 }}>
                            <span style={{ position: 'absolute', left: '-24px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', border: '2px solid white' }}></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>12:54:45</span>
                            <strong>📜 Browsed Features Page</strong> <span className="path-tag" style={{ fontSize: '11px', padding: '1px 6px' }}>/features</span> <span style={{ color: '#059669', fontSize: '11px', fontWeight: 600 }}>(Scrolled 85% depth)</span>
                          </div>
                          <div style={{ position: 'relative', fontSize: '12px', lineHeight: 1.4 }}>
                            <span style={{ position: 'absolute', left: '-24px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', border: '2px solid white' }}></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>12:55:12</span>
                            <strong>⚡ High-Intent Click:</strong> <span style={{ color: 'var(--text-secondary)' }}>Clicked "Compare Growth vs Business" button</span>
                          </div>
                          <div style={{ position: 'relative', fontSize: '12px', lineHeight: 1.4 }}>
                            <span style={{ position: 'absolute', left: '-24px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', border: '2px solid white' }}></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>12:55:38</span>
                            <strong>🎯 Navigated to Pricing</strong> <span className="path-tag" style={{ fontSize: '11px', padding: '1px 6px' }}>{selectedVisitor?.currentUrl || '/pricing'}</span> <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '11px' }}>(Evaluating Growth Plan)</span>
                          </div>
                          <div style={{ position: 'relative', fontSize: '12px', lineHeight: 1.4 }}>
                            <span style={{ position: 'absolute', left: '-24px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '2px solid white' }}></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>12:56:02</span>
                            <strong>💬 Opened Chat Widget</strong> <span style={{ color: '#059669', fontSize: '11px', fontWeight: 600 }}>Sent initial inquiry via live widget</span>
                          </div>
                        </div>
                      </div>

                      {messages.map((msg, i) => {
                        const senderType = (msg.senderType || msg.sender || 'visitor').toLowerCase();
                        const time = msg.timestamp || msg.createdAt || new Date();
                        return (
                          <div key={msg._id || i} className={`db-msg-row ${senderType}`}>
                            <div className="db-msg-bubble">{formatMessageText(msg.text || msg.content || '')}</div>
                            <div className="db-msg-time">
                              {msg.senderName || (senderType === 'agent' ? 'Agent' : 'Visitor')} • {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Visitor typing indicator */}
                      {selectedConversation?.visitorId && visitorTypingStatus[selectedConversation.visitorId._id || selectedConversation.visitorId] && (
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
                              backgroundColor: 'rgba(220, 38, 38, 0.08)',
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

                    {/* In-Chat Agent Upsell & Deal Closer Co-Pilot */}
                    <div className="upsell-copilot-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#b45309', whiteSpace: 'nowrap' }}>
                        <span>⚡ Upsell Pitch:</span>
                      </div>
                      
                      <button
                        className="upsell-pill"
                        title="Insert Growth Plan Pitch"
                        onClick={() => setChatInput(prev => prev ? `${prev} We noticed you are exploring our Growth Plan! We currently have a special promotion where you get 20% off plus free onboarding setup.` : 'Hi! We noticed you are exploring our Growth Plan! We currently have a special promotion where you get 20% off plus free onboarding setup.')}
                      >
                        💼 Pitch Growth (₹299/mo)
                      </button>

                      <button
                        className="upsell-pill"
                        title="Insert 20% Coupon Code"
                        onClick={() => setChatInput(prev => prev ? `${prev} Use exclusive coupon code LETS20 for an instant 20% discount on any annual plan!` : 'Here is an exclusive coupon code for you: LETS20 for an instant 20% discount on any annual plan!')}
                      >
                        🏷️ 20% Coupon (LETS20)
                      </button>

                      <button
                        className="upsell-pill"
                        title="Insert Direct Checkout Link"
                        onClick={() => setChatInput(prev => prev ? `${prev} Here is your instant checkout link: https://letstrack.manacity.in/#billing` : 'You can activate your subscription directly here: https://letstrack.manacity.in/#billing')}
                      >
                        💳 Send Payment Link
                      </button>

                      <button
                        className="upsell-pill"
                        style={{ borderColor: '#d1d5db', color: 'var(--text-secondary)' }}
                        title="Offer custom trial extension"
                        onClick={() => setChatInput(prev => prev ? `${prev} I can also extend your free trial by an extra 7 days so you can test all features with your team!` : 'I can also extend your free trial by an extra 7 days so you can test all features with your team!')}
                      >
                        🎁 +7 Day Trial
                      </button>
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

              {/* 3. Right Details & Customer 360 Drawer (Collapsible) */}
              <div className={`pane-details ${chatDetailsCollapsed ? 'collapsed' : ''}`}>
                {selectedConversation ? (
                  <>
                    {/* Card 1: Contact Identity */}
                    <div className="detail-card">
                      <div className="detail-card-title">
                        <span>👤 Customer Profile</span>
                      </div>
                      <div className="form-group" style={{ marginBottom: '4px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Full Name</label>
                        <input type="text" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorName} onChange={(e) => setEditVisitorName(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '4px' }}>
                        <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Address</label>
                        <input type="email" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorEmail} onChange={(e) => setEditVisitorEmail(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone Number</label>
                          {editVisitorPhone && (
                            <a
                              href={`https://wa.me/${editVisitorPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '11px', color: '#10B981', textDecoration: 'none', fontWeight: '600' }}
                            >
                              📱 Open WhatsApp
                            </a>
                          )}
                        </div>
                        <input type="tel" className="form-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={editVisitorPhone} onChange={(e) => setEditVisitorPhone(e.target.value)} placeholder="e.g. +91 98765 43210" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                        <input type="checkbox" id="visitor-muted-check-2" checked={editVisitorMuted} onChange={(e) => setEditVisitorMuted(e.target.checked)} style={{ cursor: 'pointer' }} />
                        <label htmlFor="visitor-muted-check-2" className="form-label" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }}>Mute & Suppress Alerts</label>
                      </div>
                      <button 
                        style={{ 
                          padding: '9px 14px', 
                          fontSize: '12.5px', 
                          width: '100%', 
                          background: 'linear-gradient(135deg, #dc2626, #b91c1c)', 
                          color: '#ffffff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          fontWeight: 700,
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }} 
                        onClick={handleUpdateVisitor}
                      >
                        💾 Save Profile
                      </button>
                    </div>

                    {/* Card 2: Live Location & Journey */}
                    <div className="detail-card">
                      <div className="detail-card-title">
                        <span>📍 Live Telemetry & Device</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Location</span>
                        <span className="info-item-value">🌍 {selectedVisitor?.country || 'Unknown'}, {selectedVisitor?.city || 'Local'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">IP Address</span>
                        <span className="info-item-value" style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>{selectedVisitor?.ipAddress || '127.0.0.1'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Current Page</span>
                        <span className="info-item-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', whiteSpace: 'nowrap', color: 'var(--primary)' }} title={selectedVisitor?.currentUrl}>
                          {selectedVisitor?.currentUrl || '/'}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Device & OS</span>
                        <span className="info-item-value">{selectedVisitor?.deviceType || 'Desktop'} • {selectedVisitor?.os || 'Windows'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Browser</span>
                        <span className="info-item-value">{selectedVisitor?.browser || 'Chrome'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">First Seen</span>
                        <span className="info-item-value">
                          {selectedVisitor?.firstSeen ? new Date(selectedVisitor.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>
                    </div>

                    {/* Card 3: Staff Assignment & Delegation */}
                    <div className="detail-card">
                      <div className="detail-card-title">
                        <span>🎯 Staff Delegation</span>
                      </div>
                      <div className="assignee-box" style={{ padding: '10px' }}>
                        {selectedConversation.assignedAgentId ? (
                          <>
                            <div style={{ fontSize: '12.5px' }}>
                              Assigned to: <strong style={{ color: '#10B981' }}>{selectedConversation.assignedAgentId._id === user.id ? 'You (Mine)' : selectedConversation.assignedAgentId.name}</strong>
                            </div>
                            <button className="claim-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', padding: '5px 10px', fontSize: '11px' }} onClick={handleReleaseChat}>
                              Release back to queue
                            </button>
                          </>
                        ) : (
                          <>
                            <p style={{ fontSize: '11.5px', color: 'var(--warning)', margin: 0 }}>⚠️ Chat is currently unassigned in queue.</p>
                            <button className="claim-btn" style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600' }} onClick={handleClaimChat}>
                              Claim Chat
                            </button>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>Quick Re-Assign to Staff:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {agents
                            .filter(a => a._id !== (selectedConversation.assignedAgentId?._id || selectedConversation.assignedAgentId))
                            .map(agent => (
                              <div key={agent._id} className="agent-assign-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                  <span style={{ fontSize: '8px' }}>{agent.status === 'Online' ? '🟢' : '⚪'}</span>
                                  <strong>{agent.name}</strong>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({agent.role})</span>
                                </div>
                                <button className="assign-action-btn" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => handleDelegateChat(agent._id)}>
                                  Assign
                                </button>
                              </div>
                            ))}
                        </div>
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

          {/* D. WHATSAPP BUSINESS API HUB (COMING SOON) */}
          {activeTab === 'whatsapp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
              {/* Hero Banner */}
              <div className="glass-card" style={{ 
                padding: '36px', 
                background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', 
                border: '1px solid #bbf7d0', 
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                boxShadow: '0 4px 20px rgba(37, 211, 102, 0.08)'
              }}>
                <div style={{ maxWidth: '640px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, marginBottom: '12px' }}>
                    <span>🚀 COMING SOON</span>
                    <span>•</span>
                    <span>OFFICIAL META TECH PARTNER INTEGRATION</span>
                  </div>
                  <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
                    WhatsApp Business Cloud API
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Connect your official Meta WhatsApp Business number directly to LetsTrack. Manage customer chats with multi-agent inbox routing, send automated OTP/Order notifications, and broadcast campaigns with verified green-tick branding.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
                  <button
                    onClick={() => showToast('🎉 You have been added to the VIP WhatsApp API Beta Waitlist!')}
                    style={{
                      background: 'linear-gradient(135deg, #25D366, #128C7E)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(37, 211, 102, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>⚡ Request Early Access</span>
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Zero setup fees for existing active subscriptions
                  </span>
                </div>
              </div>

              {/* 4 Feature Highlights Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff' }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>👥</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Multi-Agent WhatsApp Routing</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Assign 1 WhatsApp number across your entire team. Route inquiries to sales or support agents automatically without sharing phones.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff' }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔔</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Automated HSM Notifications</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Send automated booking confirmations, payment links, and abandoned cart alerts directly from your website via Webhooks.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff' }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>🛡️</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Verified Meta Green Tick</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Showcase your official brand name and green verified checkmark on WhatsApp instead of an unknown mobile number.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff' }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>🤖</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Interactive Chatbot Flows</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Auto-respond 24/7 with interactive button menus, catalog sharing, and smart lead qualification before handing off to live agents.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* E. WIDGET CUSTOMIZER */}
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

          {/* E. MANAGE EMPLOYEES / TEAM & STAFF VIEW */}
          {activeTab === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 1. Subscription Capacity Banner */}
              <div className="team-capacity-card glass-card">
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Team & Staff Seats</h3>
                    <span style={{ 
                      backgroundColor: 'rgba(220, 38, 38, 0.15)', 
                      color: '#F87171', 
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase' 
                    }}>
                      {seatInfo.plan ? `${seatInfo.plan} Plan` : 'Free Plan'}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Support agents can log in, claim chats from the queue, and respond to live visitors.
                  </p>
                  
                  {/* Capacity Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {seatInfo.used} of {seatInfo.max} Seats Allocated
                      </span>
                      <span style={{ color: seatInfo.used >= seatInfo.max ? '#F87171' : '#10B981' }}>
                        {seatInfo.max - seatInfo.used} Seat{seatInfo.max - seatInfo.used === 1 ? '' : 's'} Remaining
                      </span>
                    </div>
                    <div className="capacity-meter-bar">
                      <div 
                        className="capacity-meter-fill" 
                        style={{ 
                          width: `${Math.min(100, (seatInfo.used / seatInfo.max) * 100)}%`,
                          background: seatInfo.used >= seatInfo.max 
                            ? 'linear-gradient(90deg, #F59E0B, #DC2626)' 
                            : 'linear-gradient(90deg, #10B981, #059669)'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {seatInfo.used >= seatInfo.max && (
                    <button
                      onClick={() => { setActiveTab('billing'); fetchBillingData(); }}
                      style={{
                        background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                        color: 'white',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 0 15px rgba(220, 38, 38, 0.4)'
                      }}
                    >
                      ⚡ Upgrade for More Seats
                    </button>
                  )}
                  <button
                    onClick={handleCleanupDemoAccounts}
                    title="Remove all orphaned test accounts from verification tests"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    🧹 Clean Demo Accounts
                  </button>
                </div>
              </div>

              {/* 2. Grid with Table + Add Form */}
              <div className="monitor-grid">
                
                {/* Staff List Table */}
                <div className="monitor-card glass-card">
                  <div className="card-header">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>👥 Active Staff Members</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({agents.length})</span>
                    </div>
                  </div>
                  <div className="card-body-scroll">
                    <table className="visitor-list-table">
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Email Username</th>
                          <th>Role</th>
                          <th>Live Workload</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map(agent => {
                          const activeChats = conversations.filter(c => c.assignedAgentId && (c.assignedAgentId._id === agent._id || c.assignedAgentId === agent._id) && !c.isArchived && c.status !== 'Archived').length;

                          return (
                            <tr key={agent._id}>
                              <td>
                                <div className="visitor-badge-info">
                                  <div className="agent-avatar" style={{ width: '30px', height: '30px', fontSize: '12px', background: agent.status === 'Online' ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--bg-accent)' }}>
                                    {agent.name[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '600' }}>
                                      {agent.name} {agent._id === user.id ? '<span style="color: var(--primary); font-size: 11px;">(You)</span>' : ''}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                      Joined {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{agent.email}</td>
                              <td>
                                <span className="path-tag" style={{ color: agent.role === 'Admin' ? '#EF4444' : 'var(--primary)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                  {agent.role}
                                </span>
                              </td>
                              <td>
                                <span className="path-tag" style={{ color: activeChats > 0 ? '#10B981' : 'var(--text-muted)', border: activeChats > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px' }}>
                                  💬 {activeChats} Active
                                </span>
                              </td>
                              <td>
                                <span className={`status-dot ${agent.status.toLowerCase()}`} style={{ marginRight: '6px' }}></span>
                                <span style={{ fontSize: '12px', color: agent.status === 'Online' ? '#10B981' : 'var(--text-muted)' }}>{agent.status}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleResetAgentPassword(agent._id, agent.name)}
                                    title="Reset Password"
                                    className="staff-action-btn"
                                  >
                                    🔑 Reset Pass
                                  </button>
                                  {agent._id !== user.id && agent.role !== 'Admin' && agent.role !== 'SuperAdmin' && (
                                    <button
                                      onClick={() => handleDeleteAgent(agent._id, agent.name)}
                                      title="Remove staff member"
                                      className="staff-action-btn danger"
                                    >
                                      🗑️ Remove
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Invite Employee Form */}
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 className="card-title" style={{ marginBottom: '8px' }}>Invite New Team Member</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Create login credentials for support agents to handle chat conversations.
                  </p>

                  {seatInfo.used >= seatInfo.max && user?.role !== 'SuperAdmin' ? (
                    <div style={{
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '10px',
                      padding: '18px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</div>
                      <h4 style={{ color: '#F87171', fontSize: '14px', marginBottom: '6px' }}>Team Seat Capacity Reached</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        Your current <strong>{seatInfo.plan ? seatInfo.plan.toUpperCase() : 'FREE'}</strong> plan allows maximum {seatInfo.max} seat(s).
                      </p>
                      <button
                        onClick={() => { setActiveTab('billing'); fetchBillingData(); }}
                        className="auth-btn"
                        style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}
                      >
                        ⚡ Upgrade to Growth (3 Seats) or Business (6 Seats)
                      </button>
                    </div>
                  ) : (
                    <form className="auth-form" onSubmit={handleInviteAgent}>
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Sarah Connor"
                          value={agentInviteName}
                          onChange={(e) => setAgentInviteName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Email Address (Login ID)</label>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="sarah@company.com"
                          value={agentInviteEmail}
                          onChange={(e) => setAgentInviteEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Temporary Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="At least 6 characters"
                          value={agentInvitePassword}
                          onChange={(e) => setAgentInvitePassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Access Role</label>
                        <select
                          className="form-input"
                          value={agentInviteRole}
                          onChange={(e) => setAgentInviteRole(e.target.value)}
                          style={{ background: 'var(--bg-tertiary)' }}
                        >
                          <option value="Agent">Support Agent (Chat Inbox Only)</option>
                          <option value="Admin">Tenant Admin (Full Management Access)</option>
                        </select>
                      </div>

                      <button type="submit" className="auth-btn" style={{ marginTop: '10px' }}>
                        ➕ Register & Allocate Team Seat
                      </button>
                    </form>
                  )}
                </div>
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
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
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
                      <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                        ₹{billingData?.planPrice || (tenant?.plan === 'business' ? 399 : tenant?.plan === 'growth' ? 299 : 0)} / month
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quota Progress Bar */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                    <span>Team Seats Allocated</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {billingData?.usedSeats || 1} / {tenant?.maxAgents || 1} Seats Used
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
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
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Available Subscription Plans
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  {/* Growth Plan Card */}
                  <div className="glass-card" style={{ 
                    padding: '24px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    border: tenant?.plan === 'growth' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    {tenant?.plan === 'growth' && (
                      <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        CURRENT PLAN
                      </span>
                    )}
                    <div>
                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>
                        🔥 Special Offer: First 1,000 Users
                      </div>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)' }}>Growth Plan</h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 16px 0' }}>
                        Ideal for small teams requiring real-time live visitor radar and custom widget branding.
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px', color: '#9ca3af', textDecoration: 'line-through' }}>₹999</span>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)' }}>₹299</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ month</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginBottom: '16px' }}>
                        + ₹999 one-time onboarding fee
                      </div>

                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
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
                        background: tenant?.plan === 'growth' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                        color: tenant?.plan === 'growth' ? 'var(--text-muted)' : 'white',
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
                    border: tenant?.plan === 'business' ? '2px solid #10b981' : '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    {tenant?.plan === 'business' && (
                      <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        CURRENT PLAN
                      </span>
                    )}
                    <div>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>
                        ⚡ Omnichannel Pro
                      </div>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)' }}>Business Plan</h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 16px 0' }}>
                        For modern brands managing Website Chat + Instagram DMs and Facebook Messenger.
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px', color: '#9ca3af', textDecoration: 'line-through' }}>₹1,499</span>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)' }}>₹399</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ month</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginBottom: '16px' }}>
                        + ₹999 one-time onboarding fee
                      </div>

                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
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
                        background: tenant?.plan === 'business' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: tenant?.plan === 'business' ? 'var(--text-muted)' : 'white',
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
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Payment History & Receipts</h4>
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
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{p.amount}</td>
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

          {/* G. SUPER ADMIN DASHBOARD */}
          {activeTab === 'superadmin' && user?.role === 'SuperAdmin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Metrics Summary Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #dc2626' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Registered Workspaces</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{superStats?.totalTenants || 0}</div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>+{superStats?.newTenantsLast30d || 0} joined this month</div>
                </div>

                <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Paid Mandates</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{superStats?.activeSubscriptions || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Autopay UPI & Card Recurring</div>
                </div>

                <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Platform Live MRR</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>₹{superStats?.mrr?.toLocaleString() || 0}</div>
                  <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '4px' }}>Total Collected: ₹{superStats?.totalRevenue?.toLocaleString() || 0}</div>
                </div>

                <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total User Accounts</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{superStats?.totalUsers || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Across all client tenants</div>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setSuperActiveTab('tenants')} 
                    style={{ 
                      background: superActiveTab === 'tenants' ? '#fee2e2' : 'transparent', 
                      color: superActiveTab === 'tenants' ? '#dc2626' : 'var(--text-secondary)', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '13px', 
                      cursor: 'pointer' 
                    }}
                  >
                    🏢 All Client Workspaces ({superTenants.length})
                  </button>

                  <button 
                    onClick={() => setSuperActiveTab('payments')} 
                    style={{ 
                      background: superActiveTab === 'payments' ? '#fee2e2' : 'transparent', 
                      color: superActiveTab === 'payments' ? '#dc2626' : 'var(--text-secondary)', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '13px', 
                      cursor: 'pointer' 
                    }}
                  >
                    💳 Payment Ledger ({superPayments.length})
                  </button>

                  <button 
                    onClick={() => setSuperActiveTab('users')} 
                    style={{ 
                      background: superActiveTab === 'users' ? '#fee2e2' : 'transparent', 
                      color: superActiveTab === 'users' ? '#dc2626' : 'var(--text-secondary)', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '13px', 
                      cursor: 'pointer' 
                    }}
                  >
                    👥 User Accounts ({superUsers.length})
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={superSearch}
                    onChange={(e) => setSuperSearch(e.target.value)}
                    style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '220px' }}
                  />
                  <button onClick={fetchSuperAdminData} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
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
                        <th>Workspace Name</th>
                        <th>Domain & API Key</th>
                        <th>Plan & Seats</th>
                        <th>Admin Contact</th>
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
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
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
                                style={{ background: '#ffffff', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
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
                                background: t.isSuspended ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', 
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
                                  style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  🔑 Login As
                                </button>
                                <button
                                  onClick={() => handleSuperToggleSuspend(t.id, t.isSuspended)}
                                  style={{ background: t.isSuspended ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: t.isSuspended ? '#166534' : '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
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
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.tenantId?.name || 'Deleted Tenant'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.tenantId?.domain}</div>
                            </td>
                            <td style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>₹{p.amount}</td>
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
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Active: {new Date(u.lastActive || u.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td>{u.email}</td>
                            <td>{u.tenantId?.name || 'Platform Admin'}</td>
                            <td>
                              <select
                                value={u.role}
                                onChange={(e) => handleSuperUpdateUserRole(u._id, e.target.value)}
                                style={{ background: '#ffffff', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' }}
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
