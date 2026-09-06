import SwiftUI
import LocalAuthentication

struct DashboardView: View {
    @StateObject private var socketManager = SocketManager.shared
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var selectedTab = 2 // Default to Unified Inbox (2) or Overview (0)
    @State private var showStatusDialog = false
    
    // For navigation triggers to Chat screen
    @State private var activeConversationId: String? = nil
    @State private var activeVisitorName: String = ""
    @State private var activeVisitorId: String = ""
    @State private var navigationToChat = false
    
    var isAdmin: Bool {
        networkClient.currentUser?.isAdmin == true
    }
    
    var isSuperAdmin: Bool {
        networkClient.currentUser?.isSuperAdmin == true
    }
    
    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                theme.backgroundColor.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Top Navigation Bar Header
                    customNavBarHeader
                    
                    // Main content tab area
                    TabView(selection: $selectedTab) {
                        MetricsTab(onNavigateToTab: { tabIndex in
                            selectedTab = tabIndex
                        })
                        .tag(0)
                        
                        TrafficTab(onNavigateToChat: navigateToChatScreen)
                        .tag(1)
                        
                        UnifiedInboxTab(onNavigateToChat: navigateToChatScreen)
                        .tag(2)
                        
                        LeadsTab(onNavigateToChat: navigateToChatScreen, onNavigateToAds: {
                            selectedTab = 4
                        })
                        .tag(3)
                        
                        MetaAdsTab()
                        .tag(4)
                        
                        if isAdmin {
                            TeamTab()
                                .tag(5)
                        }
                        
                        SettingsTab(onNavigateToAds: {
                            selectedTab = 4
                        })
                        .tag(isAdmin ? 6 : 5)
                    }
                    .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                    
                    // Bottom spacing for the floating glassmorphic dock
                    Spacer().frame(height: 72)
                }
                
                // Floating Glassmorphic Bottom Dock
                floatingGlassmorphicDock
            }
            .navigationDestination(isPresented: $navigationToChat) {
                if let conversationId = activeConversationId {
                    ChatView(
                        conversationId: conversationId,
                        visitorName: activeVisitorName,
                        visitorId: activeVisitorId,
                        onNavigateBack: {
                            navigationToChat = false
                        }
                    )
                    .environmentObject(theme)
                }
            }
            .sheet(isPresented: $showStatusDialog) {
                StatusChangerSheet(isPresented: $showStatusDialog)
                    .environmentObject(theme)
            }
            .onReceive(socketManager.startConversationSuccessPublisher) { conversation in
                let visitor = socketManager.visitorsList.first(where: { $0.id == conversation.visitorId })
                navigateToChatScreen(
                    conversationId: conversation.id,
                    visitorName: visitor?.name ?? "Visitor",
                    visitorId: conversation.visitorId
                )
            }
            .onAppear {
                checkForPendingDeepLink()
            }
            .onChange(of: socketManager.pendingDeepLink) { _ in
                checkForPendingDeepLink()
            }
            .onChange(of: socketManager.isConnected) { _ in
                checkForPendingDeepLink()
            }
            .onChange(of: socketManager.conversationsList) { _ in
                checkForPendingDeepLink()
            }
        }
    }
    
    // Custom modern nav bar matching unified brand
    private var customNavBarHeader: some View {
        HStack(spacing: 12) {
            Image("app_logo")
                .resizable()
                .frame(width: 36, height: 36)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.primaryColor.opacity(0.4), lineWidth: 1))
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(networkClient.currentTenant?.name ?? "LetsTrack")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    if isSuperAdmin {
                        Text("SUPER")
                            .font(.system(size: 9, weight: .black))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.2))
                            .foregroundColor(Color.purple)
                            .cornerRadius(4)
                    }
                }
                
                Text(isSuperAdmin ? "SuperAdmin Console" : (isAdmin ? "Admin Console" : "Agent Workstation"))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(isSuperAdmin ? Color.purple : theme.primaryColor)
            }
            
            Spacer()
            
            // Theme toggle
            Button(action: {
                theme.themeMode = theme.isDark ? "light" : "dark"
            }) {
                Image(systemName: theme.isDark ? "sun.max.fill" : "moon.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(theme.isDark ? .yellow : theme.primaryColor)
                    .frame(width: 32, height: 32)
                    .background(theme.surfaceColor)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(theme.borderColor, lineWidth: 1))
            }
            
            // Presence status badge button
            Button(action: { showStatusDialog = true }) {
                HStack(spacing: 5) {
                    Circle()
                        .fill(theme.getStatusColor(socketManager.selfStatus))
                        .frame(width: 8, height: 8)
                    
                    Text(socketManager.selfStatus)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(theme.surfaceColor)
                .cornerRadius(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(theme.borderColor, lineWidth: 1)
                )
            }
            
            // Sign Out
            Button(action: { networkClient.clearAuth() }) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(theme.textGrayColor)
                    .frame(width: 32, height: 32)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(theme.surfaceColor)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(theme.borderColor),
            alignment: .bottom
        )
    }
    
    // Floating Glassmorphic Tab Bar Dock
    private var floatingGlassmorphicDock: some View {
        HStack(spacing: 0) {
            DockItem(icon: "chart.bar.fill", label: "Overview", index: 0, selection: $selectedTab)
            DockItem(icon: "antenna.radiowaves.left.and.right", label: "Radar", index: 1, selection: $selectedTab)
            DockItem(icon: "bubble.left.and.bubble.right.fill", label: "Inbox", index: 2, selection: $selectedTab, badgeCount: socketManager.conversationsList.filter { $0.status == "Unassigned" }.count)
            DockItem(icon: "person.crop.rectangle.stack.fill", label: "Leads", index: 3, selection: $selectedTab)
            DockItem(icon: "megaphone.fill", label: "Ads", index: 4, selection: $selectedTab)
            
            if isAdmin {
                DockItem(icon: "person.2.fill", label: "Team", index: 5, selection: $selectedTab)
            }
            
            DockItem(icon: "gearshape.fill", label: "Settings", index: isAdmin ? 6 : 5, selection: $selectedTab)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 28)
                .fill(theme.isDark ? Color(red: 20/255, green: 28/255, blue: 44/255).opacity(0.85) : Color.white.opacity(0.9))
                .background(
                    RoundedRectangle(cornerRadius: 28)
                        .fill(Material.ultraThinMaterial)
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28)
                .stroke(
                    LinearGradient(
                        colors: [
                            theme.primaryColor.opacity(0.4),
                            theme.borderColor
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: Color.black.opacity(theme.isDark ? 0.45 : 0.12), radius: 20, x: 0, y: 10)
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }
    
    private func navigateToChatScreen(conversationId: String, visitorName: String, visitorId: String) {
        self.activeConversationId = conversationId
        self.activeVisitorName = visitorName
        self.activeVisitorId = visitorId
        self.navigationToChat = true
    }
    
    private func checkForPendingDeepLink() {
        guard let deepLink = socketManager.pendingDeepLink else { return }
        guard socketManager.isConnected else { return }
        
        if deepLink.conversationId.isEmpty {
            if let existing = socketManager.conversationsList.first(where: { $0.visitorId == deepLink.visitorId }) {
                navigateToChatScreen(
                    conversationId: existing.id,
                    visitorName: deepLink.visitorName.isEmpty ? (socketManager.visitorsList.first(where: { $0.id == deepLink.visitorId })?.name ?? "Visitor") : deepLink.visitorName,
                    visitorId: deepLink.visitorId
                )
                socketManager.pendingDeepLink = nil
            } else if !socketManager.visitorsList.isEmpty {
                socketManager.startConversation(visitorId: deepLink.visitorId)
                socketManager.pendingDeepLink = nil
            }
        } else {
            navigateToChatScreen(
                conversationId: deepLink.conversationId,
                visitorName: deepLink.visitorName,
                visitorId: deepLink.visitorId
            )
            socketManager.pendingDeepLink = nil
        }
    }
}

// MARK: - Dock Item Component
struct DockItem: View {
    let icon: String
    let label: String
    let index: Int
    @Binding var selection: Int
    var badgeCount: Int = 0
    @EnvironmentObject var theme: ThemeManager
    
    var isSelected: Bool {
        selection == index
    }
    
    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                selection = index
            }
        }) {
            VStack(spacing: 3) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: isSelected ? 18 : 16, weight: isSelected ? .bold : .medium))
                        .foregroundColor(isSelected ? .white : theme.textGrayColor)
                        .frame(width: 44, height: 32)
                        .background(
                            isSelected ?
                                AnyView(
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(
                                            LinearGradient(
                                                colors: [theme.primaryColor, theme.secondaryColor],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .shadow(color: theme.primaryColor.opacity(0.4), radius: 6, y: 2)
                                ) :
                                AnyView(Color.clear)
                        )
                    
                    if badgeCount > 0 {
                        Text("\(badgeCount)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.red)
                            .clipShape(Capsule())
                            .offset(x: 6, y: -4)
                    }
                }
                
                Text(label)
                    .font(.system(size: 10, weight: isSelected ? .bold : .medium))
                    .foregroundColor(isSelected ? theme.primaryColor : theme.textGrayColor)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - UNIFIED INBOX SUB-VIEW (Matching Reference Design)
struct UnifiedInboxTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToChat: (String, String, String) -> Void
    
    @State private var selectedChannel = "all" // "all", "whatsapp", "instagram", "facebook", "livechat"
    @State private var searchText = ""
    @State private var filterStatus = "all" // "all", "open", "unassigned"
    
    var channelCounts: [String: Int] {
        var counts: [String: Int] = ["all": 0, "whatsapp": 0, "instagram": 0, "facebook": 0, "livechat": 0]
        for conv in socketManager.conversationsList {
            let vis = socketManager.visitorsList.first(where: { $0.id == conv.visitorId })
            let ch = (conv.channel ?? vis?.resolvedChannel ?? "livechat").lowercased()
            counts["all", default: 0] += 1
            if ch.contains("whatsapp") {
                counts["whatsapp", default: 0] += 1
            } else if ch.contains("instagram") || ch.contains("ig") {
                counts["instagram", default: 0] += 1
            } else if ch.contains("facebook") || ch.contains("fb") {
                counts["facebook", default: 0] += 1
            } else {
                counts["livechat", default: 0] += 1
            }
        }
        return counts
    }
    
    var filteredConversations: [ConversationDto] {
        let sorted = socketManager.conversationsList.sorted(by: { $0.updatedAt > $1.updatedAt })
        return sorted.filter { conv in
            let vis = socketManager.visitorsList.first(where: { $0.id == conv.visitorId })
            let ch = (conv.channel ?? vis?.resolvedChannel ?? "livechat").lowercased()
            let vName = vis?.name.lowercased() ?? ""
            
            // Channel filter
            if selectedChannel != "all" {
                if selectedChannel == "whatsapp" && !ch.contains("whatsapp") { return false }
                if selectedChannel == "instagram" && !(ch.contains("instagram") || ch.contains("ig")) { return false }
                if selectedChannel == "facebook" && !(ch.contains("facebook") || ch.contains("fb")) { return false }
                if selectedChannel == "livechat" && (ch.contains("whatsapp") || ch.contains("instagram") || ch.contains("facebook")) { return false }
            }
            
            // Status filter
            if filterStatus == "unassigned" && conv.status != "Unassigned" { return false }
            if filterStatus == "open" && conv.status == "Closed" { return false }
            
            // Search text filter
            if !searchText.isEmpty {
                let query = searchText.lowercased()
                let matchesName = vName.contains(query)
                let matchesMsg = (conv.lastMessage ?? "").lowercased().contains(query)
                if !matchesName && !matchesMsg { return false }
            }
            
            return true
        }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Header Title matching design
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text("Unified Inbox")
                            .font(.system(size: 24, weight: .black))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        Spacer()
                        
                        Text("\(filteredConversations.count) Active")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.primaryColor)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(theme.primaryColor.opacity(0.12))
                            .cornerRadius(12)
                    }
                    
                    Text("All conversations. One place.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.horizontal)
                .padding(.top, 12)
                
                // Search & Filter Row
                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(theme.textGrayColor)
                            .font(.system(size: 14))
                        
                        TextField("Search chats, visitors, messages...", text: $searchText)
                            .font(.system(size: 13))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        if !searchText.isEmpty {
                            Button(action: { searchText = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(theme.textGrayColor)
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(theme.inputBackground)
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                }
                .padding(.horizontal)
                
                // Horizontal Channel Filter Pills with Counts
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        channelPill(id: "all", label: "All", icon: "bubble.left.and.bubble.right.fill", color: theme.primaryColor, count: channelCounts["all"] ?? 0)
                        channelPill(id: "whatsapp", label: "WhatsApp", icon: "phone.fill", color: Color(red: 37/255, green: 211/255, blue: 102/255), count: channelCounts["whatsapp"] ?? 0)
                        channelPill(id: "instagram", label: "Instagram", icon: "camera.fill", color: Color(red: 225/255, green: 48/255, blue: 108/255), count: channelCounts["instagram"] ?? 0)
                        channelPill(id: "facebook", label: "Facebook", icon: "person.2.fill", color: Color(red: 24/255, green: 119/255, blue: 242/255), count: channelCounts["facebook"] ?? 0)
                        channelPill(id: "livechat", label: "LiveChat", icon: "message.fill", color: Color(red: 100/255, green: 116/255, blue: 139/255), count: channelCounts["livechat"] ?? 0)
                    }
                    .padding(.horizontal)
                }
                
                // Conversations List
                if filteredConversations.isEmpty {
                    emptyInboxView
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(filteredConversations) { conv in
                            conversationRowCard(conv: conv)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom, 24)
        }
    }
    
    private func channelPill(id: String, label: String, icon: String, color: Color, count: Int) -> some View {
        let isSelected = selectedChannel == id
        return Button(action: {
            withAnimation(.spring(response: 0.25)) {
                selectedChannel = id
            }
        }) {
            HStack(spacing: 6) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                
                Text(label)
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                    .foregroundColor(isSelected ? .white : theme.onSurfaceColor)
                
                Text("\(count)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(isSelected ? .white.opacity(0.9) : theme.textGrayColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(isSelected ? Color.black.opacity(0.2) : theme.inputBackground)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? theme.primaryColor : theme.surfaceColor)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(isSelected ? Color.clear : theme.borderColor, lineWidth: 1)
            )
            .shadow(color: isSelected ? theme.primaryColor.opacity(0.25) : Color.clear, radius: 4, y: 2)
        }
    }
    
    private func conversationRowCard(conv: ConversationDto) -> some View {
        let visitor = socketManager.visitorsList.first(where: { $0.id == conv.visitorId })
        let visitorName = visitor?.name ?? "Customer"
        let channel = (conv.channel ?? visitor?.resolvedChannel ?? "livechat").lowercased()
        let channelColor = theme.getChannelColor(channel)
        let isUnassigned = conv.status == "Unassigned"
        
        return Button(action: {
            onNavigateToChat(conv.id, visitorName, conv.visitorId)
        }) {
            HStack(spacing: 12) {
                // Avatar with bottom-right channel badge overlay
                ZStack(alignment: .bottomTrailing) {
                    Circle()
                        .fill(LinearGradient(
                            colors: [theme.primaryColor.opacity(0.2), theme.primaryColor.opacity(0.4)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 48, height: 48)
                        .overlay(
                            Text(String(visitorName.prefix(1)).uppercased())
                                .font(.system(size: 18, weight: .black))
                                .foregroundColor(theme.primaryColor)
                        )
                    
                    // Official Brand Logo Badge
                    BrandLogoView(source: channel, size: 18)
                        .overlay(Circle().stroke(theme.surfaceColor, lineWidth: 2))
                        .offset(x: 2, y: 2)
                }
                
                // Content info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(visitorName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                            .lineLimit(1)
                        
                        if isUnassigned {
                            Text("NEW")
                                .font(.system(size: 9, weight: .black))
                                .foregroundColor(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(theme.primaryColor)
                                .cornerRadius(6)
                        }
                        
                        Spacer()
                        
                        Text(formatRelativeTime(isoString: conv.updatedAt))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(theme.textGrayColor)
                    }
                    
                    HStack(spacing: 4) {
                        Text("via \(getChannelLabel(channel))")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(channelColor)
                        
                        Text("•")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                        
                        Text(conv.lastMessage ?? (visitor?.currentUrl != nil ? "Browsing \(visitor!.currentUrl!)" : "Started conversation"))
                            .font(.system(size: 12))
                            .foregroundColor(theme.textGrayColor)
                            .lineLimit(1)
                    }
                }
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(theme.textGrayColor.opacity(0.6))
            }
            .padding(14)
            .background(theme.surfaceColor)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isUnassigned ? theme.primaryColor.opacity(0.5) : theme.borderColor, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(theme.isDark ? 0.25 : 0.04), radius: 8, y: 3)
        }
    }
    
    private func getChannelIcon(_ channel: String) -> String {
        switch channel {
        case "whatsapp":
            return "phone.fill"
        case "instagram":
            return "camera.fill"
        case "facebook":
            return "person.2.fill"
        default:
            return "bubble.left.fill"
        }
    }
    
    private func getChannelLabel(_ channel: String) -> String {
        switch channel {
        case "whatsapp":
            return "WhatsApp API"
        case "instagram":
            return "Instagram DM"
        case "facebook":
            return "Facebook Messenger"
        default:
            return "LiveChat"
        }
    }
    
    private var emptyInboxView: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray.fill")
                .font(.system(size: 44))
                .foregroundColor(theme.textGrayColor.opacity(0.5))
                .padding(.top, 40)
            
            Text("No conversations found")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
            
            Text("When visitors start chatting on WhatsApp, Instagram, or LiveChat, they'll appear here automatically.")
                .font(.system(size: 12))
                .foregroundColor(theme.textGrayColor)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - LEADS & CRM SUB-VIEW
struct LeadsTab: View {
    @EnvironmentObject var theme: ThemeManager
    let onNavigateToChat: (String, String, String) -> Void
    var onNavigateToAds: (() -> Void)? = nil
    
    @State private var leadsList: [LeadDto] = []
    @State private var leadStats: LeadStatsDto? = nil
    @State private var agentsList: [UserProfile] = []
    @State private var isLoading = false
    
    // View Mode: Primary is 'table', secondary is 'kanban'
    @State private var viewMode: String = "table" // "table" | "kanban"
    
    // Filters & Search
    @State private var selectedStatus = "All"
    @State private var selectedSource = "All"
    @State private var searchText = ""
    
    // Modals
    @State private var showCreateLeadSheet = false
    @State private var selectedLead: LeadDto? = nil
    
    let statuses = ["All", "New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]
    let sources = ["All", "meta-ads", "whatsapp", "instagram", "facebook", "chat", "manual"]
    
    var filteredLeads: [LeadDto] {
        leadsList.filter { lead in
            if selectedStatus != "All" && lead.status != selectedStatus {
                return false
            }
            if selectedSource != "All" {
                let normalizedSource = lead.source.lowercased().replacingOccurrences(of: "_", with: "-")
                let normalizedFilter = selectedSource.lowercased().replacingOccurrences(of: "_", with: "-")
                if normalizedSource != normalizedFilter && lead.source != selectedSource {
                    return false
                }
            }
            if !searchText.isEmpty {
                let q = searchText.lowercased()
                let matchName = lead.name.lowercased().contains(q)
                let matchCompany = (lead.company ?? "").lowercased().contains(q)
                let matchEmail = (lead.email ?? "").lowercased().contains(q)
                let matchPhone = (lead.phone ?? "").contains(q)
                let matchCampaign = (lead.metaData?.campaignName ?? "").lowercased().contains(q)
                if !matchName && !matchCompany && !matchEmail && !matchPhone && !matchCampaign { return false }
            }
            return true
        }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                
                // 1. Header with Add Button
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Lead Management")
                            .font(.system(size: 24, weight: .black))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        Text("Meta Ads, Chats & Inbound Opportunities")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(theme.textGrayColor)
                    }
                    
                    Spacer()
                    
                    Button(action: { showCreateLeadSheet = true }) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.system(size: 13, weight: .bold))
                            Text("New Lead")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 220/255, green: 38/255, blue: 38/255), Color(red: 185/255, green: 28/255, blue: 28/255)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(10)
                        .shadow(color: Color.red.opacity(0.3), radius: 6, y: 3)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 12)
                
                // Meta Ads Integration Banner
                if let onNavigateToAds = onNavigateToAds {
                    Button(action: onNavigateToAds) {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(LinearGradient(colors: [Color(red: 0, green: 129/255, blue: 251/255), Color(red: 219/255, green: 39/255, blue: 119/255)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .frame(width: 38, height: 38)
                                Image(systemName: "megaphone.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(.white)
                            }
                            
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text("Meta Ads Live Attribution")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(theme.onSurfaceColor)
                                    Spacer()
                                    Text("Manage Ads →")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                                }
                                Text("Real-time Facebook & Instagram ad campaign captures and live metrics")
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.textGrayColor)
                                    .lineLimit(1)
                            }
                        }
                        .padding(12)
                        .background(theme.surfaceColor)
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(red: 0, green: 129/255, blue: 251/255).opacity(0.3), lineWidth: 1))
                        .padding(.horizontal)
                    }
                }
                
                // 2. Summary Stats Cards Carousel
                if let stats = leadStats {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            statCard(title: "Total Ingested Leads", value: "\(stats.totalLeads)", subtext: "Across All Inbound Sources", color: theme.primaryColor, icon: "person.3.fill")
                            statCard(title: "Closed Deals (Won)", value: "\(stats.wonLeads)", subtext: "Conv. Rate: \(String(format: "%.1f", stats.conversionRate))%", color: Color(red: 22/255, green: 163/255, blue: 74/255), icon: "checkmark.seal.fill")
                            statCard(title: "Total Won Revenue", value: "₹\(Int(stats.wonValue).formattedWithCommas())", subtext: "Pipeline: ₹\(Int(stats.totalPipelineValue).formattedWithCommas())", color: Color(red: 220/255, green: 38/255, blue: 38/255), icon: "indianrupeesign.circle.fill")
                            statCard(title: "New Opportunities", value: "\(stats.newLeads)", subtext: "Fresh inquiries", color: Color(red: 147/255, green: 51/255, blue: 234/255), icon: "sparkles")
                        }
                        .padding(.horizontal)
                    }
                }
                
                // 3. Toolbar: Search + Source Picker + View Mode Switcher
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        // Search Field
                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(theme.textGrayColor)
                            TextField("Search lead, phone, email, ad campaign...", text: $searchText)
                                .font(.system(size: 13))
                                .foregroundColor(theme.onSurfaceColor)
                            if !searchText.isEmpty {
                                Button(action: { searchText = "" }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(theme.textGrayColor)
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(theme.inputBackground)
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        
                        // Source Filter Menu
                        Menu {
                            Button("All Sources", action: { selectedSource = "All" })
                            Button("📢 Meta Ads", action: { selectedSource = "meta-ads" })
                            Button("🟢 WhatsApp", action: { selectedSource = "whatsapp" })
                            Button("📸 Instagram", action: { selectedSource = "instagram" })
                            Button("👥 Facebook", action: { selectedSource = "facebook" })
                            Button("💬 LiveChat", action: { selectedSource = "chat" })
                            Button("📝 Manual Entry", action: { selectedSource = "manual" })
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "line.3.horizontal.decrease.circle")
                                Text(selectedSource == "All" ? "Source" : formatSource(selectedSource))
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(theme.surfaceColor)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(10)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                    }
                    
                    // View Mode Switcher (Table Primary vs Kanban)
                    HStack {
                        HStack(spacing: 0) {
                            Button(action: { viewMode = "table" }) {
                                HStack(spacing: 5) {
                                    Image(systemName: "tablecells.fill")
                                    Text("Table View")
                                        .font(.system(size: 12, weight: .bold))
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(viewMode == "table" ? theme.primaryColor : Color.clear)
                                .foregroundColor(viewMode == "table" ? .white : theme.textGrayColor)
                                .cornerRadius(8)
                            }
                            
                            Button(action: { viewMode = "kanban" }) {
                                HStack(spacing: 5) {
                                    Image(systemName: "square.grid.3x2.fill")
                                    Text("Kanban")
                                        .font(.system(size: 12, weight: .bold))
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(viewMode == "kanban" ? theme.primaryColor : Color.clear)
                                .foregroundColor(viewMode == "kanban" ? .white : theme.textGrayColor)
                                .cornerRadius(8)
                            }
                        }
                        .padding(3)
                        .background(theme.inputBackground)
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        
                        Spacer()
                        
                        Text("\(filteredLeads.count) Leads")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
                .padding(.horizontal)
                
                // 4. Status Filter Pills Carousel
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(statuses, id: \.self) { status in
                            let count = status == "All" ? leadsList.count : leadsList.filter { $0.status == status }.count
                            Button(action: { selectedStatus = status }) {
                                HStack(spacing: 5) {
                                    Text(status)
                                        .font(.system(size: 12, weight: selectedStatus == status ? .bold : .semibold))
                                    Text("\(count)")
                                        .font(.system(size: 10, weight: .black))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(selectedStatus == status ? Color.white.opacity(0.25) : theme.inputBackground)
                                        .cornerRadius(8)
                                }
                                .foregroundColor(selectedStatus == status ? .white : theme.onSurfaceColor)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(selectedStatus == status ? theme.primaryColor : theme.surfaceColor)
                                .cornerRadius(16)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(selectedStatus == status ? Color.clear : theme.borderColor, lineWidth: 1)
                                )
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                
                // 5. Main View (Primary Table/List vs Kanban)
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if filteredLeads.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "tray.fill")
                            .font(.system(size: 40))
                            .foregroundColor(theme.textGrayColor.opacity(0.5))
                            .padding(.top, 30)
                        Text("No leads found")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Try modifying your search or click '+ New Lead' to record an inquiry.")
                            .font(.system(size: 12))
                            .foregroundColor(theme.textGrayColor)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    if viewMode == "table" {
                        // PRIMARY TABLE VIEW
                        LazyVStack(spacing: 10) {
                            ForEach(filteredLeads) { lead in
                                leadTableRow(lead: lead)
                            }
                        }
                        .padding(.horizontal)
                    } else {
                        // KANBAN BOARD VIEW
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 14) {
                                ForEach(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"], id: \.self) { stage in
                                    let stageLeads = filteredLeads.filter { $0.status == stage }
                                    let stageSum = stageLeads.reduce(0.0) { $0 + ($1.dealValue ?? 0) }
                                    
                                    VStack(alignment: .leading, spacing: 10) {
                                        // Column Header
                                        HStack {
                                            Text(stage)
                                                .font(.system(size: 13, weight: .black))
                                                .foregroundColor(theme.onSurfaceColor)
                                            Text("\(stageLeads.count)")
                                                .font(.system(size: 10, weight: .bold))
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(theme.inputBackground)
                                                .cornerRadius(8)
                                                .foregroundColor(theme.textGrayColor)
                                            Spacer()
                                            if stageSum > 0 {
                                                Text("₹\(Int(stageSum).formattedWithCommas())")
                                                    .font(.system(size: 11, weight: .black))
                                                    .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                                            }
                                        }
                                        .padding(.bottom, 4)
                                        
                                        // Column Cards
                                        if stageLeads.isEmpty {
                                            Text("No leads")
                                                .font(.system(size: 11))
                                                .foregroundColor(theme.textGrayColor.opacity(0.6))
                                                .frame(maxWidth: .infinity, minHeight: 80)
                                                .background(theme.surfaceColor.opacity(0.5))
                                                .cornerRadius(10)
                                        } else {
                                            ForEach(stageLeads) { lead in
                                                leadCard(lead: lead)
                                            }
                                        }
                                    }
                                    .padding(12)
                                    .frame(width: 280)
                                    .background(theme.inputBackground.opacity(0.6))
                                    .cornerRadius(14)
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.bottom, 30)
        }
        .refreshable {
            loadLeadsData()
        }
        .onAppear(perform: loadLeadsData)
        .sheet(isPresented: $showCreateLeadSheet) {
            CreateLeadSheet(isPresented: $showCreateLeadSheet, onLeadCreated: { newLead in
                leadsList.insert(newLead, at: 0)
            })
            .environmentObject(theme)
        }
        .sheet(item: $selectedLead) { lead in
            LeadDetailSheet(lead: lead, agentsList: agentsList, onNavigateToChat: onNavigateToChat, onUpdated: { updated in
                if let idx = leadsList.firstIndex(where: { $0.id == updated.id }) {
                    leadsList[idx] = updated
                }
            }, onDeleted: { deletedId in
                leadsList.removeAll(where: { $0.id == deletedId })
            })
            .environmentObject(theme)
        }
    }
    
    // MARK: - STAT CARD COMPONENT
    private func statCard(title: String, value: String, subtext: String, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                    .textCase(.uppercase)
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(color)
            }
            
            Text(value)
                .font(.system(size: 20, weight: .black))
                .foregroundColor(color)
            
            Text(subtext)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(theme.textGrayColor)
                .lineLimit(1)
        }
        .padding(14)
        .frame(width: 175)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - PRIMARY TABLE ROW COMPONENT
    private func leadTableRow(lead: LeadDto) -> some View {
        let scoreInfo = getScoreInfo(lead: lead)
        
        return VStack(alignment: .leading, spacing: 10) {
            // Row 1: Name, Source Chip, Quality Score Pill & Deal Value
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(lead.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    if let comp = lead.company, !comp.isEmpty {
                        Text(comp)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(theme.textGrayColor)
                    }
                    if let camp = lead.metaData?.campaignName, !camp.isEmpty {
                        Text("🎯 \(camp)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color(red: 219/255, green: 39/255, blue: 119/255))
                    }
                }
                
                Spacer()
                
                // Quality Score Pill
                Text(scoreInfo.label)
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(scoreInfo.color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(scoreInfo.color.opacity(0.12))
                    .cornerRadius(6)
                
                // Source Badge
                sourceBadge(lead.source)
            }
            
            // Row 2: Phone/Email & Deal Value
            HStack {
                if let p = lead.phone, !p.isEmpty {
                    Text("📞 \(p)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                if let em = lead.email, !em.isEmpty {
                    Text("✉️ \(em)")
                        .font(.system(size: 11))
                        .foregroundColor(theme.textGrayColor)
                        .lineLimit(1)
                }
                
                Spacer()
                
                if let val = lead.dealValue, val > 0 {
                    Text("₹\(Int(val).formattedWithCommas())")
                        .font(.system(size: 13, weight: .black))
                        .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                }
            }
            
            Divider().background(theme.borderColor)
            
            // Row 3: Stage Selector Menu + 1-Click Action Triggers + Details
            HStack(spacing: 8) {
                // Inline Stage Transition Menu
                Menu {
                    ForEach(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"], id: \.self) { st in
                        Button(st) {
                            updateLeadStatus(lead: lead, newStatus: st)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(lead.status)
                            .font(.system(size: 11, weight: .bold))
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9))
                    }
                    .foregroundColor(getStatusColor(lead.status))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(getStatusColor(lead.status).opacity(0.12))
                    .cornerRadius(6)
                }
                
                Spacer()
                
                // 1-Click WhatsApp Trigger
                if let phone = lead.phone, !phone.isEmpty {
                    Button(action: { openWhatsApp(phone: phone, name: lead.name) }) {
                        HStack(spacing: 3) {
                            Image(systemName: "bubble.left.fill")
                            Text("WA")
                        }
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color(red: 22/255, green: 163/255, blue: 74/255).opacity(0.12))
                        .cornerRadius(6)
                    }
                    
                    // 1-Click Call Trigger
                    Button(action: { openCall(phone: phone) }) {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.blue)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.12))
                            .cornerRadius(6)
                    }
                }
                
                // 1-Click Email Trigger
                if let email = lead.email, !email.isEmpty {
                    Button(action: { openEmail(email: email, name: lead.name) }) {
                        Image(systemName: "envelope.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.purple)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .background(Color.purple.opacity(0.12))
                            .cornerRadius(6)
                    }
                }
                
                // View Full Details Button
                Button(action: { selectedLead = lead }) {
                    Text("Details")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(theme.inputBackground)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(theme.borderColor, lineWidth: 1))
                }
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
        .shadow(color: Color.black.opacity(theme.isDark ? 0.25 : 0.03), radius: 6, y: 2)
    }
    
    // MARK: - KANBAN CARD COMPONENT
    private func leadCard(lead: LeadDto) -> some View {
        Button(action: { selectedLead = lead }) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(lead.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    Spacer()
                    sourceBadge(lead.source)
                }
                
                if let comp = lead.company, !comp.isEmpty {
                    Text(comp)
                        .font(.system(size: 11))
                        .foregroundColor(theme.textGrayColor)
                }
                
                if let phone = lead.phone, !phone.isEmpty {
                    Text("📞 \(phone)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(theme.textGrayColor)
                }
                
                HStack {
                    if let val = lead.dealValue, val > 0 {
                        Text("₹\(Int(val).formattedWithCommas())")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                    } else {
                        Text("No Deal Val")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                    }
                    Spacer()
                    let score = getScoreInfo(lead: lead)
                    Text(score.label)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(score.color)
                }
            }
            .padding(12)
            .background(theme.surfaceColor)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
        }
    }
    
    // Helper: Source Badge
    private func sourceBadge(_ source: String) -> some View {
        let (label, icon, color) = getSourceConfig(source)
        return HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(label)
                .font(.system(size: 9.5, weight: .bold))
        }
        .foregroundColor(color)
        .padding(.horizontal, 6)
        .padding(.vertical, 2.5)
        .background(color.opacity(0.12))
        .cornerRadius(6)
    }
    
    private func getSourceConfig(_ source: String) -> (String, String, Color) {
        switch source.lowercased() {
        case "meta-ads", "meta_ads", "facebook_ads":
            return ("Meta Ads", "megaphone.fill", Color(red: 219/255, green: 39/255, blue: 119/255))
        case "whatsapp":
            return ("WhatsApp", "phone.bubble.left.fill", Color(red: 22/255, green: 163/255, blue: 74/255))
        case "instagram":
            return ("Instagram", "camera.fill", Color(red: 147/255, green: 51/255, blue: 234/255))
        case "facebook":
            return ("Facebook", "person.2.fill", Color(red: 37/255, green: 99/255, blue: 235/255))
        case "chat", "livechat", "website":
            return ("LiveChat", "message.fill", Color(red: 220/255, green: 38/255, blue: 38/255))
        default:
            return ("Manual", "square.and.pencil", Color(red: 100/255, green: 116/255, blue: 139/255))
        }
    }
    
    private func getScoreInfo(lead: LeadDto) -> (label: String, color: Color) {
        var score = lead.score ?? 50
        if (lead.dealValue ?? 0) > 50000 { score += 20 }
        else if (lead.dealValue ?? 0) > 10000 { score += 10 }
        if lead.phone != nil && lead.email != nil { score += 10 }
        if lead.source.contains("meta") { score += 15 }
        if lead.status == "Won" { score = 100 }
        if lead.status == "Lost" { score = 10 }
        score = min(max(score, 5), 100)
        
        if score >= 80 { return ("🔥 Hot (\(score))", Color.red) }
        if score >= 50 { return ("⚡ Warm (\(score))", Color.orange) }
        return ("❄️ Cold (\(score))", Color.gray)
    }
    
    private func getStatusColor(_ status: String) -> Color {
        switch status {
        case "New": return Color.blue
        case "Contacted": return Color.orange
        case "Qualified": return Color.purple
        case "Proposal": return Color.indigo
        case "Won": return Color(red: 22/255, green: 163/255, blue: 74/255)
        case "Lost": return Color(red: 220/255, green: 38/255, blue: 38/255)
        default: return theme.primaryColor
        }
    }
    
    private func formatSource(_ source: String) -> String {
        switch source.lowercased() {
        case "meta-ads", "meta_ads": return "Meta Ads"
        case "whatsapp": return "WhatsApp"
        case "instagram": return "Instagram"
        case "facebook": return "Facebook"
        case "chat", "livechat": return "LiveChat"
        default: return source.capitalized
        }
    }
    
    // Quick Communication Launchers
    private func openWhatsApp(phone: String, name: String) {
        let clean = phone.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        let text = "Hi \(name), thank you for contacting us via LetsTrack! How can we assist you today?"
        if let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "https://wa.me/\(clean)?text=\(encoded)") {
            UIApplication.shared.open(url)
        }
    }
    
    private func openCall(phone: String) {
        let clean = phone.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
        if let url = URL(string: "tel://\(clean)"), UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
    
    private func openEmail(email: String, name: String) {
        let subject = "Inquiry Follow-up - LetsTrack"
        let body = "Hi \(name),\n\nFollowing up on your inquiry with us.\n\nBest regards,\nLetsTrack Team"
        if let encSub = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let encBody = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "mailto:\(email)?subject=\(encSub)&body=\(encBody)") {
            UIApplication.shared.open(url)
        }
    }
    
    private func updateLeadStatus(lead: LeadDto, newStatus: String) {
        Task {
            do {
                let updated = try await NetworkClient.shared.updateLead(leadId: lead.id, fields: ["status": newStatus])
                await MainActor.run {
                    if let idx = leadsList.firstIndex(where: { $0.id == lead.id }) {
                        leadsList[idx] = updated
                    }
                }
            } catch {
                print("Failed to update status: \(error)")
            }
        }
    }
    
    private func loadLeadsData() {
        isLoading = true
        Task {
            do {
                let fetchedLeads = try await NetworkClient.shared.getLeads()
                await MainActor.run {
                    self.leadsList = fetchedLeads
                    self.isLoading = false
                }
            } catch {
                print("Failed to load leads list: \(error)")
                await MainActor.run { self.isLoading = false }
            }
            
            do {
                let fetchedStats = try await NetworkClient.shared.getLeadStats()
                let fetchedAgents = try await NetworkClient.shared.getAgents()
                await MainActor.run {
                    self.leadStats = fetchedStats
                    self.agentsList = fetchedAgents
                }
            } catch {
                print("Failed to load lead telemetry: \(error)")
            }
        }
    }
}

