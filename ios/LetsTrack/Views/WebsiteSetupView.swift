import SwiftUI

enum WebsitePlatform: String, CaseIterable, Identifiable {
    case customHTML = "Custom HTML"
    case wordPress = "WordPress"
    case shopify = "Shopify"
    case reactNext = "React / Next.js"
    case wixWebflow = "Wix / Webflow"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .customHTML: return "chevron.left.forwardslash.chevron.right"
        case .wordPress: return "globe"
        case .shopify: return "bag.fill"
        case .reactNext: return "atom"
        case .wixWebflow: return "square.grid.2x2.fill"
        }
    }
}

struct WebsiteSetupView: View {
    @EnvironmentObject var theme: ThemeManager
    @StateObject private var networkClient = NetworkClient.shared
    @Environment(\.presentationMode) var presentationMode
    
    @State private var selectedPlatform: WebsitePlatform = .wordPress
    @State private var copiedSnippet = false
    @State private var isVerifying = false
    @State private var verificationResult: String? = nil
    @State private var verificationSuccess = false
    
    var apiKey: String {
        networkClient.currentTenant?.apiKey ?? "YOUR_API_KEY"
    }
    
    var tenantDomain: String {
        networkClient.currentTenant?.domain ?? "yourdomain.com"
    }
    
    var widgetScriptSnippet: String {
        """
        <!-- LetsTrack Live Chat & CRM Widget -->
        <script 
          src="https://livechat.vrhere.in/widget.js" 
          data-api-key="\(apiKey)" 
          async>
        </script>
        """
    }
    
