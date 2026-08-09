<?php
/**
 * Plugin Name: LetsTrack Tracking Widget
 * Plugin URI: https://livechat.vrhere.in
 * Description: Enables LetsTrack user tracking and chat widget on your WordPress site.
 * Version: 1.0.0
 * Author: LetsTrack Team
 * Author URI: https://livechat.vrhere.in
 * License: GPL2
 * Text Domain: letstrack-wp-plugin
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Main LetsTrack Plugin Class.
 */
class LetsTrack_WP_Plugin {

    /**
     * Constructor to initialize hooks.
     */
    public function __construct() {
        // Register settings in admin
        add_action( 'admin_init', array( $this, 'register_settings' ) );

        // Add menu item in settings
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );

        // Inject script onto frontend pages
        add_action( 'wp_footer', array( $this, 'inject_tracking_widget' ) );
    }

    /**
     * Register settings in the database.
     */
    public function register_settings() {
        register_setting( 'letstrack_options', 'letstrack_enabled', array(
            'type'              => 'integer',
            'sanitize_callback' => 'intval',
            'default'           => 0,
        ) );

        register_setting( 'letstrack_options', 'letstrack_website_id', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        ) );

        register_setting( 'letstrack_options', 'letstrack_backend_url', array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'http://localhost:5004',
        ) );
    }

    /**
     * Add options page under settings menu.
     */
    public function add_admin_menu() {
        $page_hook = add_options_page(
            __( 'LetsTrack Settings', 'letstrack-wp-plugin' ),
            'LetsTrack',
            'manage_options',
            'letstrack-settings',
            array( $this, 'render_admin_page' )
        );

        // Enqueue styles only on our specific settings page
        add_action( 'admin_print_styles-' . $page_hook, array( $this, 'enqueue_admin_assets' ) );
    }

    /**
     * Enqueue Google Fonts and custom CSS for the admin dashboard.
     */
    public function enqueue_admin_assets() {
        wp_enqueue_style(
            'letstrack-admin-fonts',
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap',
            array(),
            null
        );

        wp_enqueue_style(
            'letstrack-admin-style',
            plugins_url( 'admin-style.css', __FILE__ ),
            array(),
            '1.0.0'
        );
    }

    /**
     * Get the active backend URL.
     * Checks for constant override, then saved option, and falls back to production server.
     *
     * @return string
     */
    public function get_backend_url() {
        if ( defined( 'LETSTRACK_BACKEND_URL' ) ) {
            return LETSTRACK_BACKEND_URL;
        }

        $saved_url = get_option( 'letstrack_backend_url', '' );
        if ( ! empty( $saved_url ) ) {
            return $saved_url;
        }

        return 'https://livechat.vrhere.in';
    }

    /**
     * Render the admin settings page.
     */
    public function render_admin_page() {
        // Check capabilities
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $enabled    = get_option( 'letstrack_enabled', 0 );
        $website_id = get_option( 'letstrack_website_id', '' );

        $saved = isset( $_GET['settings-updated'] ) && $_GET['settings-updated'] === 'true';
        ?>
        <div class="wrap letstrack-admin-wrap">
            <?php if ( $saved ) : ?>
                <div class="letstrack-toast success">
                    <span class="toast-icon">⚡</span>
                    <span class="toast-msg"><?php _e( 'Settings updated successfully!', 'letstrack-wp-plugin' ); ?></span>
                </div>
            <?php endif; ?>

            <div class="letstrack-header">
                <div class="letstrack-logo-area">
                    <span class="letstrack-logo-icon">📡</span>
                    <div class="letstrack-logo-text">
                        <h1>LetsTrack</h1>
                        <p><?php _e( 'Real-time User Analytics & Chat Widget', 'letstrack-wp-plugin' ); ?></p>
                    </div>
                </div>
                <div class="letstrack-status-badge <?php echo ( $enabled && ! empty( $website_id ) ) ? 'active' : 'inactive'; ?>">
                    <span class="status-dot"></span>
                    <span class="status-text">
                        <?php 
                        if ( $enabled && ! empty( $website_id ) ) {
                            _e( 'Tracking Active', 'letstrack-wp-plugin' );
                        } else {
                            _e( 'Tracking Inactive', 'letstrack-wp-plugin' );
                        }
                        ?>
                    </span>
                </div>
            </div>

            <div class="letstrack-content-grid">
                <div class="letstrack-card main-settings">
                    <h2><?php _e( 'Configuration Panel', 'letstrack-wp-plugin' ); ?></h2>
                    <p class="section-desc"><?php _e( 'Enable tracking and connect your WordPress site to the LetsTrack service.', 'letstrack-wp-plugin' ); ?></p>

                    <form method="post" action="options.php">
                        <?php settings_fields( 'letstrack_options' ); ?>

                        <div class="form-group toggle-group">
                            <label for="letstrack_enabled">
                                <strong><?php _e( 'Enable LetsTrack Widget', 'letstrack-wp-plugin' ); ?></strong>
                                <span><?php _e( 'Toggle user tracking and chat widget visibility on the frontend of your site.', 'letstrack-wp-plugin' ); ?></span>
                            </label>
                            <label class="switch">
                                <input type="checkbox" id="letstrack_enabled" name="letstrack_enabled" value="1" <?php checked( 1, $enabled ); ?> />
                                <span class="slider round"></span>
                            </label>
                        </div>

                        <div class="form-group">
                            <label for="letstrack_website_id"><?php _e( 'Website API Key / ID', 'letstrack-wp-plugin' ); ?></label>
                            <input type="text" id="letstrack_website_id" name="letstrack_website_id" value="<?php echo esc_attr( $website_id ); ?>" placeholder="e.g. site_ab12cd34ef56..." class="regular-text code" required />
                            <p class="field-desc"><?php _e( 'Enter your unique website API Key from your LetsTrack account dashboard.', 'letstrack-wp-plugin' ); ?></p>
                        </div>

                        <div class="form-actions">
                            <input type="submit" name="submit" id="submit" class="button button-primary letstrack-btn" value="<?php esc_attr_e( 'Save Configuration', 'letstrack-wp-plugin' ); ?>" />
                        </div>
                    </form>
                </div>

                <div class="letstrack-card sidebar-card">
                    <h2><?php _e( 'Integration Guide', 'letstrack-wp-plugin' ); ?></h2>
                    <div class="guide-steps">
                        <div class="step">
                            <span class="step-num">1</span>
                            <div class="step-body">
                                <h3><?php _e( 'Create an Account', 'letstrack-wp-plugin' ); ?></h3>
                                <p><?php _e( 'Sign up at <a href="https://livechat.vrhere.in" target="_blank" style="color: #c084fc; text-decoration: none;">livechat.vrhere.in</a> and log in to your dashboard.', 'letstrack-wp-plugin' ); ?></p>
                            </div>
                        </div>
                        <div class="step">
                            <span class="step-num">2</span>
                            <div class="step-body">
                                <h3><?php _e( 'Get your API Key', 'letstrack-wp-plugin' ); ?></h3>
                                <p><?php _e( 'Add your WordPress website domain under your projects list and copy the generated Website ID.', 'letstrack-wp-plugin' ); ?></p>
                            </div>
                        </div>
                        <div class="step">
                            <span class="step-num">3</span>
                            <div class="step-body">
                                <h3><?php _e( 'Start Tracking', 'letstrack-wp-plugin' ); ?></h3>
                                <p><?php _e( 'Paste the ID above, enable the widget, and save. Tracking will begin immediately!', 'letstrack-wp-plugin' ); ?></p>
                            </div>
                        </div>
                    </div>

                    <div class="tech-specs">
                        <h3><?php _e( 'Technical Details', 'letstrack-wp-plugin' ); ?></h3>
                        <ul>
                            <li><strong><?php _e( 'Injection Hook:', 'letstrack-wp-plugin' ); ?></strong> <code>wp_footer</code></li>
                            <li><strong><?php _e( 'Target file:', 'letstrack-wp-plugin' ); ?></strong> <code>/widget.js</code></li>
                            <li><strong><?php _e( 'Dependencies:', 'letstrack-wp-plugin' ); ?></strong> Socket.io client</li>
                        </ul>
                    </div>

                    <div class="tech-specs" style="border-top: 1px solid rgba(255, 255, 255, 0.06); margin-top: 20px; padding-top: 20px;">
                        <h3><?php _e( 'SaaS Service Disclosures', 'letstrack-wp-plugin' ); ?></h3>
                        <p style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 12px;">
                            <?php _e( 'This plugin routes live chat sockets and analytical events through the external LetsTrack SaaS service.', 'letstrack-wp-plugin' ); ?>
                        </p>
                        <ul>
                            <li><strong><?php _e( 'Platform URL:', 'letstrack-wp-plugin' ); ?></strong> <a href="https://livechat.vrhere.in" target="_blank" style="color: #c084fc; text-decoration: none;">livechat.vrhere.in</a></li>
                            <li><strong><?php _e( 'Terms of Use:', 'letstrack-wp-plugin' ); ?></strong> <a href="https://livechat.vrhere.in/terms" target="_blank" style="color: #c084fc; text-decoration: none;">Terms &amp; Conditions</a></li>
                            <li><strong><?php _e( 'Privacy Policy:', 'letstrack-wp-plugin' ); ?></strong> <a href="https://livechat.vrhere.in/privacy" target="_blank" style="color: #c084fc; text-decoration: none;">Privacy Disclosures</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Inject the tracking widget into the website footer.
     */
    public function inject_tracking_widget() {
        $enabled     = get_option( 'letstrack_enabled', 0 );
        $website_id  = get_option( 'letstrack_website_id', '' );
        $backend_url = $this->get_backend_url();

        // If plugin is disabled or website ID is not set, do not inject.
        if ( ! $enabled || empty( $website_id ) ) {
            return;
        }

        // Standardize the URL by trimming trailing slashes
        $backend_url = rtrim( $backend_url, '/' );

        ?>
        <!-- LetsTrack Widget -->
        <script>
            window.LetsTrackConfig = {
                websiteId: '<?php echo esc_js( $website_id ); ?>'
            };
        </script>
        <script src="<?php echo esc_url( $backend_url . '/widget.js' ); ?>" async defer></script>
        <!-- End LetsTrack Widget -->
        <?php
    }
}

// Initialize the plugin.
new LetsTrack_WP_Plugin();
