=== LetsTrack Tracking Widget ===
Contributors: letstrack-team
Tags: livechat, tracking, analytics, chat, user-tracking
Requires at least: 5.0
Tested up to: 6.5
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Easily enable the LetsTrack user tracking script and live chat widget on your WordPress site.

== Description ==

LetsTrack is a real-time visitor tracking and live chat communication service. This plugin acts as the integration client, allowing you to connect your WordPress site directly to the LetsTrack backend platform. 

By activating the plugin, you can monitor user engagements and interact with your site visitors instantly.

= SaaS Integration Disclosure & Terms =
This plugin relies on the external LetsTrack Software-as-a-Service (SaaS) platform to store and process analytics data and route live chat sockets. 
* LetsTrack Service URL: https://livechat.vrhere.in
* Terms of Use: https://livechat.vrhere.in/terms
* Privacy Policy & Data Collection Disclosures: https://livechat.vrhere.in/privacy

By enabling the tracking widget and inputting your Website API Key, you consent to sending non-sensitive page view analytics and live chat socket payloads to the LetsTrack backend servers.

== Installation ==

1. Upload the `letstrack-wp-plugin` directory to the `/wp-content/plugins/` directory of your site, or upload the zipped folder directly via **Plugins** -> **Add New** -> **Upload Plugin**.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Navigate to **Settings** -> **LetsTrack** in your sidebar.
4. Check the **Enable LetsTrack Widget** checkbox.
5. Paste your Website API Key / ID from your LetsTrack dashboard.
6. Click **Save Configuration** to activate the script integration.

== Frequently Asked Questions ==

= Where do I get my Website API Key? =
Sign in to your LetsTrack account dashboard (https://livechat.vrhere.in), add your website domain under your projects, and copy the unique Website ID/API Key.

= Does this plugin track personal data? =
No personal data (like names or emails) is tracked by default. Only persistent visitor UUIDs (stored in local storage) and current page URL paths are transmitted to sync active socket chats, unless a user explicitly provides their name/email inside the chat widget interface.

= Can I use this for local development? =
Yes. You can override the default backend URL by defining the `LETSTRACK_BACKEND_URL` constant in your website's `wp-config.php` file:
`define( 'LETSTRACK_BACKEND_URL', 'http://localhost:5004' );`

== Screenshots ==

1. The LetsTrack Admin settings dashboard page in WordPress.

== Changelog ==

= 1.0.0 =
* Initial release of the LetsTrack Tracking Widget plugin.
* Integrated dynamic footer hook script loading.
* Premium styled settings control page.