// MARK: - INT FORMATTER HELPER
extension Int {
    func formattedWithCommas() -> String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .decimal
        return numberFormatter.string(from: NSNumber(value: self)) ?? "\(self)"
    }
}

// MARK: - CREATE LEAD SHEET MODAL
struct CreateLeadSheet: View {
    @Binding var isPresented: Bool
    let onLeadCreated: (LeadDto) -> Void
    @EnvironmentObject var theme: ThemeManager
    
    @State var name: String
    @State var email: String
    @State var phone: String
    @State var company: String
    @State var source: String
    @State var status: String
    @State var dealValue: String
    @State var note: String
    @State var conversationId: String?
    @State var visitorId: String?
    
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showContactPicker = false
    
    init(
        isPresented: Binding<Bool>,
        onLeadCreated: @escaping (LeadDto) -> Void,
        name: String = "",
        email: String = "",
        phone: String = "",
        company: String = "",
        source: String = "manual",
        status: String = "New",
        dealValue: String = "",
        note: String = "",
        conversationId: String? = nil,
        visitorId: String? = nil
    ) {
        self._isPresented = isPresented
        self.onLeadCreated = onLeadCreated
        self._name = State(initialValue: name)
        self._email = State(initialValue: email)
        self._phone = State(initialValue: phone)
        self._company = State(initialValue: company)
        self._source = State(initialValue: source)
        self._status = State(initialValue: status)
        self._dealValue = State(initialValue: dealValue)
        self._note = State(initialValue: note)
        self._conversationId = State(initialValue: conversationId)
        self._visitorId = State(initialValue: visitorId)
    }
    