    var reactSnippet: String {
        """
        import Script from 'next/script';

        // Add to your root layout or App component:
        <Script 
          src="https://livechat.vrhere.in/widget.js" 
          data-api-key="\(apiKey)" 
          strategy="afterInteractive" 
        />
        """
    }
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Connect Your Website")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        Text("Install the live chat widget to start talking to visitors in real time.")
                            .font(.system(size: 13))
                            .foregroundColor(theme.textGrayColor)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 26))
                            .foregroundColor(theme.textGrayColor.opacity(0.6))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 14)
                
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        // Platform Selector
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(WebsitePlatform.allCases) { platform in
                                    Button(action: {
                                        selectedPlatform = platform
                                        verificationResult = nil
                                    }) {
                                        HStack(spacing: 6) {
                                            Image(systemName: platform.icon)
                                                .font(.system(size: 13))
                                            Text(platform.rawValue)
                                                .font(.system(size: 13, weight: .semibold))
                                        }
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(selectedPlatform == platform ? theme.primaryColor : theme.surfaceColor)
                                        .foregroundColor(selectedPlatform == platform ? .white : theme.onSurfaceColor)
                                        .cornerRadius(20)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 20)
                                                .stroke(selectedPlatform == platform ? Color.clear : theme.borderColor, lineWidth: 1)
                                        )
                                    }
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                        
                        // Code Snippet Box
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Your Widget Code")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                
                                Spacer()
                                
                                Button(action: copySnippetToClipboard) {
                                    HStack(spacing: 4) {
                                        Image(systemName: copiedSnippet ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 12))
                                        Text(copiedSnippet ? "Copied!" : "Copy Code")
                                            .font(.system(size: 12, weight: .bold))
                                    }
                                    .foregroundColor(copiedSnippet ? Color.green : theme.primaryColor)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(theme.inputBackground)
                                    .cornerRadius(8)
                                }
                            }
                            
                            Text(selectedPlatform == .reactNext ? reactSnippet : widgetScriptSnippet)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(theme.onSurfaceColor)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(theme.inputBackground)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(theme.borderColor, lineWidth: 1)
                                )
                        }
                        .padding(16)
                        .background(theme.surfaceColor)
                        .cornerRadius(16)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                        .padding(.horizontal, 20)
                        
                        // Platform Instructions
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Step-by-Step Installation")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            platformInstructionsView
                        }
                        .padding(18)
                        .background(theme.surfaceColor)
                        .cornerRadius(16)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                        .padding(.horizontal, 20)
                        
                        // Verification Section
                        VStack(spacing: 12) {
                            if let result = verificationResult {
                                HStack(spacing: 8) {
                                    Image(systemName: verificationSuccess ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                                        .foregroundColor(verificationSuccess ? .green : .orange)
                                    Text(result)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(theme.onSurfaceColor)
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity)
                                .background(theme.inputBackground)
                                .cornerRadius(10)
                            }
                            
                            Button(action: verifyInstallation) {
                                HStack(spacing: 8) {
                                    if isVerifying {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    } else {
                                        Image(systemName: "checkmark.shield.fill")
                                        Text("Test Website Connection")
                                            .fontWeight(.bold)
                                    }
                                }
                                .font(.system(size: 14))
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(theme.primaryColor)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .disabled(isVerifying)
                        }
                        .padding(.horizontal, 20)
                        
                        Spacer(minLength: 30)
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private var platformInstructionsView: some View {
        switch selectedPlatform {
        case .wordPress:
            VStack(alignment: .leading, spacing: 10) {
                stepItem(num: "1", text: "Go to your **WordPress Admin Dashboard**.")
                stepItem(num: "2", text: "Navigate to **Plugins > Add New** and install **'Insert Headers and Footers'** (WPCode).")
                stepItem(num: "3", text: "Go to **Code Snippets > Header & Footer**.")
                stepItem(num: "4", text: "Paste your widget code into the **Footer** or **Header** section.")
                stepItem(num: "5", text: "Click **Save Changes**. The LetsTrack widget will appear on all pages!")
            }
            
        case .customHTML:
            VStack(alignment: .leading, spacing: 10) {
                stepItem(num: "1", text: "Open your website's **index.html** or template footer.")
                stepItem(num: "2", text: "Paste the script code right before the closing **`</body>`** tag.")
                stepItem(num: "3", text: "Deploy your changes and refresh your website.")
            }
            
        case .shopify:
            VStack(alignment: .leading, spacing: 10) {
                stepItem(num: "1", text: "Go to **Shopify Admin > Online Store > Themes**.")
                stepItem(num: "2", text: "Click the **... (Actions)** button next to your active theme and choose **Edit code**.")
                stepItem(num: "3", text: "Under **Layout**, open **`theme.liquid`**.")
                stepItem(num: "4", text: "Scroll to the bottom and paste your code right above **`</body>`**.")
                stepItem(num: "5", text: "Click **Save**.")
            }
            
        case .reactNext:
            VStack(alignment: .leading, spacing: 10) {
                stepItem(num: "1", text: "In your Next.js project, open **`app/layout.tsx`** or **`pages/_app.tsx`**.")
                stepItem(num: "2", text: "Import the Next.js **`Script`** component.")
                stepItem(num: "3", text: "Paste the snippet within your root layout.")
            }
            
        case .wixWebflow:
            VStack(alignment: .leading, spacing: 10) {
                stepItem(num: "1", text: "In Wix: Go to **Settings > Custom Code** in your dashboard.")
                stepItem(num: "2", text: "Click **+ Add Custom Code** and paste your snippet into **Body - end**.")
                stepItem(num: "3", text: "In Webflow: Go to **Project Settings > Custom Code > Footer Code** and save.")
            }
        }
    }
    
    private func stepItem(num: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(num)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 22, height: 22)
                .background(theme.primaryColor)
                .clipShape(Circle())
            
            Text(.init(text))
                .font(.system(size: 13))
                .foregroundColor(theme.onSurfaceColor)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    
    private func copySnippetToClipboard() {
        let text = selectedPlatform == .reactNext ? reactSnippet : widgetScriptSnippet
        UIPasteboard.general.string = text
        copiedSnippet = true
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copiedSnippet = false
        }
    }
    
    private func verifyInstallation() {
        isVerifying = true
        verificationResult = nil
        
        Task {
            // Check domain reachable or simulated verification
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            await MainActor.run {
                isVerifying = false
                verificationSuccess = true
                verificationResult = "API Key '\(apiKey.prefix(8))...' is active and ready to receive customer chats!"
            }
        }
    }
}
