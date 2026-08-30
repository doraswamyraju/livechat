(function() {
  console.log('[LetsTrack] Widget script starting');

  // Ensure widget config exists or auto-detect from script tag attribute
  let apiKey = window.LetsTrackConfig ? window.LetsTrackConfig.websiteId : null;
  if (!apiKey) {
    const currentScript = document.currentScript || document.querySelector('script[data-api-key]');
    if (currentScript) {
      apiKey = currentScript.getAttribute('data-api-key');
    }
  }

  console.log('[LetsTrack] API key source:', 
    window.LetsTrackConfig?.websiteId
      ? 'LetsTrackConfig'
      : document.querySelector('script[data-api-key]')
        ? 'data-api-key'
        : 'missing'
  );
  console.log('[LetsTrack] API key detected:', !!apiKey);

  if (!apiKey) {
    console.error("LetsTrack: Missing websiteId (API key) in LetsTrackConfig or data-api-key attribute.");
    return;
  }

  const API_KEY = apiKey;
  const BACKEND_URL = '__BACKEND_URL__'; // Dynamically replaced by server at runtime
  console.log('[LetsTrack] BACKEND_URL:', BACKEND_URL);

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
      script.onerror = () =>
        reject(new Error("LetsTrack failed to load Socket.io client."));
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

  // Safe default widget settings
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

  let widgetSettings = defaultSettings;
  let widgetInitialized = false;

  console.log('[LetsTrack] Loading widget settings');

  // Fetch widget customizations asynchronously
  fetch(`${BACKEND_URL}/api/settings/widget?apiKey=${encodeURIComponent(API_KEY)}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Settings fetch failed: HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(settings => {
      console.log('[LetsTrack] Widget settings loaded');
      widgetSettings = {
        ...defaultSettings,
        ...(settings || {})
      };
      console.log('[LetsTrack] Rendering widget');
      initWidget(widgetSettings);
    })
    .catch(err => {
      console.warn('[LetsTrack] Widget settings unavailable. Using defaults.', err);
      widgetSettings = defaultSettings;
      console.log('[LetsTrack] Rendering widget');
      initWidget(widgetSettings);
    });

  // Main UI builder using Shadow DOM
  function initWidget(settings) {
    if (widgetInitialized) {
      console.warn('[LetsTrack] Widget already initialized.');
      return;
    }
    if (document.getElementById('letstrack-widget-root')) {
      return;
    }

    widgetInitialized = true;
    console.log('[LetsTrack] initWidget() started');

    const container = document.createElement('div');
    container.id = 'letstrack-widget-root';
    document.body.appendChild(container);

    console.log('[LetsTrack] Widget DOM mounted');

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
      .lt-chat-header {
        background: ${settings.useGradient ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.gradientColor})` : settings.primaryColor};
        color: ${settings.headerTextColor};
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      }
      .lt-chat-title {
        font-weight: 700;
        font-size: 18px;
        margin: 0;
      }
      .lt-chat-subtitle {
        font-size: 12px;
        opacity: 0.85;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lt-online-dot {
        width: 8px;
        height: 8px;
        background-color: #10B981;
        border-radius: 50%;
        display: inline-block;
      }
      .lt-close-btn {
        background: none;
        border: none;
        color: ${settings.headerTextColor};
        cursor: pointer;
        opacity: 0.8;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .lt-close-btn:hover {
        opacity: 1;
      }

      /* Messages Scrollable Body */
      .lt-chat-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #F9FAFB;
      }
      .lt-msg-wrap {
        display: flex;
        flex-direction: column;
        max-width: 80%;
      }
      .lt-msg-wrap.visitor {
        align-self: flex-end;
      }
      .lt-msg-wrap.agent, .lt-msg-wrap.system {
        align-self: flex-start;
      }
      .lt-msg-bubble {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.4;
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
        color: #92400E;
        font-size: 12px;
        border-radius: 12px;
        text-align: center;
      }
      .lt-msg-sender {
        font-size: 11px;
        color: #6B7280;
        margin-bottom: 4px;
        padding: 0 4px;
      }

      /* Pre-chat Form */
      .pre-chat-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px;
      }
      .pre-chat-text {
        font-size: 13px;
        color: #4B5563;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .pre-chat-input {
        padding: 10px 14px;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }
      .pre-chat-input:focus {
        border-color: ${settings.primaryColor};
      }
      .pre-chat-btn {
        padding: 12px;
        background-color: ${settings.primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        margin-top: 4px;
        transition: opacity 0.2s;
      }
      .pre-chat-btn:hover {
        opacity: 0.9;
      }

      /* Input Footer Bar */
      .lt-chat-footer {
        padding: 12px 16px;
        background: white;
        border-top: 1px solid #E5E7EB;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lt-chat-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 14px;
        color: #1F2937;
        background: transparent;
      }
      .lt-chat-input::placeholder {
        color: #9CA3AF;
      }
      .lt-send-btn {
        background: none;
        border: none;
        color: ${settings.primaryColor};
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.1s;
      }
      .lt-send-btn:hover {
        transform: scale(1.1);
      }
      .lt-send-btn:disabled, .lt-chat-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Badge */
      .lt-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background-color: #EF4444;
        color: white;
        font-size: 11px;
        font-weight: bold;
        height: 18px;
        min-width: 18px;
        border-radius: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      /* Typing indicator */
      .typing-indicator {
        display: none;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: #E5E7EB;
        border-radius: 12px;
        width: fit-content;
        margin-top: 4px;
      }
      .typing-dot {
        width: 6px;
        height: 6px;
        background: #6B7280;
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out;
      }
      .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      /* Notification Toast Outer Popup */
      .lt-popup {
        position: fixed;
        bottom: 85px;
        ${settings.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
        width: 280px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        padding: 14px;
        display: none;
        flex-direction: column;
        gap: 6px;
        z-index: 999998;
        border-left: 4px solid ${settings.primaryColor};
        animation: popupSlideIn 0.3s ease-out;
      }
      @keyframes popupSlideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .lt-popup-title {
        font-size: 13px;
        font-weight: 700;
        color: #1F2937;
      }
      .lt-popup-text {
        font-size: 12px;
        color: #4B5563;
        line-height: 1.3;
      }
    `;

    // DOM Structure
    const rootContainer = document.createElement('div');
    rootContainer.className = 'lt-widget-container';

    // Outer notification toast popup
    const popup = document.createElement('div');
    popup.className = 'lt-popup';
    popup.innerHTML = `
      <div class="lt-popup-title">New Message</div>
      <div class="lt-popup-text">...</div>
    `;

    // Drawer Window
    const chatWindow = document.createElement('div');
    chatWindow.className = 'lt-chat-window';
    chatWindow.innerHTML = `
      <div class="lt-chat-header">
        <div>
          <div class="lt-chat-title">${settings.headingText}</div>
          <div class="lt-chat-subtitle">
            <span class="lt-online-dot"></span> ${settings.statusText}
          </div>
        </div>
        <button class="lt-close-btn" id="lt-close-btn" aria-label="Close Chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="lt-chat-body" id="lt-chat-body">
        <div class="typing-indicator" id="lt-typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
      <div class="lt-chat-footer">
        <input type="text" class="lt-chat-input" id="lt-chat-input" placeholder="Type a message..." disabled />
        <button class="lt-send-btn" id="lt-send-btn" disabled aria-label="Send Message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </div>
      ${!settings.hideBranding ? `
        <div class="lt-branding-footer" style="padding: 6px 12px; background: #f3f4f6; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; gap: 4px;">
          <span>⚡ Powered by</span>
          <a href="https://letstrack.manacity.in" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; text-decoration: none; font-weight: 600;">LetsTrack</a>
        </div>
      ` : ''}
    `;

    // Trigger Button
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'lt-widget-btn';
    triggerBtn.setAttribute('aria-label', 'Open Chat');

    const launcherLabel = settings.launcherText 
      ? `<span style="color: white; font-weight: 600; font-size: 14px;">${settings.launcherText}</span>` 
      : '';

    triggerBtn.innerHTML = `
      <div class="lt-badge" id="lt-badge">0</div>
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
      </svg>
      ${launcherLabel}
    `;

    rootContainer.appendChild(chatWindow);
    rootContainer.appendChild(triggerBtn);

    shadow.appendChild(style);
    shadow.appendChild(rootContainer);
    shadow.appendChild(popup);

    // Dynamic Elements References
    const closeBtn = shadow.querySelector('#lt-close-btn');
    const body = shadow.querySelector('#lt-chat-body');
    const textInput = shadow.querySelector('#lt-chat-input');
    const sendBtn = shadow.querySelector('#lt-send-btn');
    const badge = shadow.querySelector('#lt-badge');
    const typingIndicator = shadow.querySelector('#lt-typing-indicator');

    let isWindowOpen = false;
    let unreadCount = 0;
    let welcomeTimeout = null;
    let hasHistory = false;

    // Toggle Chat Window
    const toggleChat = () => {
      isWindowOpen = !isWindowOpen;
      if (isWindowOpen) {
        chatWindow.classList.add('open');
        triggerBtn.classList.add('open');
        popup.style.display = 'none';

        // Clear unread badge
        unreadCount = 0;
        badge.style.display = 'none';
        badge.textContent = '0';

        // Auto-focus input
        setTimeout(() => textInput.focus(), 150);
      } else {
        chatWindow.classList.remove('open');
        triggerBtn.classList.remove('open');
      }
    };

    closeBtn.onclick = () => toggleChat();

    // Helper: Show Toast Notification
    function showNotificationPopup(senderName, messageText) {
      const popupTitle = popup.querySelector('.lt-popup-title');
      const popupText = popup.querySelector('.lt-popup-text');

      popupTitle.textContent = senderName || 'Support Agent';
      popupText.textContent = messageText;
      popup.style.display = 'flex';

      popup.onclick = () => {
        if (!isWindowOpen) toggleChat();
        popup.style.display = 'none';
      };

      setTimeout(() => {
        popup.style.display = 'none';
      }, 6000);
    }

    triggerBtn.onclick = () => toggleChat();

    // ------------------------------------------
    // WEBSOCKETS COMMUNICATIONS (ASYNCHRONOUS & OPTIONAL)
    // ------------------------------------------
    let socket = null;
    let socketReady = false;

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
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
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
      if (!socket || !socketReady) return;
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

    function bindSocketEvents() {
      if (!socket) return;

      socket.on('connect', async () => {
        console.log('[LetsTrack] Socket connected');
        socketReady = true;
        const coords = await getPreciseLocation();
        sendVisitorInit(coords);
      });

      socket.on('connect_error', (err) => {
        console.warn('[LetsTrack] Socket connect_error:', err ? err.message : err);
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
    }

    // Handle real-time URL path tracking
    let lastUrl = window.location.pathname + window.location.search;
    setInterval(() => {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (socket && socketReady) {
          socket.emit('page-view', { currentUrl });
        }
      }
    }, 2000);

    const initializeSocket = async () => {
      console.log('[LetsTrack] Loading Socket.io');
      try {
        await loadSocketScript();

        if (!window.io) {
          throw new Error('Socket.io client unavailable after script load');
        }

        console.log('[LetsTrack] Socket.io loaded');
        socket = window.io(`${BACKEND_URL}/visitor`);
        socketReady = true;

        bindSocketEvents();

      } catch (error) {
        console.warn(
          '[LetsTrack] Live connection unavailable. Widget running in offline mode.',
          error
        );
        socketReady = false;
      }
    };

    // Render pre-chat form or initial chat state
    if (!settings.preChatEnabled) {
      renderChatUI();
    } else {
      renderPreChatForm(false);
    }

    // Initialize Socket.io after DOM/UI is completely mounted
    initializeSocket();

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

      // Enable chat text forms
      textInput.removeAttribute('disabled');
      sendBtn.removeAttribute('disabled');

      // Bind text forms
      const triggerSendMessage = () => {
        const textVal = textInput.value.trim();
        if (!textVal) return;

        if (!socket) {
          console.warn('[LetsTrack] Chat connection is not ready.');
          return;
        }

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
        if (socket) {
          socket.emit('visitor-typing', { isTyping: true });
        }
        
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          if (socket) {
            socket.emit('visitor-typing', { isTyping: false });
          }
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
