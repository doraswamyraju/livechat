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

  // Live visitor ticker simulation
  const [simulatedVisitorCount, setSimulatedVisitorCount] = useState(148);
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedVisitorCount(prev => prev + (Math.random() > 0.4 ? 1 : -1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
          <span>Standalone Real-Time Visitor Tracking & Chat Engine</span>
        </div>

        <h1 className="hero-title">
          Turn Anonymous Visitors into Customers <span>in Real-Time.</span>
        </h1>

        <p className="hero-subtitle">
          Track active page views, visitor geolocation, and live behavior across your website. 
          Engage intent-ready leads instantly with a ultra-lightweight live chat widget and instant mobile push alerts.
        </p>

        <div className="hero-buttons">
          <button className="btn-primary-cta btn-hero-lg" onClick={onNavigateToRegister}>
            Get Started Free
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

        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-value">&lt; 15 KB</span>
            <span className="stat-label">Ultra Lightweight SDK</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">&lt; 50 ms</span>
            <span className="stat-label">WebSocket Latency</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{simulatedVisitorCount}</span>
            <span className="stat-label">Active Demo Visitors Now</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">100%</span>
            <span className="stat-label">WordPress Compatible</span>
          </div>
        </div>

        {/* Hero Interactive Mockup */}
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

          <div className="mockup-body">
            {/* Left side: Live Visitor Radar */}
            <div className="mockup-visitor-table">
              <div className="table-title">
                <span>🔴 Live Visitor Radar</span>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Streaming WebSockets</span>
              </div>

              <div className="visitor-row active">
                <div className="visitor-info">
                  <span className="online-indicator"></span>
                  <div>
                    <strong style={{ color: 'white' }}>Visitor #8402 (United States)</strong>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Chrome on macOS • Chrome/122</div>
                  </div>
                </div>
                <span className="visitor-page">/pricing</span>
              </div>

              <div className="visitor-row">
                <div className="visitor-info">
                  <span className="online-indicator"></span>
                  <div>
                    <strong style={{ color: 'white' }}>Visitor #3194 (India)</strong>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Mobile Safari on iOS</div>
                  </div>
                </div>
                <span className="visitor-page">/checkout</span>
              </div>

              <div className="visitor-row">
                <div className="visitor-info">
                  <span className="online-indicator"></span>
                  <div>
                    <strong style={{ color: 'white' }}>Visitor #1092 (Germany)</strong>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Firefox on Windows 11</div>
                  </div>
                </div>
                <span className="visitor-page">/docs/wordpress</span>
              </div>
            </div>

            {/* Right side: Active Co-Browsing Chat Card */}
            <div className="mockup-chat-preview">
              <div className="mockup-chat-head">
                <span>💬 Co-Browsing Live Session</span>
                <span style={{ fontSize: '10px', background: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>ACTIVE</span>
              </div>
              <div className="mockup-chat-messages">
                <div className="chat-bubble bubble-visitor">
                  Hi! Does LetsTrack work with WordPress single-site and multisite?
                </div>
                <div className="chat-bubble bubble-agent">
                  Yes! We provide a dedicated WordPress plugin that installs in seconds and tracks all user sessions automatically.
                </div>
                <div className="chat-bubble bubble-visitor">
                  Awesome, testing it now! 🚀
                </div>
              </div>
            </div>
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
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h3 className="feature-title">Sub-15KB & Zero Lag</h3>
            <p className="feature-text">
              Engineered for extreme performance. Asynchronous loading ensures zero impact on your site’s Google PageSpeed scores.
            </p>
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
    </div>
  );
}