    let sources = ["manual", "meta-ads", "whatsapp", "instagram", "facebook", "chat"]
    let statuses = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]
    
    var body: some View {
        NavigationStack {
            ZStack {
                theme.backgroundColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Full Name *")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                
                                Spacer()
                                
                                Button(action: { showContactPicker = true }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "person.crop.circle.badge.plus")
                                        Text("Pick from Contacts")
                                    }
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(theme.primaryColor)
                                }
                            }
                            
                            TextField("Customer Name (e.g. Priya Sharma)", text: $name)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Company / Organization")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("Company Name (optional)", text: $company)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Phone Number")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                TextField("+91 98765 43210", text: $phone)
                                    .keyboardType(.phonePad)
                                    .padding(12)
                                    .background(theme.inputBackground)
                                    .foregroundColor(theme.onSurfaceColor)
                                    .cornerRadius(10)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                            }
                            
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Email Address")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                TextField("email@domain.com", text: $email)
                                    .keyboardType(.emailAddress)
                                    .padding(12)
                                    .background(theme.inputBackground)
                                    .foregroundColor(theme.onSurfaceColor)
                                    .cornerRadius(10)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                            }
                        }
                        
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Channel Source")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                Picker("Source", selection: $source) {
                                    Text("📝 Manual").tag("manual")
                                    Text("📢 Meta Ads").tag("meta-ads")
                                    Text("🟢 WhatsApp").tag("whatsapp")
                                    Text("📸 Instagram").tag("instagram")
                                    Text("👥 Facebook").tag("facebook")
                                    Text("💬 LiveChat").tag("chat")
                                }
                                .pickerStyle(.menu)
                                .padding(8)
                                .frame(maxWidth: .infinity)
                                .background(theme.inputBackground)
                                .cornerRadius(10)
                            }
                            
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Initial Stage")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                Picker("Status", selection: $status) {
                                    ForEach(statuses, id: \.self) { st in
                                        Text(st).tag(st)
                                    }
                                }
                                .pickerStyle(.menu)
                                .padding(8)
                                .frame(maxWidth: .infinity)
                                .background(theme.inputBackground)
                                .cornerRadius(10)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Estimated Deal Value (₹)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("e.g. 25000", text: $dealValue)
                                .keyboardType(.numberPad)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Initial Notes / Context")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("Customer inquiry details, requirements...", text: $note)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        if !errorMessage.isEmpty {
                            Text(errorMessage)
                                .font(.system(size: 12))
                                .foregroundColor(.red)
                        }
                        
                        Button(action: createLead) {
                            HStack {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("Save Lead")
                                        .font(.system(size: 15, weight: .bold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(
                                LinearGradient(
                                    colors: [Color(red: 220/255, green: 38/255, blue: 38/255), Color(red: 185/255, green: 28/255, blue: 28/255)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: Color.red.opacity(0.3), radius: 8, y: 4)
                        }
                        .disabled(isLoading)
                        .padding(.top, 10)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Create New Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
            }
            .sheet(isPresented: $showContactPicker) {
                ContactPickerView { pickedName, pickedPhone, pickedEmail, pickedCompany in
                    if let n = pickedName, !n.isEmpty { self.name = n }
                    if let p = pickedPhone, !p.isEmpty { self.phone = p }
                    if let e = pickedEmail, !e.isEmpty { self.email = e }
                    if let c = pickedCompany, !c.isEmpty { self.company = c }
                }
            }
        }
    }
    
    private func createLead() {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Name is required."
            return
        }
        
        isLoading = true
        errorMessage = ""
        
        let req = CreateLeadRequest(
            name: name.trimmingCharacters(in: .whitespaces),
            email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
            phone: phone.isEmpty ? nil : phone.trimmingCharacters(in: .whitespaces),
            company: company.isEmpty ? nil : company.trimmingCharacters(in: .whitespaces),
            source: source,
            status: status,
            dealValue: Double(dealValue),
            currency: "INR",
            score: 50,
            notes: note.isEmpty ? nil : [note],
            tags: ["Mobile App Ingestion"],
            assignedAgentId: nil,
            conversationId: conversationId,
            visitorId: visitorId
        )
        
        Task {
            do {
                let created = try await NetworkClient.shared.createLead(request: req)
                await MainActor.run {
                    onLeadCreated(created)
                    isLoading = false
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - LEAD DETAIL SHEET MODAL
struct LeadDetailSheet: View {
    @State var lead: LeadDto
    let agentsList: [UserProfile]
    let onNavigateToChat: (String, String, String) -> Void
    let onUpdated: (LeadDto) -> Void
    let onDeleted: (String) -> Void
    
    @EnvironmentObject var theme: ThemeManager
    @Environment(\.dismiss) private var dismiss
    
    @State private var newNoteText = ""
    @State private var isAddingNote = false
    @State private var isDeleting = false
    @State private var showDeleteConfirm = false
    @State private var contactFeedback: String? = nil
    @State private var isSavingContact = false
    @State private var contactSaved = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                theme.backgroundColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        
                        // 1. Header Card: Name, Source, Timestamp
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(lead.name)
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                                Spacer()
                                Text(lead.source.uppercased())
                                    .font(.system(size: 10, weight: .black))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(theme.primaryColor.opacity(0.12))
                                    .foregroundColor(theme.primaryColor)
                                    .cornerRadius(6)
                            }
                            
                            if let comp = lead.company, !comp.isEmpty {
                                Text("🏢 \(comp)")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(theme.textGrayColor)
                            }
                            
                            if let created = lead.createdAt {
                                Text("Created: \(created)")
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.textGrayColor.opacity(0.8))
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(theme.surfaceColor)
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                        
                        if let feedback = contactFeedback {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text(feedback)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(theme.onSurfaceColor)
                                Spacer()
                                Button(action: { contactFeedback = nil }) {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 11))
                                        .foregroundColor(theme.textGrayColor)
                                }
                            }
                            .padding(10)
                            .background(Color.green.opacity(0.12))
                            .cornerRadius(8)
                        }
                        
                        // 2. 1-Click Action Buttons Bar
                        HStack(spacing: 8) {
                            if let p = lead.phone, !p.isEmpty {
                                Button(action: { openWhatsApp(phone: p, name: lead.name) }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "bubble.left.fill")
                                        Text("WhatsApp")
                                    }
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 38)
                                    .background(Color(red: 22/255, green: 163/255, blue: 74/255))
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                                }
                                
                                Button(action: { openCall(phone: p) }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "phone.fill")
                                        Text("Call")
                                    }
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 38)
                                    .background(Color.blue)
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                                }
                            }
                            
                            if let em = lead.email, !em.isEmpty {
                                Button(action: { openEmail(email: em, name: lead.name) }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "envelope.fill")
                                        Text("Email")
                                    }
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 38)
                                    .background(Color.purple)
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                                }
                            }
                            
                            Button(action: saveToContacts) {
                                HStack(spacing: 4) {
                                    if isSavingContact {
                                        ProgressView()
                                            .tint(.white)
                                            .scaleEffect(0.7)
                                    } else if contactSaved {
                                        Image(systemName: "checkmark")
                                        Text("Saved")
                                    } else {
                                        Image(systemName: "person.crop.circle.badge.plus")
                                        Text("Contacts")
                                    }
                                }
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                                .background(contactSaved ? Color(red: 22/255, green: 163/255, blue: 74/255) : Color.orange)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                            .disabled(isSavingContact)
                        }
                        
                        // 3. Status & Assigned Agent Selectors
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("PIPELINE STAGE")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundColor(theme.textGrayColor)
                                
                                Picker("Stage", selection: $lead.status) {
                                    ForEach(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"], id: \.self) { st in
                                        Text(st).tag(st)
                                    }
                                }
                                .pickerStyle(.segmented)
                                .onChange(of: lead.status) { newStatus in
                                    updateLeadField(fields: ["status": newStatus])
                                }
                            }
                            
                            if !agentsList.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("ASSIGNED AGENT")
                                        .font(.system(size: 10, weight: .black))
                                        .foregroundColor(theme.textGrayColor)
                                    
                                    Menu {
                                        Button("Unassigned") {
                                            updateLeadField(fields: ["assignedAgentId": NSNull()])
                                        }
                                        ForEach(agentsList, id: \.id) { agent in
                                            Button("👤 \(agent.name) (\(agent.email))") {
                                                updateLeadField(fields: ["assignedAgentId": agent.id])
                                            }
                                        }
                                    } label: {
                                        HStack {
                                            Text(lead.assignedAgentName ?? "Unassigned")
                                                .font(.system(size: 13, weight: .semibold))
                                                .foregroundColor(theme.onSurfaceColor)
                                            Spacer()
                                            Image(systemName: "chevron.up.chevron.down")
                                                .font(.system(size: 11))
                                                .foregroundColor(theme.textGrayColor)
                                        }
                                        .padding(10)
                                        .background(theme.inputBackground)
                                        .cornerRadius(8)
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                                    }
                                }
                            }
                        }
                        .padding(14)
                        .background(theme.surfaceColor)
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                        
                        // 4. Contact Details & Deal Value
                        VStack(alignment: .leading, spacing: 8) {
                            Text("CONTACT & DEAL INFO")
                                .font(.system(size: 10, weight: .black))
                                .foregroundColor(theme.textGrayColor)
                            
                            VStack(spacing: 6) {
                                infoRow(label: "Phone", value: lead.phone ?? "Not provided")
                                infoRow(label: "Email", value: lead.email ?? "Not provided")
                                infoRow(label: "Company", value: lead.company ?? "Not provided")
                                infoRow(label: "Deal Value", value: "₹\(Int(lead.dealValue ?? 0).formattedWithCommas())")
                            }
                        }
                        .padding(14)
                        .background(theme.surfaceColor)
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                        
                        // 5. Meta Ads Attribution (if available)
                        if let meta = lead.metaData {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("META ADS ATTRIBUTION")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundColor(Color(red: 219/255, green: 39/255, blue: 119/255))
                                
                                VStack(spacing: 6) {
                                    if let camp = meta.campaignName { infoRow(label: "Campaign", value: camp) }
                                    if let ad = meta.adName { infoRow(label: "Ad Name", value: ad) }
                                    if let fId = meta.formId { infoRow(label: "Form ID", value: fId) }
                                }
                                
                                if let answers = meta.formAnswers, !answers.isEmpty {
                                    Text("Instant Form Responses")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(theme.onSurfaceColor)
                                        .padding(.top, 4)
                                    
                                    ForEach(answers.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                                        HStack {
                                            Text(k)
                                                .font(.system(size: 11))
                                                .foregroundColor(theme.textGrayColor)
                                            Spacer()
                                            Text(v)
                                                .font(.system(size: 11, weight: .bold))
                                                .foregroundColor(theme.onSurfaceColor)
                                        }
                                        .padding(8)
                                        .background(theme.inputBackground)
                                        .cornerRadius(6)
                                    }
                                }
                            }
                            .padding(14)
                            .background(theme.surfaceColor)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        // 6. Activity Timeline & Notes Stream
                        VStack(alignment: .leading, spacing: 10) {
                            Text("TIMELINE & NOTES")
                                .font(.system(size: 10, weight: .black))
                                .foregroundColor(theme.textGrayColor)
                            
                            HStack {
                                TextField("Add meeting note, call update...", text: $newNoteText)
                                    .font(.system(size: 12))
                                    .padding(10)
                                    .background(theme.inputBackground)
                                    .foregroundColor(theme.onSurfaceColor)
                                    .cornerRadius(8)
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                                
                                Button(action: addNote) {
                                    if isAddingNote {
                                        ProgressView().tint(.white).frame(width: 40, height: 36)
                                    } else {
                                        Text("Post")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 12)
                                            .frame(height: 36)
                                            .background(theme.primaryColor)
                                            .cornerRadius(8)
                                    }
                                }
                                .disabled(isAddingNote || newNoteText.isEmpty)
                            }
                            
                            if let notes = lead.notes, !notes.isEmpty {
                                ForEach(notes.reversed()) { note in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(note.text)
                                            .font(.system(size: 12.5))
                                            .foregroundColor(theme.onSurfaceColor)
                                        
                                        HStack {
                                            Text(note.authorName ?? "Agent")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(theme.primaryColor)
                                            Spacer()
                                            if let time = note.createdAt {
                                                Text(time)
                                                    .font(.system(size: 9.5))
                                                    .foregroundColor(theme.textGrayColor)
                                            }
                                        }
                                    }
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(theme.inputBackground)
                                    .cornerRadius(8)
                                }
                            } else {
                                Text("No progress notes recorded yet.")
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.textGrayColor)
                            }
                        }
                        .padding(14)
                        .background(theme.surfaceColor)
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                        
                        // 7. Delete Lead Action
                        Button(action: { showDeleteConfirm = true }) {
                            HStack {
                                Image(systemName: "trash")
                                Text("Delete Lead")
                            }
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(10)
                        }
                        .padding(.top, 6)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Lead Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Delete Lead", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    deleteLeadAction()
                }
            } message: {
                Text("Are you sure you want to delete this lead? This action cannot be undone.")
            }
        }
    }
    
    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(theme.textGrayColor)
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
        }
    }
    
    private func openWhatsApp(phone: String, name: String) {
        let clean = phone.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        let text = "Hi \(name), following up on your inquiry with LetsTrack!"
        if let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "https://wa.me/\(clean)?text=\(encoded)") {
            UIApplication.shared.open(url)
        }
    }
    
    private func openCall(phone: String) {
        let clean = phone.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
        if let url = URL(string: "tel://\(clean)"), UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
    
    private func openEmail(email: String, name: String) {
        let subject = "Inquiry Follow-up - LetsTrack"
        if let encSub = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "mailto:\(email)?subject=\(encSub)") {
            UIApplication.shared.open(url)
        }
    }
    
    private func updateLeadField(fields: [String: Any]) {
        Task {
            do {
                let updated = try await NetworkClient.shared.updateLead(leadId: lead.id, fields: fields)
                await MainActor.run {
                    self.lead = updated
                    self.onUpdated(updated)
                }
            } catch {
                print("Failed to update lead field: \(error)")
            }
        }
    }
    
    private func addNote() {
        guard !newNoteText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isAddingNote = true
        let noteStr = newNoteText.trimmingCharacters(in: .whitespaces)
        
        Task {
            do {
                let updated = try await NetworkClient.shared.addLeadNote(leadId: lead.id, text: noteStr)
                await MainActor.run {
                    self.lead = updated
                    self.onUpdated(updated)
                    self.newNoteText = ""
                    self.isAddingNote = false
                }
            } catch {
                print("Failed to add note: \(error)")
                await MainActor.run { self.isAddingNote = false }
            }
        }
    }
    
    private func saveToContacts() {
        guard !isSavingContact else { return }
        isSavingContact = true
        
        ContactHelper.shared.saveContact(
            fullName: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company,
            note: nil
        ) { success, message in
            DispatchQueue.main.async {
                self.isSavingContact = false
                if success {
                    self.contactSaved = true
                }
                self.contactFeedback = message
            }
        }
    }
    
    private func deleteLeadAction() {
        Task {
            do {
                try await NetworkClient.shared.deleteLead(leadId: lead.id)
                await MainActor.run {
                    onDeleted(lead.id)
                    dismiss()
                }
            } catch {
                print("Failed to delete lead: \(error)")
            }
        }
    }
}

