import React, { useState, useEffect, useMemo } from 'react';

export default function LeadManagementSystem({
  token,
  user,
  BACKEND_URL,
  showToast,
  targetTenantId,
  onOpenChatWithLead
}) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Primary default view is TABLE VIEW as requested
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  
  // Filters & Sorting
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Bulk Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Selected Lead Drawer & Modals
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [agentsList, setAgentsList] = useState([]);

  // New Lead Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    company: '',
    source: 'manual',
    status: 'New',
    dealValue: '',
    currency: 'INR',
    tags: '',
    assignedAgentId: '',
    initialNote: ''
  });

  const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

  // Fetch Leads and Stats
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'All') params.append('status', filterStatus);
      if (filterSource !== 'All') params.append('source', filterSource);
      if (searchQuery) params.append('search', searchQuery);
      if (targetTenantId) params.append('tenantId', targetTenantId);

      const res = await fetch(`${BACKEND_URL}/api/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (targetTenantId) params.append('tenantId', targetTenantId);
      const res = await fetch(`${BACKEND_URL}/api/leads/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAgentsList(data.agents || []);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLeads();
      fetchStats();
      fetchAgents();
    }
  }, [token, filterStatus, filterSource, targetTenantId]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handle Status Transition (Inline & Drawer)
  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      // Optimistic update
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
      if (selectedLead?._id === leadId) {
        setSelectedLead(prev => ({ ...prev, status: newStatus }));
      }

      const res = await fetch(`${BACKEND_URL}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(prev => prev.map(l => l._id === leadId ? data.lead : l));
        if (selectedLead?._id === leadId) {
          setSelectedLead(data.lead);
        }
        fetchStats();
        showToast?.(`Lead status updated to ${newStatus}`, 'success');
      } else {
        fetchLeads(); // revert
        showToast?.('Failed to update status', 'error');
      }
    } catch (err) {
      fetchLeads();
      showToast?.('Failed to update status', 'error');
    }
  };

  // Add Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedLead) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/${selectedLead._id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: newNoteText.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLead(prev => ({
          ...prev,
          notes: [...(prev.notes || []), data.note]
        }));
        setNewNoteText('');
        showToast?.('Note added to timeline', 'success');
      }
    } catch (err) {
      showToast?.('Failed to add note', 'error');
    }
  };

  // Create Lead
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) return showToast?.('Lead name is required', 'error');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email ? formData.email.trim() : '',
        phoneNumber: formData.phoneNumber ? formData.phoneNumber.trim() : '',
        company: formData.company ? formData.company.trim() : '',
        source: formData.source || 'manual',
        status: formData.status || 'New',
        dealValue: Number(formData.dealValue) || 0,
        currency: formData.currency || 'INR',
        initialNote: formData.initialNote ? formData.initialNote.trim() : '',
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      if (formData.assignedAgentId && formData.assignedAgentId.trim()) {
        payload.assignedAgentId = formData.assignedAgentId.trim();
      }
      if (targetTenantId) payload.tenantId = targetTenantId;

      const res = await fetch(`${BACKEND_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setLeads(prev => [data.lead, ...prev]);
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phoneNumber: '',
          company: '',
          source: 'manual',
          status: 'New',
          dealValue: '',
          currency: 'INR',
          tags: '',
          assignedAgentId: '',
          initialNote: ''
        });
        fetchStats();
        showToast?.('Lead created successfully', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast?.(errData.error || 'Failed to create lead', 'error');
      }
    } catch (err) {
      console.error('Error creating lead:', err);
      showToast?.('Failed to create lead', 'error');
    }
  };

  // Delete Lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l._id !== leadId));
        setSelectedLead(null);
        setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
        fetchStats();
        showToast?.('Lead deleted successfully', 'success');
      }
    } catch (err) {
      showToast?.('Failed to delete lead', 'error');
    }
  };

  // Bulk Status Update
  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedLeadIds.length === 0) return;
    try {
      setBulkActionLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/leads/bulk-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          status: newStatus
        })
      });
      if (res.ok) {
        const data = await res.json();
        showToast?.(`Moved ${selectedLeadIds.length} leads to ${newStatus}`, 'success');
        setSelectedLeadIds([]);
        fetchLeads();
        fetchStats();
      } else {
        showToast?.('Failed to update selected leads', 'error');
      }
    } catch (err) {
      showToast?.('Error during bulk update', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete all ${selectedLeadIds.length} selected leads?`)) return;
    try {
      setBulkActionLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/leads/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leadIds: selectedLeadIds
        })
      });
      if (res.ok) {
        showToast?.(`Deleted ${selectedLeadIds.length} leads`, 'success');
        setSelectedLeadIds([]);
        fetchLeads();
        fetchStats();
      } else {
        showToast?.('Failed to delete selected leads', 'error');
      }
    } catch (err) {
      showToast?.('Error during bulk deletion', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Selection helpers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(sortedLeads.map(l => l._id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleToggleSelectLead = (id, e) => {
    e.stopPropagation();
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Calculate Lead Score & Temperature
  const getLeadScoreInfo = (lead) => {
    let score = lead.score || 50;
    if (lead.dealValue > 50000) score += 20;
    else if (lead.dealValue > 10000) score += 10;
    if (lead.phoneNumber && lead.email) score += 10;
    if (lead.source === 'meta-ads') score += 15;
    if (lead.status === 'Won') score = 100;
    if (lead.status === 'Lost') score = 10;
    score = Math.min(Math.max(score, 5), 100);

    if (score >= 80) return { label: '🔥 Hot', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', score };
    if (score >= 50) return { label: '⚡ Warm', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', score };
    return { label: '❄️ Cold', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', score };
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    const leadsToExport = selectedLeadIds.length > 0 
      ? leads.filter(l => selectedLeadIds.includes(l._id))
      : leads;

    if (leadsToExport.length === 0) {
      showToast?.('No leads to export', 'error');
      return;
    }

    const headers = ['Lead Name', 'Phone', 'Email', 'Company', 'Source', 'Stage', 'Deal Value (INR)', 'Lead Score', 'Assigned Agent', 'Campaign Name', 'Ad Name', 'Created At'];
    
    const rows = leadsToExport.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.phoneNumber || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${l.source || 'manual'}"`,
      `"${l.status || 'New'}"`,
      l.dealValue || 0,
      getLeadScoreInfo(l).score,
      `"${(l.assignedAgentId?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(l.metaData?.campaignName || '').replace(/"/g, '""')}"`,
      `"${(l.metaData?.adName || '').replace(/"/g, '""')}"`,
      `"${new Date(l.createdAt).toLocaleString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LetsTrack_Leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Exported ${leadsToExport.length} leads to CSV`, 'success');
  };

  // Sorting
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'score') {
        valA = getLeadScoreInfo(a).score;
        valB = getLeadScoreInfo(b).score;
      } else if (sortField === 'dealValue') {
        valA = Number(a.dealValue) || 0;
        valB = Number(b.dealValue) || 0;
      } else if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortField, sortOrder]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Quick Communication Triggers
  const openWhatsApp = (phone, name, e) => {
    e?.stopPropagation();
    if (!phone) return showToast?.('No phone number recorded for this lead', 'error');
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hi ${name || 'there'}, thank you for contacting us via LetsTrack! How can we assist you today?`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const openCall = (phone, e) => {
    e?.stopPropagation();
    if (!phone) return showToast?.('No phone number recorded', 'error');
    window.location.href = `tel:${phone}`;
  };

  const openEmail = (email, name, e) => {
    e?.stopPropagation();
    if (!email) return showToast?.('No email address recorded', 'error');
    const subject = encodeURIComponent(`Inquiry Follow-up - LetsTrack`);
    const body = encodeURIComponent(`Hi ${name || 'there'},\n\nFollowing up on your inquiry with us.\n\nBest regards,\nLetsTrack Team`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'meta-ads':
        return <span className="lead-source-chip meta-ads">📢 Meta Ads</span>;
      case 'whatsapp':
        return <span className="lead-source-chip whatsapp">🟢 WhatsApp</span>;
      case 'instagram':
        return <span className="lead-source-chip instagram">📸 Instagram</span>;
      case 'facebook':
        return <span className="lead-source-chip facebook">👥 Facebook</span>;
      case 'chat':
      case 'website':
        return <span className="lead-source-chip chat">💬 LiveChat</span>;
      default:
        return <span className="lead-source-chip manual">📝 Manual</span>;
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'Won': return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
      case 'Lost': return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      case 'Proposal': return { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' };
      case 'Qualified': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'Contacted': return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
      default: return { bg: 'var(--bg-tertiary)', text: 'var(--text-primary)', border: 'var(--border-color)' };
    }
  };

  return (
    <div className="lms-container">
      {/* 1. KPI Telemetry Row */}
      <div className="lms-stats-grid">
        <div className="lms-stat-card glass-card">
          <div className="lms-stat-title">Total Ingested Leads</div>
          <div className="lms-stat-value">{stats?.totalLeads ?? leads.length}</div>
          <div className="lms-stat-subtext">Across All Inbound Sources</div>
        </div>
        <div className="lms-stat-card glass-card">
          <div className="lms-stat-title">Closed Deals (Won)</div>
          <div className="lms-stat-value" style={{ color: '#16a34a' }}>
            {stats?.stages?.Won ?? 0}
          </div>
          <div className="lms-stat-subtext">Conversion Rate: {stats?.conversionRate ?? '0.0'}%</div>
        </div>
        <div className="lms-stat-card glass-card">
          <div className="lms-stat-title">Total Won Revenue</div>
          <div className="lms-stat-value" style={{ color: '#dc2626' }}>
            ₹{(stats?.wonDealValue ?? 0).toLocaleString()}
          </div>
          <div className="lms-stat-subtext">Pipeline Value: ₹{(stats?.totalDealValue ?? 0).toLocaleString()}</div>
        </div>
        <div className="lms-stat-card glass-card">
          <div className="lms-stat-title">Meta Ads Auto-Captures</div>
          <div className="lms-stat-value" style={{ color: '#9333ea' }}>
            {stats?.sources?.['meta-ads'] ?? 0}
          </div>
          <div className="lms-stat-subtext">Instant Form Webhooks Synced</div>
        </div>
      </div>

      {/* 2. Toolbar & Controls */}
      <div className="lms-toolbar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Top Filter & Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by name, phone, email, ad campaign..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Source Filter */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="All">🌐 All Sources</option>
              <option value="meta-ads">📢 Meta Ads</option>
              <option value="whatsapp">🟢 WhatsApp API</option>
              <option value="instagram">📸 Instagram DM</option>
              <option value="facebook">👥 Facebook</option>
              <option value="chat">💬 LiveChat</option>
              <option value="manual">📝 Manual Entry</option>
            </select>
          </div>

          {/* Right Action Controls: View Switcher, CSV Export & Add Lead */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            
            {/* View Toggle (Table Primary) */}
            <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                📊 Table View
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                📋 Kanban Board
              </button>
            </div>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Export leads to CSV spreadsheet"
            >
              📥 Export CSV
            </button>

            {/* Add Lead Button */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
              }}
            >
              ➕ Add Lead
            </button>
          </div>
        </div>

        {/* Quick Stage Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
          <button
            onClick={() => setFilterStatus('All')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filterStatus === 'All' ? 'var(--primary)' : 'var(--border-color)',
              background: filterStatus === 'All' ? 'var(--primary)' : 'var(--bg-primary)',
              color: filterStatus === 'All' ? '#fff' : 'var(--text-secondary)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All Leads ({stats?.totalLeads ?? leads.length})
          </button>
          {STAGES.map(stage => {
            const count = stats?.stages?.[stage] ?? leads.filter(l => l.status === stage).length;
            const isSelected = filterStatus === stage;
            return (
              <button
                key={stage}
                onClick={() => setFilterStatus(stage)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                  background: isSelected ? 'var(--primary)' : 'var(--bg-primary)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{stage}</span>
                <span style={{ 
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '10px'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* 3. Bulk Actions Floating Bar (when items selected) */}
      {selectedLeadIds.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#fff',
          borderRadius: '10px',
          padding: '10px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 800, fontSize: '13px', background: 'var(--primary)', padding: '3px 9px', borderRadius: '12px' }}>
              ✓ {selectedLeadIds.length} Selected
            </span>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Bulk Actions:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Move Stage Selector */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={bulkActionLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#334155',
                color: '#fff',
                border: '1px solid #475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Move Stage To...</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Export Selected to CSV */}
            <button
              onClick={handleExportCSV}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#334155',
                color: '#fff',
                border: '1px solid #475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📥 Export Selected
            </button>

            {/* Bulk Delete */}
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🗑️ Delete Selected
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedLeadIds([])}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. Main View Area (Primary TABLE VIEW or Kanban) */}
      {viewMode === 'table' ? (
        /* ================= PRIMARY TABLE VIEW ================= */
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.03em' }}>
                  
                  {/* Select All Checkbox */}
                  <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={sortedLeads.length > 0 && selectedLeadIds.length === sortedLeads.length}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>

                  {/* Lead Name */}
                  <th 
                    onClick={() => toggleSort('name')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Lead Name {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Source */}
                  <th 
                    onClick={() => toggleSort('source')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Source {sortField === 'source' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Contact Info & 1-Click Triggers */}
                  <th style={{ padding: '12px 16px' }}>Direct Contact</th>

                  {/* Score */}
                  <th 
                    onClick={() => toggleSort('score')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Score {sortField === 'score' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Stage Dropdown */}
                  <th 
                    onClick={() => toggleSort('status')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Pipeline Stage {sortField === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Deal Value */}
                  <th 
                    onClick={() => toggleSort('dealValue')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Deal Value {sortField === 'dealValue' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Assigned Agent */}
                  <th style={{ padding: '12px 16px' }}>Assigned Agent</th>

                  {/* Created Date */}
                  <th 
                    onClick={() => toggleSort('createdAt')}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Created {sortField === 'createdAt' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>

                  {/* Quick Action Buttons */}
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Quick Actions</th>
                </tr>
              </thead>
              
              <tbody>
                {sortedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>No leads found</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Try modifying your filters or click "+ Add Lead" to record a new inbound inquiry.</div>
                    </td>
                  </tr>
                ) : (
                  sortedLeads.map(lead => {
                    const scoreInfo = getLeadScoreInfo(lead);
                    const stageColor = getStageColor(lead.status);
                    const isSelected = selectedLeadIds.includes(lead._id);

                    return (
                      <tr
                        key={lead._id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(220, 38, 38, 0.04)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelectLead(lead._id, e)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Lead Name & Company */}
                        <td 
                          style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13.5px' }}>{lead.name}</span>
                          </div>
                          {lead.company && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                              🏢 {lead.company}
                            </div>
                          )}
                          {lead.metaData?.campaignName && (
                            <div style={{ fontSize: '10.5px', color: '#db2777', fontWeight: 600, marginTop: '2px' }}>
                              🎯 {lead.metaData.campaignName}
                            </div>
                          )}
                        </td>

                        {/* Source */}
                        <td style={{ padding: '12px 16px' }}>
                          {getSourceBadge(lead.source)}
                        </td>

                        {/* Direct Contact (Phone & Email with 1-click links) */}
                        <td style={{ padding: '12px 16px' }}>
                          {lead.phoneNumber ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              <span>📞 {lead.phoneNumber}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>No phone</span>
                          )}
                          {lead.email && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              ✉️ {lead.email}
                            </div>
                          )}
                        </td>

                        {/* Quality Score Pill */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: scoreInfo.bg,
                            color: scoreInfo.color,
                            border: `1px solid ${scoreInfo.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {scoreInfo.label} ({scoreInfo.score})
                          </span>
                        </td>

                        {/* Pipeline Stage with Instant Inline Switcher */}
                        <td style={{ padding: '12px 16px' }}>
                          <select
                            value={lead.status}
                            onChange={(e) => handleUpdateStatus(lead._id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: stageColor.bg,
                              color: stageColor.text,
                              border: `1px solid ${stageColor.border}`,
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {STAGES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>

                        {/* Deal Value */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: lead.dealValue > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                          {lead.dealValue > 0 ? `₹${Number(lead.dealValue).toLocaleString()}` : '—'}
                        </td>

                        {/* Assigned Agent */}
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {lead.assignedAgentId?.name ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                              👤 {lead.assignedAgentId.name}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>Unassigned</span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>

                        {/* Quick Action Icons & Details */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            {/* WhatsApp Direct Action */}
                            {lead.phoneNumber && (
                              <button
                                onClick={(e) => openWhatsApp(lead.phoneNumber, lead.name, e)}
                                title="Chat on WhatsApp"
                                style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                🟢 WA
                              </button>
                            )}

                            {/* Direct Call */}
                            {lead.phoneNumber && (
                              <button
                                onClick={(e) => openCall(lead.phoneNumber, e)}
                                title="Call lead"
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                📞
                              </button>
                            )}

                            {/* Direct Email */}
                            {lead.email && (
                              <button
                                onClick={(e) => openEmail(lead.email, lead.name, e)}
                                title="Send Email"
                                style={{
                                  background: '#faf5ff',
                                  color: '#7e22ce',
                                  border: '1px solid #e9d5ff',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✉️
                              </button>
                            )}

                            {/* View Full Details */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="lms-kanban-board">
          {STAGES.map(stage => {
            const stageLeads = sortedLeads.filter(l => l.status === stage);
            const stageTotal = stageLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);

            return (
              <div key={stage} className="kanban-col">
                <div className="kanban-col-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{stage}</span>
                    <span style={{ background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {stageLeads.length}
                    </span>
                  </div>
                  {stageTotal > 0 && (
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                      ₹{stageTotal.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="kanban-cards-list">
                  {stageLeads.length === 0 ? (
                    <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No leads in {stage}
                    </div>
                  ) : (
                    stageLeads.map(lead => {
                      const scoreInfo = getLeadScoreInfo(lead);
                      return (
                        <div
                          key={lead._id}
                          className="lead-item-card"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                              {lead.name}
                            </span>
                            {getSourceBadge(lead.source)}
                          </div>

                          {lead.company && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              🏢 {lead.company}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            {lead.phoneNumber && <div>📞 {lead.phoneNumber}</div>}
                            {lead.email && <div>✉️ {lead.email}</div>}
                            {lead.metaData?.campaignName && (
                              <div style={{ color: '#db2777', fontWeight: 600 }}>
                                🎯 Ad: {lead.metaData.campaignName}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-light)', fontSize: '11.5px' }}>
                            <span style={{ fontWeight: 700, color: lead.dealValue > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                              {lead.dealValue > 0 ? `₹${Number(lead.dealValue).toLocaleString()}` : 'No Deal Val'}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: scoreInfo.color,
                              background: scoreInfo.bg,
                              padding: '2px 5px',
                              borderRadius: '4px'
                            }}>
                              {scoreInfo.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Enhanced Lead Details Drawer */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Quick Actions */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{selectedLead.name}</h3>
                  {getSourceBadge(selectedLead.source)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Created on {new Date(selectedLead.createdAt).toLocaleString()}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleDeleteLead(selectedLead._id)}
                  style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                  title="Delete Lead"
                >
                  🗑️ Delete
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick 1-Click Communications Row in Drawer */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {selectedLead.phoneNumber && (
                <button
                  onClick={() => openWhatsApp(selectedLead.phoneNumber, selectedLead.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🟢 Open WhatsApp
                </button>
              )}
              {selectedLead.phoneNumber && (
                <button
                  onClick={() => openCall(selectedLead.phoneNumber)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  📞 Direct Dial
                </button>
              )}
              {selectedLead.email && (
                <button
                  onClick={() => openEmail(selectedLead.email, selectedLead.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✉️ Send Email
                </button>
              )}
              {onOpenChatWithLead && (
                <button
                  onClick={() => {
                    onOpenChatWithLead(selectedLead);
                    setSelectedLead(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  💬 Open LiveChat
                </button>
              )}
            </div>

            {/* Content Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Status & Agent Assignment Switcher Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Pipeline Stage
                  </label>
                  <select
                    value={selectedLead.status}
                    onChange={(e) => handleUpdateStatus(selectedLead._id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      color: selectedLead.status === 'Won' ? '#16a34a' : 'var(--text-primary)'
                    }}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Assigned Agent
                  </label>
                  <select
                    value={selectedLead.assignedAgentId?._id || selectedLead.assignedAgentId || ''}
                    onChange={async (e) => {
                      const newAgentId = e.target.value;
                      try {
                        const res = await fetch(`${BACKEND_URL}/api/leads/${selectedLead._id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ assignedAgentId: newAgentId || null })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setSelectedLead(data.lead);
                          setLeads(prev => prev.map(l => l._id === selectedLead._id ? data.lead : l));
                          showToast?.('Assigned agent updated', 'success');
                        }
                      } catch (err) {
                        showToast?.('Failed to update agent assignment', 'error');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Unassigned</option>
                    {agentsList.map(a => (
                      <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contact Info & Meta Ad Attribution */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Contact Details
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>📞 <strong>Phone:</strong> {selectedLead.phoneNumber || 'Not provided'}</div>
                    <div>✉️ <strong>Email:</strong> {selectedLead.email || 'Not provided'}</div>
                    <div>🏢 <strong>Company:</strong> {selectedLead.company || 'Not provided'}</div>
                    <div>💰 <strong>Deal Value:</strong> ₹{(Number(selectedLead.dealValue) || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Source Attribution
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>🏷️ <strong>Source:</strong> {selectedLead.source}</div>
                    {selectedLead.metaData?.campaignName && (
                      <div>🎯 <strong>Campaign:</strong> {selectedLead.metaData.campaignName}</div>
                    )}
                    {selectedLead.metaData?.adName && (
                      <div>📢 <strong>Ad Name:</strong> {selectedLead.metaData.adName}</div>
                    )}
                    {selectedLead.metaData?.formId && (
                      <div>📝 <strong>Meta Form ID:</strong> {selectedLead.metaData.formId}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta Lead Form Key-Value Answers (if applicable) */}
              {selectedLead.metaData?.formAnswers && Object.keys(selectedLead.metaData.formAnswers).length > 0 && (
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#db2777', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Meta Instant Form Responses
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px' }}>
                    {Object.entries(selectedLead.metaData.formAnswers).map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{k}</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity & Notes Stream */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>Activity Timeline & Notes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
                  {selectedLead.notes && selectedLead.notes.length > 0 ? (
                    selectedLead.notes.map((n, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10.5px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700 }}>{n.authorName || 'Agent'}</span>
                          <span>{new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{n.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No notes recorded yet.</div>
                  )}
                </div>

                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type progress update, meeting note, or customer request..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  />
                  <button
                    type="submit"
                    style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Post Note
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 6. Add Lead Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>➕ Create New Lead</h3>
            
            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Email Address</label>
                  <input
                    type="email"
                    placeholder="priya@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Company / Org</label>
                  <input
                    type="text"
                    placeholder="Apex Innovations"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Deal Value (₹)</label>
                  <input
                    type="number"
                    placeholder="25000"
                    value={formData.dealValue}
                    onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    <option value="manual">📝 Manual Entry</option>
                    <option value="meta-ads">📢 Meta Ads</option>
                    <option value="whatsapp">🟢 WhatsApp</option>
                    <option value="instagram">📸 Instagram</option>
                    <option value="facebook">👥 Facebook</option>
                    <option value="chat">💬 LiveChat</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Initial Stage</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Initial Note / Requirement</label>
                <textarea
                  rows={2}
                  placeholder="Customer inquiry details..."
                  value={formData.initialNote}
                  onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '4px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
