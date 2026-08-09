# LetsTrack Tracking Widget - WordPress Plugin

Allows WordPress administrators to enable user tracking and the real-time chat widget via their LetsTrack dashboard settings page.

## SaaS Integration Disclosures

This plugin connects your website with the external **LetsTrack** Software-as-a-Service (SaaS) platform to handle analytics storage, event tracking, and live chat WebSockets communication.

- **LetsTrack Website:** [livechat.vrhere.in](https://livechat.vrhere.in)
- **Terms of Service:** [Terms & Conditions](https://livechat.vrhere.in/terms)
- **Privacy Disclosures:** [Privacy Policy](https://livechat.vrhere.in/privacy)

By enabling the tracking widget and configuring your Website API Key, you authorize sending non-sensitive page view analytics and live chat socket payloads to the LetsTrack backend servers.

---

## Features

- **Simple Integration:** Easily connect your WordPress frontend pages to your LetsTrack backend instance.
- **Premium Admin Interface:** Beautiful, dark-themed responsive administrative panel in WordPress settings.
- **Dynamic Script Injection:** Automatically injects the tracking configuration and loaded script via the `wp_footer` hook.
- **Secure Implementation:** Follows WordPress security guidelines, including strict nonces, capability checks, and outputs sanitization.

---

## Installation

### Method 1: Zipped Folder Upload (Recommended)

1. Compress the `letstrack-wp-plugin` directory into a `.zip` archive:
   ```bash
   zip -r letstrack-wp-plugin.zip letstrack-wp-plugin
   ```
2. Navigate to your WordPress Dashboard.
3. Click on **Plugins** -> **Add New** -> **Upload Plugin**.
4. Choose the `letstrack-wp-plugin.zip` file and click **Install Now**.
5. Once installed, click **Activate Plugin**.

### Method 2: Manual Installation via SFTP

1. Upload the `letstrack-wp-plugin` folder to your WordPress installation's `wp-content/plugins/` directory.
2. Go to **Plugins** -> **Installed Plugins** in your WordPress dashboard.
3. Locate **LetsTrack Tracking Widget** and click **Activate**.

---

## Configuration

1. After activation, navigate to **Settings** -> **LetsTrack** in your WordPress sidebar.
2. Toggle the **Enable LetsTrack Widget** setting.
3. Enter your unique **Website API Key / ID** obtained from your LetsTrack account dashboard.
4. Click **Save Configuration**.

---

## Local Development (For Developers)

If you are developing or hosting your own instance of the LetsTrack backend service locally, you can override the production endpoint URL by defining the `LETSTRACK_BACKEND_URL` constant in your website's `wp-config.php` file:
```php
define( 'LETSTRACK_BACKEND_URL', 'http://localhost:5004' );
```

---

## How It Works

Once active and configured, the plugin enqueues the tracking config parameters onto the webpage footer, injecting:
```html
<script>
    window.LetsTrackConfig = {
        websiteId: 'YOUR_WEBSITE_ID'
    };
</script>
<script src="https://livechat.vrhere.in/widget.js" async defer></script>
```

This dynamically loads the socket client library and sets up user analytics and active chat widgets matching the domain configuration.