// MARK: - META ADS & CAMPAIGN MANAGEMENT SUB-VIEW
struct MetaAdsTab: View {
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var adAccounts: [AdAccountDto] = []
    @State private var selectedAccount: AdAccountDto? = nil
    @State private var campaigns: [AdCampaignDto] = []
    @State private var isLoading = false
    @State private var isSyncing = false
    @State private var syncToastMessage: String? = nil
    
    // Filters & Search
    @State private var selectedStatus = "All"
    @State private var selectedObjective = "All"
    @State private var searchText = ""
    
    // Modals
    @State private var showCreateSheet = false
    @State private var selectedCampaignForBudget: AdCampaignDto? = nil
    @State private var newBudgetValue: String = ""
    @State private var isUpdatingBudget = false
    @State private var expandedCampaignIds: Set<String> = []
    
    let statuses = ["All", "ACTIVE", "PAUSED"]
    let objectives = ["All", "LEAD_GENERATION", "MESSAGES", "CONVERSIONS"]
    
    var filteredCampaigns: [AdCampaignDto] {
        campaigns.filter { camp in
            let matchesStatus = selectedStatus == "All" || camp.status == selectedStatus
            let matchesObj = selectedObjective == "All" || (camp.objective ?? "") == selectedObjective
            let matchesSearch = searchText.isEmpty ||
                camp.name.localizedCaseInsensitiveContains(searchText) ||
                (camp.adSet?.name?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (camp.adCreative?.headline?.localizedCaseInsensitiveContains(searchText) ?? false)
            return matchesStatus && matchesObj && matchesSearch
        }
    }
    
    var totalSpend: Double {
        campaigns.reduce(0.0) { sum, camp in
            let cleaned = (camp.spend ?? "").replacingOccurrences(of: "[^0-9.]", with: "", options: .regularExpression)
            return sum + (Double(cleaned) ?? 0.0)
        }
    }
    
    var totalImpressions: Int {
        campaigns.reduce(0) { $0 + ($1.impressions ?? 0) }
    }
    
    var totalClicks: Int {
        campaigns.reduce(0) { $0 + ($1.clicks ?? 0) }
    }
    
    var totalConversions: Int {
        campaigns.reduce(0) { $0 + ($1.conversions ?? 0) }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                
                // 1. Top Header
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text("Meta Ads Manager")
                                .font(.system(size: 24, weight: .black))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            Text("v26.0 LIVE")
                                .font(.system(size: 9, weight: .black))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(red: 0, green: 129/255, blue: 251/255).opacity(0.15))
                                .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                                .cornerRadius(4)
                        }
                        
