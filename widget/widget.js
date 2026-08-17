(function() {
  // Ensure widget config exists or auto-detect from script tag attribute
  let apiKey = window.LetsTrackConfig ? window.LetsTrackConfig.websiteId : null;
  if (!apiKey) {
    const currentScript = document.currentScript || document.querySelector('script[data-api-key]');
    if (currentScript) {
      apiKey = currentScript.getAttribute('data-api-key');
    }
  }

  if (!apiKey) {
    console.error("LetsTrack: Missing websiteId (API key) in LetsTrackConfig or data-api-key attribute.");
    return;
  }

  const API_KEY = apiKey;
  const BACKEND_URL = '__BACKEND_URL__'; // Dynamically replaced by server at runtime
  
  // Generate or retrieve persistent visitor UUID
  const savedVisitorId = localStorage.getItem('letstrack_visitor_uuid');
  const isRevisit = !!savedVisitorId;
  const visitorId = savedVisitorId || ('v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  if (!savedVisitorId) {
    localStorage.setItem('letstrack_visitor_uuid', visitorId);
  }

  // Load Socket.io Client from CDN asynchronously
  const loadSocketScript = () => {
    return new Promise((resolve, reject) => {
      if (window.io) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("LetsTrack failed to load Socket.io client."));
      document.head.appendChild(script);
    });
  };

  // Premium audio notification chime using browser Web Audio API (no dependencies)
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5 note

      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio context might be blocked until user gesture, ignore silently
    }
  };

  // Helper: Detect browser info
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    let os = "Unknown";
    let deviceType = "Desktop";

    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
    else if (ua.indexOf("Trident") > -1) browser = "IE";
    else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";

    if (ua.indexOf("Windows NT 10.0") > -1) os = "Windows 10/11";
    else if (ua.indexOf("Windows NT 6.2") > -1) os = "Windows 8";
    else if (ua.indexOf("Windows NT 6.1") > -1) os = "Windows 7";
    else if (ua.indexOf("Macintosh") > -1) os = "macOS";
    else if (ua.indexOf("Android") > -1) { os = "Android"; deviceType = "Mobile"; }
    else if (ua.indexOf("iPhone") > -1) { os = "iOS"; deviceType = "Mobile"; }
    else if (ua.indexOf("iPad") > -1) { os = "iOS"; deviceType = "Tablet"; }
    else if (ua.indexOf("Linux") > -1) os = "Linux";

    return { browser, os, deviceType };
  };

  // Fetch widget customizations
  fetch(`${BACKEND_URL}/api/settings/widget?apiKey=${API_KEY}`)
    .then(res => {
      if (!res.ok) throw new Error("Settings fetch failed");
      return res.json();
    })
    .then(async (settings) => {
      await loadSocketScript();
      initWidget(settings);
    })
    .catch(err => {
      console.warn("LetsTrack: falling back to default styling configuration.", err);
      const defaultSettings = {
        primaryColor: '#7C3AED',
        headingText: 'Chat with Us!',
        welcomeMessage: 'Hi there! How can we help you today?',
        preChatEnabled: false,
        position: 'bottom-right',
        headerTextColor: '#ffffff',
        gradientColor: '#312E81',
        useGradient: true,
        statusText: 'Typically replies instantly',
        borderRadius: 16,
        launcherText: 'Chat'
      };
      loadSocketScript().then(() => initWidget(defaultSettings));
    });

  // Main UI builder using Shadow DOM
  function initWidget(settings) {
    const container = document.createElement('div');
    container.id = 'letstrack-widget-root';
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'closed' });

    // Styles for Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        box-sizing: border-box;
      }
      
      .lt-widget-container {
        position: fixed;
        bottom: 20px;
        ${settings.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: ${settings.position === 'bottom-left' ? 'flex-start' : 'flex-end'};
      }

      /* Widget Button Trigger */
      .lt-widget-btn {
        height: 50px;
        border-radius: ${settings.launcherText ? '25px' : '50%'};
        padding: ${settings.launcherText ? '0 20px' : '0'};
        min-width: ${settings.launcherText ? 'auto' : '50px'};
        background-color: ${settings.primaryColor};
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
        border: none;
        outline: none;
      }
      .lt-widget-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      }
      .lt-widget-btn svg {
        width: 24px;
        height: 24px;
        fill: white;
        transition: transform 0.2s;
      }
      .lt-widget-btn.open svg {
        transform: rotate(90deg);
      }

      /* Chat Window Drawer */
      .lt-chat-window {
        width: 370px;
        height: 520px;
        border-radius: ${settings.borderRadius ?? 16}px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
        margin-bottom: 15px;
        transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        transform: translateY(20px) scale(0.95);
        opacity: 0;
      }
      .lt-chat-window.open {
        display: flex;
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      /* Glassmorphism Header */
      .lt-header {
        background: ${settings.useGradient !== false
          ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.gradientColor || '#312E81'})`
          : settings.primaryColor};
        color: ${settings.headerTextColor || 'white'};
        padding: 20px 20px 24px 20px;
        display: flex;
        flex-direction: column;
        position: relative;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      }
      .lt-header-title {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.5px;
      }
      .lt-header-subtitle {
        font-size: 12px;
        margin: 4px 0 0 0;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lt-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10B981; /* Green */
        box-shadow: 0 0 6px #10B981;
        display: inline-block;
        animation: pulse 2s infinite;
      }

      /* Pre-chat and Messages Container */
      .lt-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #F9FAFB;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
      }

      /* Messages UI styling */
      .lt-msg-wrap {
        display: flex;
        flex-direction: column;
        max-width: 80%;
      }
      .lt-msg-wrap.visitor {
        align-self: flex-end;
      }
      .lt-msg-wrap.agent {
        align-self: flex-start;
      }
      .lt-msg-wrap.system {
        align-self: center;
        max-width: 90%;
      }
      .lt-msg-sender {
        font-size: 10px;
        color: #6B7280;
        margin-bottom: 2px;
        margin-left: 4px;
      }
      .lt-msg-wrap.visitor .lt-msg-sender {
        margin-left: 0;
        margin-right: 4px;
        align-self: flex-end;
      }
      .lt-msg-bubble {
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }
      .lt-msg-wrap.visitor .lt-msg-bubble {
        background-color: ${settings.primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }
      .lt-msg-wrap.agent .lt-msg-bubble {
        background-color: #E5E7EB;
        color: #1F2937;
        border-bottom-left-radius: 4px;
      }
      .lt-msg-wrap.system .lt-msg-bubble {
        background-color: #FEF3C7;
        color: #D97706;
        font-size: 11px;
        padding: 6px 12px;
        border-radius: 12px;
        text-align: center;
        border: 1px dashed #FCD34D;
      }
      
      /* Typing Indicator dots */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: #E5E7EB;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        align-self: flex-start;
        display: none;
      }
      .typing-dot {
        width: 6px;
        height: 6px;
        background: #6B7280;
        border-radius: 50%;
        animation: typingBounce 1.4s infinite ease-in-out both;
      }
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      /* Pre-chat Form */
      .pre-chat-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        border: 1px solid #E5E7EB;
      }
      .pre-chat-text {
        font-size: 13px;
        color: #4B5563;
        margin: 0 0 6px 0;
        line-height: 1.4;
      }
      .pre-chat-input {
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #D1D5DB;
        outline: none;
        font-size: 14px;
        transition: border-color 0.2s;
      }
      .pre-chat-input:focus {
        border-color: ${settings.primaryColor};
      }
      .pre-chat-btn {
        background-color: ${settings.primaryColor};
        color: white;
        padding: 11px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: opacity 0.2s;
      }
      .pre-chat-btn:hover {
        opacity: 0.9;
      }

      /* Chat Footer Input */
      .lt-footer {
        padding: 14px 16px;
        background: white;
        border-top: 1px solid #E5E7EB;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lt-input {
        flex: 1;
        border: none;
        outline: none;
        resize: none;
        font-size: 14px;
        max-height: 50px;
        padding: 6px 0;
        color: #1F2937;
      }
      .lt-input::placeholder {
        color: #9CA3AF;
      }
      .lt-send-btn {
        border: none;
        outline: none;
        background: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 50%;
        transition: background-color 0.2s;
      }
      .lt-send-btn:hover {
        background-color: #F3F4F6;
      }
      .lt-send-btn svg {
        width: 22px;
        height: 22px;
        fill: ${settings.primaryColor};
      }

      /* Scrollbar config */
      .lt-body::-webkit-scrollbar {
        width: 5px;
      }
      .lt-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .lt-body::-webkit-scrollbar-thumb {
        background: #D1D5DB;
        border-radius: 10px;
      }

      /* Animations */
      @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
      @keyframes typingBounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }

      /* Unread badge style */
      .lt-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background-color: #EF4444; /* Bright Red */
        color: white;
        font-size: 11px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        padding: 0 4px;
        box-sizing: border-box;
      }
      .lt-widget-btn.open .lt-badge {
        display: none !important;
      }

      /* Notification pop-up preview */
      .lt-notification-popup {
        position: absolute;
        bottom: 70px;
        ${settings.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
        width: 280px;
        padding: 12px 16px;
        border-radius: 12px;
        background: white;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        border: 1px solid #E5E7EB;
        display: none;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
        z-index: 999998;
        animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        font-family: sans-serif;
      }
      .lt-notification-popup:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .lt-notification-title {
        font-size: 13px;
        font-weight: 700;
        color: ${settings.primaryColor};
        margin: 0;
      }
      .lt-notification-text {
        font-size: 12px;
        color: #4B5563;
        margin: 0;
        line-height: 1.4;
      }
      .lt-notification-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9CA3AF;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .lt-notification-close:hover {
        color: #4B5563;
      }

      @keyframes slideIn {
        from { transform: translateY(15px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      /* Adaptive Mobile viewports */
      @media (max-width: 480px) {
        .lt-chat-window {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          top: 0;
          width: 100% !important;
          height: 100% !important;
          border-radius: 0;
          margin-bottom: 0;
        }
        .lt-widget-btn {
          display: flex !important;
        }
        .lt-chat-window.open {
          display: flex;
        }
        .lt-header {
          padding-top: 30px;
        }
      }
    `;

    // ------------------------------------------
    // DOM TREE ASSEMBLY
    // ------------------------------------------
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'lt-widget-container';

    // 1. Chat Window
    const chatWindow = document.createElement('div');
    chatWindow.className = 'lt-chat-window';

    // Header
    const header = document.createElement('div');
    header.className = 'lt-header';
    header.innerHTML = `
      <div class="lt-header-title">${settings.headingText}</div>
      <div class="lt-header-subtitle">
        <span class="lt-status-dot"></span> ${settings.statusText || 'Typically replies instantly'}
      </div>
    `;
    chatWindow.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'lt-body';
    chatWindow.appendChild(body);

    // Typing dots (inside body)
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    body.appendChild(typingIndicator);

    // Footer Input
    const footer = document.createElement('div');
    footer.className = 'lt-footer';
    footer.innerHTML = `
      <input class="lt-input" type="text" placeholder="Type a message..." disabled />
      <button class="lt-send-btn" disabled>
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    `;
    chatWindow.appendChild(footer);

    widgetContainer.appendChild(chatWindow);

    // 2. Trigger Floating Button
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'lt-widget-btn';
    
    const triggerInner = document.createElement('div');
    triggerInner.style.display = 'flex';
    triggerInner.style.alignItems = 'center';
    triggerInner.style.justifyContent = 'center';
    triggerInner.style.gap = '8px';
    triggerInner.style.height = '100%';
    
    let btnHtml = `
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
      </svg>
    `;
    if (settings.launcherText) {
      btnHtml += `<span style="color: white; font-size: 14px; font-weight: 600; font-family: inherit;">${settings.launcherText}</span>`;
    }
    triggerInner.innerHTML = btnHtml;
    triggerBtn.appendChild(triggerInner);
    widgetContainer.appendChild(triggerBtn);

    // Create unread badge inside trigger button
    const badge = document.createElement('div');
    badge.className = 'lt-badge';
    triggerBtn.appendChild(badge);

    // Create notification popup
    const notificationPopup = document.createElement('div');
    notificationPopup.className = 'lt-notification-popup';
    notificationPopup.innerHTML = `
      <div class="lt-notification-close">&times;</div>
      <div class="lt-notification-title">${settings.headingText || 'Support Agent'}</div>
      <div class="lt-notification-text"></div>
    `;
    widgetContainer.appendChild(notificationPopup);

    const popupClose = notificationPopup.querySelector('.lt-notification-close');
    popupClose.onclick = (e) => {
      e.stopPropagation();
      notificationPopup.style.display = 'none';
    };
    notificationPopup.onclick = (e) => {
      if (e.target !== popupClose) {
        toggleChat(true);
      }
    };

    shadow.appendChild(style);
    shadow.appendChild(widgetContainer);

    // References to UI elements inside Shadow DOM
    const textInput = footer.querySelector('.lt-input');
    const sendBtn = footer.querySelector('.lt-send-btn');
    
    // Toggle Chat window Open / Close
    let isWindowOpen = false;
    let unreadCount = 0;
    let hasHistory = false;
    let hasInteracted = false;
    let welcomeTimeout = null;
    let popupTimeout = null;

    const showNotificationPopup = (title, text) => {
      if (isWindowOpen) return;
      const titleEl = notificationPopup.querySelector('.lt-notification-title');
      const textEl = notificationPopup.querySelector('.lt-notification-text');
      titleEl.textContent = title;
      textEl.textContent = text;
      notificationPopup.style.display = 'flex';
      
      if (popupTimeout) clearTimeout(popupTimeout);
      popupTimeout = setTimeout(() => {
        notificationPopup.style.display = 'none';
      }, 6000);
    };

    welcomeTimeout = setTimeout(() => {
      if (!isWindowOpen && !hasInteracted && !hasHistory) {
        showNotificationPopup(settings.headingText || 'Support Agent', settings.welcomeMessage || 'Hi there! How can we help you today?');
      }
    }, 3000);
    
    // Mobile close trigger helper (add close button in header on mobile)
    const addMobileCloseBtn = () => {
      const closeBtn = document.createElement('div');
      closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 15px;
        cursor: pointer;
        padding: 5px;
        display: none;
      `;
      closeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      `;
      header.appendChild(closeBtn);

      // Only show close icon on screens below 480px
      const mediaQuery = window.matchMedia('(max-width: 480px)');
      const handleMedia = (e) => {
        if (e.matches) closeBtn.style.display = 'block';
        else closeBtn.style.display = 'none';
      };
      mediaQuery.addListener(handleMedia);
      handleMedia(mediaQuery);

      closeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleChat(false);
      };
    };
    addMobileCloseBtn();

    const toggleChat = (forceOpen) => {
      isWindowOpen = forceOpen !== undefined ? forceOpen : !isWindowOpen;
      
      if (isWindowOpen) {
        // Reset unread counts and notifications
        unreadCount = 0;
        badge.textContent = '';
        badge.style.display = 'none';
        notificationPopup.style.display = 'none';
        hasInteracted = true;
        if (welcomeTimeout) clearTimeout(welcomeTimeout);
        if (popupTimeout) clearTimeout(popupTimeout);

        chatWindow.style.display = 'flex';
        // Force layout calculations for transition smooth states
        chatWindow.offsetHeight; 
        chatWindow.classList.add('open');
        triggerBtn.classList.add('open');
        
        let closeHtml = `
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        `;
        if (settings.launcherText) {
          closeHtml += `<span style="color: white; font-size: 14px; font-weight: 600; font-family: inherit;">Close</span>`;
        }
        triggerInner.innerHTML = closeHtml;

        setTimeout(() => {
          textInput.focus();
          scrollToBottom();
        }, 100);
      } else {
        chatWindow.classList.remove('open');
        triggerBtn.classList.remove('open');
        
        let openHtml = `
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
          </svg>
        `;
        if (settings.launcherText) {
          openHtml += `<span style="color: white; font-size: 14px; font-weight: 600; font-family: inherit;">${settings.launcherText}</span>`;
        }
        triggerInner.innerHTML = openHtml;

        setTimeout(() => {
          if (!chatWindow.classList.contains('open')) {
            chatWindow.style.display = 'none';
          }
        }, 300);
      }
    };

    triggerBtn.onclick = () => toggleChat();

    // ------------------------------------------
    // WEBSOCKETS COMMUNICATIONS
    // ------------------------------------------
    const socket = window.io(`${BACKEND_URL}/visitor`);
    let visitorProfile = {
      name: localStorage.getItem('letstrack_visitor_name') || '',
      email: localStorage.getItem('letstrack_visitor_email') || '',
      phoneNumber: localStorage.getItem('letstrack_visitor_phone') || ''
    };

    let locationAttempted = false;
    let cachedCoords = null;

    // Helper utility: Requests HTML5 coordinates safely
    const getPreciseLocation = () => {
      if (locationAttempted) {
        return Promise.resolve(cachedCoords);
      }
      locationAttempted = true;

      return new Promise((resolve) => {
        // Geolocation is optional.
        if (!navigator || !navigator.geolocation) {
          return resolve(null);
        }

        // Do not request location from iframe previews / embedded contexts (e.g. ManaCity website preview)
        try {
          if (window.self !== window.top) {
            return resolve(null);
          }
        } catch (e) {
          return resolve(null);
        }

        try {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              cachedCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
              resolve(cachedCoords);
            },
            () => {
              // Permission denied, blocked, unavailable, timeout, etc.
              resolve(null);
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 300000
            }
          );
        } catch (error) {
          // Geolocation is optional. Never break widget initialization.
          resolve(null);
        }
      });
    };


    // Helper to send visitor initialization state
    const sendVisitorInit = (coords = null) => {
      const browserInfo = getBrowserInfo();
      socket.emit('visitor-init', {
        apiKey: API_KEY,
        visitorId,
        currentUrl: window.location.pathname + window.location.search,
        referrer: document.referrer || 'Direct',
        name: visitorProfile.name,
        email: visitorProfile.email,
        phoneNumber: visitorProfile.phoneNumber,
        browser: browserInfo.browser,
        os: browserInfo.os,
        deviceType: browserInfo.deviceType,
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null
      });
    };

    socket.on('connect', async () => {
      const coords = await getPreciseLocation();
      sendVisitorInit(coords);
    });

    socket.on('visitor-init-success', (data) => {
      visitorProfile.name = data.name;
      
      // On revisit, if they are missing real contact details, show the form
      const hasRealName = visitorProfile.name && !visitorProfile.name.startsWith('Visitor #');
      const hasEmail = visitorProfile.email && visitorProfile.email.trim().length > 0;
      const hasPhone = visitorProfile.phoneNumber && visitorProfile.phoneNumber.trim().length > 0;
      const needsLeadCapture = !hasRealName || !hasEmail || !hasPhone;

      if (isRevisit && needsLeadCapture) {
        renderPreChatForm(true);
      } else if (!settings.preChatEnabled || hasRealName) {
        renderChatUI();
      } else {
        renderPreChatForm(false);
      }
    });

    // Handle incoming chat logs history
    socket.on('chat-history', (data) => {
      const { messages } = data;
      if (messages && messages.length > 0) {
        hasHistory = true;
        if (welcomeTimeout) clearTimeout(welcomeTimeout);
      }
      messages.forEach(msg => {
        appendMessage(msg.senderName, msg.senderType, msg.text, false);
      });
      scrollToBottom();
    });

    // Handle incoming real-time messages
    socket.on('msg-received', (message) => {
      // Cancel agent typing indicators on new messages
      typingIndicator.style.display = 'none';

      appendMessage(message.senderName, message.senderType, message.text, true);
      scrollToBottom();

      // Play audio notification chime if window is minimized or not active
      if (!isWindowOpen || message.senderType === 'Agent') {
        playChime();
      }

      // Show outer notification popup and increment unread badge if window is closed
      if (!isWindowOpen && message.senderType === 'Agent') {
        unreadCount++;
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
        showNotificationPopup(message.senderName, message.text);
      }
    });

    // Handle agent typing indicator state changes
    socket.on('agent-typing', (data) => {
      if (data.isTyping) {
        typingIndicator.style.display = 'flex';
        scrollToBottom();
      } else {
        typingIndicator.style.display = 'none';
      }
    });

    // Handle real-time URL path tracking
    let lastUrl = window.location.pathname + window.location.search;
    setInterval(() => {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        socket.emit('page-view', { currentUrl });
      }
    }, 2000);

    // ------------------------------------------
    // RENDER INTERACTION PANELS
    // ------------------------------------------
    function renderPreChatForm(isRevisitForm = false) {
      // Clear body
      body.innerHTML = '';
      
      const formWrap = document.createElement('div');
      formWrap.className = 'pre-chat-form';
      
      const welcomeText = isRevisitForm 
        ? "Welcome back! Please update or confirm your contact details to connect with us:" 
        : settings.welcomeMessage;
        
      let skipBtnHtml = '';
      if (isRevisitForm) {
        skipBtnHtml = `<button type="button" class="pre-chat-btn" id="prechat-skip" style="background-color: #6B7280; margin-top: 8px;">Skip & Chat</button>`;
      }

      formWrap.innerHTML = `
        <p class="pre-chat-text">${welcomeText}</p>
        <input type="text" class="pre-chat-input" id="prechat-name" placeholder="Your Name" value="${visitorProfile.name && !visitorProfile.name.startsWith('Visitor #') ? visitorProfile.name : ''}" required />
        <input type="email" class="pre-chat-input" id="prechat-email" placeholder="Your Email" value="${visitorProfile.email || ''}" />
        <input type="tel" class="pre-chat-input" id="prechat-phone" placeholder="Phone Number" value="${visitorProfile.phoneNumber || ''}" />
        <button type="button" class="pre-chat-btn" id="prechat-submit">Submit Details</button>
        ${skipBtnHtml}
      `;
      body.appendChild(formWrap);

      const submitBtn = formWrap.querySelector('#prechat-submit');
      const skipBtn = formWrap.querySelector('#prechat-skip');
      const nameInput = formWrap.querySelector('#prechat-name');
      const emailInput = formWrap.querySelector('#prechat-email');
      const phoneInput = formWrap.querySelector('#prechat-phone');

      submitBtn.onclick = () => {
        const nameVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();
        const phoneVal = phoneInput.value.trim();

        if (!nameVal) {
          nameInput.focus();
          return;
        }

        visitorProfile.name = nameVal;
        visitorProfile.email = emailVal;
        visitorProfile.phoneNumber = phoneVal;

        localStorage.setItem('letstrack_visitor_name', nameVal);
        localStorage.setItem('letstrack_visitor_email', emailVal);
        localStorage.setItem('letstrack_visitor_phone', phoneVal);

        // Re-authenticate visitor with updated credentials
        sendVisitorInit();
        renderChatUI();
      };

      if (skipBtn) {
        skipBtn.onclick = () => {
          renderChatUI();
        };
      }
    }

    function renderChatUI() {
      // Clear body of pre-chat templates and insert clean Welcome text bubble
      body.innerHTML = '';
      body.appendChild(typingIndicator); // Preserve typing drawer reference in the bottom

      appendMessage('System', 'System', settings.welcomeMessage, false);

      // Re-enable chat text forms
      textInput.removeAttribute('disabled');
      sendBtn.removeAttribute('disabled');

      // Bind text forms
      const triggerSendMessage = () => {
        const textVal = textInput.value.trim();
        if (!textVal) return;

        socket.emit('visitor-msg', { text: textVal });
        textInput.value = '';

        // Stop visitor typing immediately on send
        socket.emit('visitor-typing', { isTyping: false });
      };

      sendBtn.onclick = triggerSendMessage;
      textInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          triggerSendMessage();
          e.preventDefault();
        }
      };

      // Handle visitor typing indicators
      let typingTimeout = null;
      textInput.oninput = () => {
        socket.emit('visitor-typing', { isTyping: true });
        
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          socket.emit('visitor-typing', { isTyping: false });
        }, 2000);
      };
    }

    // Helper: append message elements
    function appendMessage(senderName, senderType, text, shouldScroll) {
      const msgWrap = document.createElement('div');
      msgWrap.className = `lt-msg-wrap ${senderType.toLowerCase()}`;

      let msgHtml = '';
      if (senderType !== 'System') {
        msgHtml += `<div class="lt-msg-sender">${senderName}</div>`;
      }
      msgHtml += `<div class="lt-msg-bubble">${text}</div>`;
      msgWrap.innerHTML = msgHtml;

      // Insert message right before typingIndicator if attached, otherwise append to body
      if (typingIndicator && typingIndicator.parentNode === body) {
        body.insertBefore(msgWrap, typingIndicator);
      } else {
        body.appendChild(msgWrap);
      }


      if (shouldScroll) {
        scrollToBottom();
      }
    }

    function scrollToBottom() {
      body.scrollTop = body.scrollHeight;
    }
  }

  // Helper utility: Lightens a hex color
  function lightenColor(color, percent) {
    let num = parseInt(color.replace("#",""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
  }

})();
