import React, { useState, useEffect } from 'react';

export default function SuperAdminDashboard({
  token,
  user,
  BACKEND_URL,
  showToast,
  onNavigateTab,
  onImpersonateSuccess
}) {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState('tenants'); // 'tenants' | 'meta' | 'payments' | 'users' | 'logs'
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

  // Modals
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignBudget, setNewCampaignBudget] = useState('500');
  const [newCampaignObjective, setNewCampaignObjective] = useState('LEAD_GENERATION');

  const [manualPaymentModal, setManualPaymentModal] = useState(false);
  const [manualPayTenantId, setManualPayTenantId] = useState('');
  const [manualPayAmount, setManualPayAmount] = useState('299');
  const [manualPayPlan, setManualPayPlan] = useState('growth');
  const [manualPayMethod, setManualPayMethod] = useState('bank_transfer');
  const [manualPayNotes, setManualPayNotes] = useState('');

  // Initial Data Fetch
  useEffect(() => {
    fetchOverviewData();
    fetchMetaAssets();
    fetchAdCampaigns();
  }, [token]);

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
      showToast('Error loading platform metrics', 'error');
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
        setMetaAssets(await res.json());
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

  // 1. Tenant Management Handlers
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
      } else {
        showToast('Failed to update workspace plan', 'error');
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
    if (!window.confirm(`Are you sure you want to permanently delete workspace "${tenantName}" and all its users, chat logs, and telemetry?`)) return;
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

  const handleImpersonateTenant = async (tenantId, tenantName) => {
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

  // 2. Meta OAuth & Messaging Handlers
  const handleFacebookLogin = () => {
    setConnectingMeta(true);
    const appId = '1311990813621733';
    const redirectUri = encodeURIComponent('https://letstrack.manacity.in/');
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

          // Exchange token via SuperAdmin backend
          fetch(`${BACKEND_URL}/api/superadmin/meta/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ accessToken })
          })
            .then(res => res.json())
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
              showToast('Error connecting Meta assets', 'error');
            })
            .finally(() => setConnectingMeta(false));
        } else if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setConnectingMeta(false);
        }
      } catch (e) {
        // Cross-origin access until redirect completes
      }
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

  const handleCreateAdCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return showToast('Campaign Name is required', 'error');

    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCampaignName,
          dailyBudget: newCampaignBudget,
          objective: newCampaignObjective
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      setShowNewCampaignModal(false);
      setNewCampaignName('');
      showToast('🎉 Meta Ad Campaign Launched to Live Marketing API');
      fetchAdCampaigns();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleAdCampaign = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-ads/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAdCampaigns();
        showToast('Campaign status toggled');
      }
    } catch (e) {}
  };

  const handleTriggerTestMsg = async (channel) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/superadmin/meta-review/trigger-test-msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ channel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message sync failed');

      showToast(`⚡ Inbound ${channel === 'instagram' ? 'Instagram DM' : 'WhatsApp Lead'} synced to Inbox!`);
      if (onNavigateTab) onNavigateTab('chat');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 3. User & Role IAM Handlers
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
        showToast('User permissions role updated!');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error updating user role', 'error');
    }
  };

  const handleForceResetPassword = async (userId, userEmail) => {
    const newPassword = window.prompt(`Enter new password for ${userEmail} (minimum 6 characters):`, 'Secret2026!');
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

  // 4. Financial & Payment Handlers
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
        showToast('Payment recorded & Workspace plan upgraded successfully!');
        setManualPaymentModal(false);
        setManualPayNotes('');
        fetchOverviewData();
      }
    } catch (err) {
      showToast('Error recording payment', 'error');
    }
  };

  // Filtering helper
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

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Platform Enterprise Command Center
            </h2>
            <span style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
              🛡️ SuperAdmin Master Access
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Real-time client workspace administration, Meta Omnichannel gateways, financial ledger, and platform infrastructure.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => setManualPaymentModal(true)} 
            style={{ 
              background: 'linear-gradient(135deg, #10b981, #059669)', 
              color: '#ffffff', 
              border: 'none', 
              padding: '9px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '13px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            💳 Record Offline Payment
          </button>
          <button 
            onClick={fetchOverviewData} 
            style={{ 
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              padding: '9px 16px', 
              borderRadius: '8px', 
              fontWeight: 600, 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics Telemetry Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Workspaces</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{stats?.totalTenants || tenants.length}</div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>+{stats?.newTenantsLast30d || 0} joined this month</div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Paid Autopay Mandates</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{stats?.activeSubscriptions || 0}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Razorpay UPI & Card Autopay</div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Platform Live MRR</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>₹{stats?.mrr?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '4px' }}>Total Collected: ₹{stats?.totalRevenue?.toLocaleString() || 0}</div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Platform User Accounts</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{stats?.totalUsers || usersList.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Across all client tenants</div>
        </div>
      </div>

      {/* Sub-Navigation Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveSubTab('tenants')} 
            style={{ 
              background: activeSubTab === 'tenants' ? '#fee2e2' : 'transparent', 
              color: activeSubTab === 'tenants' ? '#dc2626' : 'var(--text-secondary)', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            🏢 Workspaces ({tenants.length})
          </button>

          <button 
            onClick={() => {
              setActiveSubTab('meta');
              fetchMetaAssets();
              fetchAdCampaigns();
            }} 
            style={{ 
              background: activeSubTab === 'meta' ? 'linear-gradient(135deg, #1877f2, #0d65d9)' : '#eff6ff', 
              color: activeSubTab === 'meta' ? '#ffffff' : '#1d4ed8', 
              border: '1px solid #bfdbfe', 
              padding: '8px 18px', 
              borderRadius: '8px', 
              fontWeight: 800, 
              fontSize: '13px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ Meta Omnichannel Hub
          </button>

          <button 
            onClick={() => setActiveSubTab('payments')} 
            style={{ 
              background: activeSubTab === 'payments' ? '#fee2e2' : 'transparent', 
              color: activeSubTab === 'payments' ? '#dc2626' : 'var(--text-secondary)', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            💳 Financial Ledger ({payments.length})
          </button>

          <button 
            onClick={() => setActiveSubTab('users')} 
            style={{ 
              background: activeSubTab === 'users' ? '#fee2e2' : 'transparent', 
              color: activeSubTab === 'users' ? '#dc2626' : 'var(--text-secondary)', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            👥 User Accounts ({usersList.length})
          </button>

          <button 
            onClick={() => setActiveSubTab('logs')} 
            style={{ 
              background: activeSubTab === 'logs' ? '#fee2e2' : 'transparent', 
              color: activeSubTab === 'logs' ? '#dc2626' : 'var(--text-secondary)', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            🛡️ Security Audit Logs ({auditLogs.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search records, domains, API keys..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '7px 14px', color: 'var(--text-primary)', fontSize: '12.5px', outline: 'none', width: '260px' }}
        />
      </div>

      {/* SUB-TAB 1: WORKSPACES */}
      {activeSubTab === 'tenants' && (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto', background: '#ffffff', border: '1px solid var(--border-color)' }}>
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
              {filteredTenants.map(t => (
                <tr key={t.id} className="visitor-row">
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {t.id}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{t.domain || 'All Domains Allowed'}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#dc2626' }}>{t.apiKey}</div>
                  </td>
                  <td>
                    <select
                      value={t.plan}
                      onChange={(e) => handleUpdateTenantPlan(t.id, e.target.value)}
                      style={{
                        background: t.plan === 'business' ? '#fdf2f8' : t.plan === 'growth' ? '#eff6ff' : '#f8fafc',
                        color: t.plan === 'business' ? '#be185d' : t.plan === 'growth' ? '#1d4ed8' : '#475569',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
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
                  <td>
                    <div style={{ fontSize: '12.5px' }}>{t.adminEmail}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created {new Date(t.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td>
                    <span style={{
                      background: t.isSuspended ? '#fee2e2' : '#dcfce7',
                      color: t.isSuspended ? '#dc2626' : '#15803d',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {t.isSuspended ? 'Suspended' : '🟢 Active'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleImpersonateTenant(t.id, t.name)}
                        style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        title="Login as Tenant Admin"
                      >
                        🔑 Login
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(t.id, t.isSuspended)}
                        style={{ background: '#f8fafc', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        {t.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(t.id, t.name)}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
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

      {/* SUB-TAB 2: META ENTERPRISE OMNICHANNEL HUB */}
      {activeSubTab === 'meta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Hero Banner: Meta Production Engine Status */}
          <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid #334155', color: '#ffffff' }}>
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
                    <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span> Live Production Engine
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Unified messaging gateway connecting <strong>WhatsApp Cloud Business API</strong>, <strong>Instagram Direct Messenger</strong>, and <strong>Meta Ad Campaigns & Attribution</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={handleFacebookLogin}
                disabled={connectingMeta}
                style={{
                  background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 6px 18px rgba(24, 119, 242, 0.4)'
                }}
              >
                {connectingMeta ? '🔄 Authenticating...' : '🔗 Connect Meta Business Account (OAuth)'}
              </button>
            </div>
          </div>

          {/* 3 Live Enterprise Hub Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            
            {/* Live Hub 1: Instagram Direct Messenger */}
            <div className="glass-card" style={{ padding: '22px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📸</span>
                  <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Instagram Business Messenger</h4>
                </div>
                <span style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                  Live IG DM Gateway
                </span>
              </div>
              
              <div style={{ background: '#faf5ff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f3e8ff', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Connected Business Page:</strong> {metaAssets.meta?.pageId ? `Page ID ${metaAssets.meta.pageId}` : 'ManaCity Business'}</div>
                <div><strong>Instagram Account:</strong> {metaAssets.meta?.instagramAccountId ? `IG @manacity.in` : '@manacity.in'}</div>
                <div><strong>Live Webhook Status:</strong> <span style={{ color: '#16a34a', fontWeight: 800 }}>🟢 Subscribed & Active (messages)</span></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleTriggerTestMsg('instagram')}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  📨 Receive Inbound Instagram DM
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('chat')}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  💬 Open Inbox
                </button>
              </div>
            </div>

            {/* Live Hub 2: WhatsApp Cloud Business API */}
            <div className="glass-card" style={{ padding: '22px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🟢</span>
                  <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>WhatsApp Cloud Business API</h4>
                </div>
                <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                  Official WABA Engine
                </span>
              </div>

              <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #dcfce7', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Phone Number ID:</strong> {metaAssets.whatsappApi?.phoneNumberId || '111738020188242'}</div>
                <div><strong>Support Window:</strong> <span style={{ color: '#16a34a', fontWeight: 800 }}>🟢 24h Interactive Messaging Active</span></div>
                <div><strong>Webhook Gateway:</strong> <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#15803d' }}>/api/integrations/whatsapp-api/webhook</span></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleTriggerTestMsg('whatsapp')}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  📨 Receive Inbound WhatsApp Lead
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('chat')}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  💬 Open Inbox
                </button>
              </div>
            </div>

            {/* Live Hub 3: Meta Ads & Marketing API */}
            <div className="glass-card" style={{ padding: '22px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📊</span>
                  <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Meta Marketing & Ad Campaigns</h4>
                </div>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                  Marketing API Active
                </span>
              </div>

              <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #dbeafe', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Managed Campaigns:</strong> {adCampaigns.length} Active in Meta Ads</div>
                <div><strong>Attribution Engine:</strong> <span style={{ color: '#1d4ed8', fontWeight: 800 }}>UTM Tracking & Live Conversions</span></div>
                <div><strong>Campaign Management:</strong> Full CRUD & Status Controls</div>
              </div>

              <button
                onClick={() => setShowNewCampaignModal(true)}
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}
              >
                ➕ Launch New Ad Campaign
              </button>
            </div>

          </div>

          {/* Live Meta Ad Campaigns Table */}
          <div className="glass-card" style={{ padding: '22px', background: '#ffffff', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Live Meta Ad Campaigns & Conversion Attribution</h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
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

            <table className="visitor-list-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Objective</th>
                  <th>Daily Budget</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>Attributed Live Chats</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {adCampaigns.map(camp => (
                  <tr key={camp.id} className="visitor-row">
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{camp.name}</td>
                    <td><span className="path-tag">{camp.objective}</span></td>
                    <td style={{ fontWeight: 600 }}>{camp.dailyBudget}</td>
                    <td>{camp.impressions.toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{camp.clicks}</td>
                    <td><strong style={{ color: '#16a34a' }}>{camp.conversions} chats</strong></td>
                    <td>
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
                    <td>
                      <button
                        onClick={() => handleToggleAdCampaign(camp.id)}
                        style={{
                          background: camp.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4',
                          color: camp.status === 'ACTIVE' ? '#dc2626' : '#16a34a',
                          border: '1px solid var(--border-color)',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {camp.status === 'ACTIVE' ? '⏸️ Pause' : '▶️ Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* SUB-TAB 3: FINANCIAL LEDGER */}
      {activeSubTab === 'payments' && (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto', background: '#ffffff', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Transaction Ledger & Subscription Payments</h4>
            <button 
              onClick={() => setManualPaymentModal(true)} 
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Add Offline Payment
            </button>
          </div>

          <table className="visitor-list-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client Workspace</th>
                <th>Plan & Type</th>
                <th>Amount (INR)</th>
                <th>Payment ID / Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id} className="visitor-row">
                  <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700 }}>
                    <div>{p.tenantId?.name || 'Unknown Client'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.tenantId?.domain}</div>
                  </td>
                  <td>
                    <span className="path-tag" style={{ textTransform: 'capitalize' }}>{p.plan} ({p.type || 'subscription'})</span>
                  </td>
                  <td style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>₹{p.amount}</td>
                  <td style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>
                    {p.razorpayPaymentId || p.paymentMethod || 'Razorpay UPI'}
                  </td>
                  <td>
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

      {/* SUB-TAB 4: USER IAM DIRECTORY */}
      {activeSubTab === 'users' && (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto', background: '#ffffff', border: '1px solid var(--border-color)' }}>
          <table className="visitor-list-table">
            <thead>
              <tr>
                <th>User Full Name</th>
                <th>Email Address</th>
                <th>Associated Workspace</th>
                <th>Role & Permissions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u._id} className="visitor-row">
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td style={{ fontSize: '13px' }}>{u.email}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.tenantId?.name || 'Master Admin'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.tenantId?.domain}</div>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                      style={{
                        background: u.role === 'SuperAdmin' ? '#fee2e2' : u.role === 'Admin' ? '#eff6ff' : '#f8fafc',
                        color: u.role === 'SuperAdmin' ? '#dc2626' : u.role === 'Admin' ? '#1d4ed8' : '#475569',
                        border: '1px solid var(--border-color)',
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
                  <td>
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
                  <td>
                    <button
                      onClick={() => handleForceResetPassword(u._id, u.email)}
                      style={{ background: '#f8fafc', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
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

      {/* SUB-TAB 5: SECURITY AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto', background: '#ffffff', border: '1px solid var(--border-color)' }}>
          <table className="visitor-list-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Security Action</th>
                <th>Target Workspace</th>
                <th>Actor</th>
                <th>Details Payload</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(l => (
                <tr key={l._id}>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>
                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                      {l.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{l.tenantId?.name || 'System / Platform'}</td>
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

      {/* MODAL 1: Meta Business Asset Selector */}
      {showAssetModal && (
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
          <div className="glass-card" style={{ padding: '24px', width: '480px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '17px', fontWeight: '800' }}>Select Meta Business Page & WhatsApp Asset</h3>
              <button onClick={() => setShowAssetModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>AVAILABLE FACEBOOK PAGES & INSTAGRAM ACCOUNTS:</div>
              {availablePages.map(p => (
                <div 
                  key={p.pageId} 
                  onClick={() => handleSelectAsset(p.pageId, availableWabas[0]?.phoneId)}
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#1877f2' }}>📄 {p.pageName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Instagram: {p.instagramHandle || 'No IG linked'}</div>
                  </div>
                  <span style={{ background: '#1877f2', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Select</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Ad Campaign */}
      {showNewCampaignModal && (
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
          <div className="glass-card" style={{ padding: '24px', width: '440px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '17px', fontWeight: '800' }}>Launch Meta Ad Campaign</h3>
              <button onClick={() => setShowNewCampaignModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateAdCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Campaign Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. LetsTrack 2026 Promo - Direct to Chat"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Objective</label>
                <select
                  className="form-input"
                  value={newCampaignObjective}
                  onChange={(e) => setNewCampaignObjective(e.target.value)}
                >
                  <option value="LEAD_GENERATION">LEAD_GENERATION (Direct WhatsApp / Live Chat)</option>
                  <option value="CONVERSIONS">CONVERSIONS (/pricing & checkout)</option>
                  <option value="TRAFFIC">TRAFFIC (Website Landing Page)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Daily Budget (INR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newCampaignBudget}
                  onChange={(e) => setNewCampaignBudget(e.target.value)}
                  required
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

      {/* MODAL 3: Offline / Manual Payment Record */}
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
          <div className="glass-card" style={{ padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>Record Offline / Manual Payment</h3>
              <button onClick={() => setManualPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            
            <form onSubmit={handleRecordManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Select Client Workspace</label>
                <select
                  className="form-input"
                  value={manualPayTenantId}
                  onChange={(e) => setManualPayTenantId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Workspace --</option>
                  {tenants.map(t => (
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
                >
                  <option value="bank_transfer">Direct Bank NEFT / IMPS</option>
                  <option value="upi_manual">UPI QR Offline</option>
                  <option value="cash">Cash / Cheque</option>
                  <option value="adjustment">Internal Admin Credit</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Internal Notes / Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="UTR / Txn Ref number"
                  value={manualPayNotes}
                  onChange={(e) => setManualPayNotes(e.target.value)}
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
