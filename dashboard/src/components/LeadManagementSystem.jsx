import React, { useState, useEffect } from 'react';

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
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Handle Status Transition
  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
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
        showToast?.(`Lead status moved to ${newStatus}`, 'success');
      }
    } catch (err) {
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
        body: JSON.stringify({ text: newNoteText })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLead(prev => ({
          ...prev,
          notes: [...(prev.notes || []), data.note]
        }));
        setNewNoteText('');
        showToast?.('Note added to lead timeline', 'success');
      }
    } catch (err) {
      showToast?.('Failed to add note', 'error');
    }
  };

  // Create Lead
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!formData.name) return showToast?.('Lead name is required', 'error');

    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };
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
        const errData = await res.json();
        showToast?.(errData.error || 'Failed to create lead', 'error');
      }
    } catch (err) {
      showToast?.('Failed to create lead', 'error');
    }
  };

  const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

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
      <div className="lms-toolbar glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search lead by name, phone, email, campaign, ad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '340px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />

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
              fontWeight: 600
            }}
          >
            <option value="All">All Sources</option>
            <option value="meta-ads">📢 Meta Ads</option>
            <option value="whatsapp">🟢 WhatsApp API</option>
            <option value="instagram">📸 Instagram DM</option>
            <option value="facebook">👥 Facebook</option>
            <option value="chat">💬 LiveChat</option>
            <option value="manual">📝 Manual Entry</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📋 Kanban Pipeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📑 Table View
            </button>
          </div>

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

      {/* 3. Main View Area (Kanban or Table) */}
      {viewMode === 'kanban' ? (
        <div className="lms-kanban-board">
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage);
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
                    stageLeads.map(lead => (
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
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px' }}>
                <th style={{ padding: '12px 16px' }}>Lead Name</th>
                <th style={{ padding: '12px 16px' }}>Source</th>
                <th style={{ padding: '12px 16px' }}>Contact</th>
                <th style={{ padding: '12px 16px' }}>Stage</th>
                <th style={{ padding: '12px 16px' }}>Deal Value</th>
                <th style={{ padding: '12px 16px' }}>Assigned Agent</th>
                <th style={{ padding: '12px 16px' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr
                  key={lead._id}
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => setSelectedLead(lead)}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {lead.name}
                    {lead.company && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{lead.company}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{getSourceBadge(lead.source)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    <div>{lead.phoneNumber || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.email || '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: lead.status === 'Won' ? '#f0fdf4' : lead.status === 'Lost' ? '#fef2f2' : 'var(--bg-tertiary)',
                      color: lead.status === 'Won' ? '#16a34a' : lead.status === 'Lost' ? '#dc2626' : 'var(--text-secondary)'
                    }}>
                      {lead.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: lead.dealValue > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                    {lead.dealValue > 0 ? `₹${Number(lead.dealValue).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {lead.assignedAgentId?.name || 'Unassigned'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLead(lead);
                      }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Lead Details Drawer */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedLead.name}</h3>
                  {getSourceBadge(selectedLead.source)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Created {new Date(selectedLead.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Status Switcher Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Pipeline Stage:</span>
                <select
                  value={selectedLead.status}
                  onChange={(e) => handleUpdateStatus(selectedLead._id, e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: selectedLead.status === 'Won' ? '#16a34a' : 'var(--text-primary)'
                  }}
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Contact Info & Meta Ad Attribution */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Contact Details</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>📞 <strong>Phone:</strong> {selectedLead.phoneNumber || 'Not provided'}</div>
                    <div>✉️ <strong>Email:</strong> {selectedLead.email || 'Not provided'}</div>
                    <div>🏢 <strong>Company:</strong> {selectedLead.company || 'Not provided'}</div>
                    <div>💰 <strong>Deal Value:</strong> ₹{(Number(selectedLead.dealValue) || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Source Attribution</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#db2777', textTransform: 'uppercase', marginBottom: '8px' }}>Meta Instant Form Submission Fields</div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
                  {selectedLead.notes && selectedLead.notes.length > 0 ? (
                    selectedLead.notes.map((n, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10.5px', marginBottom: '2px' }}>
                          <span>{n.authorName || 'Agent'}</span>
                          <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ color: 'var(--text-primary)' }}>{n.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No notes recorded yet.</div>
                  )}
                </div>

                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add a progress note..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  />
                  <button
                    type="submit"
                    style={{ padding: '8px 14px', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Post Note
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 5. Add Lead Modal */}
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
