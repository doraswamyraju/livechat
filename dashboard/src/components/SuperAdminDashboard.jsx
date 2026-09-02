import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function SuperAdminDashboard({
  token,
  user,
  BACKEND_URL,
  showToast,
  onLogout,
  onImpersonateSuccess
}) {
  // Navigation
  const [activeTab, setActiveTab] = useState('meta'); // 'meta' | 'inbox' | 'ads' | 'visitors' | 'workspaces' | 'payments' | 'users' | 'logs'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Platform Telemetry & Data
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Meta Omnichannel & Ads States
  const [metaAssets, setMetaAssets] = useState({ meta: {}, whatsappApi: {} });
  const [adCampaigns, setAdCampaigns] = useState([]);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);
  const [availableWabas, setAvailableWabas] = useState([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [metaToken, setMetaToken] = useState('');

  // WhatsApp Cloud API Onboarding Flow Modal
  const [showWaOnboardingModal, setShowWaOnboardingModal] = useState(false);
  const [waOnboardingStep, setWaOnboardingStep] = useState(1);
  const [waWabaId, setWaWabaId] = useState('5703446903066867');
  const [waPhoneId, setWaPhoneId] = useState('111738020188242');
  const [waDisplayNumber, setWaDisplayNumber] = useState('+91 99000 11223');
  const [waDisplayName, setWaDisplayName] = useState('ManaCity Support');
  const [waPin, setWaPin] = useState('123456');
  const [waCategory, setWaCategory] = useState('CUSTOMER_SERVICE');

  // Ad Campaign Creation Modal
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignBudget, setNewCampaignBudget] = useState('500');
  const [newCampaignObjective, setNewCampaignObjective] = useState('LEAD_GENERATION');

  // Manual Payment Modal
  const [manualPaymentModal, setManualPaymentModal] = useState(false);
  const [manualPayTenantId, setManualPayTenantId] = useState('');
  const [manualPayAmount, setManualPayAmount] = useState('299');
  const [manualPayPlan, setManualPayPlan] = useState('growth');
  const [manualPayMethod, setManualPayMethod] = useState('bank_transfer');
  const [manualPayNotes, setManualPayNotes] = useState('');

  // Live Omnichannel Inbox State
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [chatChannelFilter, setChatChannelFilter] = useState('all'); // 'all' | 'instagram' | 'whatsapp-api' | 'facebook' | 'webchat'
  const [chatInputText, setChatInputText] = useState('');
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(true);
  const [cannedReplySelect, setCannedReplySelect] = useState('');
  const [upsellPitchSelect, setUpsellPitchSelect] = useState('');

  // Presets
  const quickReplies = [
    { _id: 'qr1', title: '👋 Welcome & Meta Demo', message: 'Hello! Thank you for contacting us via Meta Omnichannel Hub. How can we assist you today?' },
    { _id: 'qr2', title: '📸 Instagram DM Reply', message: 'Hi there! We received your Instagram direct message. Our support team is ready to assist you in real time.' },
    { _id: 'qr3', title: '🟢 WhatsApp Cloud API Info', message: 'Hello! LetsTrack is an official Meta WhatsApp Cloud API gateway provider offering 24-hour interactive messaging.' },
    { _id: 'qr4', title: '🚀 Pricing & Growth Plan', message: 'Our Growth plan is ₹299/mo with 3 agent seats, live visitor journey tracking, and omnichannel messaging.' }
  ];

  const upsellPitches = [
    { _id: 'up1', name: '⚡ Meta Omnichannel Suite Upgrade', pitchText: 'Unlock automated WhatsApp Business templates, Instagram DM broadcast, and live Meta Ad lead attribution for just ₹399/mo!' },
    { _id: 'up2', name: '🛡️ Enterprise Custom Branding', pitchText: 'Get 100% white-label widget branding, custom CNAME domain, and 20 agent seats with dedicated SLA.' }
  ];

  // Active Visitors Telemetry
  const [activeVisitors, setActiveVisitors] = useState([]);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Initial Load & WebSocket Setup
  useEffect(() => {
    fetchOverviewData();
    fetchMetaAssets();
    fetchAdCampaigns();
    fetchConversations();

    // Connect to WebSocket /dashboard Namespace for Real-Time Meta Messages Ingestion
    if (token) {
      const socket = io(`${BACKEND_URL}/dashboard`, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('agent-init', {
          tenantId: user?.tenantId,
          agentId: user?._id || user?.userId
        });
      });

      socket.on('dashboard-sync', (data) => {
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations);
          if (!selectedConvId) {
            setSelectedConvId(data.conversations[0]._id);
          }
        }
        if (data.visitors) setActiveVisitors(data.visitors);
      });

      socket.on('visitor-msg', (data) => {
        const { conversation, message, visitor } = data || {};
        if (!conversation) return;

        setConversations(prev => {
          const index = prev.findIndex(c => c._id === conversation._id);
          if (index > -1) {
            const updated = [...prev];
            const prevMessages = updated[index].messages || [];
            const isDup = message && prevMessages.some(m => m._id === message._id || (m.text === message.text && Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 3000));
            updated[index] = {
              ...conversation,
              visitorId: visitor || updated[index].visitorId,
              messages: message && !isDup ? [...prevMessages, message] : prevMessages
            };
            return updated;
          }
          return [{ ...conversation, visitorId: visitor, messages: message ? [message] : [] }, ...prev];
        });

        setSelectedConvId(prev => prev || conversation._id);
        showToast(`💬 Inbound ${conversation.source || 'chat'} message received!`);
      });

      socket.on('agent-msg-received', (data) => {
        const { conversationId, message } = data;
        setConversations(prev => prev.map(c => {
          if (c._id === conversationId) {
            const existing = c.messages || [];
            const isDup = message && existing.some(m => m._id === message._id || (m.text === message.text && Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 3000));
            if (isDup) return c;
            return {
              ...c,
              lastMessageText: message.text,
              updatedAt: message.timestamp || new Date().toISOString(),
              messages: [...existing, message]
            };
          }
          return c;
        }));
      });

      socket.on('conversation-updated', (updatedConv) => {
        setConversations(prev => prev.map(c => c._id === updatedConv._id ? { ...c, ...updatedConv } : c));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, user]);

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setConversations(data);
          setSelectedConvId(prev => prev || data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, selectedConvId]);

  const fetchOverviewData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [statsRes, tenantsRes, usersRes, paymentsRes, logsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/superadmin/overview`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/tenants`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/payments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/superadmin/audit-logs`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (tenantsRes.ok) setTenants(await tenantsRes.json());
      if (usersRes.ok) setUsersList(await usersRes.json());
      if (paymentsRes.ok) setPayments(await paymentsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch (err) {
      console.error('SuperAdmin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetaAssets = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetaAssets(data);
      }
    } catch (err) {
      console.error('Error fetching Meta assets:', err);
    }
  };

  const fetchAdCampaigns = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/campaigns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAdCampaigns(await res.json());
      }
    } catch (err) {
      console.error('Error fetching ad campaigns:', err);
    }
  };

  // 2. Meta OAuth Login
  const handleFacebookLogin = () => {
    setConnectingMeta(true);
    const appId = '1311990813621733';
    const redirectUri = encodeURIComponent(
      window.location.origin.includes('letstrack') 
        ? 'https://letstrack.manacity.in/' 
        : 'https://manacity.in/'
    );
    const scope = encodeURIComponent('public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,pages_manage_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_comments,instagram_manage_insights,instagram_content_publish,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging,ads_read,ads_management');
    const authUrl = `https://www.facebook.com/v26.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      'Meta Business OAuth Login',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );

    const checkPopup = setInterval(() => {
      try {
        if (popup && popup.location && popup.location.href.includes('access_token')) {
          const hashParams = new URLSearchParams(popup.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          popup.close();
          clearInterval(checkPopup);

          setMetaToken(accessToken);

          fetch(`${BACKEND_URL}/api/superadmin/meta/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ accessToken })
          })
            .then(async res => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Server returned HTTP ' + res.status }));
                throw new Error(errData.error || 'Server returned status ' + res.status);
              }
              return res.json();
            })
            .then(data => {
              if (data.pages && data.pages.length > 0) {
                setAvailablePages(data.pages);
                setAvailableWabas(data.whatsappNumbers || []);
                setShowAssetModal(true);
                showToast('🎉 Meta Business Assets Discovered! Select your Page & Number.');
              } else {
                showToast(data.message || 'Meta Assets Connected!');
                fetchMetaAssets();
              }
            })
            .catch(err => {
              console.error(err);
              showToast(err.message || 'Error connecting Meta assets', 'error');
            })
            .finally(() => setConnectingMeta(false));
        } else if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setConnectingMeta(false);
        }
      } catch (e) {}
    }, 600);
  };

  const handleSelectAsset = async (pageId, wabaPhoneId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accessToken: metaToken,
          selectedPageId: pageId,
          selectedWabaPhoneId: wabaPhoneId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link asset');
      setShowAssetModal(false);
      showToast('Meta Page, Instagram & WhatsApp linked successfully!');
      fetchMetaAssets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 3. WhatsApp Cloud API Onboarding Completion
  const handleCompleteWhatsAppOnboarding = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/whatsapp-api/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          wabaId: waWabaId,
          phoneNumberId: waPhoneId,
          displayNumber: waDisplayNumber,
          displayName: waDisplayName,
          pin: waPin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard WhatsApp API');
      
      setShowWaOnboardingModal(false);
      showToast('🎉 WhatsApp Business Cloud API successfully activated & verified!');
      fetchMetaAssets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 4. Inbound Test Trigger
  const handleTriggerInboundMsg = (channel) => {
    const timeStr = new Date().toISOString();
    const newId = 'msg_' + Date.now();

    if (channel === 'instagram') {
      const newIgConv = {
        _id: 'conv_ig_' + Date.now(),
        visitorId: {
          _id: 'v_ig_' + Date.now(),
          name: 'Live IG User (@manacity_client)',
          email: 'client@instagram.user',
          phone: 'N/A (Instagram ID)',
          location: { city: 'Bengaluru', country: 'IN' },
          device: 'Instagram Mobile App',
          currentUrl: 'https://instagram.com/direct/t/106590312320041',
          ip: '49.37.152.88',
          utmCampaign: 'Instagram_Stories_Promo',
          createdAt: timeStr
        },
        source: 'instagram',
        status: 'Active',
        unreadCount: 1,
        lastMessageText: 'Hello! I am sending this message directly from Instagram Direct Messenger.',
        updatedAt: timeStr,
        messages: [
          { _id: newId, senderType: 'Visitor', text: 'Hello! I am sending this message directly from Instagram Direct Messenger.', timestamp: timeStr }
        ]
      };
      setConversations(prev => [newIgConv, ...prev]);
      setSelectedConvId(newIgConv._id);
      setActiveTab('inbox');
      showToast('📸 Inbound Instagram Direct Message Received!');
    } else if (channel === 'whatsapp') {
      const newWaConv = {
        _id: 'conv_wa_' + Date.now(),
        visitorId: {
          _id: 'v_wa_' + Date.now(),
          name: 'WhatsApp Business Lead (+91 99000 11223)',
          email: 'lead@whatsapp.cloud',
          phone: '+91 99000 11223',
          location: { city: 'Hyderabad', country: 'IN' },
          device: 'WhatsApp Cloud API',
          currentUrl: 'https://wa.me/919900011223',
          ip: '103.21.124.5',
          utmCampaign: 'Meta_WhatsApp_Click_to_Chat',
          createdAt: timeStr
        },
        source: 'whatsapp-api',
        status: 'Active',
        unreadCount: 1,
        lastMessageText: 'Hi! I clicked your WhatsApp Ad on Meta and want to connect with an agent.',
        updatedAt: timeStr,
        messages: [
          { _id: newId, senderType: 'Visitor', text: 'Hi! I clicked your WhatsApp Ad on Meta and want to connect with an agent.', timestamp: timeStr }
        ]
      };
      setConversations(prev => [newWaConv, ...prev]);
      setSelectedConvId(newWaConv._id);
      setActiveTab('inbox');
      showToast('🟢 Inbound WhatsApp Cloud API Message Received!');
    }
  };

  // 5. Send Reply via Live Backend & Meta API
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!chatInputText.trim() || !selectedConvId) return;

    const conv = conversations.find(c => c._id === selectedConvId);
    if (!conv) return;

    const textToSend = chatInputText.trim();
    setChatInputText('');

    const reply = {
      _id: 'rep_' + Date.now(),
      senderType: 'Agent',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => {
      if (c._id === selectedConvId) {
        return {
          ...c,
          lastMessageText: textToSend,
          updatedAt: new Date().toISOString(),
          messages: [...(c.messages || []), reply]
        };
      }
      return c;
    }));

    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${conv._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSend })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to dispatch via Meta API');
      }

      showToast(`💬 Reply delivered to ${conv.source === 'facebook' ? 'Facebook Messenger' : conv.source === 'instagram' ? 'Instagram Direct' : 'Customer'}!`);
    } catch (err) {
      console.error('Send message error:', err);
      showToast(err.message, 'error');
    }
  };

  // 6. Tenant Management Handlers
  const handleUpdateTenantPlan = async (tenantId, newPlan) => {
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
        showToast('Workspace plan updated successfully!');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error updating workspace', 'error');
    }
  };

  const handleToggleSuspend = async (tenantId, currentSuspended) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ suspended: !currentSuspended })
      });
      if (res.ok) {
        showToast(!currentSuspended ? 'Workspace suspended' : 'Workspace activated');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error modifying workspace status', 'error');
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    if (!window.confirm(`Are you sure you want to permanently delete workspace "${tenantName}"?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`Workspace "${tenantName}" removed`);
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error deleting workspace', 'error');
    }
  };

  const handleImpersonateTenant = async (tenantId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/${tenantId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impersonation failed');

      if (onImpersonateSuccess) {
        onImpersonateSuccess(data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 7. User IAM Handlers
  const handleUpdateUserRole = async (userId, newRole) => {
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
        showToast('User permissions updated!');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error updating user role', 'error');
    }
  };

  const handleForceResetPassword = async (userId, userEmail) => {
    const newPassword = window.prompt(`Enter new password for ${userEmail} (min 6 chars):`, 'Secret2026!');
    if (!newPassword || newPassword.length < 6) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        showToast(`Password reset successfully for ${userEmail}`);
      }
    } catch (err) {
      showToast('Error resetting password', 'error');
    }
  };

  // 8. Manual Payment Record
  const handleRecordManualPayment = async (e) => {
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
        showToast('Payment recorded & Workspace plan upgraded!');
        setManualPaymentModal(false);
        setManualPayNotes('');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error recording payment', 'error');
    }
  };

  // Filter Helpers
  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.adminEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.apiKey?.includes(searchQuery)
  );

  const filteredUsers = usersList.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.tenantId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(c => {
    if (chatChannelFilter !== 'all' && c.source !== chatChannelFilter) return false;
    const vName = c.visitorId?.name || (typeof c.visitorId === 'string' ? c.visitorId : '');
    if (searchQuery && !vName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.lastMessageText?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeConv = filteredConversations.find(c => c._id === selectedConvId) || conversations.find(c => c._id === selectedConvId) || filteredConversations[0] || conversations[0];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0B0E14', overflow: 'hidden', color: '#F3F4F6', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. MASTER SUPERADMIN SIDEBAR */}
      <div style={{
        width: sidebarCollapsed ? '76px' : '260px',
        minWidth: sidebarCollapsed ? '76px' : '260px',
        height: '100%',
        background: '#111827',
        borderRight: '1px solid #1f2937',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.2s ease',
        zIndex: 100
      }}>
        <div>
          {/* Brand Header */}
          <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', borderBottom: '1px solid #1f2937' }}>
            {!sidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #dc2626, #991b1b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '16px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)' }}>
                  LT
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>LetsTrack Master</div>
                  <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform SuperAdmin</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
            >
              {sidebarCollapsed ? '▶' : '◀'}
            </button>
          </div>

          {/* Navigation Menu */}
          <div style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            
            {/* Meta Omnichannel Hub */}
            <button
              onClick={() => {
                setActiveTab('meta');
                fetchMetaAssets();
                fetchAdCampaigns();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: activeTab === 'meta' ? 'none' : '1px solid rgba(24, 119, 242, 0.25)',
                background: activeTab === 'meta' ? 'linear-gradient(135deg, #1877f2, #0d65d9)' : 'rgba(24, 119, 242, 0.08)',
                color: activeTab === 'meta' ? '#ffffff' : '#60a5fa',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>⚡</span>
              {!sidebarCollapsed && <span>Meta Omnichannel Hub</span>}
            </button>

            {/* Live Omnichannel Inbox */}
            <button
              onClick={() => setActiveTab('inbox')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'inbox' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'inbox' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'inbox' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>💬</span>
              {!sidebarCollapsed && <span>Omnichannel Inbox</span>}
            </button>

            {/* Meta Ads Manager */}
            <button
              onClick={() => {
                setActiveTab('ads');
                fetchAdCampaigns();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'ads' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'ads' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'ads' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>📊</span>
              {!sidebarCollapsed && <span>Meta Ads Manager</span>}
            </button>

            {/* Active Visitor Monitor */}
            <button
              onClick={() => setActiveTab('visitors')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'visitors' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'visitors' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'visitors' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>👁️</span>
              {!sidebarCollapsed && <span>Active Visitor Monitor</span>}
            </button>

            {/* Workspaces */}
            <button
              onClick={() => setActiveTab('workspaces')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'workspaces' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'workspaces' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'workspaces' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>🏢</span>
              {!sidebarCollapsed && <span>Client Workspaces</span>}
            </button>

            {/* Payments */}
            <button
              onClick={() => setActiveTab('payments')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'payments' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'payments' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'payments' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>💳</span>
              {!sidebarCollapsed && <span>Financial Ledger</span>}
            </button>

            {/* Users */}
            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'users' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'users' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'users' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>👥</span>
              {!sidebarCollapsed && <span>User Directory</span>}
            </button>

            {/* Audit Logs */}
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'logs' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'logs' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'logs' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>🛡️</span>
              {!sidebarCollapsed && <span>Security Audit</span>}
            </button>

          </div>
        </div>

        {/* Sidebar Footer */}
        <div style={{ padding: '14px 12px', borderTop: '1px solid #1f2937', background: '#0d1117' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: sidebarCollapsed ? 0 : '10px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '14px' }}>
              {user?.name?.charAt(0) || 'S'}
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.name || 'SuperAdmin'}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.email}</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={onLogout}
              style={{ width: '100%', padding: '7px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              🚪 Sign Out
            </button>
          )}
        </div>

      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#f8fafc', color: '#0f172a' }}>
        
        {/* Top Executive Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {activeTab === 'meta' && '⚡ Meta Omnichannel Enterprise Hub'}
              {activeTab === 'inbox' && '💬 Omnichannel Live Messaging & Inbox Console'}
              {activeTab === 'ads' && '📊 Meta Marketing & Ad Campaigns Engine'}
              {activeTab === 'visitors' && '👁️ Live Real-Time Visitor Journey Tracking'}
              {activeTab === 'workspaces' && '🏢 Client Workspaces & Tenancy Administration'}
              {activeTab === 'payments' && '💳 Transaction Ledger & Subscription Billing'}
              {activeTab === 'users' && '👥 Global Platform User Accounts & IAM'}
              {activeTab === 'logs' && '🛡️ System Security Audit Trail'}
            </h1>
            <span style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
              Master Access
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleTriggerInboundMsg('instagram')}
              style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              📸 Test Inbound IG DM
            </button>
            <button
              onClick={() => handleTriggerInboundMsg('whatsapp')}
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              🟢 Test Inbound WhatsApp
            </button>
            <button
              onClick={() => setManualPaymentModal(true)}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              💳 Record Payment
            </button>
            <button
              onClick={fetchOverviewData}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', width: '100%', margin: '0 auto', flex: 1 }}>
          
          {/* TAB 1: META OMNICHANNEL ENTERPRISE HUB */}
          {activeTab === 'meta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              {/* Hero Banner */}
              <div style={{ padding: '24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '14px', border: '1px solid #334155', color: '#ffffff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #1877f2, #0066ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: '0 8px 20px rgba(24, 119, 242, 0.4)' }}>
                      ⚡
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Meta Omnichannel Enterprise Hub</h3>
                        <span style={{ background: 'rgba(24, 119, 242, 0.25)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700 }}>
                          App ID: 1311990813621733
                        </span>
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
                          🟢 Live Production Verified
                        </span>
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                        Connect your Facebook Pages, Instagram Business Accounts, WhatsApp Business Cloud APIs, and Meta Marketing Campaigns.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowWaOnboardingModal(true)}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a, #15803d)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)'
                      }}
                    >
                      🚀 WhatsApp API Onboarding Wizard
                    </button>
                    <button
                      onClick={handleFacebookLogin}
                      disabled={connectingMeta}
                      style={{
                        background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(24, 119, 242, 0.4)'
                      }}
                    >
                      {connectingMeta ? '🔄 Authenticating...' : '🔗 Connect Meta Facebook & IG (OAuth)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. ACTUAL CONNECTED ASSETS GALLERY (SEPARATE DEDICATED CARDS) */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>📱</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Active Connected Meta Business Assets</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>Authorized Facebook Pages, Instagram Profiles, and WhatsApp Cloud APIs receiving live customer webhooks.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleFacebookLogin}
                    style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🔄 Switch / Add Facebook Page
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
                  
                  {/* Card A: Facebook Business Page */}
                  <div style={{ border: '1.5px solid #bfdbfe', background: '#f8fafc', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#1877f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px' }}>
                          f
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>{metaAssets.meta?.pageName || 'Connected Facebook Page'}</div>
                          <a href={metaAssets.meta?.facebookUrl || `https://facebook.com/${metaAssets.meta?.pageId || '106590312320041'}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1877f2', textDecoration: 'none', fontWeight: 600 }}>
                            Page ID: {metaAssets.meta?.pageId || '106590312320041'} ↗
                          </a>
                        </div>
                      </div>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                        🟢 Verified Active
                      </span>
                    </div>

                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>⚡ Webhook Gateway:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>messages, messaging_postbacks</span></div>
                      <div><strong>🔑 Token Status:</strong> <span style={{ color: '#15803d', fontWeight: 700 }}>Page Scoped Token Active</span></div>
                      <div><strong>🛡️ App Review:</strong> <span style={{ color: '#1d4ed8', fontWeight: 700 }}>pages_messaging, pages_manage_metadata</span></div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${BACKEND_URL}/api/superadmin/meta/sync-subscriptions`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed to sync');
                            showToast('⚡ Webhook Subscriptions re-synced successfully with Meta!');
                          } catch (err) {
                            showToast(err.message, 'error');
                          }
                        }}
                        style={{ background: '#f8fafc', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '8px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⚡ Re-Sync Webhook
                      </button>
                      <button
                        onClick={() => setActiveTab('inbox')}
                        style={{ flex: 1, background: '#1877f2', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        💬 Open Live Inbox
                      </button>
                    </div>
                  </div>

                  {/* Card B: Dedicated Instagram Business Account */}
                  <div style={{ border: '1.5px solid #fbcfe8', background: '#fdf2f8', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px' }}>
                          📸
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                            {metaAssets.meta?.instagramHandle ? `${metaAssets.meta.instagramHandle.replace('@', '')}` : (metaAssets.meta?.pageName || 'Instagram Business Account')}
                          </div>
                          <a href={`https://instagram.com/${(metaAssets.meta?.instagramHandle || 'rajugari_ventures').replace('@', '')}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#be185d', textDecoration: 'none', fontWeight: 700 }}>
                            {metaAssets.meta?.instagramHandle || '@rajugari_ventures'} ↗
                          </a>
                        </div>
                      </div>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                        🟢 IG DM Live
                      </span>
                    </div>

                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fbcfe8', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>🆔 Instagram Account ID:</strong> <span style={{ fontFamily: 'monospace' }}>{metaAssets.meta?.instagramAccountId || '17841447931070784'}</span></div>
                      <div><strong>⚡ Direct Webhooks:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>instagram_manage_messages (Live)</span></div>
                      <div><strong>📸 Story Mentions & DMs:</strong> <span style={{ color: '#be185d', fontWeight: 700 }}>Bidirectional Ingestion Active</span></div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleTriggerInboundMsg('instagram')}
                        style={{ flex: 1, background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        📸 Test Inbound IG DM
                      </button>
                      <button
                        onClick={() => setActiveTab('inbox')}
                        style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        💬 View Inbox
                      </button>
                    </div>
                  </div>

                  {/* Card C: WhatsApp Cloud API Asset */}
                  <div style={{ border: metaAssets.whatsappApi?.enabled ? '1.5px solid #bbf7d0' : '1.5px dashed #cbd5e1', background: metaAssets.whatsappApi?.enabled ? '#f0fdf4' : '#f8fafc', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px' }}>
                          WA
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                            {metaAssets.whatsappApi?.enabled ? (metaAssets.whatsappApi?.verifiedName || 'ManaCity Support') : 'WhatsApp Business Cloud API'}
                          </div>
                          <div style={{ fontSize: '12px', color: metaAssets.whatsappApi?.enabled ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                            {metaAssets.whatsappApi?.enabled ? metaAssets.whatsappApi?.whatsappDisplayNumber : 'Not Configured Yet'}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        background: metaAssets.whatsappApi?.enabled ? '#dcfce7' : '#fee2e2',
                        color: metaAssets.whatsappApi?.enabled ? '#15803d' : '#dc2626',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 800
                      }}>
                        {metaAssets.whatsappApi?.enabled ? '🟢 Official WABA' : '⚠️ Setup Required'}
                      </span>
                    </div>

                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {metaAssets.whatsappApi?.enabled ? (
                        <>
                          <div><strong>🏢 WABA Account ID:</strong> <span style={{ fontFamily: 'monospace' }}>{metaAssets.whatsappApi?.wabaId}</span></div>
                          <div><strong>📱 Phone Number ID:</strong> <span style={{ fontFamily: 'monospace' }}>{metaAssets.whatsappApi?.phoneNumberId}</span></div>
                          <div><strong>🛡️ 24h Window:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>Interactive Session Messaging Active</span></div>
                        </>
                      ) : (
                        <div style={{ color: '#64748b', lineHeight: 1.4 }}>
                          Click the onboarding wizard below to link your official Meta WhatsApp Business Account, verify phone number, and set up 2FA.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => setShowWaOnboardingModal(true)}
                        style={{ flex: 1, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        {metaAssets.whatsappApi?.enabled ? '⚙️ Manage / Reconfigure WABA' : '🚀 Launch WhatsApp API Wizard'}
                      </button>
                      {metaAssets.whatsappApi?.enabled && (
                        <button
                          onClick={() => handleTriggerInboundMsg('whatsapp')}
                          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🟢 Test Lead
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Quick Jump Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💬</span>
                    <h5 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800 }}>Full Omnichannel Inbox</h5>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>Demonstrate bidirectional messaging with real visitor details and canned responses.</p>
                  <button onClick={() => setActiveTab('inbox')} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}>
                    Open Live Inbox ➔
                  </button>
                </div>

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📊</span>
                    <h5 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800 }}>Meta Marketing Campaigns</h5>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>Manage ad campaigns, budget pacing, and conversion chat attribution.</p>
                  <button onClick={() => setActiveTab('ads')} style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}>
                    Open Ads Manager ➔
                  </button>
                </div>

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>👁️</span>
                    <h5 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800 }}>Live Visitor Journey</h5>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>Real-time visitor tracking with live URL monitoring and UTM tags.</p>
                  <button onClick={() => setActiveTab('visitors')} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}>
                    Open Visitor Monitor ➔
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LIVE OMNICHANNEL INBOX (LIVE WEBSOCKET & META WEBHOOKS) */}
          {activeTab === 'inbox' && (
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', height: '680px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              
              {/* Left Pane: Conversation Threads */}
              <div style={{ width: '340px', minWidth: '340px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                
                {/* Search & Channel Badges */}
                <div style={{ padding: '14px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                    <button
                      onClick={() => {
                        setChatChannelFilter('all');
                        if (conversations.length > 0) setSelectedConvId(conversations[0]._id);
                      }}
                      style={{ padding: '6px 2px', borderRadius: '6px', border: 'none', background: chatChannelFilter === 'all' ? '#0f172a' : 'transparent', color: chatChannelFilter === 'all' ? '#fff' : '#64748b', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('instagram');
                        const matching = conversations.filter(c => c.source === 'instagram');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      style={{ padding: '6px 2px', borderRadius: '6px', border: 'none', background: chatChannelFilter === 'instagram' ? '#a855f7' : 'transparent', color: chatChannelFilter === 'instagram' ? '#fff' : '#64748b', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      📸 IG
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('whatsapp-api');
                        const matching = conversations.filter(c => c.source === 'whatsapp-api');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      style={{ padding: '6px 2px', borderRadius: '6px', border: 'none', background: chatChannelFilter === 'whatsapp-api' ? '#16a34a' : 'transparent', color: chatChannelFilter === 'whatsapp-api' ? '#fff' : '#64748b', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      🟢 WA
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('facebook');
                        const matching = conversations.filter(c => c.source === 'facebook');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      style={{ padding: '6px 2px', borderRadius: '6px', border: 'none', background: chatChannelFilter === 'facebook' ? '#1877f2' : 'transparent', color: chatChannelFilter === 'facebook' ? '#fff' : '#64748b', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      f FB
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('webchat');
                        const matching = conversations.filter(c => c.source === 'webchat');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      style={{ padding: '6px 2px', borderRadius: '6px', border: 'none', background: chatChannelFilter === 'webchat' ? '#3b82f6' : 'transparent', color: chatChannelFilter === 'webchat' ? '#fff' : '#64748b', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      💬 Web
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search name, phone, message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Rooms List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map(c => {
                      const isSel = c._id === selectedConvId;
                      const vName = c.visitorId?.name || (typeof c.visitorId === 'string' ? c.visitorId : 'Visitor');
                      return (
                        <div
                          key={c._id}
                          onClick={() => setSelectedConvId(c._id)}
                          style={{
                            padding: '14px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            background: isSel ? '#eff6ff' : '#ffffff',
                            borderLeft: isSel ? '4px solid #1d4ed8' : '4px solid transparent',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: c.source === 'instagram' ? '#a855f7' : c.source === 'whatsapp-api' ? '#16a34a' : c.source === 'facebook' ? '#1877f2' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>
                                {c.source === 'instagram' ? 'IG' : c.source === 'whatsapp-api' ? 'WA' : c.source === 'facebook' ? 'FB' : 'LT'}
                              </div>
                              <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{vName}</span>
                            </div>
                            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                              {new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              background: c.source === 'instagram' ? '#fdf2f8' : c.source === 'whatsapp-api' ? '#f0fdf4' : c.source === 'facebook' ? '#eff6ff' : '#f8fafc',
                              color: c.source === 'instagram' ? '#be185d' : c.source === 'whatsapp-api' ? '#15803d' : c.source === 'facebook' ? '#1d4ed8' : '#475569',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}>
                              {c.source === 'instagram' ? '📸 Instagram' : c.source === 'whatsapp-api' ? '🟢 WhatsApp' : c.source === 'facebook' ? 'f Facebook' : '💬 Live Web'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.lastMessageText || 'Chat started'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No active conversations found. Send a message to your connected Instagram or Facebook page to see it here live!
                    </div>
                  )}
                </div>

              </div>

              {/* Center Pane: Active Message Stream */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                {activeConv ? (
                  <>
                    {/* Header */}
                    <div style={{ padding: '14px 22px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: activeConv.source === 'instagram' ? '#a855f7' : activeConv.source === 'whatsapp-api' ? '#16a34a' : activeConv.source === 'facebook' ? '#1877f2' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                          {activeConv.source === 'instagram' ? 'IG' : activeConv.source === 'whatsapp-api' ? 'WA' : activeConv.source === 'facebook' ? 'FB' : 'LT'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>{activeConv.visitorId?.name || (typeof activeConv.visitorId === 'string' ? activeConv.visitorId : 'Visitor')}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Channel: <strong>{activeConv.source}</strong> | UTM: <strong>{activeConv.visitorId?.utmCampaign || 'Direct'}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setDetailsDrawerOpen(!detailsDrawerOpen)}
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {detailsDrawerOpen ? 'Hide Details ◀' : 'Show Details ▶'}
                      </button>
                    </div>

                    {/* Messages Scroll View */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {activeConv.messages?.map((m, idx) => (
                        <div
                          key={m._id || idx}
                          style={{
                            alignSelf: m.senderType === 'Agent' ? 'flex-end' : 'flex-start',
                            maxWidth: '72%',
                            background: m.senderType === 'Agent' ? 'linear-gradient(135deg, #1d4ed8, #1e40af)' : '#ffffff',
                            color: m.senderType === 'Agent' ? '#ffffff' : '#0f172a',
                            padding: '12px 16px',
                            borderRadius: m.senderType === 'Agent' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            border: m.senderType === 'Agent' ? 'none' : '1px solid #e2e8f0'
                          }}
                        >
                          <div style={{ fontSize: '13.5px', lineHeight: 1.45 }}>{m.text}</div>
                          <div style={{ fontSize: '10.5px', color: m.senderType === 'Agent' ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                            {new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Canned Responses & Upsell Pitches Bar */}
                    <div style={{ padding: '8px 20px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select
                        value={cannedReplySelect}
                        onChange={(e) => {
                          if (e.target.value) {
                            setChatInputText(e.target.value);
                            setCannedReplySelect('');
                          }
                        }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                      >
                        <option value="">⚡ Insert Canned Quick Reply...</option>
                        {quickReplies.map(qr => (
                          <option key={qr._id} value={qr.message}>{qr.title}</option>
                        ))}
                      </select>

                      <select
                        value={upsellPitchSelect}
                        onChange={(e) => {
                          if (e.target.value) {
                            setChatInputText(e.target.value);
                            setUpsellPitchSelect('');
                          }
                        }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                      >
                        <option value="">🚀 Trigger Upsell Pitch...</option>
                        {upsellPitches.map(up => (
                          <option key={up._id} value={up.pitchText}>{up.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Chat Input Bar */}
                    <form onSubmit={handleSendReply} style={{ padding: '14px 20px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder={`Type reply to ${activeConv.visitorId?.name || 'customer'}...`}
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                      />
                      <button
                        type="submit"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Send Reply 🚀
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                    Select a conversation thread to view
                  </div>
                )}
              </div>

              {/* Right Pane: Visitor Details Sidebar */}
              {detailsDrawerOpen && activeConv && (
                <div style={{ width: '280px', minWidth: '280px', borderLeft: '1px solid #e2e8f0', background: '#ffffff', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Visitor & Lead Profile</h4>
                  
                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700 }}>Full Name</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{activeConv.visitorId?.name || 'Customer'}</div>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700 }}>Channel / Origin</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px', textTransform: 'capitalize' }}>{activeConv.source || 'WebChat'}</div>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700 }}>Email / Phone</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{activeConv.visitorId?.email || activeConv.visitorId?.phone || 'Not Provided'}</div>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700 }}>Location & Device</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                        {activeConv.visitorId?.device || 'Meta Mobile App'}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700 }}>Meta Review Certification</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                        This live console handles real-time bidirectional messages across Facebook Messenger, Instagram Direct, and WhatsApp Cloud APIs.
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: META ADS MANAGER */}
          {activeTab === 'ads' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Live Meta Ad Campaigns & Conversion Attribution</h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Real-time campaign management, budget pacing, and direct chat lead attribution powered by Meta Marketing API.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewCampaignModal(true)}
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ➕ Create Campaign
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Campaign Name</th>
                    <th style={{ padding: '10px 12px' }}>Objective</th>
                    <th style={{ padding: '10px 12px' }}>Daily Budget</th>
                    <th style={{ padding: '10px 12px' }}>Impressions</th>
                    <th style={{ padding: '10px 12px' }}>Clicks</th>
                    <th style={{ padding: '10px 12px' }}>Attributed Chats</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adCampaigns.map(camp => (
                    <tr key={camp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#0f172a' }}>{camp.name}</td>
                      <td style={{ padding: '12px' }}><span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{camp.objective}</span></td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{camp.dailyBudget}</td>
                      <td style={{ padding: '12px' }}>{camp.impressions.toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{camp.clicks}</td>
                      <td style={{ padding: '12px' }}><strong style={{ color: '#16a34a' }}>{camp.conversions} chats</strong></td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: camp.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                          color: camp.status === 'ACTIVE' ? '#15803d' : '#dc2626',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800
                        }}>
                          {camp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: ACTIVE VISITOR MONITOR */}
          {activeTab === 'visitors' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Real-Time Active Visitors & Journey Telemetry</h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Live visitor navigation monitoring with automated UTM campaign attribution and proactive chat engagement.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerInboundMsg('instagram')}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ⚡ Simulate Inbound Visitor
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Visitor & Location</th>
                    <th style={{ padding: '10px 12px' }}>Current Browsing Page</th>
                    <th style={{ padding: '10px 12px' }}>Ad / Referrer Source</th>
                    <th style={{ padding: '10px 12px' }}>Time on Site</th>
                    <th style={{ padding: '10px 12px' }}>Device</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeVisitors.map((v, i) => (
                    <tr key={v._id || v.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{v.name || 'Visitor'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>IP: {v.ip || 'Local'}</div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12.5px', color: '#1d4ed8', fontWeight: 600 }}>{v.currentUrl || '/'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {v.utmCampaign || 'Direct'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12.5px' }}>Online</td>
                      <td style={{ padding: '12px', fontSize: '12.5px', color: '#64748b' }}>{v.device || 'Desktop'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                          🟢 Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: WORKSPACES */}
          {activeTab === 'workspaces' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Workspace Name</th>
                    <th style={{ padding: '12px 14px' }}>Domain & API Key</th>
                    <th style={{ padding: '12px 14px' }}>Plan & Seats</th>
                    <th style={{ padding: '12px 14px' }}>Admin Contact</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px' }}>
                        <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {t.id}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontSize: '13px', color: '#334155' }}>{t.domain || 'All Domains Allowed'}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#dc2626' }}>{t.apiKey}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <select
                          value={t.plan}
                          onChange={(e) => handleUpdateTenantPlan(t.id, e.target.value)}
                          style={{
                            background: t.plan === 'business' ? '#fdf2f8' : t.plan === 'growth' ? '#eff6ff' : '#f8fafc',
                            color: t.plan === 'business' ? '#be185d' : t.plan === 'growth' ? '#1d4ed8' : '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="free">Free (1 Seat)</option>
                          <option value="growth">Growth (₹299/mo - 3 Seats)</option>
                          <option value="business">Business (₹399/mo - 6 Seats)</option>
                          <option value="enterprise">Enterprise (20 Seats)</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontSize: '13px' }}>{t.adminEmail}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Created {new Date(t.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          background: t.isSuspended ? '#fee2e2' : '#dcfce7',
                          color: t.isSuspended ? '#dc2626' : '#15803d',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 700
                        }}>
                          {t.isSuspended ? 'Suspended' : '🟢 Active'}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleImpersonateTenant(t.id)}
                            style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            🔑 Login As
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(t.id, t.isSuspended)}
                            style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                          >
                            {t.isSuspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => handleDeleteTenant(t.id, t.name)}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: FINANCIAL LEDGER */}
          {activeTab === 'payments' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Date</th>
                    <th style={{ padding: '12px 14px' }}>Client Workspace</th>
                    <th style={{ padding: '12px 14px' }}>Plan & Type</th>
                    <th style={{ padding: '12px 14px' }}>Amount (INR)</th>
                    <th style={{ padding: '12px 14px' }}>Payment ID / Method</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '14px', fontWeight: 700 }}>
                        <div>{p.tenantId?.name || 'Unknown Client'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.tenantId?.domain}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                          {p.plan} ({p.type || 'subscription'})
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>₹{p.amount}</td>
                      <td style={{ padding: '14px', fontSize: '11.5px', fontFamily: 'monospace' }}>
                        {p.razorpayPaymentId || p.paymentMethod || 'Razorpay UPI'}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          background: p.status === 'success' ? '#dcfce7' : '#fee2e2',
                          color: p.status === 'success' ? '#15803d' : '#dc2626',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {p.status === 'success' ? '✅ Paid' : '❌ Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: USER IAM DIRECTORY */}
          {activeTab === 'users' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>User Full Name</th>
                    <th style={{ padding: '12px 14px' }}>Email Address</th>
                    <th style={{ padding: '12px 14px' }}>Associated Workspace</th>
                    <th style={{ padding: '12px 14px' }}>Role & Permissions</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px', fontWeight: 700 }}>{u.name}</td>
                      <td style={{ padding: '14px', fontSize: '13px' }}>{u.email}</td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 600 }}>{u.tenantId?.name || 'Master Admin'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{u.tenantId?.domain}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                          style={{
                            background: u.role === 'SuperAdmin' ? '#fee2e2' : u.role === 'Admin' ? '#eff6ff' : '#f8fafc',
                            color: u.role === 'SuperAdmin' ? '#dc2626' : u.role === 'Admin' ? '#1d4ed8' : '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="Agent">Agent (Support Staff)</option>
                          <option value="Admin">Admin (Workspace Owner)</option>
                          <option value="SuperAdmin">SuperAdmin (Platform Master)</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          background: u.status === 'Online' ? '#dcfce7' : '#f1f5f9',
                          color: u.status === 'Online' ? '#15803d' : '#64748b',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {u.status === 'Online' ? '🟢 Online' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <button
                          onClick={() => handleForceResetPassword(u._id, u.email)}
                          style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                        >
                          🔑 Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 8: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Timestamp</th>
                    <th style={{ padding: '12px 14px' }}>Security Action</th>
                    <th style={{ padding: '12px 14px' }}>Target Workspace</th>
                    <th style={{ padding: '12px 14px' }}>Actor</th>
                    <th style={{ padding: '12px 14px' }}>Details Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(l => (
                    <tr key={l._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                          {l.action}
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 600 }}>{l.tenantId?.name || 'System / Platform'}</td>
                      <td style={{ padding: '14px', fontSize: '12px' }}>{l.actorEmail || 'system'}</td>
                      <td style={{ padding: '14px', fontSize: '11px', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {JSON.stringify(l.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* MODAL 1: Meta Assets Selector */}
      {showAssetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '480px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Select Meta Business Page & WhatsApp Asset</h3>
              <button onClick={() => setShowAssetModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>AVAILABLE FACEBOOK PAGES & INSTAGRAM ACCOUNTS:</div>
              {availablePages.map(p => (
                <div 
                  key={p.pageId} 
                  onClick={() => handleSelectAsset(p.pageId, null)}
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#1877f2' }}>📄 {p.pageName}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Instagram: {p.instagramHandle || 'No IG linked'}</div>
                  </div>
                  <span style={{ background: '#1877f2', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Select</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WHATSAPP CLOUD API ONBOARDING WIZARD */}
      {showWaOnboardingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '28px', width: '520px', display: 'flex', flexDirection: 'column', gap: '20px', color: '#0f172a', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px' }}>
                  WA
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>WhatsApp Cloud Business API Onboarding</h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Meta Embedded Signup & Business Phone Verification</span>
                </div>
              </div>
              <button onClick={() => setShowWaOnboardingModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            {/* Stepper Progress */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: 700 }}>
              <span style={{ color: waOnboardingStep >= 1 ? '#16a34a' : '#94a3b8' }}>1. WABA Account</span>
              <span>➔</span>
              <span style={{ color: waOnboardingStep >= 2 ? '#16a34a' : '#94a3b8' }}>2. Phone & 2FA PIN</span>
              <span>➔</span>
              <span style={{ color: waOnboardingStep >= 3 ? '#16a34a' : '#94a3b8' }}>3. Webhook Sync</span>
            </div>

            <form onSubmit={handleCompleteWhatsAppOnboarding} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Step 1 */}
              {waOnboardingStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700 }}>WhatsApp Business Account ID (WABA)</label>
                    <input
                      type="text"
                      value={waWabaId}
                      onChange={(e) => setWaWabaId(e.target.value)}
                      placeholder="e.g. 5703446903066867"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700 }}>WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      value={waPhoneId}
                      onChange={(e) => setWaPhoneId(e.target.value)}
                      placeholder="e.g. 111738020188242"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setWaOnboardingStep(2)}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}
                  >
                    Next: Register Phone & 2FA ➔
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {waOnboardingStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Display Phone Number (E.164 Format)</label>
                    <input
                      type="text"
                      value={waDisplayNumber}
                      onChange={(e) => setWaDisplayNumber(e.target.value)}
                      placeholder="e.g. +91 99000 11223"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Verified Business Display Name</label>
                    <input
                      type="text"
                      value={waDisplayName}
                      onChange={(e) => setWaDisplayName(e.target.value)}
                      placeholder="e.g. ManaCity Support"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700 }}>6-Digit 2FA PIN</label>
                      <input
                        type="password"
                        maxLength="6"
                        value={waPin}
                        onChange={(e) => setWaPin(e.target.value)}
                        placeholder="123456"
                        required
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Business Category</label>
                      <select
                        value={waCategory}
                        onChange={(e) => setWaCategory(e.target.value)}
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="CUSTOMER_SERVICE">Customer Service</option>
                        <option value="COMMERCE">Retail & Commerce</option>
                        <option value="FINANCE">Financial Services</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setWaOnboardingStep(1)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      ◀ Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaOnboardingStep(3)}
                      style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Next: Verify Webhook Gateway ➔
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {waOnboardingStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>✅ Live Webhook Gateway Configured:</div>
                    <div><strong>Callback URL:</strong> <span style={{ fontFamily: 'monospace' }}>https://letstrack.manacity.in/api/integrations/whatsapp-api/webhook</span></div>
                    <div><strong>Verification Token:</strong> <span style={{ fontFamily: 'monospace' }}>letstrack_wa_verify_2026</span></div>
                    <div><strong>Permissions Active:</strong> <span style={{ color: '#16a34a', fontWeight: 800 }}>whatsapp_business_management, whatsapp_business_messaging</span></div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setWaOnboardingStep(2)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      ◀ Back
                    </button>
                    <button
                      type="submit"
                      style={{ flex: 1, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer' }}
                    >
                      🎉 Complete WhatsApp Onboarding & Activate
                    </button>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Launch Ad Campaign */}
      {showNewCampaignModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '440px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Launch Meta Ad Campaign</h3>
              <button onClick={() => setShowNewCampaignModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ name: newCampaignName, dailyBudget: newCampaignBudget, objective: newCampaignObjective })
                });
                if (res.ok) {
                  setShowNewCampaignModal(false);
                  setNewCampaignName('');
                  showToast('🎉 Meta Ad Campaign Launched!');
                  fetchAdCampaigns();
                }
              } catch (e) {}
            }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. LetsTrack 2026 Promo - Direct to Chat"
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Objective</label>
                <select
                  value={newCampaignObjective}
                  onChange={(e) => setNewCampaignObjective(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="LEAD_GENERATION">LEAD_GENERATION (Direct WhatsApp / Live Chat)</option>
                  <option value="CONVERSIONS">CONVERSIONS (/pricing & checkout)</option>
                  <option value="TRAFFIC">TRAFFIC (Website Landing Page)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Daily Budget (INR)</label>
                <input
                  type="number"
                  value={newCampaignBudget}
                  onChange={(e) => setNewCampaignBudget(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  🚀 Launch Campaign
                </button>
                <button type="button" onClick={() => setShowNewCampaignModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Manual Payment Record */}
      {manualPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Record Offline / Manual Payment</h3>
              <button onClick={() => setManualPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleRecordManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Select Client Workspace</label>
                <select
                  value={manualPayTenantId}
                  onChange={(e) => setManualPayTenantId(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Choose Workspace --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.domain || t.adminEmail})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Amount (INR)</label>
                <input
                  type="number"
                  value={manualPayAmount}
                  onChange={(e) => setManualPayAmount(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Upgrade Plan Target</label>
                <select
                  value={manualPayPlan}
                  onChange={(e) => setManualPayPlan(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="growth">Growth (₹299/mo - 3 Seats)</option>
                  <option value="business">Business (₹399/mo - 6 Seats + Social DM)</option>
                  <option value="enterprise">Enterprise (Custom Seats)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Payment Method</label>
                <select
                  value={manualPayMethod}
                  onChange={(e) => setManualPayMethod(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="bank_transfer">Direct Bank NEFT / IMPS</option>
                  <option value="upi_manual">UPI QR Offline</option>
                  <option value="cash">Cash / Cheque</option>
                  <option value="adjustment">Internal Admin Credit</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Internal Notes / Reference</label>
                <input
                  type="text"
                  placeholder="UTR / Txn Ref number"
                  value={manualPayNotes}
                  onChange={(e) => setManualPayNotes(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  ✅ Record & Activate Plan
                </button>
                <button type="button" onClick={() => setManualPaymentModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
