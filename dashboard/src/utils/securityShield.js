/**
 * LetsTrack Content & Privacy Protection Shield
 * Disables right-click, inspection, devtools shortcuts, print-to-PDF, and screenshot capture
 * with whitelist bypass for Admin, SuperAdmin, and authorized devices.
 */

export function initSecurityShield(getUser) {
  const isBypassed = () => {
    try {
      // 1. Check if user is SuperAdmin or Admin
      const currentUser = typeof getUser === 'function' ? getUser() : null;
      if (
        currentUser &&
        (currentUser.role === 'SuperAdmin' ||
          currentUser.role === 'Admin' ||
          currentUser.isSuperAdmin ||
          currentUser.email === 'rajugariventures@gmail.com')
      ) {
        return true;
      }

      // 2. Check local PC bypass key in localStorage
      if (localStorage.getItem('letstrack_security_bypass') === 'true') {
        return true;
      }

      // 3. Check localhost development environment
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return true;
      }
    } catch (e) {
      // fail safe
    }
    return false;
  };

  // 1. Disable Right Click (Context Menu)
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (isBypassed()) return;
      e.preventDefault();
      return false;
    },
    { capture: true }
  );

  // 2. Disable Key Shortcuts (Inspect, DevTools, View Source, Print, Save, Screenshot)
  window.addEventListener(
    'keydown',
    (e) => {
      // Secret Admin Unlock Shortcut: Ctrl + Alt + Shift + U
      if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
        const currentlyBypassed = localStorage.getItem('letstrack_security_bypass') === 'true';
        if (currentlyBypassed) {
          localStorage.removeItem('letstrack_security_bypass');
          alert('🔒 LetsTrack Security: Protection re-enabled on this device.');
        } else {
          localStorage.setItem('letstrack_security_bypass', 'true');
          alert('✅ LetsTrack Security: This PC is now permanently whitelisted!');
        }
        return;
      }

      if (isBypassed()) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // F12 (DevTools)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        try {
          navigator.clipboard?.writeText?.('');
        } catch (_) {}
        return false;
      }

      // Ctrl/Cmd + Shift + I (Inspect), J (Console), C (Element Inspector)
      if (
        ctrlOrCmd &&
        e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl/Cmd + U (View Source)
      if (ctrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl/Cmd + S (Save HTML / Webpage)
      if (ctrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl/Cmd + P (Print / PDF capture)
      if (ctrlOrCmd && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    { capture: true }
  );

  // 3. Screen Capture / Snip mitigation: Blur content when window loses focus (Snipping tool / screenshot activation)
  window.addEventListener('blur', () => {
    if (isBypassed()) return;
    document.body.classList.add('lt-privacy-shield-active');
  });

  window.addEventListener('focus', () => {
    document.body.classList.remove('lt-privacy-shield-active');
  });

  // 4. Update body classes for protected mode vs admin mode
  const updateBodyClass = () => {
    if (isBypassed()) {
      document.body.classList.remove('lt-protected-mode');
    } else {
      document.body.classList.add('lt-protected-mode');
    }
  };

  updateBodyClass();
  setInterval(updateBodyClass, 2000);

  // Global console helpers for your PC
  window.whitelistMyPC = () => {
    localStorage.setItem('letstrack_security_bypass', 'true');
    console.log('%c[LetsTrack Security] This PC is now permanently whitelisted!', 'color: #10B981; font-weight: bold; font-size: 14px;');
    alert('✅ LetsTrack Security: This PC is now permanently whitelisted!');
  };

  window.protectMyPC = () => {
    localStorage.removeItem('letstrack_security_bypass');
    console.log('%c[LetsTrack Security] Whitelist removed. Protection enabled.', 'color: #EF4444; font-weight: bold; font-size: 14px;');
    alert('🔒 LetsTrack Security: Protection re-enabled for this PC.');
  };
}
