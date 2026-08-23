import React, { useState, useEffect } from 'react';
import './LandingPage.css';

export default function LandingPage({ onNavigateToLogin, onNavigateToRegister }) {
  // Demo Widget State
  const [widgetColor, setWidgetColor] = useState('#dc2626');
  const [demoMessages, setDemoMessages] = useState([
    { sender: 'agent', text: 'Hello! 👋 How can I help you explore LetsTrack today?' }
  ]);
  const [demoInput, setDemoInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Integration tab state (wordpress, javascript, react)
  const [activeIntegrationTab, setActiveIntegrationTab] = useState('wordpress');
  const [copiedCode, setCopiedCode] = useState(false);

  // Pricing Billing Toggle
  const [isAnnual, setIsAnnual] = useState(true);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState(0);

  // Inbox Showcase filter state
  const [demoInboxFilter, setDemoInboxFilter] = useState('all');

  // Hero Mockup Tab State
  const [heroMockupTab, setHeroMockupTab] = useState('radar'); // 'radar' | 'inbox' | 'analytics'

  // Live visitor ticker simulation
  const [simulatedVisitorCount, setSimulatedVisitorCount] = useState(148);
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedVisitorCount(prev => prev + (Math.random() > 0.4 ? 1 : -1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Floating Widget state on Landing Page
  const [isFloatingWidgetOpen, setIsFloatingWidgetOpen] = useState(false);

  // ROI Calculator State
  const [calcVisitors, setCalcVisitors] = useState(15000);
  const [calcOrderValue, setCalcOrderValue] = useState(85);

  const handleSendDemoMessage = (e) => {
    e?.preventDefault();
    if (!demoInput.trim()) return;

    const userMsg = demoInput;
    setDemoMessages(prev => [...prev, { sender: 'visitor', text: userMsg }]);
    setDemoInput('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let replyText = 'Thanks for testing! As soon as a visitor messages on your website, your agents receive instant desktop and mobile notifications.';
      if (userMsg.toLowerCase().includes('wordpress')) {
        replyText = 'Installing on WordPress takes less than 2 minutes! Download our .zip plugin, upload to WP Admin, enter your API key, and you are live.';
      } else if (userMsg.toLowerCase().includes('pricing') || userMsg.toLowerCase().includes('cost')) {
        replyText = 'LetsTrack offers a Free Starter tier, and Pro plans start at just $29/month with unlimited visitors!';
      }
      setDemoMessages(prev => [...prev, { sender: 'agent', text: replyText }]);
    }, 1200);
  };

  const copySnippet = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const jsSnippet = `<script 
  src="https://letstrack.manacity.in/widget/letstrack.js" 
  data-tenant-id="YOUR_TENANT_ID" 
  data-color="${widgetColor}" 
  async>
</script>`;

  const reactSnippet = `import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://letstrack.manacity.in/widget/letstrack.js';
    script.setAttribute('data-tenant-id', 'YOUR_TENANT_ID');
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div>My Web Application</div>;
}`;

  return (
    <div className="landing-container">
      {/* Glow Blobs */}
      <div className="landing-bg-blob blob-1"></div>
      <div className="landing-bg-blob blob-2"></div>
      <div className="landing-bg-blob blob-3"></div>

      {/* Header Navbar */}
      <header className="landing-header">
        <nav className="landing-nav">
          <div className="landing-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="landing-logo-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <span className="landing-logo-title">LetsTrack</span>
            <span className="landing-logo-badge">Module</span>
          </div>

          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#demo" className="landing-nav-link">Live Demo</a>
            <a href="#integrations" className="landing-nav-link">WordPress & SDK</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </div>

          <div className="landing-nav-actions">
            <button className="btn-console" onClick={onNavigateToLogin}>
              Access Console
            </button>
            <button className="btn-primary-cta" onClick={onNavigateToRegister}>
              Start Free Trial
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-pill">
          <span className="hero-pill-dot"></span>
          <span>⚡ All-In-One Real-Time Growth & Sales Engine</span>
        </div>

        <h1 className="hero-title">
          Know the Moment a Visitor Lands. <span>Engage & Upsell in One Single App.</span>
        </h1>

        <p className="hero-subtitle">
          Get instant push alerts the second a prospect opens your website. Receive every message—from Web Chat, Instagram DMs, and Facebook—into one unified inbox, powered by live upsell analytics.
        </p>

        <div className="hero-buttons">
          <button className="btn-primary-cta btn-hero-lg" onClick={onNavigateToRegister}>
            Start 14-Day Free Trial
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          <a href="#demo" className="btn-secondary-hero">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Test Drive Live Widget
          </a>
        </div>

        {/* Hero Interactive Showcase Window */}
        <div className="hero-mockup-container">
          <div className="mockup-header">
            <span className="mockup-dot dot-red"></span>
            <span className="mockup-dot dot-yellow"></span>
            <span className="mockup-dot dot-green"></span>
            <div className="mockup-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              https://letstrack.manacity.in/console
            </div>
          </div>

          {/* Interactive Showcase Tabs inside Hero Mockup */}
          <div className="mockup-tab-bar">
            <button
              className={`mockup-tab-btn ${heroMockupTab === 'radar' ? 'active' : ''}`}
              onClick={() => setHeroMockupTab('radar')}
            >
              🔔 Instant Visitor Entry Alerts & Radar
            </button>
            <button
              className={`mockup-tab-btn ${heroMockupTab === 'inbox' ? 'active' : ''}`}
              onClick={() => setHeroMockupTab('inbox')}
            >
              📥 Meta & Web Unified Inbox
            </button>
            <button
              className={`mockup-tab-btn ${heroMockupTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setHeroMockupTab('analytics')}
            >
              📊 Upsell Analytics & Buyer Intent
            </button>
          </div>

          <div className="mockup-body">
            {heroMockupTab === 'radar' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="push-alert-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🔔</span>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ color: '#ffffff', fontSize: '13px' }}>INSTANT ALERT: High-Intent Lead #8402 (United States)</strong>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>Currently reading /pricing for 3 minutes • 89% Buy Intent Score</div>
                    </div>
                  </div>
                  <button className="btn-primary-cta" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onNavigateToRegister}>
                    Start Chat Now
                  </button>
                </div>

                <div className="mockup-visitor-table">
                  <div className="table-title">
                    <span>🔴 Real-Time Visitor Radar (WebSockets Stream)</span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>● {simulatedVisitorCount} Active Visitors Now</span>
                  </div>

                  <div className="visitor-row active">
                    <div className="visitor-info">
                      <span className="online-indicator"></span>
                      <div>
                        <strong style={{ color: 'white' }}>Visitor #8402 (United States)</strong>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Chrome on macOS • Referral: Google Search</div>
                      </div>
                    </div>
                    <span className="visitor-page">/pricing (3m 12s)</span>
                  </div>

                  <div className="visitor-row">
                    <div className="visitor-info">
                      <span className="online-indicator"></span>
                      <div>
                        <strong style={{ color: 'white' }}>Visitor #3194 (London, UK)</strong>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Mobile Safari on iOS</div>
                      </div>
                    </div>
                    <span className="visitor-page">/checkout (1m 45s)</span>
                  </div>
                </div>
              </div>
            )}

            {heroMockupTab === 'inbox' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📥 Unified Master Inbox (Meta + Web)</span>
                    <span style={{ fontSize: '11px', color: '#ef4444' }}>4 Unread Conversations</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="inbox-item-row unread">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📸</span>
                        <div>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }}>@sarah_designs (Instagram DM)</strong>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Hi! Can I get a discount for 5 website licenses?"</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Just Now</span>
                    </div>

                    <div className="inbox-item-row unread">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🌐</span>
                        <div>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }}>Visitor #4019 (Website Chat)</strong>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Does your WordPress plugin support multisite?"</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>1m ago</span>
                    </div>

                    <div className="inbox-item-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>💬</span>
                        <div>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }}>Alex Rivers (FB Messenger)</strong>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Scheduling live demo for tomorrow!"</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>3m ago</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {heroMockupTab === 'analytics' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📊 Live Upsell & Conversion Analytics</span>
                    <span style={{ fontSize: '11px', color: '#10b981' }}>+340% Lead Lift</span>
                  </div>

                  <div className="analytics-metrics-row">
                    <div className="metric-pill-box">
                      <div className="metric-num" style={{ color: '#10b981' }}>89%</div>
                      <div className="metric-lbl">High Buy Intent</div>
                    </div>
                    <div className="metric-pill-box">
                      <div className="metric-num">$3,420</div>
                      <div className="metric-lbl">Recovered Cart Sales</div>
                    </div>
                    <div className="metric-pill-box">
                      <div className="metric-num" style={{ color: '#ef4444' }}>&lt; 28s</div>
                      <div className="metric-lbl">Avg Reply Time</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(220,38,38,0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.3)', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#e5e7eb' }}>💡 <strong>AUTOMATED UPSELL PROMPT:</strong> 42 visitors are hovering on the Checkout page right now. Trigger 10% coupon popover?</span>
                    <button className="btn-primary-cta" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={onNavigateToRegister}>
                      Trigger Upsell
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3 Core Pillar Cards Below Mockup Window */}
        <div className="hero-pillars-grid">
          <div className="hero-pillar-card">
            <div className="hero-pillar-header">
              <div className="hero-pillar-icon">🔔</div>
              <h3 className="hero-pillar-title">1. Instant Entry Alerts</h3>
            </div>
            <p className="hero-pillar-text">
              Receive real-time push notifications on mobile or desktop the exact second a high-intent buyer opens your website or lands on your pricing page.
            </p>
          </div>

          <div className="hero-pillar-card">
            <div className="hero-pillar-header">
              <div className="hero-pillar-icon">📥</div>
              <h3 className="hero-pillar-title">2. Meta & Web Unified Inbox</h3>
            </div>
            <p className="hero-pillar-text">
              Stream Website Chat, Instagram DMs, Facebook Messenger, and WhatsApp into 1 single master app. Reply to all leads from one screen.
            </p>
          </div>

          <div className="hero-pillar-card">
            <div className="hero-pillar-header">
              <div className="hero-pillar-icon">📊</div>
              <h3 className="hero-pillar-title">3. Sales & Upsell Analytics</h3>
            </div>
            <p className="hero-pillar-text">
              Track live buyer intent scores, cart values, and traffic heatmaps to trigger timely discount coupons and close high-ticket upsells.
            </p>
          </div>
        </div>

        {/* Platform Compatibility Banner */}
        <div className="logos-strip">
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>COMPATIBLE WITH ALL PLATFORMS:</span>
          <div className="platform-logo-item">🌐 WordPress</div>
          <div className="platform-logo-item">🛍️ Shopify</div>
          <div className="platform-logo-item">⚛️ React & Next.js</div>
          <div className="platform-logo-item">📦 WooCommerce</div>
          <div className="platform-logo-item">🎨 Webflow</div>
        </div>
      </section>

      {/* Before vs After Section */}
      <section className="section-padding" style={{ paddingTop: '40px' }}>
        <div className="section-header">
          <span className="section-tag">Why You Need LetsTrack</span>
          <h2 className="section-title">Stop Losing 98% of Your Website Visitors</h2>
          <p className="section-desc">
            Most website visitors leave without buying or filling a form. Here is how LetsTrack transforms your sales pipeline.
          </p>
        </div>

        <div className="before-after-grid">
          <div className="ba-card without">
            <span className="ba-badge">❌ WITHOUT LETSTRACK</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#f87171' }}>Anonymous Visitors Bounce</h3>
            <ul className="ba-list">
              <li className="ba-item">
                <span style={{ color: '#ef4444' }}>✕</span>
                <span>98% of visitors leave your website without taking any action or leaving contact info.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#ef4444' }}>✕</span>
                <span>Zero visibility into which product or pricing page high-intent leads are currently reading.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#ef4444' }}>✕</span>
                <span>You miss the critical 2-minute window to answer buyer questions before they leave for competitors.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#ef4444' }}>✕</span>
                <span>Expensive live chat tools (Intercom/Drift) charge $450+/mo per seat.</span>
              </li>
            </ul>
          </div>

          <div className="ba-card with">
            <span className="ba-badge">✅ WITH LETSTRACK</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>Instant Lead Capture & Conversion</h3>
            <ul className="ba-list">
              <li className="ba-item">
                <span style={{ color: '#10b981' }}>✓</span>
                <span>Track exact active URLs, geolocation, referral sources, and visitor behavior in real time.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#10b981' }}>✓</span>
                <span>Proactively chat with visitors on high-intent pages before they exit your site.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#10b981' }}>✓</span>
                <span>Get instant push alerts on Android & iOS whenever a hot lead asks a question.</span>
              </li>
              <li className="ba-item">
                <span style={{ color: '#10b981' }}>✓</span>
                <span>Unified Multi-Channel Inbox (Web, Instagram DMs, Facebook, WhatsApp) starting at just $29/mo.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="section-padding">
        <div className="section-header">
          <span className="section-tag">Interactive Sandbox</span>
          <h2 className="section-title">Test Drive the Widget Live</h2>
          <p className="section-desc">
            Experience what your visitors will see. Customize the widget color palette and chat directly with our live demo bot!
          </p>
        </div>

        <div className="demo-section-box">
          <div className="demo-controls">
            <h3>Customizable Widget Themes</h3>
            <p>
              Match your brand identity perfectly. The LetsTrack widget seamlessly fits any modern web application or e-commerce site.
            </p>

            <div className="demo-color-picker">
              <span className="picker-label">Select Brand Accent Color:</span>
              <div className="color-options">
                {[
                  { hex: '#dc2626', name: 'Crimson Red' },
                  { hex: '#2563eb', name: 'Royal Blue' },
                  { hex: '#059669', name: 'Emerald' },
                  { hex: '#7c3aed', name: 'Purple Glow' },
                  { hex: '#d97706', name: 'Amber Gold' }
                ].map(item => (
                  <div
                    key={item.hex}
                    className={`color-swatch ${widgetColor === item.hex ? 'active' : ''}`}
                    style={{ backgroundColor: item.hex }}
                    onClick={() => setWidgetColor(item.hex)}
                    title={item.name}
                  ></div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' }}>⚡ Instant Live Alerts</div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                Every message sent in the widget streams directly to your team console and triggers instant push notifications on your mobile device.
              </div>
            </div>
          </div>

          <div className="demo-widget-preview-card">
            <div className="demo-widget-head" style={{ backgroundColor: widgetColor }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                <span>LetsTrack Support</span>
              </div>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>Online</span>
            </div>

            <div className="demo-widget-body">
              {demoMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble ${msg.sender === 'visitor' ? 'bubble-visitor' : 'bubble-agent'}`} style={{ backgroundColor: msg.sender === 'agent' ? widgetColor : undefined }}>
                  {msg.text}
                </div>
              ))}
              {isTyping && (
                <div className="chat-bubble bubble-agent" style={{ backgroundColor: widgetColor, opacity: 0.8, fontStyle: 'italic', fontSize: '11px' }}>
                  Support agent is typing...
                </div>
              )}
            </div>

            <form className="demo-widget-footer" onSubmit={handleSendDemoMessage}>
              <input
                type="text"
                className="demo-input"
                placeholder="Type a test message..."
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
              />
              <button type="submit" className="demo-send-btn" style={{ backgroundColor: widgetColor }}>
                Send
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="section-padding">
        <div className="section-header">
          <span className="section-tag">Powerful Capabilities</span>
          <h2 className="section-title">Built for Modern Growth Teams</h2>
          <p className="section-desc">
            Everything you need to convert anonymous website traffic into engaged conversations and revenue.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                <path d="M2 12h20"/>
              </svg>
            </div>
            <h3 className="feature-title">Real-Time Visitor Radar</h3>
            <p className="feature-text">
              See who is browsing your site right now, which page they are reading, referral paths, IP location, and live session duration.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3 className="feature-title">Proactive Live Messaging</h3>
            <p className="feature-text">
              Initiate direct conversations with active visitors on high-intent pages before they exit your site.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </div>
            <h3 className="feature-title">Mobile Push Alerts</h3>
            <p className="feature-text">
              Never miss a lead. Get instant push notifications on Android & iOS apps when a visitor initiates a conversation.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <polyline points="17 11 19 13 23 9"/>
              </svg>
            </div>
            <h3 className="feature-title">Multi-Agent & Multi-Tenant</h3>
            <p className="feature-text">
              Assign conversations to specific agents, manage active status (Online/Offline), and segment multiple client websites.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h3 className="feature-title">WordPress & Custom SDK</h3>
            <p className="feature-text">
              Install via our 1-click WordPress Plugin or embed a lightweight 1-line JavaScript snippet into React, Vue, HTML, or Next.js.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <h3 className="feature-title">Multi-Channel Unified Inbox</h3>
            <p className="feature-text">
              Receive messages from your Website Chat, Instagram DMs, Facebook Messenger, WhatsApp, and custom Webhooks into one single agent application.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <h3 className="feature-title">Real-Time Traffic Analytics</h3>
            <p className="feature-text">
              Track conversion rates, active chat volume, peak traffic hours, geographic visitor heatmaps, and agent response speed in real time.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h3 className="feature-title">Sub-15KB & Zero Lag</h3>
            <p className="feature-text">
              Engineered for extreme performance. Asynchronous loading ensures zero impact on your site’s Google PageSpeed scores.
            </p>
          </div>
        </div>

        {/* Feature Spotlight Showcases for Unified Inbox & Analytics */}
        <div className="showcase-two-col">
          {/* Spotlight 1: Unified Inbox */}
          <div className="spotlight-card">
            <span className="spotlight-header-badge">📥 Multi-Channel Inbox (Web • Insta • FB • WhatsApp)</span>
            <h3 className="spotlight-title">Unified Multi-Channel Inbox</h3>
            <p className="spotlight-desc">
              Stop switching between separate apps and browser tabs. Stream your Website Visitors, Instagram DMs, Facebook Messenger, and WhatsApp inquiries directly into one master console.
            </p>

            <div className="inbox-filter-pills">
              {['all', 'website', 'instagram', 'facebook'].map(f => (
                <button
                  key={f}
                  className={`inbox-pill ${demoInboxFilter === f ? 'active' : ''}`}
                  onClick={() => setDemoInboxFilter(f)}
                >
                  {f === 'all' ? 'All Channels (14)' : f === 'website' ? '🌐 Website (6)' : f === 'instagram' ? '📸 Instagram (4)' : '💬 Facebook (4)'}
                </button>
              ))}
            </div>

            <div className="inbox-chat-list">
              <div className="inbox-item-row unread">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>📸</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#ffffff' }}>@sarah_designs</strong>
                      <span style={{ fontSize: '10px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '1px 6px', borderRadius: '4px' }}>Instagram DM</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Hi! What are your pro subscription packages?"</div>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Just Now</span>
              </div>

              <div className="inbox-item-row unread">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>🌐</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#ffffff' }}>Lead #4019 (High Intent)</strong>
                      <span style={{ fontSize: '10px', background: 'rgba(220,38,38,0.2)', color: '#f87171', padding: '1px 6px', borderRadius: '4px' }}>Website Chat</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Looking for WordPress multisite integration..."</div>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>1m ago</span>
              </div>

              <div className="inbox-item-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>💬</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#ffffff' }}>Alex Rivers</strong>
                      <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '1px 6px', borderRadius: '4px' }}>FB Messenger</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>"Can we schedule a live demo call for tomorrow?"</div>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>4m ago</span>
              </div>
            </div>
          </div>

          {/* Spotlight 2: Real-Time Analytics */}
          <div className="spotlight-card">
            <span className="spotlight-header-badge">📊 Live Metrics & Intelligence</span>
            <h3 className="spotlight-title">Real-Time Traffic Analytics</h3>
            <p className="spotlight-desc">
              Gain deep visibility into visitor trends, peak engagement hours, average agent response velocity, and lead conversion rates.
            </p>

            <div className="analytics-metrics-row">
              <div className="metric-pill-box">
                <div className="metric-num">1,842</div>
                <div className="metric-lbl">Total Visitors Today</div>
              </div>
              <div className="metric-pill-box">
                <div className="metric-num" style={{ color: '#10b981' }}>98.4%</div>
                <div className="metric-lbl">Satisfaction Rate</div>
              </div>
              <div className="metric-pill-box">
                <div className="metric-num" style={{ color: '#ef4444' }}>&lt; 38s</div>
                <div className="metric-lbl">Avg Response Time</div>
              </div>
            </div>

            <div className="chart-bar-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                <span>Hourly Engagement Trends</span>
                <span style={{ color: '#10b981' }}>+24% vs Yesterday</span>
              </div>
              <div className="chart-bars-wrap">
                <div className="bar-col" style={{ height: '40%' }} title="09:00 - 120 visitors"></div>
                <div className="bar-col" style={{ height: '65%' }} title="10:00 - 240 visitors"></div>
                <div className="bar-col" style={{ height: '90%' }} title="11:00 - 380 visitors"></div>
                <div className="bar-col" style={{ height: '75%' }} title="12:00 - 310 visitors"></div>
                <div className="bar-col" style={{ height: '100%' }} title="13:00 - 450 visitors"></div>
                <div className="bar-col" style={{ height: '85%' }} title="14:00 - 360 visitors"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive ROI Calculator Section */}
      <section className="section-padding">
        <div className="section-header">
          <span className="section-tag">Calculate Your ROI</span>
          <h2 className="section-title">How Much Revenue Are You Missing?</h2>
          <p className="section-desc">
            Adjust the sliders below to calculate how much additional monthly revenue LetsTrack can recover for your business.
          </p>
        </div>

        <div className="roi-calculator-box">
          <div>
            <div className="calc-slider-group">
              <div className="calc-label-row">
                <span>Monthly Website Visitors:</span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>{calcVisitors.toLocaleString()} visitors</span>
              </div>
              <input
                type="range"
                className="calc-range-input"
                min="1000"
                max="100000"
                step="1000"
                value={calcVisitors}
                onChange={(e) => setCalcVisitors(Number(e.target.value))}
              />
            </div>

            <div className="calc-slider-group">
              <div className="calc-label-row">
                <span>Average Order / Deal Value ($):</span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>${calcOrderValue}</span>
              </div>
              <input
                type="range"
                className="calc-range-input"
                min="10"
                max="500"
                step="5"
                value={calcOrderValue}
                onChange={(e) => setCalcOrderValue(Number(e.target.value))}
              />
            </div>

            <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
              💡 <em>Based on capturing an extra 3.5% of exiting or hesitation traffic using real-time visitor radar and proactive chat triggers.</em>
            </div>
          </div>

          <div className="calc-result-card">
            <span style={{ fontSize: '12px', uppercase: true, fontWeight: 700, color: '#d1d5db' }}>ESTIMATED EXTRA MONTHLY REVENUE</span>
            <div className="calc-val-display">${Math.round(calcVisitors * 0.035 * calcOrderValue).toLocaleString()}</div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
              Recovered every single month with LetsTrack Pro ($29/mo).
            </p>
            <button className="btn-primary-cta" style={{ width: '100%', justifyContent: 'center' }} onClick={onNavigateToRegister}>
              Start Recovering Sales Now
            </button>
          </div>
        </div>
      </section>

      {/* Competitor Comparison Matrix Section */}
      <section className="section-padding">
        <div className="section-header">
          <span className="section-tag">Value Comparison</span>
          <h2 className="section-title">Why Smart Growth Teams Choose LetsTrack</h2>
          <p className="section-desc">
            Get enterprise-grade visitor tracking and multi-channel messaging without paying $500+/month.
          </p>
        </div>

        <div className="matrix-container">
          <table className="matrix-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Features</th>
                <th className="highlight">🚀 LetsTrack</th>
                <th>Intercom</th>
                <th>Drift</th>
                <th>Crisp</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>Real-Time Visitor Radar</td>
                <td className="highlight">✅ Streaming WebSockets</td>
                <td>❌ Basic ($499+/mo)</td>
                <td>❌ Enterprise Only</td>
                <td>⚠️ Basic Logs</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>Unified Social Inbox (Insta, FB, Web)</td>
                <td className="highlight">✅ Included</td>
                <td>⚠️ Expensive Add-on</td>
                <td>❌ Not Available</td>
                <td>⚠️ Limited</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>WordPress 1-Click Plugin</td>
                <td className="highlight">✅ Included (.zip)</td>
                <td>⚠️ Complex Script</td>
                <td>⚠️ Complex Script</td>
                <td>⚠️ Basic Plugin</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>Mobile Push Alerts (Android/iOS)</td>
                <td className="highlight">✅ Included</td>
                <td>✅ Included</td>
                <td>✅ Included</td>
                <td>⚠️ Web Only</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>Sub-15KB Script Footprint</td>
                <td className="highlight">⚡ &lt; 15 KB</td>
                <td>🐌 ~120 KB</td>
                <td>🐌 ~180 KB</td>
                <td>⚡ ~40 KB</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>Monthly Price</td>
                <td className="highlight" style={{ fontSize: '18px', color: '#10b981' }}>$29 / mo</td>
                <td>$450+ / mo</td>
                <td>$2,500+ / mo</td>
                <td>$95+ / mo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Verified Customer Testimonials Section */}
      <section className="section-padding">
        <div className="section-header">
          <span className="section-tag">Proven Results</span>
          <h2 className="section-title">Loved by Founder & Growth Leads</h2>
          <p className="section-desc">
            See how businesses use LetsTrack to convert traffic into repeat customers.
          </p>
        </div>

        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div>
              <div className="stars-row">★★★★★</div>
              <p className="t-quote">
                "LetsTrack allowed us to see visitors browsing our pricing page in real time. We greeted 4 high-intent prospects live and closed 3 of them the same day! Our conversion rate jumped by 340%."
              </p>
            </div>
            <div className="t-author-box">
              <div className="t-avatar">MD</div>
              <div className="t-author-info">
                <span className="t-name">Marcus Vance</span>
                <span className="t-role">Founder, SaaSFlow</span>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div>
              <div className="stars-row">★★★★★</div>
              <p className="t-quote">
                "The WordPress plugin setup took literally 90 seconds. Having Instagram DMs and Website visitor chats in one unified mobile app means our support team responds in seconds."
              </p>
            </div>
            <div className="t-author-box">
              <div className="t-avatar">ST</div>
              <div className="t-author-info">
                <span className="t-name">Sarah Tanaka</span>
                <span className="t-role">Head of E-Commerce, TrendBoutique</span>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div>
              <div className="stars-row">★★★★★</div>
              <p className="t-quote">
                "We switched from Intercom to LetsTrack and saved over $5,000/year while getting better real-time visitor tracking and zero page load slowdown."
              </p>
            </div>
            <div className="t-author-box">
              <div className="t-avatar">DR</div>
              <div className="t-author-info">
                <span className="t-name">David Ross</span>
                <span className="t-role">CTO, WebCraft Agency</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WordPress & Integration Section */}
      <section id="integrations" className="section-padding">
        <div className="section-header">
          <span className="section-tag">2-Minute Installation</span>
          <h2 className="section-title">Seamlessly Embed Anywhere</h2>
          <p className="section-desc">
            Works out of the box with WordPress, custom web apps, or single page applications.
          </p>
        </div>

        <div className="integration-tabs">
          <button
            className={`tab-btn ${activeIntegrationTab === 'wordpress' ? 'active' : ''}`}
            onClick={() => setActiveIntegrationTab('wordpress')}
          >
            WordPress Plugin (.zip)
          </button>
          <button
            className={`tab-btn ${activeIntegrationTab === 'javascript' ? 'active' : ''}`}
            onClick={() => setActiveIntegrationTab('javascript')}
          >
            JavaScript Snippet
          </button>
          <button
            className={`tab-btn ${activeIntegrationTab === 'react' ? 'active' : ''}`}
            onClick={() => setActiveIntegrationTab('react')}
          >
            React / Next.js
          </button>
        </div>

        <div className="code-box-container">
          <div className="code-box-header">
            <span className="code-lang-tag">
              {activeIntegrationTab === 'wordpress' ? 'WordPress Setup Guide' : activeIntegrationTab.toUpperCase()}
            </span>
            {activeIntegrationTab !== 'wordpress' && (
              <button
                className="btn-copy-code"
                onClick={() => copySnippet(activeIntegrationTab === 'javascript' ? jsSnippet : reactSnippet)}
              >
                {copiedCode ? '✓ Copied!' : 'Copy Code'}
              </button>
            )}
          </div>

          {activeIntegrationTab === 'wordpress' && (
            <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: 1.7 }}>
              <p style={{ marginBottom: '12px' }}>
                <strong>Step 1:</strong> Download the official LetsTrack WordPress Plugin package:
              </p>
              <div style={{ marginBottom: '16px' }}>
                <a
                  href="/letstrack-wp-plugin.zip"
                  download
                  className="btn-primary-cta"
                  style={{ textDecoration: 'none', display: 'inline-flex', padding: '8px 16px', fontSize: '13px' }}
                >
                  📥 Download letstrack-wp-plugin.zip
                </a>
              </div>
              <p style={{ marginBottom: '8px' }}>
                <strong>Step 2:</strong> Go to <code>Plugins &gt; Add New &gt; Upload Plugin</code> in your WP Admin dashboard.
              </p>
              <p>
                <strong>Step 3:</strong> Activate the plugin and paste your Tenant Key from the LetsTrack Console. Your live visitor radar is active immediately!
              </p>
            </div>
          )}

          {activeIntegrationTab === 'javascript' && (
            <pre className="code-snippet">{jsSnippet}</pre>
          )}

          {activeIntegrationTab === 'react' && (
            <pre className="code-snippet">{reactSnippet}</pre>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section-padding">
        <div className="section-header">
          <span className="section-tag">Simple Pricing</span>
          <h2 className="section-title">Start Free, Scale as You Grow</h2>
          <p className="section-desc">
            No credit card required to start. Predictable plans for every stage.
          </p>
        </div>

        <div className="pricing-toggle-container">
          <span style={{ fontSize: '14px', color: !isAnnual ? '#ffffff' : '#9ca3af', fontWeight: 600 }}>Monthly</span>
          <div className={`toggle-switch ${isAnnual ? 'active' : ''}`} onClick={() => setIsAnnual(!isAnnual)}>
            <div className="toggle-knob"></div>
          </div>
          <span style={{ fontSize: '14px', color: isAnnual ? '#ffffff' : '#9ca3af', fontWeight: 600 }}>
            Annual <span style={{ color: '#ef4444', fontSize: '12px' }}>(Save 20%)</span>
          </span>
        </div>

        <div className="pricing-grid">
          {/* Starter Plan */}
          <div className="pricing-card">
            <h3 className="plan-name">Starter</h3>
            <p className="plan-desc">Perfect for blogs & small sites getting started with visitor tracking.</p>
            <div className="plan-price">
              $0 <span className="plan-period">/ forever</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> 1 Website Domain
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Real-Time Visitor Radar (500 monthly)
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> 1 Agent Account
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Standard Live Chat Widget
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> WordPress Plugin
              </li>
            </ul>
            <button className="btn-console" style={{ width: '100%' }} onClick={onNavigateToRegister}>
              Start Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className="pricing-card featured">
            <span className="pricing-badge">Most Popular</span>
            <h3 className="plan-name">Pro Growth</h3>
            <p className="plan-desc">For growing businesses needing live sales engagement & mobile push alerts.</p>
            <div className="plan-price">
              {isAnnual ? '$24' : '$29'} <span className="plan-period">/ month</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Unlimited Website Domains
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Unlimited Real-Time Visitors
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Up to 5 Agent Accounts
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Mobile Push Alerts (Android & iOS)
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Custom Widget Branding & Colors
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Pre-Chat Forms & Lead Capture
              </li>
            </ul>
            <button className="btn-primary-cta" style={{ width: '100%', justifyContent: 'center' }} onClick={onNavigateToRegister}>
              Start 14-Day Free Trial
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card">
            <h3 className="plan-name">Enterprise</h3>
            <p className="plan-desc">Dedicated server instances, custom SLA, and high-volume routing.</p>
            <div className="plan-price">
              {isAnnual ? '$79' : '$99'} <span className="plan-period">/ month</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Everything in Pro
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Unlimited Agents & Seats
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Webhook Integrations & API Access
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> Dedicated Isolated Database Option
              </li>
              <li className="plan-feature-item">
                <span className="check-icon">✓</span> 99.9% Uptime Guarantee & Support
              </li>
            </ul>
            <button className="btn-console" style={{ width: '100%' }} onClick={onNavigateToRegister}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="section-padding">
        <div className="section-header">
          <span className="section-tag">Got Questions?</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>

        <div className="faq-list">
          {[
            {
              q: 'How does LetsTrack capture visitors in real-time?',
              a: 'LetsTrack establishes a lightweight WebSocket connection from the visitor web page to our high-speed server. As long as a visitor keeps your website open, their active URL, referral source, and session state are streamed directly to your team console.'
            },
            {
              q: 'Will the widget slow down my website load speed?',
              a: 'Not at all. The script is less than 15KB in size and loads asynchronously after your primary website assets render. It has zero impact on Google PageSpeed ratings.'
            },
            {
              q: 'Can I receive live chat notifications on my mobile phone?',
              a: 'Yes! LetsTrack supports web push and mobile push notifications for both Android and iOS devices so you can answer visitor chats anywhere.'
            },
            {
              q: 'How do I connect LetsTrack to WordPress?',
              a: 'Simply download our official letstrack-wp-plugin.zip file from the Integrations tab, upload it in WP Admin under Plugins, and input your Tenant Key.'
            },
            {
              q: 'Can I customize the chat widget design?',
              a: 'Yes, you can customize header text, launcher text, primary accent colors, gradients, welcome messages, and pre-chat lead forms right from your LetsTrack Console.'
            }
          ].map((item, idx) => (
            <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
              <div className="faq-question" onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                <span>{item.q}</span>
                <span>{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && <div className="faq-answer">{item.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <div className="cta-banner">
        <div className="cta-card">
          <h2 className="cta-title">Ready to See Who is On Your Website Right Now?</h2>
          <p className="cta-subtitle">
            Set up LetsTrack in less than 2 minutes and start engaging high-intent leads in real-time.
          </p>
          <button className="btn-primary-cta btn-hero-lg" style={{ background: '#ffffff', color: '#dc2626', fontWeight: 800 }} onClick={onNavigateToRegister}>
            Create Free Account Now
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="landing-logo">
              <div className="landing-logo-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              </div>
              <span className="landing-logo-title">LetsTrack</span>
            </div>
            <p className="footer-desc">
              Real-time visitor intelligence and instant live chat module for modern web apps and WordPress.
            </p>
          </div>

          <div className="footer-links-group">
            <div>
              <div className="footer-column-title">Product</div>
              <ul className="footer-links">
                <li><a href="#features" className="footer-link">Features</a></li>
                <li><a href="#demo" className="footer-link">Interactive Demo</a></li>
                <li><a href="#integrations" className="footer-link">WordPress Plugin</a></li>
                <li><a href="#pricing" className="footer-link">Pricing Plans</a></li>
              </ul>
            </div>

            <div>
              <div className="footer-column-title">Console</div>
              <ul className="footer-links">
                <li><span className="footer-link" onClick={onNavigateToLogin} style={{ cursor: 'pointer' }}>Access Console</span></li>
                <li><span className="footer-link" onClick={onNavigateToRegister} style={{ cursor: 'pointer' }}>Create Tenant Account</span></li>
                <li><span className="footer-link" onClick={onNavigateToLogin} style={{ cursor: 'pointer' }}>Agent Login</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} LetsTrack Platform. All rights reserved.</span>
          <span>Powered by ManaCity Engine</span>
        </div>
      </footer>

      {/* Floating Live Chat Widget Launcher on Landing Page */}
      <button 
        className="landing-floating-widget-toggle" 
        onClick={() => setIsFloatingWidgetOpen(!isFloatingWidgetOpen)}
      >
        <span>💬</span>
        <span>{isFloatingWidgetOpen ? 'Close Live Demo Widget' : 'Test Drive Live Widget'}</span>
      </button>

      {/* Floating Live Chat Widget Popup */}
      {isFloatingWidgetOpen && (
        <div className="landing-floating-widget-popup">
          <div className="demo-widget-head" style={{ backgroundColor: widgetColor }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              <span>LetsTrack Support (Live Demo)</span>
            </div>
            <button 
              onClick={() => setIsFloatingWidgetOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>

          <div className="demo-widget-body" style={{ flex: 1 }}>
            {demoMessages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.sender === 'visitor' ? 'bubble-visitor' : 'bubble-agent'}`} style={{ backgroundColor: msg.sender === 'agent' ? widgetColor : undefined }}>
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble bubble-agent" style={{ backgroundColor: widgetColor, opacity: 0.8, fontStyle: 'italic', fontSize: '11px' }}>
                Agent is typing...
              </div>
            )}
          </div>

          <form className="demo-widget-footer" onSubmit={handleSendDemoMessage}>
            <input
              type="text"
              className="demo-input"
              placeholder="Type a message to test..."
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
            />
            <button type="submit" className="demo-send-btn" style={{ backgroundColor: widgetColor }}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
