import React, { useState } from 'react';
import './DemoSandbox.css';

export default function DemoSandbox({ onBackToLanding, onNavigateToRegister }) {
  // Mode Switcher State: 'web' (Desktop Web Console) vs 'mobile' (Mobile App Simulator)
  const [sandboxMode, setSandboxMode] = useState('web');

  // Widget Accent Color State
  const [widgetColor, setWidgetColor] = useState('#dc2626');

  // Visitor Radar Session Data
  const [simulatedVisitors, setSimulatedVisitors] = useState([
    { id: '8402', country: 'United States', flag: '🇺🇸', device: 'Chrome on macOS', path: '/pricing', duration: '3m 12s', status: 'high_intent' },
    { id: '3194', country: 'United Kingdom', flag: '🇬🇧', device: 'Safari on iOS', path: '/checkout', duration: '1m 45s', status: 'active' },
    { id: '1092', country: 'Germany', flag: '🇩🇪', device: 'Firefox on Windows', path: '/docs/wordpress', duration: '42s', status: 'active' }
  ]);

  // Unified Inbox Messages
  const [inboxConversations, setInboxConversations] = useState([
    { id: 1, channel: 'instagram', icon: '📸', sender: '@sarah_designs', text: 'Hi! Can I get a discount for 5 website licenses?', time: 'Just Now', unread: true },
    { id: 2, channel: 'website', icon: '🌐', sender: 'Visitor #8402 (United States)', text: 'Does your WordPress plugin support multisite?', time: '1m ago', unread: true },
    { id: 3, channel: 'facebook', icon: '💬', sender: 'Alex Rivers (FB Messenger)', text: 'Scheduling live demo for tomorrow!', time: '3m ago', unread: false },
    { id: 4, channel: 'whatsapp', icon: '📱', sender: '+1 (555) 019-2834 (WhatsApp)', text: 'Interested in Enterprise plan custom deployment.', time: '5m ago', unread: false }
  ]);

  // Chat Messages inside Visitor Widget
  const [widgetMessages, setWidgetMessages] = useState([
    { sender: 'agent', text: 'Hi there! 👋 Welcome to LetsTrack. How can we help your business grow today?' },
    { sender: 'visitor', text: 'Hi! I am testing the live chat widget directly on your demo playground!' }
  ]);
  const [widgetInput, setWidgetInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);

  // Agent Console reply input
  const [consoleReplyInput, setConsoleReplyInput] = useState('');
  const [selectedInboxId, setSelectedInboxId] = useState(2);

  // Simulation Triggers
  const handleSimulateMetaInstagram = () => {
    const newDM = {
      id: Date.now(),
      channel: 'instagram',
      icon: '📸',
      sender: `@user_${Math.floor(1000 + Math.random() * 9000)} (Instagram DM)`,
      text: 'Hey! Saw your story about LetsTrack. How fast is the WordPress setup?',
      time: 'Just Now',
      unread: true
    };
    setInboxConversations(prev => [newDM, ...prev]);
    setSelectedInboxId(newDM.id);
  };

  const handleSimulateMetaFacebook = () => {
    const newFB = {
      id: Date.now(),
      channel: 'facebook',
      icon: '💬',
      sender: `Lead ${Math.floor(100 + Math.random() * 900)} (FB Messenger)`,
      text: 'Do you offer a free 14-day trial without credit card required?',
      time: 'Just Now',
      unread: true
    };
    setInboxConversations(prev => [newFB, ...prev]);
    setSelectedInboxId(newFB.id);
  };

  const handleSimulateNewVisitorAlert = () => {
    const countries = [
      { country: 'Canada', flag: '🇨🇦' },
      { country: 'Australia', flag: '🇦🇺' },
      { country: 'France', flag: '🇫🇷' },
      { country: 'Japan', flag: '🇯🇵' }
    ];
    const picked = countries[Math.floor(Math.random() * countries.length)];
    const newVis = {
      id: String(Math.floor(1000 + Math.random() * 9000)),
      country: picked.country,
      flag: picked.flag,
      device: 'Mobile Safari on iOS',
      path: '/pricing',
      duration: '10s',
      status: 'high_intent'
    };
    setSimulatedVisitors(prev => [newVis, ...prev.slice(0, 4)]);
  };

  const handleSendWidgetMessage = (e) => {
    e?.preventDefault();
    if (!widgetInput.trim()) return;

    const userText = widgetInput;
    setWidgetInput('');
    setWidgetMessages(prev => [...prev, { sender: 'visitor', text: userText }]);

    // Update Unified Inbox Website message
    setInboxConversations(prev => prev.map(item => 
      item.channel === 'website' ? { ...item, text: userText, time: 'Just Now', unread: true } : item
    ));

    // Auto agent reply
    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      setWidgetMessages(prev => [
        ...prev,
        { sender: 'agent', text: '⚡ Agent Console Received Your Message! This is how fast your sales team can reply to website leads!' }
      ]);
    }, 1200);
  };

  const handleConsoleSendReply = (e) => {
    e?.preventDefault();
    if (!consoleReplyInput.trim()) return;

    const replyText = consoleReplyInput;
    setConsoleReplyInput('');

    // Add to widget messages if responding to website chat
    setWidgetMessages(prev => [...prev, { sender: 'agent', text: replyText }]);
  };

  const activeConversation = inboxConversations.find(c => c.id === selectedInboxId) || inboxConversations[0];

  return (
    <div className="demo-sandbox-container">
      {/* Header Bar */}
      <header className="sandbox-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBackToLanding}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f3f4f6', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ← Back to Overview
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ffffff' }}>LetsTrack</span>
            <span style={{ fontSize: '10px', background: 'rgba(220,38,38,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              Interactive Playground
            </span>
          </div>
        </div>

        {/* Version Switcher: Web Console vs Mobile App */}
        <div className="sandbox-mode-toggle">
          <button 
            className={`mode-toggle-btn ${sandboxMode === 'web' ? 'active' : ''}`}
            onClick={() => setSandboxMode('web')}
          >
            🖥️ Web Console Version
          </button>
          <button 
            className={`mode-toggle-btn ${sandboxMode === 'mobile' ? 'active' : ''}`}
            onClick={() => setSandboxMode('mobile')}
          >
            📱 Mobile App Version
          </button>
        </div>

        <button className="btn-primary-cta" style={{ padding: '8px 18px', fontSize: '13px' }} onClick={onNavigateToRegister}>
          Start 14-Day Free Trial
        </button>
      </header>

      {/* Interactive Simulation Controls Bar */}
      <div className="simulator-toolbar">
        <span className="toolbar-label">⚡ Live Event Simulators:</span>

        <button className="sim-action-btn" onClick={handleSimulateMetaInstagram}>
          📸 Simulate Instagram DM
        </button>
        <button className="sim-action-btn" onClick={handleSimulateMetaFacebook}>
          💬 Simulate FB Messenger
        </button>
        <button className="sim-action-btn" onClick={handleSimulateNewVisitorAlert}>
          🔔 Simulate New Visitor Entry
        </button>

        <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 8px' }}></div>

        <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>Widget Accent:</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['#dc2626', '#2563eb', '#16a34a', '#7c3aed', '#ea580c'].map(c => (
            <button
              key={c}
              onClick={() => setWidgetColor(c)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: c,
                border: widgetColor === c ? '2px solid white' : 'none',
                cursor: 'pointer',
                boxShadow: widgetColor === c ? `0 0 10px ${c}` : 'none'
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Split-Screen Playground */}
      <main className="playground-grid">
        {/* Left Side: Web Console or Mobile App Version */}
        {sandboxMode === 'web' ? (
          <div className="console-window-card">
            <div className="window-top-bar">
              <span className="window-mac-dot mac-red"></span>
              <span className="window-mac-dot mac-yellow"></span>
              <span className="window-mac-dot mac-green"></span>
              <div className="window-url">
                🔒 https://letstrack.manacity.in/console (Web Console Version)
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {/* Push Alert Toast Banner */}
              <div style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(15,23,42,0.9))', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🔔</span>
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '13px' }}>PUSH ALERT: New Visitor Landed on /pricing</strong>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Visitor #{simulatedVisitors[0]?.id} ({simulatedVisitors[0]?.country}) • Streaming WebSockets</div>
                  </div>
                </div>
                <span style={{ background: '#10b981', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>LIVE</span>
              </div>

              {/* Real-time Visitor Radar Table */}
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  <span>🔴 Live Visitor Radar</span>
                  <span style={{ fontSize: '11px', color: '#10b981' }}>● {simulatedVisitors.length} Active Sessions Stream</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {simulatedVisitors.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{v.flag}</span>
                        <div>
                          <strong style={{ fontSize: '12px', color: '#ffffff' }}>Visitor #{v.id} ({v.country})</strong>
                          <div style={{ fontSize: '10px', color: '#9ca3af' }}>{v.device}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>{v.path} ({v.duration})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Master Unified Inbox (Meta + Web) */}
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  <span>📥 Unified Inbox (Meta DMs + Website Chat)</span>
                  <span style={{ fontSize: '11px', color: '#ef4444' }}>{inboxConversations.filter(c => c.unread).length} Unread</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
                  {/* Left: Chat List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {inboxConversations.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedInboxId(c.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: selectedInboxId === c.id ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.02)',
                          border: selectedInboxId === c.id ? '1px solid rgba(220,38,38,0.4)' : '1px solid rgba(255,255,255,0.04)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>{c.icon} {c.sender}</span>
                          <span style={{ fontSize: '10px', color: c.unread ? '#ef4444' : '#6b7280' }}>{c.time}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Active Chat Conversation */}
                  <div style={{ background: '#080c14', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '10px', fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                        Active: {activeConversation?.icon} {activeConversation?.sender}
                      </div>
                      <div style={{ fontSize: '12px', color: '#e5e7eb', background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '8px' }}>
                        {activeConversation?.text}
                      </div>
                    </div>

                    <form onSubmit={handleConsoleSendReply} style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Reply as Agent..."
                        value={consoleReplyInput}
                        onChange={(e) => setConsoleReplyInput(e.target.value)}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: 'white' }}
                      />
                      <button type="submit" style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Left Side: Mobile App Smartphone Simulator */
          <div className="phone-simulator-container">
            <div className="phone-device-frame">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="phone-app-header">
                  <div className="phone-app-title">
                    <span style={{ fontSize: '14px' }}>⚡</span> LetsTrack Mobile App
                  </div>
                  <span style={{ fontSize: '10px', background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                    ONLINE
                  </span>
                </div>

                {/* Smartphone Instant Push Alert */}
                <div className="phone-push-card">
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 800, marginBottom: '2px' }}>
                    🔔 INSTANT PUSH NOTIFICATION
                  </div>
                  <strong style={{ fontSize: '12px', color: '#ffffff' }}>Visitor #{simulatedVisitors[0]?.id} ({simulatedVisitors[0]?.country})</strong>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Just opened /pricing page • 89% Buy Intent Score</div>
                </div>

                {/* Smartphone Live Visitor List */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    🔴 Live Visitors ({simulatedVisitors.length})
                  </div>
                  {simulatedVisitors.map(v => (
                    <div key={v.id} style={{ fontSize: '10px', color: '#9ca3af', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{v.flag} #{v.id} ({v.country})</span>
                      <span style={{ color: '#ef4444' }}>{v.path}</span>
                    </div>
                  ))}
                </div>

                {/* Mobile Meta Unified Inbox */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px', border: '1px solid rgba(255,255,255,0.06)', flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    📥 Meta & Web Messages
                  </div>
                  {inboxConversations.map(c => (
                    <div key={c.id} style={{ fontSize: '10px', padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', marginBottom: '4px' }}>
                      <strong style={{ color: '#ffffff' }}>{c.icon} {c.sender}</strong>
                      <div style={{ color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Side: Visitor Live Chat Widget Playground */}
        <div className="visitor-widget-box">
          <div className="widget-box-head" style={{ backgroundColor: widgetColor }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              <span>LetsTrack Live Chat Widget</span>
            </div>
            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px' }}>
              Visitor Mode
            </span>
          </div>

          <div className="widget-box-body">
            {widgetMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`chat-bubble ${msg.sender === 'visitor' ? 'bubble-visitor' : 'bubble-agent'}`} 
                style={{ backgroundColor: msg.sender === 'agent' ? widgetColor : undefined }}
              >
                {msg.text}
              </div>
            ))}
            {agentTyping && (
              <div className="chat-bubble bubble-agent" style={{ backgroundColor: widgetColor, opacity: 0.8, fontStyle: 'italic', fontSize: '11px' }}>
                Agent typing reply...
              </div>
            )}
          </div>

          <form className="widget-box-footer" onSubmit={handleSendWidgetMessage}>
            <input
              type="text"
              className="demo-input"
              placeholder="Type a message to test widget..."
              value={widgetInput}
              onChange={(e) => setWidgetInput(e.target.value)}
            />
            <button type="submit" className="demo-send-btn" style={{ backgroundColor: widgetColor }}>
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
