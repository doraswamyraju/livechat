import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import LeadManagementSystem from './LeadManagementSystem';

export default function SuperAdminDashboard({
  token,
  user,
  BACKEND_URL,
  showToast,
  onLogout,
  onImpersonateSuccess
}) {
  // Navigation
  const [activeTab, setActiveTab] = useState('meta'); // 'meta' | 'inbox' | 'leads' | 'ads' | 'visitors' | 'workspaces' | 'payments' | 'users' | 'logs'

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
  const [adAccounts, setAdAccounts] = useState([
    {
      id: 'act_1394810294820',
      name: 'LetsTrack Enterprise Global Ad Account',
      accountStatus: 'ACTIVE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      balance: '₹24,500',
      spendCap: '₹100,000',
      totalSpent: '₹14,850'
    },
    {
      id: 'act_984128471920',
      name: 'ManaCity Direct Growth Marketing',
      accountStatus: 'ACTIVE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      balance: '₹12,200',
      spendCap: '₹50,000',
      totalSpent: '₹6,400'
    }
  ]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('act_1394810294820');
  const [adsSubTab, setAdsSubTab] = useState('campaigns'); // 'campaigns' | 'adsets' | 'creatives' | 'attribution'
  const [isSyncingAds, setIsSyncingAds] = useState(false);
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

  // Ad Campaign Creation & Management Modals
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [createCampaignStep, setCreateCampaignStep] = useState(1);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignBudget, setNewCampaignBudget] = useState('500');
  const [newCampaignObjective, setNewCampaignObjective] = useState('LEAD_GENERATION');
  const [newCampaignTargetUrl, setNewCampaignTargetUrl] = useState('https://letstrack.manacity.in/#pricing');
  const [newCampaignLocations, setNewCampaignLocations] = useState('India (Tier 1 Metros: Bengaluru, Mumbai, Delhi-NCR, Hyderabad)');
  const [newCampaignAgeRange, setNewCampaignAgeRange] = useState('21 - 54');
  const [newCampaignInterests, setNewCampaignInterests] = useState('SaaS, E-Commerce, Shopify, Startup Founders');
  const [newCampaignPlacements, setNewCampaignPlacements] = useState(['Instagram Reels', 'Instagram Feed', 'Facebook Feed']);
  const [newCampaignFormat, setNewCampaignFormat] = useState('SINGLE_IMAGE'); // 'SINGLE_IMAGE' | 'CAROUSEL' | 'VIDEO'
  const [newCampaignImage, setNewCampaignImage] = useState('https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80');
  const [newCampaignHeadline, setNewCampaignHeadline] = useState('⚡ Turn Website & IG Visitors Into Customers 24/7');
  const [newCampaignPrimaryText, setNewCampaignPrimaryText] = useState('Start chatting with your high-intent visitors in real time with LetsTrack live visitor tracking & omnichannel inbox.');
  const [newCampaignCta, setNewCampaignCta] = useState('Send Instagram Message');

  // Edit Budget Modal
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editBudgetValue, setEditBudgetValue] = useState('');

  // Connect Custom / Live Meta Ad Account Modal
  const [showConnectAdAccountModal, setShowConnectAdAccountModal] = useState(false);
  const [customAdAccountId, setCustomAdAccountId] = useState('');
  const [customAdAccountToken, setCustomAdAccountToken] = useState('');
  const [customAdAccountName, setCustomAdAccountName] = useState('');
  const [customAdCurrency, setCustomAdCurrency] = useState('INR');
  const [isConnectingAdAcc, setIsConnectingAdAcc] = useState(false);
  const [adsApiError, setAdsApiError] = useState(null);

  // Creative Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPreviewCreative, setSelectedPreviewCreative] = useState(null);

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
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [cannedReplySelect, setCannedReplySelect] = useState('');
  const [upsellPitchSelect, setUpsellPitchSelect] = useState('');

  // Audio Chime Synthesizer
  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

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

  const fetchMessagesForSelectedConv = async (convId) => {
    if (!convId || !token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const msgs = await res.json();
        setConversations(prev => prev.map(c => {
          if (c._id === convId) {
            return { ...c, messages: msgs };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Error fetching messages for conv:', err);
    }
  };

  // 1. Initial Load & WebSocket Setup
  useEffect(() => {
    fetchOverviewData();
    fetchMetaAssets();
    fetchAdAccounts();
    fetchAdCampaigns();
    fetchConversations();

    // Connect to WebSocket /dashboard Namespace for Real-Time Meta Messages Ingestion
    if (token) {
      const socket = io(`${BACKEND_URL}/dashboard`, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      const sendAgentInit = () => {
        socket.emit('agent-init', {
          tenantId: user?.tenantId,
          agentId: user?._id || user?.userId
        });
      };

      if (socket.connected) {
        sendAgentInit();
      }
      socket.on('connect', sendAgentInit);

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
        const conversation = data?.conversation;
        const conversationId = conversation?._id || data?.conversationId;
        const message = data?.message;
        const visitor = data?.visitor || conversation?.visitorId;
        const targetId = conversationId || conversation?._id;
        if (!targetId && !conversation) return;

        setConversations(prev => {
          const index = prev.findIndex(c => c._id === targetId);
          let targetConv;
          if (index > -1) {
            const existing = prev[index];
            const prevMessages = existing.messages || [];
            const isDup = message && prevMessages.some(m => m._id === message._id || (m.text === message.text && Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 3000));
            targetConv = {
              ...existing,
              ...(conversation || {}),
              tenantId: conversation?.tenantId || existing.tenantId,
              visitorId: visitor || conversation?.visitorId || existing.visitorId,
              unreadCount: (selectedConvId === targetId) ? 0 : ((existing.unreadCount || 0) + 1),
              lastMessageText: message?.text || conversation?.lastMessageText || existing.lastMessageText,
              updatedAt: message?.timestamp || new Date().toISOString(),
              messages: message && !isDup ? [...prevMessages, message] : prevMessages
            };
          } else if (conversation) {
            targetConv = {
              ...conversation,
              unreadCount: (selectedConvId === targetId) ? 0 : 1,
              visitorId: visitor || conversation.visitorId,
              lastMessageText: message?.text || conversation.lastMessageText,
              updatedAt: message?.timestamp || new Date().toISOString(),
              messages: message ? [message] : []
            };
          } else {
            return prev;
          }
          const remaining = prev.filter(c => c._id !== targetId);
          return [targetConv, ...remaining];
        });

        if (!selectedConvId && targetId) {
          setSelectedConvId(targetId);
        }
        playNotificationSound();
        showToast(`💬 Inbound message from ${visitor?.name || conversation?.visitorId?.name || 'Visitor'}: "${message?.text?.substring(0, 35) || 'New message'}"`);
      });

      socket.on('agent-msg-received', (data) => {
        const { conversationId, message } = data;
        setConversations(prev => {
          const index = prev.findIndex(c => c._id === conversationId);
          if (index > -1) {
            const existing = prev[index];
            const prevMessages = existing.messages || [];
            const isDup = message && prevMessages.some(m => m._id === message._id || (m.text === message.text && Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 3000));
            const updated = {
              ...existing,
              lastMessageText: message.text,
              updatedAt: message.timestamp || new Date().toISOString(),
              messages: isDup ? prevMessages : [...prevMessages, message]
            };
            const remaining = prev.filter(c => c._id !== conversationId);
            return [updated, ...remaining];
          }
          return prev;
        });
      });

      socket.on('visitor-connected', (visitor) => {
        if (!visitor) return;
        setActiveVisitors(prev => {
          const index = prev.findIndex(v => v._id === visitor._id);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = visitor;
            return updated;
          }
          return [visitor, ...prev];
        });
        playNotificationSound();
        showToast(`🟢 New Visitor Online: ${visitor.name || 'Visitor'} (${visitor.city || 'India'}, ${visitor.country || 'IN'})`);
      });

      socket.on('conversation-created', (newConv) => {
        if (!newConv) return;
        setConversations(prev => {
          if (prev.some(c => c._id === newConv._id)) return prev;
          return [newConv, ...prev];
        });
        playNotificationSound();
        showToast(`⚡ New Conversation Started: ${newConv.visitorId?.name || 'Visitor'}`);
      });

      socket.on('conversation-updated', (updatedConv) => {
        if (!updatedConv) return;
        setConversations(prev => {
          const remaining = prev.filter(c => c._id !== updatedConv._id);
          const existing = prev.find(c => c._id === updatedConv._id) || {};
          return [{ ...existing, ...updatedConv }, ...remaining];
        });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, user]);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessagesForSelectedConv(selectedConvId);
    }
  }, [selectedConvId]);

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

  const fetchAdAccounts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accounts && data.accounts.length > 0) {
          setAdAccounts(data.accounts);
          if (!selectedAdAccountId || selectedAdAccountId === 'act_1394810294820') {
            setSelectedAdAccountId(data.accounts[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching ad accounts:', err);
    }
  };

  const fetchAdCampaigns = async (accId) => {
    if (!token) return;
    try {
      const targetAccountId = accId || selectedAdAccountId;
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/campaigns?accountId=${encodeURIComponent(targetAccountId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setAdsApiError(data.error);
          setAdCampaigns([]);
        } else {
          setAdsApiError(null);
          setAdCampaigns(Array.isArray(data) ? data : (data.campaigns || []));
        }
      }
    } catch (err) {
      console.error('Error fetching ad campaigns:', err);
      setAdsApiError(err.message);
    }
  };

  // Connect Custom / Live Meta Ad Account
  const handleConnectAdAccount = async (e) => {
    e.preventDefault();
    if (!customAdAccountId || !customAdAccountId.trim()) {
      showToast('Please enter a valid Meta Ad Account ID (e.g. act_1234567890)', 'error');
      return;
    }
    try {
      setIsConnectingAdAcc(true);
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/connect-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adAccountId: customAdAccountId.trim(),
          accessToken: customAdAccountToken.trim() || undefined,
          adAccountName: customAdAccountName.trim() || undefined,
          currency: customAdCurrency
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Meta ad account');

      showToast(`🎉 ${data.message || 'Meta Ad Account connected successfully!'}`);
      setShowConnectAdAccountModal(false);
      setCustomAdAccountId('');
      setCustomAdAccountToken('');
      setCustomAdAccountName('');
      
      // Refresh ad accounts and switch to it
      await fetchAdAccounts();
      if (data.account?.id) {
        setSelectedAdAccountId(data.account.id);
        fetchAdCampaigns(data.account.id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsConnectingAdAcc(false);
    }
  };

  // Toggle Campaign Status (Active / Paused)
  const handleToggleCampaignStatus = async (campaignId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/${campaignId}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Campaign status updated to ${data.campaign.status}`);
        fetchAdCampaigns();
      }
    } catch (err) {
      showToast('Failed to toggle campaign status', 'error');
    }
  };

  // Update Campaign Daily Budget
  const handleUpdateCampaignBudget = async (e) => {
    e.preventDefault();
    if (!editingCampaign || !editBudgetValue) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/${editingCampaign.id}/budget`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dailyBudget: editBudgetValue })
      });
      if (res.ok) {
        showToast(`🎉 Daily budget updated to ₹${editBudgetValue} / day`);
        setShowEditBudgetModal(false);
        setEditingCampaign(null);
        fetchAdCampaigns();
      }
    } catch (err) {
      showToast('Failed to update campaign budget', 'error');
    }
  };

  // Delete / Archive Campaign
  const handleDeleteCampaign = async (campaignId, campaignName) => {
    if (!window.confirm(`Are you sure you want to archive / delete campaign "${campaignName}" from Meta Ads?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/${campaignId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Campaign archived successfully');
        fetchAdCampaigns();
      }
    } catch (err) {
      showToast('Failed to delete campaign', 'error');
    }
  };

  // Sync with Meta Marketing API
  const handleSyncMetaAds = async () => {
    setIsSyncingAds(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdCampaigns(data.campaigns || []);
        showToast('⚡ Live sync complete with Meta Marketing API v26.0!');
      }
    } catch (err) {
      showToast('Error syncing with Meta API', 'error');
    } finally {
      setTimeout(() => setIsSyncingAds(false), 600);
    }
  };

  // Disconnect Meta Assets (Facebook, Instagram, WhatsApp)
  const handleDisconnectMeta = async (target = 'all') => {
    const confirmMsg = target === 'all'
      ? 'Are you sure you want to disconnect all Meta assets (Facebook, Instagram, and WhatsApp API)?'
      : target === 'whatsapp'
      ? 'Are you sure you want to disconnect WhatsApp Business Cloud API?'
      : 'Are you sure you want to disconnect Facebook and Instagram?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      showToast(data.message || 'Meta assets disconnected successfully');
      fetchMetaAssets();
    } catch (err) {
      showToast(err.message, 'error');
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

  const handleConnectManualToken = async () => {
    const manualToken = window.prompt('Enter your Meta Permanent Page Access Token or System User Token:');
    if (!manualToken || !manualToken.trim()) return;

    try {
      setConnectingMeta(true);
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accessToken: manualToken.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Meta token');
      showToast(data.message || '🎉 Meta Token connected successfully!');
      fetchMetaAssets();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConnectingMeta(false);
    }
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
      const errMsg = err.message || '';
      if (errMsg.includes('expired') || errMsg.includes('OAuthException') || errMsg.includes('190') || errMsg.includes('subcode":463') || errMsg.includes('access token')) {
        showToast('⚠️ Meta Token Expired! Please click "Connect Meta Facebook & IG" in Meta Hub to refresh session.', 'error');
      } else {
        showToast(errMsg, 'error');
      }
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

  const filteredConversations = conversations
    .filter(c => {
      if (chatChannelFilter !== 'all' && c.source !== chatChannelFilter) return false;
      const vName = c.visitorId?.name || (typeof c.visitorId === 'string' ? c.visitorId : '');
      if (searchQuery && !vName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.lastMessageText?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

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

            {/* Lead Management System (LMS & CRM) */}
            <button
              onClick={() => setActiveTab('leads')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'leads' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
                color: activeTab === 'leads' ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === 'leads' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                textAlign: 'left',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
            >
              <span style={{ fontSize: '17px' }}>🎯</span>
              {!sidebarCollapsed && <span>Leads & LMS CRM</span>}
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
              {activeTab === 'leads' && '🎯 Lead Management System (LMS) & Meta Ads CRM'}
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
                      onClick={handleConnectManualToken}
                      disabled={connectingMeta}
                      style={{
                        background: '#334155',
                        color: '#ffffff',
                        border: '1px solid #475569',
                        padding: '12px 18px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      🔑 Paste Permanent Token
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(metaAssets.meta?.enabled || metaAssets.whatsappApi?.enabled) && (
                      <button
                        onClick={() => handleDisconnectMeta('all')}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ❌ Disconnect All
                      </button>
                    )}
                    <button
                      onClick={handleFacebookLogin}
                      style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🔄 Switch / Add Facebook Page
                    </button>
                  </div>
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
                        ⚡ Re-Sync
                      </button>
                      <button
                        onClick={() => handleDisconnectMeta('meta')}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={() => setActiveTab('inbox')}
                        style={{ flex: 1, background: '#1877f2', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        💬 Open Inbox
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
                        {metaAssets.whatsappApi?.enabled ? '⚙️ Manage / Reconfigure' : '🚀 Launch WhatsApp API Wizard'}
                      </button>
                      {metaAssets.whatsappApi?.enabled && (
                        <>
                          <button
                            onClick={() => handleTriggerInboundMsg('whatsapp')}
                            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            🟢 Test Lead
                          </button>
                          <button
                            onClick={() => handleDisconnectMeta('whatsapp')}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            title="Disconnect WhatsApp API"
                          >
                            Disconnect
                          </button>
                        </>
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

          {/* TAB: LEAD MANAGEMENT SYSTEM & CRM */}
          {activeTab === 'leads' && (
            <LeadManagementSystem
              token={token}
              user={user}
              BACKEND_URL={BACKEND_URL}
              showToast={showToast}
              onOpenChatWithLead={(lead) => {
                setActiveTab('inbox');
                if (lead.conversationId) setSelectedConvId(lead.conversationId);
              }}
            />
          )}

          {/* TAB 2: LIVE OMNICHANNEL INBOX (LIVE WEBSOCKET & META WEBHOOKS) */}
          {activeTab === 'inbox' && (
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', height: '720px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              
              {/* Left Pane: Conversation Threads (Unified Inbox) */}
              <div style={{ width: '340px', minWidth: '320px', flexShrink: 0, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                
                {/* Unified Inbox Header with Channel Filter Pills */}
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Unified Inbox</h2>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>All conversations. One place.</div>
                    </div>
                    <button
                      onClick={() => fetchConversations()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '6px', borderRadius: '6px', color: '#64748b' }}
                      title="Refresh Inbox"
                    >
                      🔄
                    </button>
                  </div>

                  {/* Horizontal Channel Filter Pills */}
                  <div className="channel-filter-scroll" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button
                      onClick={() => {
                        setChatChannelFilter('all');
                        if (conversations.length > 0) setSelectedConvId(conversations[0]._id);
                      }}
                      className={`channel-pill ${chatChannelFilter === 'all' ? 'active' : ''}`}
                    >
                      <span>All</span>
                      <span className="pill-count-badge">{conversations.length}</span>
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('whatsapp-api');
                        const matching = conversations.filter(c => c.source === 'whatsapp-api' || c.source === 'whatsapp-web');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      className={`channel-pill ${chatChannelFilter === 'whatsapp-api' ? 'active' : ''}`}
                    >
                      <span>🟢 WA</span>
                      <span className="pill-count-badge">{conversations.filter(c => c.source === 'whatsapp-api' || c.source === 'whatsapp-web').length}</span>
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('instagram');
                        const matching = conversations.filter(c => c.source === 'instagram');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      className={`channel-pill ${chatChannelFilter === 'instagram' ? 'active' : ''}`}
                    >
                      <span>📸 IG</span>
                      <span className="pill-count-badge">{conversations.filter(c => c.source === 'instagram').length}</span>
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('facebook');
                        const matching = conversations.filter(c => c.source === 'facebook');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      className={`channel-pill ${chatChannelFilter === 'facebook' ? 'active' : ''}`}
                    >
                      <span>👥 FB</span>
                      <span className="pill-count-badge">{conversations.filter(c => c.source === 'facebook').length}</span>
                    </button>
                    <button
                      onClick={() => {
                        setChatChannelFilter('webchat');
                        const matching = conversations.filter(c => !c.source || c.source === 'webchat');
                        if (matching.length > 0) setSelectedConvId(matching[0]._id);
                      }}
                      className={`channel-pill ${chatChannelFilter === 'webchat' ? 'active' : ''}`}
                    >
                      <span>💬 Web</span>
                      <span className="pill-count-badge">{conversations.filter(c => !c.source || c.source === 'webchat').length}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search name, phone, message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Rooms List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map(c => {
                      const isSel = c._id === selectedConvId;
                      const vName = c.visitorId?.name || (typeof c.visitorId === 'string' ? c.visitorId : 'Visitor');
                      const hasUnread = Boolean(c.unreadCount && c.unreadCount > 0);
                      const initial = (vName || 'V')[0]?.toUpperCase();
                      const isWA = c.source === 'whatsapp-api' || c.source === 'whatsapp-web';
                      const isIG = c.source === 'instagram';
                      const isFB = c.source === 'facebook';

                      return (
                        <div
                          key={c._id}
                          onClick={() => {
                            setSelectedConvId(c._id);
                            setConversations(prev => prev.map(conv => conv._id === c._id ? { ...conv, unreadCount: 0 } : conv));
                            if (socketRef.current) {
                              socketRef.current.emit('mark-conversation-read', { conversationId: c._id });
                            }
                          }}
                          style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            background: isSel ? '#fef2f2' : (hasUnread ? '#f8fafc' : '#ffffff'),
                            borderLeft: isSel ? '4px solid #dc2626' : (hasUnread ? '4px solid #ef4444' : '4px solid transparent'),
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Avatar with Channel Overlay Badge */}
                          <div className="avatar-badge-wrapper" style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: '#f1f5f9',
                              color: '#0f172a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '15px'
                            }}>
                              {initial}
                            </div>
                            <div
                              className={`channel-badge-overlay ${isWA ? 'whatsapp' : isIG ? 'instagram' : isFB ? 'facebook' : 'webchat'}`}
                              style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                border: '2px solid #ffffff'
                              }}
                            >
                              {isWA ? '🟢' : isIG ? '📸' : isFB ? '👥' : '💬'}
                            </div>
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <span style={{ fontWeight: hasUnread ? 800 : 700, fontSize: '13.5px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {vName}
                              </span>
                              <span style={{ fontSize: '10.5px', color: hasUnread ? '#dc2626' : '#94a3b8', fontWeight: hasUnread ? 800 : 500 }}>
                                {new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: hasUnread ? '#0f172a' : '#64748b', fontWeight: hasUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                                {c.lastMessageText || 'No message snippet'}
                              </span>
                              {hasUnread && (
                                <span style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: 800
                                }}>
                                  {c.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No conversations found for filter
                    </div>
                  )}
                </div>
              </div>

              {/* Center Pane: Active Message Stream */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                {activeConv ? (
                  <>
                    {/* Header */}
                    <div style={{ padding: '14px 22px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: activeConv.source === 'instagram' ? '#a855f7' : activeConv.source === 'whatsapp-api' ? '#16a34a' : activeConv.source === 'facebook' ? '#1877f2' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                          {activeConv.source === 'instagram' ? 'IG' : activeConv.source === 'whatsapp-api' ? 'WA' : activeConv.source === 'facebook' ? 'FB' : 'LT'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>{activeConv.visitorId?.name || (typeof activeConv.visitorId === 'string' ? activeConv.visitorId : 'Visitor')}</span>
                            {activeConv.tenantId?.name && (
                              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                🏢 {activeConv.tenantId.name}
                              </span>
                            )}
                          </div>
                          
                          {/* Asset Selection & Channel Telemetry Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            {activeConv.source === 'instagram' && (
                              <span style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>
                                📸 Asset: IG {metaAssets.meta?.instagramHandle || '@letstrack_live'} (ID: {metaAssets.meta?.instagramAccountId || '178414008291823'})
                              </span>
                            )}
                            {activeConv.source === 'whatsapp-api' && (
                              <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>
                                🟢 Asset: WA {metaAssets.whatsappApi?.whatsappDisplayNumber || '+91 99000 11223'} (WABA: {metaAssets.whatsappApi?.wabaId || '5703446903066867'})
                              </span>
                            )}
                            {activeConv.source === 'facebook' && (
                              <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>
                                📘 Asset: FB {metaAssets.meta?.pageName || 'ManaCity Support'} (Page ID: {metaAssets.meta?.pageId || '1098234190823'})
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              UTM Campaign: <strong>{activeConv.visitorId?.utmCampaign || 'LetsTrack 2026 Promo'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={async () => {
                            try {
                              const vName = activeConv.visitorId?.name || (typeof activeConv.visitorId === 'string' ? activeConv.visitorId : 'Visitor');
                              const vEmail = activeConv.visitorId?.email || '';
                              const vPhone = activeConv.visitorId?.phoneNumber || '';
                              const tId = activeConv.tenantId?._id || activeConv.tenantId;

                              const res = await fetch(`${BACKEND_URL}/api/leads`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  tenantId: tId,
                                  name: vName,
                                  email: vEmail,
                                  phoneNumber: vPhone,
                                  source: activeConv.source === 'whatsapp-api' ? 'whatsapp' : activeConv.source,
                                  status: 'New',
                                  conversationId: activeConv._id,
                                  tags: ['Chat Conversion', activeConv.source],
                                  initialNote: `Converted from live chat conversation (${activeConv.source}). Last message: "${activeConv.lastMessageText || ''}"`
                                })
                              });
                              if (res.ok) {
                                showToast('Converted to Lead successfully!', 'success');
                                setActiveTab('leads');
                              } else {
                                const d = await res.json();
                                showToast(d.error || 'Failed to convert to lead', 'error');
                              }
                            } catch (err) {
                              showToast('Failed to convert to lead', 'error');
                            }
                          }}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecdd3',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Convert this chat into an LMS Lead record"
                        >
                          ⚡ Convert to Lead
                        </button>

                        <button
                          onClick={() => setDetailsDrawerOpen(!detailsDrawerOpen)}
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {detailsDrawerOpen ? 'Hide Details ◀' : 'Show Details ▶'}
                        </button>
                      </div>
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
                          <div style={{ fontSize: '10.5px', color: m.senderType === 'Agent' ? 'rgba(255,255,255,0.85)' : '#94a3b8', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <span>{m.senderType === 'Agent' ? (activeConv.source === 'instagram' ? '✓✓ Delivered via Instagram Graph API' : activeConv.source === 'whatsapp-api' ? '✓✓ Delivered via WhatsApp Cloud API' : '✓✓ Delivered') : ''}</span>
                            <span>{new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                <div style={{ width: '260px', minWidth: '240px', flexShrink: 0, borderLeft: '1px solid #e2e8f0', background: '#ffffff', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
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

          {/* TAB 3: META ADS MANAGER (ads_read & ads_management) */}
          {activeTab === 'ads' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 1. Meta Ads Manager Header & Account Switcher Bar */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>📊 Meta Ads Manager & Marketing Suite</h3>
                    <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                      Meta Marketing API v26.0 Live
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Manage end-to-end ad campaigns, ad sets, creatives, daily budgets, and real-time omnichannel chat lead attribution.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Connected Ad Account Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Connected Ad Account</span>
                    <select
                      value={selectedAdAccountId}
                      onChange={(e) => {
                        setSelectedAdAccountId(e.target.value);
                        fetchAdCampaigns(e.target.value);
                      }}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 700, color: '#0f172a', background: '#f8fafc', cursor: 'pointer', maxWidth: '320px' }}
                      title="Select Meta Ad Account to manage campaigns and read marketing insights"
                    >
                      {adAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.id}) - {acc.currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Connect / Add Custom Live Ad Account Button */}
                  <button
                    onClick={() => setShowConnectAdAccountModal(true)}
                    style={{ background: '#f8fafc', border: '1px solid #94a3b8', padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '14px' }}
                    title="Connect live Meta Ad Account ID (act_...) or System User Token"
                  >
                    ⚙️ Connect Live Ad Account
                  </button>

                  {/* Sync Button */}
                  <button
                    onClick={handleSyncMetaAds}
                    disabled={isSyncingAds}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px' }}
                    title="Synchronize live campaigns, impressions, and click insights from Meta Marketing API"
                  >
                    <span style={{ display: 'inline-block', transform: isSyncingAds ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s' }}>🔄</span>
                    {isSyncingAds ? 'Syncing...' : 'Sync Meta API'}
                  </button>

                  {/* Export CSV */}
                  <button
                    onClick={() => {
                      showToast('📥 Exporting Meta Ads Performance Report (CSV)...');
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, color: '#334155', cursor: 'pointer', marginTop: '14px' }}
                    title="Download marketing performance report in CSV format"
                  >
                    📥 Export Report
                  </button>

                  {/* Create Campaign CTA */}
                  <button
                    onClick={() => {
                      setCreateCampaignStep(1);
                      setShowNewCampaignModal(true);
                    }}
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29,78,216,0.3)', marginTop: '14px' }}
                    title="Create a new Meta ad campaign, ad set, and sponsored creative"
                  >
                    ➕ Create Campaign
                  </button>
                </div>
              </div>

              {/* 2. Key Performance Metrics Overview (ads_read) - Dynamic Calculations */}
              {(() => {
                const campsList = Array.isArray(adCampaigns) ? adCampaigns : [];
                const totalSpendNum = campsList.reduce((sum, c) => {
                  const raw = typeof c.spend === 'string' ? parseFloat(c.spend.replace(/[₹,]/g, '')) || 0 : (c.spend || 0);
                  return sum + raw;
                }, 0);
                const totalImpressionsNum = campsList.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0);
                const totalClicksNum = campsList.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0);
                const totalConversionsNum = campsList.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0);
                const overallCtr = totalImpressionsNum > 0 ? ((totalClicksNum / totalImpressionsNum) * 100).toFixed(2) + '%' : '0.00%';
                const overallCpc = totalClicksNum > 0 ? '₹' + (totalSpendNum / totalClicksNum).toFixed(2) : '₹0.00';
                const overallCpa = totalConversionsNum > 0 ? '₹' + (totalSpendNum / totalConversionsNum).toFixed(2) : '₹0.00';
                const activeCount = campsList.filter(c => c.status === 'ACTIVE').length;
                const pausedCount = campsList.filter(c => c.status === 'PAUSED').length;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} title="Total advertising budget spent fetched via Meta Insights API">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Total Ad Spend</span>
                        <span style={{ fontSize: '16px' }}>💳</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>₹{totalSpendNum.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>● Paced within spend cap</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} title="Total ad impressions across Instagram Feed, Reels, and Facebook">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Total Impressions</span>
                        <span style={{ fontSize: '16px' }}>👁️</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{totalImpressionsNum.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginTop: '4px' }}>Across Meta Placements</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} title="Total ad link clicks and average Click-Through-Rate (CTR)">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Clicks & CTR</span>
                        <span style={{ fontSize: '16px' }}>🖱️</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{totalClicksNum.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>{overallCtr} Avg CTR • {overallCpc} CPC</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} title="Omnichannel chat leads attributed directly to Meta ad campaigns">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Attributed Leads</span>
                        <span style={{ fontSize: '16px' }}>🎯</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>{totalConversionsNum} Chats</div>
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, marginTop: '4px' }}>{overallCpa} Cost / Lead (CPA)</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} title="Current active vs paused campaign status on Meta Marketing API">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Active Campaigns</span>
                        <span style={{ fontSize: '16px' }}>⚡</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
                        {activeCount} Active
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
                        {pausedCount} Paused • {campsList.length} Total
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Error Alert Banner if Meta API fails */}
              {adsApiError && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b' }}>Meta Marketing API Notice: Authorization Required</div>
                      <div style={{ fontSize: '12.5px', color: '#b91c1c', marginTop: '2px', lineHeight: 1.4 }}>
                        {adsApiError}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConnectAdAccountModal(true)}
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(220,38,38,0.2)' }}
                  >
                    🔑 Reconnect / Refresh Meta Token
                  </button>
                </div>
              )}

              {/* 3. Sub-Navigation Tabs */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px' }}>
                  <button
                    onClick={() => setAdsSubTab('campaigns')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      borderBottom: adsSubTab === 'campaigns' ? '3px solid #1d4ed8' : '3px solid transparent',
                      color: adsSubTab === 'campaigns' ? '#1d4ed8' : '#64748b',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    📊 Campaigns ({(Array.isArray(adCampaigns) ? adCampaigns : []).length})
                  </button>

                  <button
                    onClick={() => setAdsSubTab('adsets')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      borderBottom: adsSubTab === 'adsets' ? '3px solid #1d4ed8' : '3px solid transparent',
                      color: adsSubTab === 'adsets' ? '#1d4ed8' : '#64748b',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🎯 Ad Sets & Audiences
                  </button>

                  <button
                    onClick={() => setAdsSubTab('creatives')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      borderBottom: adsSubTab === 'creatives' ? '3px solid #1d4ed8' : '3px solid transparent',
                      color: adsSubTab === 'creatives' ? '#1d4ed8' : '#64748b',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🎨 Ad Creatives & Previews
                  </button>

                  <button
                    onClick={() => setAdsSubTab('attribution')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      borderBottom: adsSubTab === 'attribution' ? '3px solid #1d4ed8' : '3px solid transparent',
                      color: adsSubTab === 'attribution' ? '#1d4ed8' : '#64748b',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🔗 Conversion Attribution Telemetry
                  </button>
                </div>

                {/* SUBTAB 1: CAMPAIGNS MANAGEMENT TABLE */}
                {adsSubTab === 'campaigns' && (
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                        All campaigns actively managed via Meta Marketing API. Toggle status to pause/resume in real time.
                      </span>
                      <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, color: '#475569' }}>
                        Currency: <strong>INR (₹)</strong> • Timezone: <strong>Asia/Kolkata</strong>
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 14px' }} title="Campaign Name and unique Meta Identifier">Campaign Name</th>
                          <th style={{ padding: '12px 14px' }} title="Live status on Meta Ads network">Status</th>
                          <th style={{ padding: '12px 14px' }} title="Selected marketing objective">Objective</th>
                          <th style={{ padding: '12px 14px' }} title="Daily spend budget allocated to this campaign">Daily Budget</th>
                          <th style={{ padding: '12px 14px' }} title="Total ad spend to date">Spend</th>
                          <th style={{ padding: '12px 14px' }} title="Total impressions across Meta network">Impressions</th>
                          <th style={{ padding: '12px 14px' }} title="Total link clicks and Click-Through Rate">Clicks / CTR</th>
                          <th style={{ padding: '12px 14px' }} title="Direct live chat leads attributed to this campaign">Attributed Leads</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }} title="Management actions: preview, edit budget, toggle status, delete">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adCampaigns.length === 0 && (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{adsApiError ? '🔒' : '📭'}</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                                {adsApiError ? 'Meta Token Expired or Missing Permissions' : 'No ad campaigns found in this Meta Ad Account'}
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', maxWidth: '500px', margin: '4px auto 0 auto' }}>
                                {adsApiError
                                  ? 'Your short-lived Meta user token has expired. Please connect a valid System User Token or generate a fresh User Access Token with ads_read permission.'
                                  : 'Launch an end-to-end Meta ad campaign to start driving Click-to-WhatsApp and Instagram DM chats.'}
                              </div>
                              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                {adsApiError ? (
                                  <button
                                    onClick={() => setShowConnectAdAccountModal(true)}
                                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    🔑 Update Meta Access Token
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setCreateCampaignStep(1);
                                      setShowNewCampaignModal(true);
                                    }}
                                    style={{ background: '#1d4ed8', color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    ➕ Create New Campaign
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        {(Array.isArray(adCampaigns) ? adCampaigns : []).map(camp => (
                          <tr key={camp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>{camp.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                                ID: {camp.id} • {camp.buyingType || 'AUCTION'}
                              </div>
                            </td>

                            <td style={{ padding: '14px' }}>
                              <button
                                onClick={() => handleToggleCampaignStatus(camp.id)}
                                style={{
                                  background: camp.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                                  color: camp.status === 'ACTIVE' ? '#15803d' : '#dc2626',
                                  border: `1px solid ${camp.status === 'ACTIVE' ? '#bbf7d0' : '#fecaca'}`,
                                  padding: '4px 10px',
                                  borderRadius: '16px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                                title={`Click to ${camp.status === 'ACTIVE' ? 'Pause' : 'Activate'} campaign on Meta`}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: camp.status === 'ACTIVE' ? '#16a34a' : '#dc2626' }}></span>
                                {camp.status}
                              </button>
                            </td>

                            <td style={{ padding: '14px' }}>
                              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                                {camp.objective}
                              </span>
                            </td>

                            <td style={{ padding: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{camp.dailyBudget}</span>
                                <button
                                  onClick={() => {
                                    setEditingCampaign(camp);
                                    setEditBudgetValue(camp.rawDailyBudget || camp.dailyBudget.replace(/[^0-9]/g, '') || '500');
                                    setShowEditBudgetModal(true);
                                  }}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                                  title="Edit daily spend budget"
                                >
                                  ✏️ Edit
                                </button>
                              </div>
                            </td>

                            <td style={{ padding: '14px', fontWeight: 700, color: '#0f172a' }}>
                              {camp.spend || '₹0'}
                            </td>

                            <td style={{ padding: '14px', color: '#334155' }}>
                              <div style={{ fontWeight: 700 }}>{(camp.impressions || 0).toLocaleString()}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Reach: {(camp.reach || camp.impressions || 0).toLocaleString()}</div>
                            </td>

                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{camp.clicks || 0} clicks</div>
                              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>{camp.ctr || '5.2%'} CTR</div>
                            </td>

                            <td style={{ padding: '14px' }}>
                              <strong style={{ color: '#15803d', fontSize: '13px' }}>
                                {camp.conversions || 0} chat leads
                              </strong>
                            </td>

                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  onClick={() => {
                                    setSelectedPreviewCreative(camp.adCreative || {
                                      headline: camp.name,
                                      primaryText: 'Experience seamless live visitor tracking and omnichannel chat with LetsTrack.',
                                      callToAction: 'Send Message',
                                      destination: 'Instagram Direct',
                                      previewImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'
                                    });
                                    setShowPreviewModal(true);
                                  }}
                                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '5px 9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                                  title="Preview sponsored Instagram/Facebook ad creative"
                                >
                                  👁️ Preview Ad
                                </button>

                                <button
                                  onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                                  style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '5px 8px', borderRadius: '6px', fontSize: '11.5px', color: '#dc2626', cursor: 'pointer' }}
                                  title="Archive / Delete campaign from Meta"
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

                {/* SUBTAB 2: AD SETS & AUDIENCES */}
                {adsSubTab === 'adsets' && (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                    {(Array.isArray(adCampaigns) ? adCampaigns : []).length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ fontSize: '30px' }}>🎯</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>No Ad Sets to display</div>
                      </div>
                    )}
                    {(Array.isArray(adCampaigns) ? adCampaigns : []).map(camp => (
                      <div key={camp.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                              {camp.adSet?.name || `${camp.name} - Ad Set`}
                            </h5>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Parent Campaign: {camp.name}</span>
                          </div>
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 800 }}>
                            {camp.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#334155' }}>
                          <div>
                            <strong style={{ color: '#0f172a' }}>📍 Target Locations: </strong>
                            {Array.isArray(camp.adSet?.locations) ? camp.adSet.locations.join(', ') : (camp.adSet?.locations || 'India (Tier 1 Metros)')}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a' }}>🎂 Age Demographic: </strong>
                            {camp.adSet?.ageRange || '21 - 54 years'}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a' }}>💡 Interests & Behaviors: </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {(Array.isArray(camp.adSet?.interests) ? camp.adSet.interests : ['SaaS', 'E-Commerce', 'Shopify', 'Startups']).map((interest, i) => (
                                <span key={i} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600 }}>
                                  #{interest}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a' }}>📱 Placements: </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {(Array.isArray(camp.adSet?.placements) ? camp.adSet.placements : ['Instagram Reels', 'Instagram Feed', 'Facebook Feed']).map((place, i) => (
                                <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700 }}>
                                  {place}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SUBTAB 3: AD CREATIVES & SPONSORED PREVIEWS */}
                {adsSubTab === 'creatives' && (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    {(Array.isArray(adCampaigns) ? adCampaigns : []).length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ fontSize: '30px' }}>🎨</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>No Ad Creatives to display</div>
                      </div>
                    )}
                    {(Array.isArray(adCampaigns) ? adCampaigns : []).map(camp => {
                      const creative = camp.adCreative || {
                        headline: '⚡ Turn Website & IG Visitors Into Paying Customers 24/7',
                        primaryText: 'LetsTrack gives your sales team real-time visitor journey tracking, 1-click WhatsApp checkout, and seamless Instagram DM multi-agent routing.',
                        callToAction: 'Send Instagram Message',
                        destination: 'Instagram Direct',
                        previewImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'
                      };

                      return (
                        <div key={camp.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          {/* Instagram Post Header */}
                          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
                                LT
                              </div>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>letstrack_live</div>
                                <div style={{ fontSize: '10px', color: '#64748b' }}>Sponsored • Meta Ad</div>
                              </div>
                            </div>
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>•••</span>
                          </div>

                          {/* Creative Media */}
                          <div style={{ width: '100%', height: '200px', background: '#0f172a', overflow: 'hidden', position: 'relative' }}>
                            <img
                              src={creative.previewImage || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'}
                              alt="Ad Creative"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                              {camp.objective}
                            </span>
                          </div>

                          {/* Sponsored CTA Bar */}
                          <div style={{ background: '#f8fafc', padding: '10px 14px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Destination: {creative.destination || 'Instagram Direct'}</span>
                            <button
                              onClick={() => {
                                showToast(`⚡ Triggered Meta Ad CTA: ${creative.callToAction || 'Send Message'}`);
                              }}
                              style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                            >
                              {creative.callToAction || 'Send Message'} ➔
                            </button>
                          </div>

                          {/* Post Caption */}
                          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{creative.headline}</div>
                            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>{creative.primaryText}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SUBTAB 4: CONVERSION ATTRIBUTION TELEMETRY */}
                {adsSubTab === 'attribution' && (
                  <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Real-Time Meta Ad Lead Attribution Stream</h5>
                      <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Direct mapping from Meta Ad campaigns and UTM parameters to inbound chat conversations across Instagram, WhatsApp, and WebChat.
                      </p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 12px' }}>Attributed Lead / Visitor</th>
                          <th style={{ padding: '10px 12px' }}>Campaign & Source</th>
                          <th style={{ padding: '10px 12px' }}>Destination Channel</th>
                          <th style={{ padding: '10px 12px' }}>Landing Page / Intent</th>
                          <th style={{ padding: '10px 12px' }}>Conversion Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>@vikram_ecommerce</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Bengaluru, India</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                              LetsTrack 2026 Live Chat Launch
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#fdf2f8', color: '#be185d', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                              📸 Instagram Direct
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#334155' }}>/pricing (Growth Plan Lead)</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                              🎉 Converted to Chat
                            </span>
                          </td>
                        </tr>

                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>+91 98451 22334 (Rahul M.)</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mumbai, India</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                              Instagram Direct Message Inbound Ad
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#f0fdf4', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                              🟢 WhatsApp API
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#334155' }}>/demo (WhatsApp Green Tick Setup)</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                              🎉 Active Conversation
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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

      {/* MODAL 3: Launch Meta Ad Campaign (Multi-Step Creation Wizard for ads_management) */}
      {showNewCampaignModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '26px', width: '560px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', color: '#0f172a', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            {/* Modal Header & Steps Indicator */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🚀</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Create Meta Ad Campaign</h3>
                </div>
                <button onClick={() => setShowNewCampaignModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Publish new sponsored campaigns to Instagram Feed, Reels, and Facebook via Meta Marketing API v26.0.
              </p>

              {/* Step Badges */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <div style={{ flex: 1, padding: '6px', borderRadius: '6px', background: createCampaignStep === 1 ? '#eff6ff' : '#f8fafc', border: `1px solid ${createCampaignStep === 1 ? '#3b82f6' : '#e2e8f0'}`, textAlign: 'center', fontSize: '11px', fontWeight: 800, color: createCampaignStep === 1 ? '#1d4ed8' : '#64748b' }}>
                  1. Objective & Name
                </div>
                <div style={{ flex: 1, padding: '6px', borderRadius: '6px', background: createCampaignStep === 2 ? '#eff6ff' : '#f8fafc', border: `1px solid ${createCampaignStep === 2 ? '#3b82f6' : '#e2e8f0'}`, textAlign: 'center', fontSize: '11px', fontWeight: 800, color: createCampaignStep === 2 ? '#1d4ed8' : '#64748b' }}>
                  2. Audience & Placements
                </div>
                <div style={{ flex: 1, padding: '6px', borderRadius: '6px', background: createCampaignStep === 3 ? '#eff6ff' : '#f8fafc', border: `1px solid ${createCampaignStep === 3 ? '#3b82f6' : '#e2e8f0'}`, textAlign: 'center', fontSize: '11px', fontWeight: 800, color: createCampaignStep === 3 ? '#1d4ed8' : '#64748b' }}>
                  3. Creative & Copy
                </div>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (createCampaignStep < 3) {
                setCreateCampaignStep(createCampaignStep + 1);
                return;
              }

              try {
                const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    name: newCampaignName,
                    dailyBudget: newCampaignBudget,
                    objective: newCampaignObjective,
                    targetUrl: newCampaignTargetUrl,
                    locations: [newCampaignLocations],
                    ageRange: newCampaignAgeRange,
                    interests: newCampaignInterests.split(',').map(s => s.trim()),
                    placements: newCampaignPlacements,
                    headline: newCampaignHeadline,
                    primaryText: newCampaignPrimaryText,
                    callToAction: newCampaignCta,
                    previewImage: newCampaignImage,
                    mediaType: newCampaignFormat,
                    accountId: selectedAdAccountId
                  })
                });
                if (res.ok) {
                  setShowNewCampaignModal(false);
                  setNewCampaignName('');
                  setCreateCampaignStep(1);
                  showToast('🎉 Meta Ad Campaign Published & Live on Meta Marketing API!');
                  fetchAdCampaigns();
                } else {
                  const errData = await res.json();
                  showToast(errData.error || 'Failed to create campaign', 'error');
                }
              } catch (err) {
                showToast('Network error creating campaign', 'error');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* STEP 1: OBJECTIVE, NAME & BUDGET */}
              {createCampaignStep === 1 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Campaign Name *</label>
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g. LetsTrack 2026 Live Chat Launch - Free Trial Promo"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Campaign Objective *</label>
                    <select
                      value={newCampaignObjective}
                      onChange={(e) => {
                        setNewCampaignObjective(e.target.value);
                        if (e.target.value === 'MESSAGES') {
                          setNewCampaignCta('Send Instagram Message');
                        } else if (e.target.value === 'LEAD_GENERATION') {
                          setNewCampaignCta('Chat on WhatsApp');
                        } else {
                          setNewCampaignCta('Learn More');
                        }
                      }}
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="LEAD_GENERATION">LEAD_GENERATION (Direct WhatsApp & Live Chat Leads)</option>
                      <option value="MESSAGES">MESSAGES (Instagram Direct & Messenger Inbound)</option>
                      <option value="CONVERSIONS">CONVERSIONS (/pricing & Checkout page)</option>
                      <option value="TRAFFIC">TRAFFIC (Website Landing Page Visits)</option>
                    </select>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Optimized for highest engagement and direct chat attribution inside LetsTrack Omnichannel Inbox.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Daily Spend Budget (INR ₹) *</label>
                      <input
                        type="number"
                        value={newCampaignBudget}
                        onChange={(e) => setNewCampaignBudget(e.target.value)}
                        placeholder="500"
                        min="100"
                        required
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Buying Type</label>
                      <input
                        type="text"
                        value="AUCTION (Standard)"
                        disabled
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#f8fafc', color: '#64748b' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Target Landing URL</label>
                    <input
                      type="url"
                      value={newCampaignTargetUrl}
                      onChange={(e) => setNewCampaignTargetUrl(e.target.value)}
                      placeholder="https://letstrack.manacity.in/#pricing"
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </>
              )}

              {/* STEP 2: AUDIENCE & PLACEMENTS */}
              {createCampaignStep === 2 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Target Geographical Locations</label>
                    <input
                      type="text"
                      value={newCampaignLocations}
                      onChange={(e) => setNewCampaignLocations(e.target.value)}
                      placeholder="India (Bengaluru, Mumbai, Delhi-NCR, Hyderabad)"
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Age Range Demographic</label>
                      <input
                        type="text"
                        value={newCampaignAgeRange}
                        onChange={(e) => setNewCampaignAgeRange(e.target.value)}
                        placeholder="21 - 54"
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Interests & Keywords</label>
                      <input
                        type="text"
                        value={newCampaignInterests}
                        onChange={(e) => setNewCampaignInterests(e.target.value)}
                        placeholder="SaaS, E-Commerce, Shopify, Startups"
                        style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Meta Network Placements</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {['Instagram Reels', 'Instagram Feed', 'Facebook Feed', 'Messenger Inbox'].map(place => (
                        <label key={place} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newCampaignPlacements.includes(place)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCampaignPlacements([...newCampaignPlacements, place]);
                              } else {
                                setNewCampaignPlacements(newCampaignPlacements.filter(p => p !== place));
                              }
                            }}
                          />
                          <span>{place}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3: CREATIVE STUDIO & COPY */}
              {createCampaignStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Ad Format Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Ad Format</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { id: 'SINGLE_IMAGE', label: '🖼️ Single Image' },
                        { id: 'VIDEO', label: '🎬 Video / Reel' },
                        { id: 'CAROUSEL', label: '📑 Carousel' }
                      ].map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setNewCampaignFormat(fmt.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: newCampaignFormat === fmt.id ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                            background: newCampaignFormat === fmt.id ? '#eff6ff' : '#ffffff',
                            color: newCampaignFormat === fmt.id ? '#1d4ed8' : '#334155',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creative Media Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Select Ad Creative Media</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { title: 'Live Chat Hero', url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80' },
                        { title: 'Growth Analytics', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80' },
                        { title: 'Customer Support', url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80' }
                      ].map((med, i) => (
                        <div
                          key={i}
                          onClick={() => setNewCampaignImage(med.url)}
                          style={{
                            border: newCampaignImage === med.url ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          <img src={med.url} alt={med.title} style={{ width: '100%', height: '60px', objectFit: 'cover' }} />
                          <div style={{ padding: '3px 6px', fontSize: '10px', fontWeight: 700, background: '#ffffff', textAlign: 'center', color: '#0f172a' }}>
                            {med.title}
                          </div>
                        </div>
                      ))}
                    </div>

                    <input
                      type="url"
                      value={newCampaignImage}
                      onChange={(e) => setNewCampaignImage(e.target.value)}
                      placeholder="Or enter custom image / CDN URL"
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '2px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Ad Headline *</label>
                    <input
                      type="text"
                      value={newCampaignHeadline}
                      onChange={(e) => setNewCampaignHeadline(e.target.value)}
                      placeholder="⚡ Turn Website & IG Visitors Into Customers 24/7"
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Primary Text / Body Copy *</label>
                    <textarea
                      value={newCampaignPrimaryText}
                      onChange={(e) => setNewCampaignPrimaryText(e.target.value)}
                      rows={2}
                      placeholder="Start chatting with your high-intent visitors in real time..."
                      required
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Call To Action (CTA Button) *</label>
                    <select
                      value={newCampaignCta}
                      onChange={(e) => setNewCampaignCta(e.target.value)}
                      style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="Send Instagram Message">Send Instagram Message (Direct DM)</option>
                      <option value="Chat on WhatsApp">Chat on WhatsApp (WhatsApp Cloud API)</option>
                      <option value="Send Message">Send Message (Messenger & Live Chat)</option>
                      <option value="Learn More">Learn More (Landing Page)</option>
                    </select>
                  </div>

                  {/* Live Mini Preview Box */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <img src={newCampaignImage} alt="Ad Preview" style={{ width: '64px', height: '64px', borderRadius: '6px', objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>LIVE AD PREVIEW • @letstrack_live</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {newCampaignHeadline}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {newCampaignPrimaryText}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#1d4ed8', fontWeight: 700, marginTop: '2px' }}>
                        CTA: {newCampaignCta} ➔
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Footer Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {createCampaignStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCreateCampaignStep(createCampaignStep - 1)}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ◀ Back
                  </button>
                )}

                <button
                  type="submit"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(29,78,216,0.3)' }}
                >
                  {createCampaignStep === 3 ? '🚀 Publish Campaign to Meta Ads' : 'Continue to Next Step ➔'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowNewCampaignModal(false)}
                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3B: Edit Campaign Daily Budget (ads_management) */}
      {showEditBudgetModal && editingCampaign && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>✏️ Edit Campaign Daily Budget</h3>
              <button onClick={() => setShowEditBudgetModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{editingCampaign.name}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {editingCampaign.id} • Currency: INR (₹)</div>
            </div>

            <form onSubmit={handleUpdateCampaignBudget} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>New Daily Budget (INR ₹)</label>
                <input
                  type="number"
                  value={editBudgetValue}
                  onChange={(e) => setEditBudgetValue(e.target.value)}
                  placeholder="500"
                  min="100"
                  required
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  Update Budget
                </button>
                <button type="button" onClick={() => setShowEditBudgetModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3C: Sponsored Ad Creative Live Preview */}
      {showPreviewModal && selectedPreviewCreative && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px', color: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>📱 Sponsored Mobile Ad Preview</h4>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Instagram Header */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>
                    LT
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>letstrack_live</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Sponsored</div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>•••</span>
              </div>

              {/* Creative Media */}
              <img
                src={selectedPreviewCreative.previewImage || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'}
                alt="Ad Creative"
                style={{ width: '100%', height: '220px', objectFit: 'cover' }}
              />

              {/* CTA Action */}
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Destination: {selectedPreviewCreative.destination || 'Instagram Direct'}</span>
                <button style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                  {selectedPreviewCreative.callToAction || 'Send Message'} ➔
                </button>
              </div>

              {/* Copy */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>{selectedPreviewCreative.headline}</div>
                <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>{selectedPreviewCreative.primaryText}</div>
              </div>
            </div>

            <button
              onClick={() => setShowPreviewModal(false)}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Close Preview
            </button>
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

      {/* MODAL 5: Connect / Switch Live Meta Ad Account */}
      {showConnectAdAccountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Connect Live Meta Ad Account</h3>
              </div>
              <button onClick={() => setShowConnectAdAccountModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
              Connect your production Meta Ad Account ID (e.g. <code>act_1234567890</code>) to query live marketing campaigns, ad sets, impressions, clicks, and chat leads via Meta Marketing API v26.0.
            </p>

            {/* Discovered accounts quick picker if available */}
            {adAccounts.filter(a => a.id !== 'act_1394810294820' && a.id !== 'act_984128471920').length > 0 && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Discovered Ad Accounts from OAuth Token:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {adAccounts.filter(a => a.id !== 'act_1394810294820' && a.id !== 'act_984128471920').map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setSelectedAdAccountId(acc.id);
                        fetchAdCampaigns(acc.id);
                        setShowConnectAdAccountModal(false);
                        showToast(`Switched to live ad account: ${acc.name} (${acc.id})`);
                      }}
                      style={{ padding: '8px 12px', background: selectedAdAccountId === acc.id ? '#eff6ff' : '#ffffff', border: selectedAdAccountId === acc.id ? '1.5px solid #2563eb' : '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>{acc.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {acc.id} • {acc.currency} • {acc.accountStatus}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>{selectedAdAccountId === acc.id ? '✓ Selected' : 'Select'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleConnectAdAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                  Meta Ad Account ID <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. act_123456789012345 or 123456789012345"
                  value={customAdAccountId}
                  onChange={(e) => setCustomAdAccountId(e.target.value)}
                  required
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Found in Meta Ads Manager URL: <code>adsmanager.facebook.com/adsmanager/manage/campaigns?act=XXXXX</code></span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                  Ad Account Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. LetsTrack Production Ads"
                  value={customAdAccountName}
                  onChange={(e) => setCustomAdAccountName(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                  System User Token / Marketing Token (Optional - uses OAuth token by default)
                </label>
                <input
                  type="password"
                  placeholder="EAA..."
                  value={customAdAccountToken}
                  onChange={(e) => setCustomAdAccountToken(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={isConnectingAdAcc}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isConnectingAdAcc ? 'Connecting...' : '🚀 Save & Load Live Ad Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConnectAdAccountModal(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
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