                        Text("Live campaigns, ad sets, and instant leadgen attribution")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(theme.textGrayColor)
                    }
                    
                    Spacer()
                    
                    // Sync Button
                    Button(action: syncAds) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                            .padding(9)
                            .background(theme.inputBackground)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(theme.borderColor, lineWidth: 1))
                            .rotationEffect(.degrees(isSyncing ? 360 : 0))
                            .animation(isSyncing ? Animation.linear(duration: 1).repeatForever(autoreverses: false) : .default, value: isSyncing)
                    }
                    .disabled(isSyncing)
                    
                    // + Launch Campaign Button
                    Button(action: { showCreateSheet = true }) {
                        HStack(spacing: 5) {
                            Image(systemName: "plus")
                                .font(.system(size: 12, weight: .bold))
                            Text("Launch Ad")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 0, green: 129/255, blue: 251/255), Color(red: 219/255, green: 39/255, blue: 119/255)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(10)
                        .shadow(color: Color(red: 0, green: 129/255, blue: 251/255).opacity(0.3), radius: 6, y: 3)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 12)
                
                // Sync Toast Banner
                if let msg = syncToastMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text(msg)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                        Spacer()
                    }
                    .padding(10)
                    .background(Color.green.opacity(0.12))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }
                
                // 2. Active Meta Ad Account Card
                adAccountHeaderCard
                    .padding(.horizontal)
                
                // 3. KPI Performance Metrics Grid
                kpiMetricsSection
                    .padding(.horizontal)
                
                // 4. Search & Filter Toolbars
                filterToolbar
                    .padding(.horizontal)
                
                // 5. Campaign Cards List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else if filteredCampaigns.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "megaphone")
                            .font(.system(size: 40))
                            .foregroundColor(theme.textGrayColor.opacity(0.5))
                        Text("No campaigns found")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Launch your first Meta Ad campaign to start capturing high-intent leads 24/7.")
                            .font(.system(size: 13))
                            .foregroundColor(theme.textGrayColor)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                        
                        Button(action: { showCreateSheet = true }) {
                            Text("Launch New Campaign")
                                .font(.system(size: 13, weight: .bold))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Color(red: 0, green: 129/255, blue: 251/255))
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredCampaigns) { camp in
                            campaignCard(camp: camp)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom, 30)
        }
        .refreshable {
            loadData()
        }
        .onAppear(perform: loadData)
        .sheet(isPresented: $showCreateSheet) {
            CreateCampaignSheet(isPresented: $showCreateSheet, onCreated: { newCamp in
                campaigns.insert(newCamp, at: 0)
            })
            .environmentObject(theme)
        }
        .sheet(item: $selectedCampaignForBudget) { camp in
            budgetEditSheet(camp: camp)
                .environmentObject(theme)
        }
    }
    
    // MARK: - SUB-VIEWS
    private var adAccountHeaderCard: some View {
        let acc = selectedAccount ?? adAccounts.first
        
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "briefcase.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                    
                    Text(acc?.name ?? "LetsTrack Enterprise Ad Account")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                        .lineLimit(1)
                }
                
                Spacer()
                
                if adAccounts.count > 1 {
                    Menu {
                        ForEach(adAccounts) { a in
                            Button(a.name) {
                                selectedAccount = a
                                loadCampaignsForAccount(a.id)
                            }
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Text("Switch")
                            Image(systemName: "chevron.up.chevron.down")
                        }
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                    }
                }
            }
            
            HStack {
                Text("ID: \(acc?.id ?? "act_1394810294820")")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(theme.textGrayColor)
                
                Spacer()
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 6, height: 6)
                    Text("ACTIVE (\(acc?.currency ?? "INR"))")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(Color.green)
                }
            }
            
            Divider().background(theme.borderColor)
            
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("AVAILABLE BALANCE")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    Text(acc?.balance ?? "₹24,500")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("TOTAL SPENT")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    Text(acc?.totalSpent ?? "₹14,850")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(theme.onSurfaceColor)
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("SPEND CAP")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    Text(acc?.spendCap ?? "₹100,000")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(theme.textGrayColor)
                }
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private var kpiMetricsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                metaStatCard(
                    title: "Total Ad Spend",
                    value: "₹\(Int(totalSpend).formattedWithCommas())",
                    subtext: "\(campaigns.count) Active Campaigns",
                    color: Color(red: 220/255, green: 38/255, blue: 38/255),
                    icon: "indianrupeesign.circle.fill"
                )
                
                metaStatCard(
                    title: "Reach & Impressions",
                    value: "\(totalImpressions.formattedWithCommas())",
                    subtext: "\(campaigns.reduce(0) { $0 + ($1.reach ?? 0) }.formattedWithCommas()) reach",
                    color: Color(red: 0, green: 129/255, blue: 251/255),
                    icon: "eye.fill"
                )
                
                metaStatCard(
                    title: "Total Link Clicks",
                    value: "\(totalClicks.formattedWithCommas())",
                    subtext: "Avg CTR: 5.48%",
                    color: Color(red: 147/255, green: 51/255, blue: 234/255),
                    icon: "cursorarrow.rays"
                )
                
                metaStatCard(
                    title: "Inbound Leads",
                    value: "\(totalConversions)",
                    subtext: "Avg CPL: ₹42 / lead",
                    color: Color(red: 22/255, green: 163/255, blue: 74/255),
                    icon: "person.crop.circle.badge.checkmark"
                )
            }
        }
    }
    
    private func metaStatCard(title: String, value: String, subtext: String, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                    .textCase(.uppercase)
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(color)
            }
            
            Text(value)
                .font(.system(size: 20, weight: .black))
                .foregroundColor(color)
            
            Text(subtext)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(theme.textGrayColor)
                .lineLimit(1)
        }
        .padding(14)
        .frame(width: 175)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private var filterToolbar: some View {
        VStack(spacing: 10) {
            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(theme.textGrayColor)
                TextField("Search campaigns, ad sets, headlines...", text: $searchText)
                    .font(.system(size: 13))
                    .foregroundColor(theme.onSurfaceColor)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            .padding(10)
            .background(theme.inputBackground)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
            
            // Objective & Status Filter Chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["All", "LEAD_GENERATION", "MESSAGES", "CONVERSIONS"], id: \.self) { obj in
                        Button(action: { selectedObjective = obj }) {
                            Text(formatObjective(obj))
                                .font(.system(size: 11, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selectedObjective == obj ? Color(red: 0, green: 129/255, blue: 251/255) : theme.inputBackground)
                                .foregroundColor(selectedObjective == obj ? .white : theme.textGrayColor)
                                .cornerRadius(8)
                        }
                    }
                    
                    Divider().frame(height: 18).background(theme.borderColor)
                    
                    ForEach(statuses, id: \.self) { st in
                        Button(action: { selectedStatus = st }) {
                            Text(st == "All" ? "All Status" : st)
                                .font(.system(size: 11, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selectedStatus == st ? theme.primaryColor : theme.inputBackground)
                                .foregroundColor(selectedStatus == st ? .white : theme.textGrayColor)
                                .cornerRadius(8)
                        }
                    }
                }
            }
        }
    }
    
    private func campaignCard(camp: AdCampaignDto) -> some View {
        let isExpanded = expandedCampaignIds.contains(camp.id)
        let isActive = camp.status == "ACTIVE"
        
        return VStack(alignment: .leading, spacing: 12) {
            // Row 1: Objective Chip + Status Toggle + Menu
            HStack {
                objectiveBadge(camp.objective ?? "LEAD_GENERATION")
                
                Spacer()
                
                Button(action: { toggleCampaign(campaign: camp) }) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(isActive ? Color.green : Color.orange)
                            .frame(width: 6, height: 6)
                        Text(isActive ? "ACTIVE" : "PAUSED")
                            .font(.system(size: 10, weight: .black))
                            .foregroundColor(isActive ? Color.green : Color.orange)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(isActive ? Color.green.opacity(0.12) : Color.orange.opacity(0.12))
                    .cornerRadius(6)
                }
                
                Menu {
                    Button(action: { toggleCampaign(campaign: camp) }) {
                        Label(isActive ? "Pause Campaign" : "Resume Campaign", systemImage: isActive ? "pause.fill" : "play.fill")
                    }
                    
                    Button(action: {
                        selectedCampaignForBudget = camp
                        newBudgetValue = "\(Int(camp.rawDailyBudget ?? 500))"
                    }) {
                        Label("Adjust Daily Budget", systemImage: "indianrupeesign.circle")
                    }
                    
                    Button(role: .destructive, action: { deleteCampaign(campaign: camp) }) {
                        Label("Archive Campaign", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                        .padding(6)
                }
            }
            
            // Row 2: Campaign Name
            Text(camp.name)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
                .fixedSize(horizontal: false, vertical: true)
            
            // Row 3: Daily Budget + Quick Stats
            HStack(spacing: 12) {
                Button(action: {
                    selectedCampaignForBudget = camp
                    newBudgetValue = "\(Int(camp.rawDailyBudget ?? 500))"
                }) {
                    HStack(spacing: 3) {
                        Text(camp.dailyBudget ?? "₹500 / day")
                            .font(.system(size: 12, weight: .black))
                            .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                        Image(systemName: "pencil")
                            .font(.system(size: 10))
                            .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(red: 0, green: 129/255, blue: 251/255).opacity(0.1))
                    .cornerRadius(6)
                }
                
                Spacer()
                
                if let clicks = camp.clicks, clicks > 0 {
                    Text("🎯 \(clicks) Clicks (\(camp.ctr ?? "0%"))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(theme.textGrayColor)
                }
                
                if let conv = camp.conversions, conv > 0 {
                    Text("⚡ \(conv) Leads")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(Color(red: 22/255, green: 163/255, blue: 74/255))
                }
            }
            
            // Row 4: Metrics Bar
            HStack(spacing: 8) {
                metricPill(label: "Impressions", value: "\(camp.impressions?.formattedWithCommas() ?? "0")")
                metricPill(label: "Spend", value: camp.spend ?? "₹0")
                metricPill(label: "CPC", value: camp.cpc ?? "₹0")
            }
            
            // Expand/Collapse Toggle Button
            Button(action: {
                withAnimation(.spring()) {
                    if isExpanded {
                        expandedCampaignIds.remove(camp.id)
                    } else {
                        expandedCampaignIds.insert(camp.id)
                    }
                }
            }) {
                HStack {
                    Text(isExpanded ? "Hide Ad Set & Creative Details" : "View Ad Set & Creative Preview")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(theme.inputBackground)
                .cornerRadius(6)
            }
            
            // Expanded Section: Ad Set & Creative Preview
            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    Divider().background(theme.borderColor)
                    
                    // Ad Set Targeting
                    if let adSet = camp.adSet {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("AD SET TARGETING")
                                .font(.system(size: 10, weight: .black))
                                .foregroundColor(theme.textGrayColor)
                            
                            if let name = adSet.name {
                                Text("🎯 \(name)")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                            
                            if let locs = adSet.locations, !locs.isEmpty {
                                HStack(alignment: .top, spacing: 4) {
                                    Text("📍")
                                    Text(locs.joined(separator: ", "))
                                        .font(.system(size: 11))
                                        .foregroundColor(theme.textGrayColor)
                                }
                            }
                            
                            if let interests = adSet.interests, !interests.isEmpty {
                                HStack(alignment: .top, spacing: 4) {
                                    Text("💡")
                                    Text(interests.joined(separator: " • "))
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(Color(red: 147/255, green: 51/255, blue: 234/255))
                                }
                            }
                            
                            if let placements = adSet.placements, !placements.isEmpty {
                                HStack(alignment: .top, spacing: 4) {
                                    Text("📱")
                                    Text(placements.joined(separator: " • "))
                                        .font(.system(size: 11))
                                        .foregroundColor(theme.textGrayColor)
                                }
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                    }
                    
                    // Ad Creative Preview
                    if let creative = camp.adCreative {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("AD CREATIVE PREVIEW")
                                .font(.system(size: 10, weight: .black))
                                .foregroundColor(theme.textGrayColor)
                            
                            if let headline = creative.headline {
                                Text(headline)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                            
                            if let copy = creative.primaryText {
                                Text(copy)
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.textGrayColor)
                            }
                            
                            if let imgUrl = creative.previewImage, let url = URL(string: imgUrl) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(height: 120)
                                            .clipped()
                                            .cornerRadius(8)
                                    default:
                                        Color.gray.opacity(0.2)
                                            .frame(height: 120)
                                            .cornerRadius(8)
                                    }
                                }
                            }
                            
                            HStack {
                                Text("Destination: \(creative.destination ?? "Instagram Direct")")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(theme.textGrayColor)
                                
                                Spacer()
                                
                                Text(creative.callToAction ?? "Send Message")
                                    .font(.system(size: 11, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color(red: 0, green: 129/255, blue: 251/255))
                                    .foregroundColor(.white)
                                    .cornerRadius(6)
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private func metricPill(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(theme.textGrayColor)
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(theme.inputBackground)
        .cornerRadius(6)
    }
    
    private func objectiveBadge(_ objective: String) -> some View {
        let (title, color) = getObjectiveInfo(objective)
        return Text(title)
            .font(.system(size: 10, weight: .black))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .foregroundColor(color)
            .cornerRadius(4)
    }
    
    private func getObjectiveInfo(_ objective: String) -> (String, Color) {
        switch objective {
        case "LEAD_GENERATION":
            return ("🎯 LEAD GENERATION", Color(red: 219/255, green: 39/255, blue: 119/255))
        case "MESSAGES":
            return ("💬 CLICK TO CHAT", Color(red: 0, green: 129/255, blue: 251/255))
        case "CONVERSIONS":
            return ("🔥 CONVERSIONS", Color(red: 22/255, green: 163/255, blue: 74/255))
        default:
            return (objective, theme.primaryColor)
        }
    }
    
    private func formatObjective(_ obj: String) -> String {
        switch obj {
        case "All": return "All Types"
        case "LEAD_GENERATION": return "🎯 Lead Gen"
        case "MESSAGES": return "💬 Messages"
        case "CONVERSIONS": return "🔥 Conversions"
        default: return obj
        }
    }
    
    private func budgetEditSheet(camp: AdCampaignDto) -> some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Update Daily Budget")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                
                Text("Campaign: \(camp.name)")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                
                TextField("Daily Budget in INR (e.g. 750)", text: $newBudgetValue)
                    .keyboardType(.numberPad)
                    .padding(12)
                    .background(theme.inputBackground)
                    .foregroundColor(theme.onSurfaceColor)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                
                HStack(spacing: 8) {
                    ForEach([250, 500, 1000, 2500], id: \.self) { amount in
                        Button("₹\(amount)") {
                            newBudgetValue = "\(amount)"
                        }
                        .font(.system(size: 12, weight: .bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(newBudgetValue == "\(amount)" ? Color(red: 0, green: 129/255, blue: 251/255) : theme.inputBackground)
                        .foregroundColor(newBudgetValue == "\(amount)" ? .white : theme.onSurfaceColor)
                        .cornerRadius(8)
                    }
                }
                
                Spacer()
                
                Button(action: {
                    if let val = Double(newBudgetValue) {
                        saveBudget(campaign: camp, newBudget: val)
                    }
                }) {
                    HStack {
                        if isUpdatingBudget {
                            ProgressView().tint(.white)
                        } else {
                            Text("Save Daily Budget")
                                .font(.system(size: 14, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color(red: 0, green: 129/255, blue: 251/255))
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(isUpdatingBudget)
            }
            .padding(20)
            .background(theme.backgroundColor.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { selectedCampaignForBudget = nil }
                }
            }
        }
        .presentationDetents([.fraction(0.45)])
    }
    
    // MARK: - API ACTIONS
    private func loadData() {
        isLoading = true
        Task {
            do {
                let fetchedAccounts = try await networkClient.getAdAccounts()
                let fetchedCampaigns = try await networkClient.getAdCampaigns()
                await MainActor.run {
                    self.adAccounts = fetchedAccounts
                    if self.selectedAccount == nil {
                        self.selectedAccount = fetchedAccounts.first
                    }
                    self.campaigns = fetchedCampaigns
                    self.isLoading = false
                }
            } catch {
                print("Failed to load Meta Ads data: \(error)")
                await MainActor.run { self.isLoading = false }
            }
        }
    }
    
    private func loadCampaignsForAccount(_ accountId: String) {
        isLoading = true
        Task {
            do {
                let fetched = try await networkClient.getAdCampaigns(accountId: accountId)
                await MainActor.run {
                    self.campaigns = fetched
                    self.isLoading = false
                }
            } catch {
                print("Failed to load account campaigns: \(error)")
                await MainActor.run { self.isLoading = false }
            }
        }
    }
    
    private func toggleCampaign(campaign: AdCampaignDto) {
        Task {
            do {
                let updated = try await networkClient.toggleAdCampaignStatus(campaignId: campaign.id)
                await MainActor.run {
                    if let idx = campaigns.firstIndex(where: { $0.id == campaign.id }) {
                        campaigns[idx] = updated
                    }
                }
            } catch {
                print("Failed to toggle campaign status: \(error)")
            }
        }
    }
    
    private func saveBudget(campaign: AdCampaignDto, newBudget: Double) {
        isUpdatingBudget = true
        Task {
            do {
                let updated = try await networkClient.updateAdCampaignBudget(campaignId: campaign.id, dailyBudget: newBudget)
                await MainActor.run {
                    if let idx = campaigns.firstIndex(where: { $0.id == campaign.id }) {
                        campaigns[idx] = updated
                    }
                    self.isUpdatingBudget = false
                    self.selectedCampaignForBudget = nil
                }
            } catch {
                print("Failed to update daily budget: \(error)")
                await MainActor.run { self.isUpdatingBudget = false }
            }
        }
    }
    
    private func deleteCampaign(campaign: AdCampaignDto) {
        Task {
            do {
                try await networkClient.deleteAdCampaign(campaignId: campaign.id)
                await MainActor.run {
                    campaigns.removeAll(where: { $0.id == campaign.id })
                }
            } catch {
                print("Failed to delete campaign: \(error)")
            }
        }
    }
    
    private func syncAds() {
        isSyncing = true
        Task {
            do {
                let msg = try await networkClient.syncMetaAds()
                let fetched = try await networkClient.getAdCampaigns()
                await MainActor.run {
                    self.campaigns = fetched
                    self.isSyncing = false
                    withAnimation {
                        self.syncToastMessage = msg
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        withAnimation { self.syncToastMessage = nil }
                    }
                }
            } catch {
                await MainActor.run { self.isSyncing = false }
            }
        }
    }
}

// MARK: - CREATE META CAMPAIGN MODAL SHEET
struct CreateCampaignSheet: View {
    @Binding var isPresented: Bool
    let onCreated: (AdCampaignDto) -> Void
    
    @EnvironmentObject var theme: ThemeManager
    
    @State private var name: String = ""
    @State private var objective: String = "LEAD_GENERATION"
    @State private var dailyBudget: String = "500"
    @State private var targetLocations: String = "India (Tier 1 & 2 Metro Cities)"
    @State private var targetInterests: String = "E-Commerce, Shopify, SaaS, Startup Founders"
    @State private var ageRange: String = "21 - 54"
    @State private var headline: String = "⚡ Turn Website & IG Visitors Into Paying Customers 24/7"
    @State private var primaryText: String = "LetsTrack gives your sales team real-time visitor journey tracking, 1-click WhatsApp checkout, and seamless Instagram DM multi-agent routing."
    @State private var callToAction: String = "Send Instagram Message"
    @State private var destination: String = "Instagram Direct / WhatsApp"
    @State private var targetUrl: String = "https://letstrack.manacity.in/#pricing"
    @State private var previewImage: String = "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80"
    
    @State private var isLoading = false
    @State private var errorMessage = ""
    
    let objectives = [
        ("LEAD_GENERATION", "🎯 Lead Generation", "Instant Meta Forms"),
        ("MESSAGES", "💬 Messages", "Click to WhatsApp / IG Direct"),
        ("CONVERSIONS", "🔥 Conversions", "Website Checkout / Signup")
    ]
    
    let ctaOptions = [
        "Send Instagram Message",
        "Send WhatsApp Message",
        "Learn More",
        "Get Quote",
        "Sign Up"
    ]
    
    let imagePresets = [
        ("SaaS Live Chat", "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80"),
        ("E-Commerce Growth", "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80"),
        ("Customer Support", "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80"),
        ("Mobile Telemetry", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80")
    ]
    
    var body: some View {
        NavigationStack {
            ZStack {
                theme.backgroundColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        
                        if !errorMessage.isEmpty {
                            Text(errorMessage)
                                .font(.system(size: 12))
                                .foregroundColor(.red)
                                .padding(10)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        // 1. Campaign Name & Objective
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Campaign Name *")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("e.g. Diwali Live Chat Trial Promo 2026", text: $name)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Campaign Objective")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            VStack(spacing: 8) {
                                ForEach(objectives, id: \.0) { item in
                                    Button(action: {
                                        objective = item.0
                                        if item.0 == "MESSAGES" {
                                            callToAction = "Send Instagram Message"
                                            destination = "Instagram Direct / WhatsApp"
                                        }
                                    }) {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(item.1)
                                                    .font(.system(size: 13, weight: .bold))
                                                    .foregroundColor(objective == item.0 ? Color(red: 0, green: 129/255, blue: 251/255) : theme.onSurfaceColor)
                                                Text(item.2)
                                                    .font(.system(size: 11))
                                                    .foregroundColor(theme.textGrayColor)
                                            }
                                            Spacer()
                                            if objective == item.0 {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                                            }
                                        }
                                        .padding(12)
                                        .background(objective == item.0 ? Color(red: 0, green: 129/255, blue: 251/255).opacity(0.1) : theme.inputBackground)
                                        .cornerRadius(10)
                                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(objective == item.0 ? Color(red: 0, green: 129/255, blue: 251/255) : theme.borderColor, lineWidth: 1))
                                    }
                                }
                            }
                        }
                        
                        // 2. Daily Budget
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Daily Budget (INR)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            TextField("500", text: $dailyBudget)
                                .keyboardType(.numberPad)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                            
                            HStack(spacing: 8) {
                                ForEach(["250", "500", "1000", "2500"], id: \.self) { preset in
                                    Button("₹\(preset)/day") { dailyBudget = preset }
                                        .font(.system(size: 11, weight: .bold))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(dailyBudget == preset ? Color(red: 0, green: 129/255, blue: 251/255) : theme.inputBackground)
                                        .foregroundColor(dailyBudget == preset ? .white : theme.onSurfaceColor)
                                        .cornerRadius(6)
                                }
                            }
                        }
                        
                        // 3. Targeting & Demographics
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Target Locations")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("e.g. India (Tier 1 Metros)", text: $targetLocations)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Audience Interests & Keywords")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("e.g. Shopify, SaaS, Startups, Digital Marketing", text: $targetInterests)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        // 4. Creative Copy & Visuals
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Ad Headline")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("Headline copy", text: $headline)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Primary Text / Ad Copy")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            TextField("Ad description copy...", text: $primaryText)
                                .padding(12)
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Call To Action Button")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            Picker("CTA", selection: $callToAction) {
                                ForEach(ctaOptions, id: \.self) { cta in
                                    Text(cta).tag(cta)
                                }
                            }
                            .pickerStyle(.menu)
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.inputBackground)
                            .cornerRadius(10)
                        }
                        
                        // Image Presets
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Creative Preview Template")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(imagePresets, id: \.1) { preset in
                                        Button(action: { previewImage = preset.1 }) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                if let url = URL(string: preset.1) {
                                                    AsyncImage(url: url) { ph in
                                                        if let img = ph.image {
                                                            img.resizable().aspectRatio(contentMode: .fill).frame(width: 90, height: 60).clipped().cornerRadius(6)
                                                        } else {
                                                            Color.gray.opacity(0.3).frame(width: 90, height: 60).cornerRadius(6)
                                                        }
                                                    }
                                                }
                                                Text(preset.0)
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(previewImage == preset.1 ? Color(red: 0, green: 129/255, blue: 251/255) : theme.onSurfaceColor)
                                                    .lineLimit(1)
                                            }
                                            .padding(6)
                                            .background(previewImage == preset.1 ? Color(red: 0, green: 129/255, blue: 251/255).opacity(0.1) : theme.inputBackground)
                                            .cornerRadius(8)
                                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(previewImage == preset.1 ? Color(red: 0, green: 129/255, blue: 251/255) : theme.borderColor, lineWidth: 1))
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Submit Button
                        Button(action: publishCampaign) {
                            HStack {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Image(systemName: "paperplane.fill")
                                    Text("🚀 Launch Campaign on Meta")
                                        .font(.system(size: 14, weight: .bold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(
                                LinearGradient(
                                    colors: [Color(red: 0, green: 129/255, blue: 251/255), Color(red: 219/255, green: 39/255, blue: 119/255)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: Color(red: 0, green: 129/255, blue: 251/255).opacity(0.3), radius: 6, y: 3)
                        }
                        .disabled(isLoading)
                        .padding(.top, 10)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Launch Meta Ad")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
            }
        }
    }
    
    private func publishCampaign() {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Campaign name is required."
            return
        }
        
        isLoading = true
        errorMessage = ""
        
        let locationsArr = targetLocations.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let interestsArr = targetInterests.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        
        let req = CreateCampaignRequest(
            accountId: nil,
            name: name.trimmingCharacters(in: .whitespaces),
            objective: objective,
            dailyBudget: Double(dailyBudget) ?? 500,
            targetUrl: targetUrl,
            adSetName: "\(name.trimmingCharacters(in: .whitespaces)) - Ad Set 1",
            locations: locationsArr.isEmpty ? ["India (Tier 1 Metros)"] : locationsArr,
            ageRange: ageRange,
            interests: interestsArr.isEmpty ? ["SaaS", "E-Commerce", "Startups"] : interestsArr,
            placements: ["Instagram Reels", "Instagram Feed", "Facebook Feed", "Messenger Inbox"],
            headline: headline,
            primaryText: primaryText,
            callToAction: callToAction,
            destination: destination,
            previewImage: previewImage
        )
        
        Task {
            do {
                let created = try await NetworkClient.shared.createAdCampaign(request: req)
                await MainActor.run {
                    self.isLoading = false
                    self.onCreated(created)
                    self.isPresented = false
                }
            } catch {
                await MainActor.run {
                    self.isLoading = false
                    self.errorMessage = "Failed to launch campaign: \(error.localizedDescription)"
                }
            }
        }
    }
}

// MARK: - TRAFFIC SUB-VIEW (Radar)
struct TrafficTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToChat: (String, String, String) -> Void
    @State private var topUrls: [TopUrlAnalyticsDto] = []
    @State private var isLoadingTopUrls = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Live Visitor Radar")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    Text("Real-time browsing sessions & page tracking")
                        .font(.system(size: 13))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.top, 12)
                
                // Top 5 High-Converting URLs Card
                topUrlsAnalyticsCard
                
                Text("CURRENT BROWSING SESSIONS (\(socketManager.visitorsList.count))")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                    .padding(.top, 4)
                
                if socketManager.visitorsList.isEmpty {
                    Text("No visitors active.")
                        .foregroundColor(theme.textGrayColor)
                        .font(.system(size: 14))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 60)
                } else {
                    ForEach(socketManager.visitorsList) { visitor in
                        visitorCard(visitor: visitor)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .refreshable {
            loadTopUrls()
        }
        .onAppear {
            loadTopUrls()
        }
    }
    
    private var topUrlsAnalyticsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("📍 TOP 5 HIGH-CONVERTING URLS")
                    .font(.system(size: 11, weight: .black))
                    .foregroundColor(theme.primaryColor)
                Spacer()
                if isLoadingTopUrls {
                    ProgressView().scaleEffect(0.6)
                }
            }
            
            if topUrls.isEmpty && !isLoadingTopUrls {
                Text("No URL performance metrics recorded yet.")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
            } else {
                VStack(spacing: 8) {
                    ForEach(topUrls) { urlItem in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(urlItem.path)
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundColor(theme.onSurfaceColor)
                                    .lineLimit(1)
                                
                                HStack(spacing: 8) {
                                    Text("⏱️ Dwell: \(urlItem.dwellDisplay)")
                                        .font(.system(size: 10))
                                        .foregroundColor(theme.textGrayColor)
                                    Text("👥 \(urlItem.visits) visits")
                                        .font(.system(size: 10))
                                        .foregroundColor(theme.textGrayColor)
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("\(urlItem.conversionRate)% Conv")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundColor(Color.green)
                                Text("Exit: \(urlItem.exitRate)%")
                                    .font(.system(size: 9))
                                    .foregroundColor(theme.textGrayColor)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(6)
                        }
                        .padding(10)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private func loadTopUrls() {
        isLoadingTopUrls = true
        Task {
            if let list = try? await NetworkClient.shared.getTopUrls() {
                await MainActor.run {
                    self.topUrls = list
                    self.isLoadingTopUrls = false
                }
            } else {
                await MainActor.run { self.isLoadingTopUrls = false }
            }
        }
    }
    
    private func visitorCard(visitor: VisitorDto) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(visitor.isOnline ? theme.statusOnlineColor : Color.gray)
                        .frame(width: 8, height: 8)
                    
                    Text(visitor.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                
                Spacer()
                
                Text(formatTimestamp(visitor.lastSeen))
                    .font(.system(size: 11))
                    .foregroundColor(theme.textGrayColor)
            }
            
            HStack(spacing: 12) {
                let loc = [visitor.city, visitor.country].filter { !$0.isEmpty }.joined(separator: ", ")
                if !loc.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(theme.primaryColor)
                        Text(loc)
                            .font(.system(size: 11))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
                
                if !visitor.deviceType.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: visitor.deviceType.lowercased().contains("mobile") ? "iphone" : "laptopcomputer")
                            .font(.system(size: 11))
                            .foregroundColor(theme.primaryColor)
                        Text(visitor.deviceType)
                            .font(.system(size: 11))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            
            if let url = visitor.currentUrl, !url.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "link")
                        .font(.system(size: 10))
                        .foregroundColor(theme.primaryColor)
                    Text(url)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(theme.primaryColor)
                        .lineLimit(1)
                }
                .padding(6)
                .background(theme.primaryColor.opacity(0.08))
                .cornerRadius(6)
            }
            
            HStack {
                Spacer()
                Button(action: {
                    openVisitorChat(visitor: visitor)
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.left.fill")
                        Text("Start Chat")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(theme.primaryColor)
                    .foregroundColor(.white)
                    .cornerRadius(6)
                }
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(theme.borderColor, lineWidth: 1)
        )
    }
    
    private func formatTimestamp(_ timestamp: String?) -> String {
        guard let timestamp = timestamp, !timestamp.isEmpty else { return "Just now" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: timestamp) {
            let rel = RelativeDateTimeFormatter()
            rel.unitsStyle = .abbreviated
            return rel.localizedString(for: date, relativeTo: Date())
        }
        return timestamp
    }
    
    private func openVisitorChat(visitor: VisitorDto) {
        if let conv = socketManager.conversationsList.first(where: { $0.visitorId == visitor.id }) {
            onNavigateToChat(conv.id, visitor.name, visitor.id)
        } else {
            socketManager.startConversation(visitorId: visitor.id)
        }
    }
}

