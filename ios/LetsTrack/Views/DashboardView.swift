import SwiftUI

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
        networkClient.currentUser?.role == "Admin"
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
                        
                        LeadsTab(onNavigateToChat: navigateToChatScreen)
                        .tag(3)
                        
                        if isAdmin {
                            TeamTab()
                                .tag(4)
                        }
                        
                        SettingsTab()
                            .tag(isAdmin ? 5 : 4)
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
                Text(networkClient.currentTenant?.name ?? "LetsTrack")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                
                Text(isAdmin ? "SuperAdmin Console" : "Agent Workstation")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(theme.primaryColor)
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
            
            if isAdmin {
                DockItem(icon: "person.2.fill", label: "Team", index: 4, selection: $selectedTab)
            }
            
            DockItem(icon: "gearshape.fill", label: "Settings", index: isAdmin ? 5 : 4, selection: $selectedTab)
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
                    
                    // Channel Badge Icon
                    ZStack {
                        Circle()
                            .fill(channelColor)
                            .frame(width: 18, height: 18)
                        
                        Image(systemName: getChannelIcon(channel))
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                    }
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
        let clean = phone.replacingOccurrences(of: " ", with: "")
        if let url = URL(string: "tel://\(clean)") {
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
    
    @State var name = ""
    @State var email = ""
    @State var phone = ""
    @State var company = ""
    @State var source = "manual"
    @State var status = "New"
    @State var dealValue = ""
    @State var note = ""
    
    @State private var isLoading = false
    @State private var errorMessage = ""
    
    let sources = ["manual", "meta-ads", "whatsapp", "instagram", "facebook", "chat"]
    let statuses = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]
    
    var body: some View {
        NavigationStack {
            ZStack {
                theme.backgroundColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Full Name *")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
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
            conversationId: nil,
            visitorId: nil
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
        let clean = phone.replacingOccurrences(of: " ", with: "")
        if let url = URL(string: "tel://\(clean)") {
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

// MARK: - TRAFFIC SUB-VIEW (Radar)
struct TrafficTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToChat: (String, String, String) -> Void
    
    var onlineVisitors: [VisitorDto] {
        socketManager.visitorsList.filter { $0.isOnline }
    }
    
    var offlineVisitors: [VisitorDto] {
        socketManager.visitorsList.filter { !$0.isOnline }
    }
    
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
                
                if socketManager.visitorsList.isEmpty {
                    Text("No visitors active.")
                        .foregroundColor(theme.textGrayColor)
                        .font(.system(size: 14))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 60)
                } else {
                    if !onlineVisitors.isEmpty {
                        Text("Active Online (\(onlineVisitors.count))")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(theme.statusOnlineColor)
                        
                        ForEach(onlineVisitors) { visitor in
                            visitorCard(visitor: visitor)
                        }
                    }
                    
                    if !offlineVisitors.isEmpty {
                        Text("Recent Sessions (\(offlineVisitors.count))")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                            .padding(.top, 8)
                        
                        ForEach(offlineVisitors) { visitor in
                            visitorCard(visitor: visitor)
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
    }
    
    private func visitorCard(visitor: VisitorDto) -> some View {
        Button(action: {
            openVisitorChat(visitor: visitor)
        }) {
            HStack(spacing: 12) {
                Circle()
                    .fill(visitor.isOnline ? theme.statusOnlineColor : theme.statusOfflineColor)
                    .frame(width: 10, height: 10)
                
                VStack(alignment: .leading, spacing: 3) {
                    Text(visitor.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    Text("📍 \(visitor.city), \(visitor.country)")
                        .font(.system(size: 11))
                        .foregroundColor(theme.textGrayColor)
                    
                    Text("Url: \(visitor.currentUrl ?? "/")")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(theme.primaryColor)
                        .lineLimit(1)
                }
                
                Spacer()
                
                Image(systemName: "paperplane.fill")
                    .foregroundColor(theme.primaryColor)
                    .font(.system(size: 15))
                    .padding(8)
            }
            .padding(14)
            .background(theme.surfaceColor)
            .cornerRadius(14)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(theme.borderColor, lineWidth: 1)
            )
        }
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

// MARK: - SETTINGS SUB-VIEW
struct SettingsTab: View {
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var nameInput = ""
    @State private var passwordInput = ""
    @State private var emailReadonly = ""
    
    @State private var isLoading = false
    @State private var statusMessage = ""
    @State private var isSuccess = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Workspace Settings")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    Text("Theme preferences and agent profile")
                        .font(.system(size: 13))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.top, 12)
                
                // 1. Theme Configuration Card
                VStack(alignment: .leading, spacing: 12) {
                    Text("Theme Appearance")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    HStack(spacing: 12) {
                        Button(action: { theme.themeMode = "light" }) {
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
                        
                        Button(action: { theme.themeMode = "dark" }) {
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
                }
                .padding(16)
                .background(theme.surfaceColor)
                .cornerRadius(16)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                
                // 2. Profile Details Form Card
                VStack(alignment: .leading, spacing: 14) {
                    Text("Account Profile")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.system(size: 12))
                            .foregroundColor(theme.textGrayColor)
                        
                        Text(emailReadonly)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.textGrayColor)
                            .cornerRadius(8)
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Display Name")
                            .font(.system(size: 12))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        TextField("", text: $nameInput)
                            .padding()
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                            .disabled(isLoading)
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Change Password")
                            .font(.system(size: 12))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        SecureField("Leave blank to keep current", text: $passwordInput)
                            .padding()
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                            .disabled(isLoading)
                    }
                    
                    if !statusMessage.isEmpty {
                        Text(statusMessage)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(isSuccess ? Color.green : theme.secondaryColor)
                    }
                    
                    Button(action: saveConfigurations) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Save Changes")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(theme.primaryColor)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(isLoading)
                }
                .padding(16)
                .background(theme.surfaceColor)
                .cornerRadius(16)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .onAppear {
            if let user = networkClient.currentUser {
                nameInput = user.name
                emailReadonly = user.email
            }
        }
    }
    
    private func saveConfigurations() {
        guard !nameInput.trimmingCharacters(in: .whitespaces).isEmpty else {
            statusMessage = "Name cannot be empty."
            isSuccess = false
            return
        }
        
        isLoading = true
        statusMessage = ""
        isSuccess = false
        
        Task {
            do {
                _ = try await networkClient.updateProfile(request: UpdateProfileRequest(
                    name: nameInput.trimmingCharacters(in: .whitespaces),
                    avatarUrl: nil,
                    password: passwordInput.isEmpty ? nil : passwordInput.trimmingCharacters(in: .whitespaces)
                ))
                await MainActor.run {
                    isSuccess = true
                    statusMessage = "Profile updated successfully!"
                    passwordInput = ""
                    isLoading = false
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