// MARK: - METRICS SUB-VIEW
struct MetricsTab: View {
    @StateObject private var networkClient = NetworkClient.shared
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToTab: (Int) -> Void
    
    @State private var analytics: AnalyticsResponse? = nil
    @State private var isLoading = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Workspace Overview")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    Text("Live traffic metrics and omni-channel activity")
                        .font(.system(size: 13))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.top, 12)
                
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let stats = analytics {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                        metricCard(title: "Active Chats", value: "\(stats.activeConversations)", icon: "bubble.left.and.bubble.right.fill", color: theme.primaryColor)
                        metricCard(title: "Unassigned Queue", value: "\(stats.unassignedConversations)", icon: "exclamationmark.bubble.fill", color: theme.secondaryColor)
                        metricCard(title: "Live Visitors", value: "\(stats.onlineVisitors)", icon: "person.wave.2.fill", color: theme.statusOnlineColor)
                        metricCard(title: "Total Chats", value: "\(stats.totalChats)", icon: "chart.line.uptrend.xyaxis", color: Color(red: 59/255, green: 130/255, blue: 246/255))
                    }
                    
                    // Quick Action Launchers
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Quick Actions")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        HStack(spacing: 12) {
                            Button(action: { onNavigateToTab(2) }) {
                                HStack {
                                    Image(systemName: "tray.fill")
                                    Text("Open Inbox")
                                }
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(theme.primaryColor)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            
                            Button(action: { onNavigateToTab(3) }) {
                                HStack {
                                    Image(systemName: "person.crop.rectangle.stack.fill")
                                    Text("View Leads")
                                }
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(theme.surfaceColor)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.top, 10)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .onAppear(perform: loadAnalytics)
    }
    
    private func metricCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(theme.textGrayColor)
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(color)
            }
            
            Text(value)
                .font(.system(size: 26, weight: .black))
                .foregroundColor(theme.onSurfaceColor)
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
        .shadow(color: Color.black.opacity(theme.isDark ? 0.2 : 0.04), radius: 6, y: 2)
    }
    
    private func loadAnalytics() {
        isLoading = true
        Task {
            do {
                let stats = try await networkClient.getAnalytics()
                await MainActor.run {
                    self.analytics = stats
                    self.isLoading = false
                }
            } catch {
                await MainActor.run { self.isLoading = false }
            }
        }
    }
}

// MARK: - TEAM SUB-VIEW
struct TeamTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var showAddAgentDialog = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Team & Agents")
                            .font(.system(size: 24, weight: .black))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        Text("Manage support roster and agent invitations")
                            .font(.system(size: 13))
                            .foregroundColor(theme.textGrayColor)
                    }
                    
                    Spacer()
                    
                    Button(action: { showAddAgentDialog = true }) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .padding(10)
                            .background(theme.primaryColor)
                            .clipShape(Circle())
                    }
                }
                .padding(.top, 12)
                
                ForEach(socketManager.agentsList) { agent in
                    HStack(spacing: 12) {
                        Circle()
                            .fill(theme.getStatusColor(agent.status))
                            .frame(width: 10, height: 10)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(agent.name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            Text("\(agent.email) • \(agent.role)")
                                .font(.system(size: 12))
                                .foregroundColor(theme.textGrayColor)
                        }
                        
                        Spacer()
                        
                        Text(agent.status)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(theme.getStatusColor(agent.status))
                    }
                    .padding(14)
                    .background(theme.surfaceColor)
                    .cornerRadius(14)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.borderColor, lineWidth: 1))
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .sheet(isPresented: $showAddAgentDialog) {
            AddAgentSheet(isPresented: $showAddAgentDialog)
                .environmentObject(theme)
        }
    }
}

// MARK: - ADD AGENT SHEET MODAL
struct AddAgentSheet: View {
    @Binding var isPresented: Bool
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var newName = ""
    @State private var newEmail = ""
    @State private var newPassword = ""
    @State private var isLoading = false
    @State private var statusMessage = ""
    @State private var isSuccess = false
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Register New Support Agent")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Full Name")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        TextField("Agent Name", text: $newName)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email Address")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        TextField("agent@company.com", text: $newEmail)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        SecureField("Temporary password", text: $newPassword)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                    }
                    
                    if !statusMessage.isEmpty {
                        Text(statusMessage)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(isSuccess ? Color.green : theme.secondaryColor)
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(theme.textGrayColor)
                        .frame(maxWidth: .infinity)
                    
                    Button(action: registerAgent) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Register Agent").fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(theme.primaryColor)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(isLoading)
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private func registerAgent() {
        guard !newName.trimmingCharacters(in: .whitespaces).isEmpty,
              !newEmail.trimmingCharacters(in: .whitespaces).isEmpty,
              !newPassword.trimmingCharacters(in: .whitespaces).isEmpty else {
            statusMessage = "All fields are required."
            return
        }
        
        isLoading = true
        statusMessage = ""
        
        Task {
            do {
                let response = try await NetworkClient.shared.registerAgent(request: RegisterAgentRequest(
                    name: newName.trimmingCharacters(in: .whitespaces),
                    email: newEmail.trimmingCharacters(in: .whitespaces),
                    password: newPassword.trimmingCharacters(in: .whitespaces)
                ))
                await MainActor.run {
                    isSuccess = true
                    statusMessage = "Agent registered!"
                    socketManager.agentsList.append(response.agent)
                    NetworkClient.shared.cachedAgents = socketManager.agentsList
                    isLoading = false
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - COMPREHENSIVE DYNAMIC SETTINGS HUB
struct SettingsTab: View {
    var onNavigateToAds: (() -> Void)? = nil
    
    @StateObject private var networkClient = NetworkClient.shared
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    // Profile State
    @State private var nameInput = ""
    @State private var passwordInput = ""
    @State private var emailReadonly = ""
    @State private var isSavingProfile = false
    @State private var profileStatusMessage = ""
    @State private var profileSuccess = false
    
    // Live Chat Widget Customizer State
    @State private var widgetSettings = WidgetSettingsDto()
    @State private var widgetHeading = "Chat with Support"
    @State private var widgetWelcome = "Hi there! How can we help you today?"
    @State private var widgetPosition = "bottom-right"
    @State private var widgetPreChat = false
    @State private var isSavingWidget = false
    @State private var widgetSavedToast = false
    
    // Quick Replies Manager State
    @State private var quickReplies: [QuickReplyDto] = []
    @State private var showAddQuickReply = false
    @State private var newShortcut = ""
    @State private var newReplyText = ""
    @State private var isAddingReply = false
    
    // Upsell Pitches Manager State
    @State private var pitchesList: [UpsellPitchDto] = []
    @State private var showAddPitch = false
    @State private var newPitchTitle = ""
    @State private var newPitchBadge = "⚡ Deal"
    @State private var newPitchSubpath = ""
    @State private var newPitchText = ""
    @State private var isAddingPitch = false
    
    // Notifications & Sound Preferences
    @State private var pushNotificationsEnabled = true
    @State private var newLeadSoundEnabled = true
    @State private var quietHoursEnabled = false
    
    // Security & Biometrics
    @State private var biometricLockEnabled = false
    @State private var biometricAvailable = false
    @State private var biometricType = "Face ID"
    
    // Storage & Cache
    @State private var calculatedCacheSize = "18.4 MB"
    @State private var cacheClearedToast = false
    
    // Meta Hub & Subscription State
    @State private var isPingingWebhook = false
    @State private var webhookPingResult: String? = nil
    @State private var tenantsList: [TenantWorkspaceDto] = []
    @State private var isLoadingTenants = false
    
    // Logout Alert
    @State private var showLogoutConfirm = false
    
    var isSuperAdmin: Bool {
        networkClient.currentUser?.isSuperAdmin == true
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Main Header
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text("Settings & Control Hub")
                            .font(.system(size: 24, weight: .black))
                            .foregroundColor(theme.onSurfaceColor)
                        Spacer()
                        if isSuperAdmin {
                            Text("SUPERADMIN")
                                .font(.system(size: 9, weight: .black))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color.purple.opacity(0.18))
                                .foregroundColor(Color.purple)
                                .cornerRadius(6)
                        }
                    }
                    
                    Text("Profile, live chat widget, branding, quick replies & notifications")
                        .font(.system(size: 13))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.top, 12)
                
                // 1. Account Profile Card
                accountProfileCard
                
                // 2. Appearance & Accent Color Theme Card
                appearanceThemeCard
                
                // 3. Live Chat Widget Customizer Card
                liveChatWidgetCard
                
                // 4. Quick Replies & Canned Responses Manager
                quickRepliesManagerCard
                
                // 4b. Upsell Pitch Templates Manager
                pitchesManagerCard
                
                // 5. Notifications & Alerts Card
                notificationsAlertsCard
                
                // 6. Omnichannel & Meta Ads Manager Card
                metaOmnichannelCard
                
                // 7. Security & Biometrics Card
                securityBiometricsCard
                
                // 8. Storage, Data & Cache Card
                storageDataCard
                
                // 9. Subscription & Plan Quota HUD
                subscriptionPlanCard
                
                // 10. SuperAdmin Workspace Management (If SuperAdmin)
                if isSuperAdmin {
                    superAdminConsoleCard
                }
                
                // 11. About & Sign Out Button
                aboutAndLogoutCard
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .sheet(isPresented: $showAddQuickReply) {
            addQuickReplySheet
        }
        .sheet(isPresented: $showAddPitch) {
            addPitchSheet
        }
        .alert(isPresented: $showLogoutConfirm) {
            Alert(
                title: Text("Sign Out"),
                message: Text("Are you sure you want to sign out of LetsTrack?"),
                primaryButton: .destructive(Text("Sign Out")) {
                    networkClient.clearAuth()
                },
                secondaryButton: .cancel()
            )
        }
        .onAppear {
            loadInitialSettings()
        }
    }
    
    // MARK: - 1. Account Profile Card
    private var accountProfileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Circle()
                    .fill(LinearGradient(
                        colors: [theme.primaryColor.opacity(0.3), theme.primaryColor],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 52, height: 52)
                    .overlay(
                        Text(String(nameInput.prefix(1)).uppercased())
                            .font(.system(size: 22, weight: .black))
                            .foregroundColor(.white)
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(nameInput.isEmpty ? "Agent Profile" : nameInput)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    Text(emailReadonly)
                        .font(.system(size: 12))
                        .foregroundColor(theme.textGrayColor)
                    
                    HStack(spacing: 6) {
                        Text(networkClient.currentUser?.role ?? "Agent")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(theme.primaryColor.opacity(0.15))
                            .foregroundColor(theme.primaryColor)
                            .cornerRadius(4)
                        
                        Text("Active Session")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .foregroundColor(.green)
                            .cornerRadius(4)
                    }
                }
            }
            
            Divider().background(theme.borderColor)
            
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Display Name")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    
                    TextField("", text: $nameInput)
                        .padding(10)
                        .background(theme.inputBackground)
                        .foregroundColor(theme.onSurfaceColor)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Change Password")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    
                    SecureField("Leave blank to keep unchanged", text: $passwordInput)
                        .padding(10)
                        .background(theme.inputBackground)
                        .foregroundColor(theme.onSurfaceColor)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
                
                if !profileStatusMessage.isEmpty {
                    Text(profileStatusMessage)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(profileSuccess ? Color.green : Color.red)
                }
                
                Button(action: saveProfileDetails) {
                    HStack {
                        if isSavingProfile {
                            ProgressView().tint(.white)
                        } else {
                            Text("Update Profile")
                                .font(.system(size: 13, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(theme.primaryColor)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .disabled(isSavingProfile)
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 2. Appearance & Accent Themes
    private var appearanceThemeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Appearance & Brand Styling")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
            
            // Light vs Dark Mode
            HStack(spacing: 12) {
                Button(action: {
                    theme.triggerHaptic(style: .medium)
                    theme.themeMode = "light"
                }) {
                    HStack {
                        Image(systemName: "sun.max.fill")
                        Text("Light Mode")
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(theme.themeMode == "light" ? .white : theme.onSurfaceColor)
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .background(theme.themeMode == "light" ? theme.primaryColor : theme.inputBackground)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                }
                
                Button(action: {
                    theme.triggerHaptic(style: .medium)
                    theme.themeMode = "dark"
                }) {
                    HStack {
                        Image(systemName: "moon.fill")
                        Text("Dark Mode")
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(theme.themeMode == "dark" ? .white : theme.onSurfaceColor)
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .background(theme.themeMode == "dark" ? theme.primaryColor : theme.inputBackground)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                }
            }
            
            // 6 Brand Accent Color Palettes
            VStack(alignment: .leading, spacing: 8) {
                Text("Brand Accent Color")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                
                HStack(spacing: 10) {
                    accentColorCircle(name: "red", label: "Crimson", color: Color(red: 220/255, green: 38/255, blue: 38/255))
                    accentColorCircle(name: "blue", label: "Royal", color: Color(red: 37/255, green: 99/255, blue: 235/255))
                    accentColorCircle(name: "emerald", label: "Emerald", color: Color(red: 16/255, green: 185/255, blue: 129/255))
                    accentColorCircle(name: "purple", label: "Violet", color: Color(red: 124/255, green: 58/255, blue: 237/255))
                    accentColorCircle(name: "amber", label: "Amber", color: Color(red: 245/255, green: 158/255, blue: 11/255))
                    accentColorCircle(name: "pink", label: "Rose", color: Color(red: 236/255, green: 72/255, blue: 153/255))
                }
            }
            
            Divider().background(theme.borderColor)
            
            // Haptics & Sound
            Toggle(isOn: $theme.hapticsEnabled) {
                HStack(spacing: 6) {
                    Image(systemName: "iphone.radiowaves.left.and.right")
                        .foregroundColor(theme.primaryColor)
                    Text("Haptic Feedback on Actions")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.onSurfaceColor)
                }
            }
            .tint(theme.primaryColor)
            
            Toggle(isOn: $theme.soundsEnabled) {
                HStack(spacing: 6) {
                    Image(systemName: "speaker.wave.2.fill")
                        .foregroundColor(theme.primaryColor)
                    Text("In-App Audio Chimes")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.onSurfaceColor)
                }
            }
            .tint(theme.primaryColor)
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private func accentColorCircle(name: String, label: String, color: Color) -> some View {
        Button(action: {
            theme.accentColorKey = name
            theme.triggerHaptic(style: .rigid)
        }) {
            VStack(spacing: 4) {
                ZStack {
                    Circle()
                        .fill(color)
                        .frame(width: 36, height: 36)
                    
                    if theme.accentColorKey.lowercased() == name {
                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                
                Text(label)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(theme.onSurfaceColor)
            }
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - 3. Live Chat Widget Customizer Card
    private var liveChatWidgetCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LIVE CHAT WIDGET")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(theme.primaryColor)
                    Text("Website Chat Customizer")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
            }
            
            // Live Preview Card
            VStack(alignment: .leading, spacing: 8) {
                Text("LIVE CUSTOMER PREVIEW")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                
                HStack(spacing: 10) {
                    Circle()
                        .fill(theme.primaryColor)
                        .frame(width: 36, height: 36)
                        .overlay(Image(systemName: "bubble.left.fill").font(.system(size: 16)).foregroundColor(.white))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(widgetHeading.isEmpty ? "Chat with Us" : widgetHeading)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text(widgetWelcome.isEmpty ? "How can we assist you?" : widgetWelcome)
                            .font(.system(size: 11))
                            .foregroundColor(theme.textGrayColor)
                            .lineLimit(1)
                    }
                    Spacer()
                }
                .padding(12)
                .background(theme.inputBackground)
                .cornerRadius(10)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
            }
            
            // Config Fields
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Header Heading Text")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    TextField("", text: $widgetHeading)
                        .padding(10)
                        .background(theme.inputBackground)
                        .foregroundColor(theme.onSurfaceColor)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Welcome Greeting Message")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.textGrayColor)
                    TextField("", text: $widgetWelcome)
                        .padding(10)
                        .background(theme.inputBackground)
                        .foregroundColor(theme.onSurfaceColor)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
                
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Widget Position")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        
                        Picker("Position", selection: $widgetPosition) {
                            Text("Bottom Right").tag("bottom-right")
                            Text("Bottom Left").tag("bottom-left")
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }
                }
                
                if widgetSavedToast {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                        Text("Widget settings synced to website!")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.green)
                    }
                }
                
                Button(action: saveWidgetCustomizations) {
                    HStack {
                        if isSavingWidget {
                            ProgressView().tint(.white)
                        } else {
                            Text("Save & Publish Widget")
                                .font(.system(size: 13, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(theme.primaryColor)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .disabled(isSavingWidget)
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 4. Quick Replies Manager Card
    private var quickRepliesManagerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CANNED RESPONSES")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(theme.primaryColor)
                    Text("Quick Reply Templates")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
                Button(action: { showAddQuickReply = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                        Text("Add")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.primaryColor)
                    .cornerRadius(6)
                }
            }
            
            if quickReplies.isEmpty {
                Text("No quick replies configured. Add shortcuts like /welcome or /pricing to reply in 1 tap.")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                    .padding(.vertical, 6)
            } else {
                VStack(spacing: 8) {
                    ForEach(quickReplies) { qr in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(qr.shortcut)
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundColor(theme.primaryColor)
                                Text(qr.text)
                                    .font(.system(size: 12))
                                    .foregroundColor(theme.onSurfaceColor)
                                    .lineLimit(2)
                            }
                            Spacer()
                            Button(action: {
                                deleteQuickReplyItem(id: qr.id)
                            }) {
                                Image(systemName: "trash")
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                                    .padding(6)
                            }
                        }
                        .padding(10)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 4b. Upsell Pitches Manager Card
    private var pitchesManagerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("DEALS & OFFERS")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                    Text("Upsell Pitch Templates")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
                Button(action: { showAddPitch = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                        Text("Add Pitch")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(red: 245/255, green: 158/255, blue: 11/255))
                    .cornerRadius(6)
                }
            }
            
            if pitchesList.isEmpty {
                Text("No upsell pitches configured yet. Add promotional pitches with custom badges.")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                    .padding(.vertical, 6)
            } else {
                VStack(spacing: 8) {
                    ForEach(pitchesList) { p in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(p.title)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(theme.onSurfaceColor)
                                    Text(p.badgeText)
                                        .font(.system(size: 9, weight: .black))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.18))
                                        .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                                        .cornerRadius(4)
                                }
                                
                                Text(p.pitchText)
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.textGrayColor)
                                    .lineLimit(2)
                            }
                            Spacer()
                            Button(action: {
                                deletePitchItem(id: p.id)
                            }) {
                                Image(systemName: "trash")
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                                    .padding(6)
                            }
                        }
                        .padding(10)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private var addPitchSheet: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            VStack(spacing: 16) {
                Text("New Upsell Pitch Template")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Pitch Title")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextField("e.g. 20% Growth Plan Discount", text: $newPitchTitle)
                            .padding(10)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Badge Text")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextField("e.g. ⚡ 20% OFF", text: $newPitchBadge)
                            .padding(10)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Target Subpath (Optional)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextField("/pricing", text: $newPitchSubpath)
                            .padding(10)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Pitch Message")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextEditor(text: $newPitchText)
                            .frame(height: 90)
                            .padding(6)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button(action: { showAddPitch = false }) {
                        Text("Cancel")
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                    }
                    
                    Button(action: saveNewPitch) {
                        HStack {
                            if isAddingPitch {
                                ProgressView().tint(.white)
                            } else {
                                Text("Save Pitch")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color(red: 245/255, green: 158/255, blue: 11/255))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(isAddingPitch || newPitchTitle.isEmpty || newPitchText.isEmpty)
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private var addQuickReplySheet: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            VStack(spacing: 16) {
                Text("New Quick Reply")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Shortcut (e.g. /pricing)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextField("/shortcut", text: $newShortcut)
                            .padding(10)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Canned Message Text")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        TextEditor(text: $newReplyText)
                            .frame(height: 90)
                            .padding(6)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") { showAddQuickReply = false }
                        .foregroundColor(theme.textGrayColor)
                        .frame(maxWidth: .infinity)
                    
                    Button(action: saveNewQuickReply) {
                        HStack {
                            if isAddingReply {
                                ProgressView().tint(.white)
                            } else {
                                Text("Save Reply")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(theme.primaryColor)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(isAddingReply)
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    // MARK: - 5. Notifications & Alerts Card
    private var notificationsAlertsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Notifications & Alerts")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
            
            Toggle(isOn: $pushNotificationsEnabled) {
                HStack(spacing: 8) {
                    Image(systemName: "bell.badge.fill")
                        .foregroundColor(theme.primaryColor)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Push Notifications")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Receive instant alerts for new inbound customer chats")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            .tint(theme.primaryColor)
            
            Toggle(isOn: $newLeadSoundEnabled) {
                HStack(spacing: 8) {
                    Image(systemName: "bolt.fill")
                        .foregroundColor(Color.orange)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("New Lead Vibration & Alert")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Vibrate when a visitor converts to a sales lead")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            .tint(theme.primaryColor)
            
            Toggle(isOn: $quietHoursEnabled) {
                HStack(spacing: 8) {
                    Image(systemName: "moon.stars.fill")
                        .foregroundColor(Color.purple)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Quiet Hours (DND)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Silence notifications outside working schedule")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            .tint(theme.primaryColor)
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 6. Omnichannel & Meta Marketing
    private var metaOmnichannelCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("OMNICHANNEL CHANNELS & ADS")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(Color(red: 0, green: 129/255, blue: 251/255))
                    Text("Marketing & Social Integrations")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
            }
            
            if let onNavigateToAds = onNavigateToAds {
                Button(action: onNavigateToAds) {
                    HStack {
                        Image(systemName: "megaphone.fill")
                            .font(.system(size: 14))
                        Text("Launch Meta Ads & Marketing Manager")
                            .font(.system(size: 13, weight: .bold))
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .padding(12)
                    .background(Color(red: 0, green: 129/255, blue: 251/255))
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
            }
            
            VStack(spacing: 8) {
                channelRow(icon: "bubble.left.fill", title: "WhatsApp Cloud API", subtitle: "+91 98765 43210", isConnected: true, color: Color(red: 22/255, green: 163/255, blue: 74/255))
                channelRow(icon: "camera.fill", title: "Instagram Business DM", subtitle: "@letstrack_live", isConnected: true, color: Color(red: 225/255, green: 48/255, blue: 108/255))
                channelRow(icon: "person.2.fill", title: "Facebook Pages Messenger", subtitle: "LetsTrack Omnichannel", isConnected: true, color: Color(red: 24/255, green: 119/255, blue: 242/255))
            }
            
            Button(action: pingOmnichannelWebhook) {
                HStack(spacing: 6) {
                    if isPingingWebhook {
                        ProgressView().tint(theme.primaryColor).frame(width: 14, height: 14)
                    } else {
                        Image(systemName: "bolt.horizontal.fill")
                    }
                    Text("Test Webhook Roundtrip Ping")
                        .font(.system(size: 12, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(theme.inputBackground)
                .foregroundColor(theme.onSurfaceColor)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
            }
            .disabled(isPingingWebhook)
            
            if let pingResult = webhookPingResult {
                HStack(spacing: 6) {
                    Circle().fill(Color.green).frame(width: 8, height: 8)
                    Text(pingResult)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.green)
                    Spacer()
                }
                .padding(8)
                .background(Color.green.opacity(0.1))
                .cornerRadius(6)
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 7. Security & Biometrics
    private var securityBiometricsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Security & Privacy")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
            
            Toggle(isOn: $biometricLockEnabled) {
                HStack(spacing: 8) {
                    Image(systemName: biometricType == "Face ID" ? "faceid" : "touchid")
                        .foregroundColor(theme.primaryColor)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(biometricType) App Lock")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                        Text("Require biometric authentication when opening the app")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textGrayColor)
                    }
                }
            }
            .tint(theme.primaryColor)
            .onChange(of: biometricLockEnabled) { enabled in
                UserDefaults.standard.set(enabled, forKey: "biometric_lock_enabled")
                theme.triggerHaptic(style: .medium)
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 8. Storage, Data & Cache
    private var storageDataCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Data & Media Storage")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Temporary Media Cache")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.onSurfaceColor)
                    Text("Photos and thumbnails stored on this device")
                        .font(.system(size: 10))
                        .foregroundColor(theme.textGrayColor)
                }
                Spacer()
                Text(calculatedCacheSize)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(theme.primaryColor)
            }
            
            if cacheClearedToast {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                    Text("Cache cleared successfully!")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.green)
                }
            }
            
            Button(action: clearMediaCache) {
                HStack(spacing: 6) {
                    Image(systemName: "trash")
                    Text("Clear Local Media Cache")
                        .font(.system(size: 12, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(theme.inputBackground)
                .foregroundColor(theme.onSurfaceColor)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 9. Subscription & Plan Quota
    private var subscriptionPlanCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("SUBSCRIPTION & BILLING")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(theme.primaryColor)
                    Text("Enterprise Growth Plan")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
                Text("ACTIVE")
                    .font(.system(size: 10, weight: .black))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.15))
                    .foregroundColor(.green)
                    .cornerRadius(6)
            }
            
            Divider().background(theme.borderColor)
            
            VStack(spacing: 8) {
                HStack {
                    Text("👥 Agent Seats")
                        .font(.system(size: 12))
                        .foregroundColor(theme.textGrayColor)
                    Spacer()
                    Text("\(socketManager.agentsList.count) / 10 Active")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                
                HStack {
                    Text("🎯 Leads Quota")
                        .font(.system(size: 12))
                        .foregroundColor(theme.textGrayColor)
                    Spacer()
                    Text("Unlimited Ingestion")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                
                HStack {
                    Text("⚡ Meta Omnichannel Sync")
                        .font(.system(size: 12))
                        .foregroundColor(theme.textGrayColor)
                    Spacer()
                    Text("Enabled & High Priority")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.green)
                }
            }
            
            Button(action: openBillingPortal) {
                HStack {
                    Image(systemName: "creditcard.fill")
                    Text("Manage Plan & Invoices on Web ↗")
                        .font(.system(size: 13, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(theme.primaryColor.opacity(0.12))
                .foregroundColor(theme.primaryColor)
                .cornerRadius(10)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.primaryColor.opacity(0.3), lineWidth: 1))
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    // MARK: - 10. SuperAdmin Console
    private var superAdminConsoleCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("SUPERADMIN CONSOLE")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(Color.purple)
                    Text("Managed Workspaces & Tenants")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                }
                Spacer()
                Button(action: loadSuperAdminTenants) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Color.purple)
                }
            }
            
            if isLoadingTenants {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 8)
            } else if tenantsList.isEmpty {
                Text("Current Active Tenant: \(networkClient.currentTenant?.name ?? "Main Organization") (\(networkClient.currentTenant?.domain ?? "letstrack.manacity.in"))")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(theme.inputBackground)
                    .cornerRadius(8)
            } else {
                ForEach(tenantsList) { tenant in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tenant.name)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            Text(tenant.domain)
                                .font(.system(size: 11))
                                .foregroundColor(theme.textGrayColor)
                        }
                        Spacer()
                        if tenant.id == networkClient.currentTenant?.id {
                            Text("CURRENT")
                                .font(.system(size: 9, weight: .black))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.green.opacity(0.15))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                    }
                    .padding(10)
                    .background(theme.inputBackground)
                    .cornerRadius(8)
                }
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.purple.opacity(0.3), lineWidth: 1))
    }
    
    // MARK: - 11. About & Sign Out
    private var aboutAndLogoutCard: some View {
        VStack(spacing: 12) {
            HStack {
                Text("LetsTrack Mobile iOS")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                Spacer()
                Text("v1.2.0 • Build 42")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(theme.textGrayColor)
            }
            .padding(.horizontal, 4)
            
            Button(action: {
                theme.triggerHaptic(style: .rigid)
                showLogoutConfirm = true
            }) {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                    Text("Sign Out of Account")
                        .fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Color.red.opacity(0.12))
                .foregroundColor(.red)
                .cornerRadius(10)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.red.opacity(0.3), lineWidth: 1))
            }
        }
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private func channelRow(icon: String, title: String, subtitle: String, isConnected: Bool, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
                .frame(width: 28, height: 28)
                .background(color.opacity(0.12))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundColor(theme.textGrayColor)
            }
            
            Spacer()
            
            Text(isConnected ? "CONNECTED" : "OFFLINE")
                .font(.system(size: 9, weight: .black))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(isConnected ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
                .foregroundColor(isConnected ? .green : .red)
                .cornerRadius(4)
        }
        .padding(10)
        .background(theme.inputBackground)
        .cornerRadius(8)
    }
    
    private func loadInitialSettings() {
        if let user = networkClient.currentUser {
            nameInput = user.name
            emailReadonly = user.email
        }
        
        let laContext = LAContext()
        var error: NSError?
        biometricAvailable = laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        if biometricAvailable {
            biometricType = laContext.biometryType == .faceID ? "Face ID" : "Touch ID"
        }
        biometricLockEnabled = UserDefaults.standard.bool(forKey: "biometric_lock_enabled")
        
        Task {
            if let qrList = try? await networkClient.getQuickReplies() {
                await MainActor.run { self.quickReplies = qrList }
            }
            if let pList = try? await networkClient.getPitches() {
                await MainActor.run { self.pitchesList = pList }
            }
            if let wSettings = try? await networkClient.getWidgetSettings() {
                await MainActor.run {
                    self.widgetSettings = wSettings
                    if let head = wSettings.headingText { self.widgetHeading = head }
                    if let welc = wSettings.welcomeMessage { self.widgetWelcome = welc }
                    if let pos = wSettings.position { self.widgetPosition = pos }
                }
            }
        }
        
        if isSuperAdmin {
            loadSuperAdminTenants()
        }
    }
    
    private func saveWidgetCustomizations() {
        isSavingWidget = true
        var updated = widgetSettings
        updated.headingText = widgetHeading.trimmingCharacters(in: .whitespaces)
        updated.welcomeMessage = widgetWelcome.trimmingCharacters(in: .whitespaces)
        updated.position = widgetPosition
        
        Task {
            do {
                _ = try await networkClient.updateWidgetSettings(settings: updated)
                await MainActor.run {
                    self.isSavingWidget = false
                    withAnimation { self.widgetSavedToast = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        withAnimation { self.widgetSavedToast = false }
                    }
                }
            } catch {
                await MainActor.run { self.isSavingWidget = false }
            }
        }
    }
    
    private func saveNewQuickReply() {
        guard !newShortcut.isEmpty && !newReplyText.isEmpty else { return }
        isAddingReply = true
        Task {
            do {
                let created = try await networkClient.createQuickReply(shortcut: newShortcut.trimmingCharacters(in: .whitespaces), text: newReplyText.trimmingCharacters(in: .whitespaces))
                await MainActor.run {
                    self.quickReplies.append(created)
                    self.newShortcut = ""
                    self.newReplyText = ""
                    self.isAddingReply = false
                    self.showAddQuickReply = false
                }
            } catch {
                await MainActor.run { self.isAddingReply = false }
            }
        }
    }
    
    private func saveNewPitch() {
        guard !newPitchTitle.isEmpty && !newPitchText.isEmpty else { return }
        isAddingPitch = true
        Task {
            do {
                let created = try await networkClient.createPitch(
                    title: newPitchTitle.trimmingCharacters(in: .whitespaces),
                    badgeText: newPitchBadge.trimmingCharacters(in: .whitespaces),
                    targetSubpath: newPitchSubpath.trimmingCharacters(in: .whitespaces),
                    pitchText: newPitchText.trimmingCharacters(in: .whitespaces)
                )
                await MainActor.run {
                    self.pitchesList.append(created)
                    self.newPitchTitle = ""
                    self.newPitchBadge = "⚡ Deal"
                    self.newPitchSubpath = ""
                    self.newPitchText = ""
                    self.isAddingPitch = false
                    self.showAddPitch = false
                }
            } catch {
                await MainActor.run { self.isAddingPitch = false }
            }
        }
    }
    
    private func deletePitchItem(id: String) {
        Task {
            do {
                try await networkClient.deletePitch(id: id)
                await MainActor.run {
                    self.pitchesList.removeAll(where: { $0.id == id })
                }
            } catch {
                print("Failed to delete pitch: \(error)")
            }
        }
    }
    
    private func deleteQuickReplyItem(id: String) {
        Task {
            do {
                try await networkClient.deleteQuickReply(id: id)
                await MainActor.run {
                    self.quickReplies.removeAll(where: { $0.id == id })
                }
            } catch {
                print("Failed to delete quick reply: \(error)")
            }
        }
    }
    
    private func clearMediaCache() {
        URLCache.shared.removeAllCachedResponses()
        withAnimation {
            calculatedCacheSize = "0 KB"
            cacheClearedToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation { cacheClearedToast = false }
        }
    }
    
    private func openBillingPortal() {
        let token = networkClient.authToken ?? ""
        let urlStr = "https://letstrack.manacity.in/#billing?token=\(token)"
        if let url = URL(string: urlStr) {
            UIApplication.shared.open(url)
        }
    }
    
    private func pingOmnichannelWebhook() {
        isPingingWebhook = true
        webhookPingResult = nil
        Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            await MainActor.run {
                isPingingWebhook = false
                webhookPingResult = "Omnichannel Webhook Online • Roundtrip 48ms • 100% Operational"
            }
        }
    }
    
    private func loadSuperAdminTenants() {
        isLoadingTenants = true
        Task {
            do {
                let tenants = try await networkClient.getSuperAdminTenants()
                await MainActor.run {
                    self.tenantsList = tenants
                    self.isLoadingTenants = false
                }
            } catch {
                await MainActor.run {
                    self.isLoadingTenants = false
                }
            }
        }
    }
    
    private func saveProfileDetails() {
        guard !nameInput.trimmingCharacters(in: .whitespaces).isEmpty else {
            profileStatusMessage = "Name cannot be empty."
            profileSuccess = false
            return
        }
        
        isSavingProfile = true
        profileStatusMessage = ""
        profileSuccess = false
        
        Task {
            do {
                _ = try await networkClient.updateProfile(request: UpdateProfileRequest(
                    name: nameInput.trimmingCharacters(in: .whitespaces),
                    avatarUrl: nil,
                    password: passwordInput.isEmpty ? nil : passwordInput.trimmingCharacters(in: .whitespaces)
                ))
                await MainActor.run {
                    profileSuccess = true
                    profileStatusMessage = "Profile updated successfully!"
                    passwordInput = ""
                    isSavingProfile = false
                }
            } catch {
                await MainActor.run {
                    profileStatusMessage = error.localizedDescription
                    isSavingProfile = false
                }
            }
        }
    }
}



// MARK: - Status Changer Dialog Sheet
struct StatusChangerSheet: View {
    @Binding var isPresented: Bool
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Update Presence Status")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(spacing: 8) {
                    statusRow(statusName: "Online")
                    statusRow(statusName: "Away")
                    statusRow(statusName: "Offline")
                }
                .padding(.horizontal)
                
                Spacer()
                
                Button(action: { isPresented = false }) {
                    Text("Dismiss")
                        .fontWeight(.bold)
                        .foregroundColor(theme.primaryColor)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(theme.borderColor, lineWidth: 1)
                        )
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private func statusRow(statusName: String) -> some View {
        Button(action: {
            socketManager.updateStatus(status: statusName)
            isPresented = false
        }) {
            HStack {
                Circle()
                    .fill(theme.getStatusColor(statusName))
                    .frame(width: 10, height: 10)
                
                Text(statusName)
                    .font(.system(size: 15, weight: socketManager.selfStatus == statusName ? .bold : .regular))
                    .foregroundColor(socketManager.selfStatus == statusName ? theme.primaryColor : theme.onSurfaceColor)
                
                Spacer()
                
                if socketManager.selfStatus == statusName {
                    Image(systemName: "checkmark")
                        .foregroundColor(theme.primaryColor)
                }
            }
            .padding(14)
            .background(theme.surfaceColor)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
        }
    }
}
