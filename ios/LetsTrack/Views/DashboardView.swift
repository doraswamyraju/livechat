import SwiftUI

struct DashboardView: View {
    @StateObject private var socketManager = SocketManager.shared
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var selectedTab = 0 // 0: Metrics, 1: Traffic, 2: Inbox, 3: Team, 4: Settings
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
            ZStack {
                theme.backgroundColor.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Navigation Bar Header
                    customNavBarHeader
                    
                    // Main content tab area
                    TabView(selection: $selectedTab) {
                        MetricsTab(onNavigateToTab: { tabIndex in
                            selectedTab = tabIndex
                        })
                        .tag(0)
                        
                        TrafficTab(onNavigateToChat: navigateToChatScreen)
                        .tag(1)
                        
                        InboxTab(onNavigateToChat: navigateToChatScreen)
                        .tag(2)
                        
                        if isAdmin {
                            TeamTab()
                                .tag(3)
                        }
                        
                        SettingsTab()
                            .tag(isAdmin ? 4 : 3)
                    }
                    .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                    
                    // Custom tab bar to match premium layout
                    customTabBar
                }
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
        }
    }
    
    // Custom premium nav bar matching Android console
    private var customNavBarHeader: some View {
        HStack {
            Image("app_logo")
                .resizable()
                .frame(width: 36, height: 36)
                .clipShape(Circle())
                .overlay(Circle().stroke(theme.primaryColor, lineWidth: 1))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(networkClient.currentTenant?.name ?? "LetsTrack console")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                
                Text(isAdmin ? "Administrator Workspace" : "Agent Workstation Console")
                    .font(.system(size: 10))
                    .foregroundColor(theme.secondaryColor)
            }
            
            Spacer()
            
            // Presence status badge button
            Button(action: { showStatusDialog = true }) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(theme.getStatusColor(socketManager.selfStatus))
                        .frame(width: 8, height: 8)
                    
                    Text(socketManager.selfStatus)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(red: 30/255, green: 30/255, blue: 30/255))
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                )
            }
            
            // Sign Out
            Button(action: { networkClient.clearAuth() }) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(theme.primaryColor)
                    .padding(.leading, 8)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(red: 18/255, green: 18/255, blue: 18/255))
    }
    
    // Custom bottom TabBar
    private var customTabBar: some View {
        HStack {
            TabBarItem(icon: "star.fill", label: "Metrics", index: 0, selection: $selectedTab)
            TabBarItem(icon: "mappin.and.ellipse", label: "Traffic", index: 1, selection: $selectedTab)
            TabBarItem(icon: "envelope.fill", label: "Inbox", index: 2, selection: $selectedTab)
            
            if isAdmin {
                TabBarItem(icon: "person.fill", label: "Team", index: 3, selection: $selectedTab)
            }
            
            TabBarItem(icon: "gearshape.fill", label: "Settings", index: isAdmin ? 4 : 3, selection: $selectedTab)
        }
        .padding(.top, 8)
        .padding(.bottom, 24)
        .background(Color(red: 18/255, green: 18/255, blue: 18/255))
    }
    
    private func navigateToChatScreen(conversationId: String, visitorName: String, visitorId: String) {
        self.activeConversationId = conversationId
        self.activeVisitorName = visitorName
        self.activeVisitorId = visitorId
        self.navigationToChat = true
    }
    
    private func checkForPendingDeepLink() {
        guard let deepLink = socketManager.pendingDeepLink else { return }
        
        print("[Push Notification Debug] Found pending deep link to conversation: \(deepLink.conversationId)")
        
        // Navigate to the chat screen
        navigateToChatScreen(
            conversationId: deepLink.conversationId,
            visitorName: deepLink.visitorName,
            visitorId: deepLink.visitorId
        )
        
        // Clear it so it doesn't trigger again
        socketManager.pendingDeepLink = nil
    }
}

// MARK: - TabBar Item UI Helper
struct TabBarItem: View {
    let icon: String
    let label: String
    let index: Int
    @Binding var selection: Int
    @EnvironmentObject var theme: ThemeManager
    
    var body: some View {
        Button(action: { selection = index }) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(selection == index ? .white : .gray)
                    .frame(height: 28)
                    .padding(.horizontal, 16)
                    .background(theme.primaryColor.cornerRadius(12).opacity(selection == index ? 1 : 0))
                
                Text(label)
                    .font(.system(size: 10, weight: selection == index ? .bold : .regular))
                    .foregroundColor(selection == index ? theme.secondaryColor : .gray)
            }
            .frame(maxWidth: .infinity)
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
            Color(red: 18/255, green: 18/255, blue: 18/255).ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Update Live Presence Status")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
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
                    .foregroundColor(socketManager.selfStatus == statusName ? theme.primaryColor : .white)
                
                Spacer()
                
                if socketManager.selfStatus == statusName {
                    Image(systemName: "checkmark")
                        .foregroundColor(theme.primaryColor)
                        .font(.system(size: 14, weight: .bold))
                }
            }
            .padding()
            .background(Color.black.opacity(0.3))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(socketManager.selfStatus == statusName ? theme.primaryColor.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
    }
}

// MARK: - METRICS SUB-VIEW
struct MetricsTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToTab: (Int) -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Operational Health Overview")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 16)
                
                // Deck of Metric Items Cards
                Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                    GridRow {
                        metricItemCard(title: "Online Guests", value: "\(socketManager.visitorsList.filter({ $0.isOnline }).count)", tagIndex: 1)
                        metricItemCard(title: "Active Chats", value: "\(socketManager.conversationsList.filter({ $0.status == "Active" }).count)", tagIndex: 2)
                    }
                    GridRow {
                        metricItemCard(title: "Queue Size", value: "\(socketManager.conversationsList.filter({ $0.status == "Unassigned" }).count)", tagIndex: 2)
                        metricItemCard(title: "Total Staff", value: "\(socketManager.agentsList.count)", tagIndex: nil)
                    }
                }
                
                Text("Active Employees Status")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 12)
                
                // Agents list
                VStack(spacing: 12) {
                    if socketManager.agentsList.isEmpty {
                        Text("No staff connected.")
                            .foregroundColor(theme.textGrayColor)
                            .padding()
                    } else {
                        ForEach(socketManager.agentsList) { agent in
                            agentRow(agent: agent)
                        }
                    }
                }
            }
            .padding(.horizontal)
        }
        .onAppear {
            Task {
                if let res = try? await NetworkClient.shared.getAnalytics() {
                    // Rest metrics update if necessary. Since sockets handles live syncs,
                    // we dynamically fetch dashboard analytics details on load.
                    print("Fetched metrics: \(res)")
                }
            }
        }
    }
    
    private func metricItemCard(title: String, value: String, tagIndex: Int?) -> some View {
        Button(action: {
            if let index = tagIndex {
                onNavigateToTab(index)
            }
        }) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white.opacity(0.8))
                
                Text(value)
                    .font(.system(size: 28, weight: .black))
                    .foregroundColor(.white)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [theme.primaryColor, Color(red: 69/255, green: 10/255, blue: 10/255)]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(12)
        }
        .disabled(tagIndex == nil)
    }
    
    private func agentRow(agent: UserProfile) -> some View {
        HStack {
            // Placeholder Avatar
            ZStack {
                Circle()
                    .fill(Color(red: 38/255, green: 38/255, blue: 38/255))
                    .frame(width: 36, height: 36)
                
                Text(String(agent.name.prefix(1)).uppercased())
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                
                Text(agent.role)
                    .font(.system(size: 11))
                    .foregroundColor(theme.secondaryColor)
            }
            
            Spacer()
            
            // Presence status badge
            HStack(spacing: 6) {
                Circle()
                    .fill(theme.getStatusColor(agent.status))
                    .frame(width: 6, height: 6)
                
                Text(agent.status)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.black)
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(theme.borderColor, lineWidth: 1)
            )
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(theme.borderColor, lineWidth: 1)
        )
    }
}

// MARK: - TRAFFIC SUB-VIEW
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
                Text("Live Site Traffic Logs")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 16)
                
                if socketManager.visitorsList.isEmpty {
                    Text("No visitors currently active.")
                        .foregroundColor(theme.textGrayColor)
                        .font(.system(size: 14))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 80)
                } else {
                    if !onlineVisitors.isEmpty {
                        Text("Active Online Visitors (\(onlineVisitors.count))")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.statusOnlineColor)
                        
                        ForEach(onlineVisitors) { visitor in
                            visitorCard(visitor: visitor)
                        }
                    }
                    
                    if !offlineVisitors.isEmpty {
                        Text("Offline / Inactive Sessions (\(offlineVisitors.count))")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                            .padding(.top, 8)
                        
                        ForEach(offlineVisitors) { visitor in
                            visitorCard(visitor: visitor)
                        }
                    }
                }
            }
            .padding(.horizontal)
        }
    }
    
    private func visitorCard(visitor: VisitorDto) -> some View {
        Button(action: {
            openVisitorChat(visitor: visitor)
        }) {
            HStack {
                Circle()
                    .fill(visitor.isOnline ? theme.statusOnlineColor : theme.statusOfflineColor)
                    .frame(width: 10, height: 10)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(visitor.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("📍 \(visitor.city), \(visitor.country)")
                        .font(.system(size: 11))
                        .foregroundColor(theme.textGrayColor)
                    
                    Text("Url: \(visitor.currentUrl ?? "/")")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(theme.secondaryColor)
                        .lineLimit(1)
                }
                
                Spacer()
                
                Image(systemName: "paperplane.fill")
                    .foregroundColor(theme.primaryColor)
                    .font(.system(size: 16))
                    .padding(8)
            }
            .padding(16)
            .background(theme.surfaceColor)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(theme.borderColor, lineWidth: 1)
            )
        }
    }
    
    private func openVisitorChat(visitor: VisitorDto) {
        if let conv = socketManager.conversationsList.first(where: { $0.visitorId == visitor.id }) {
            onNavigateToChat(conv.id, visitor.name, visitor.id)
        } else {
            // Proactively start conversation
            socketManager.startConversation(visitorId: visitor.id)
        }
    }
}

// MARK: - INBOX SUB-VIEW
struct InboxTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    let onNavigateToChat: (String, String, String) -> Void
    
    var sortedConversations: [ConversationDto] {
        socketManager.conversationsList.sorted(by: { $0.updatedAt > $1.updatedAt })
    }
    
    var unassignedChats: [ConversationDto] {
        sortedConversations.filter { $0.status == "Unassigned" }
    }
    
    var activeChats: [ConversationDto] {
        sortedConversations.filter { $0.status == "Active" }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Inbox Conversations Queue")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 16)
                
                if socketManager.conversationsList.isEmpty {
                    Text("No chats in queue.")
                        .foregroundColor(theme.textGrayColor)
                        .font(.system(size: 14))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 80)
                } else {
                    if !activeChats.isEmpty {
                        Text("Active Chats In Progress (\(activeChats.count))")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.statusOnlineColor)
                        
                        ForEach(activeChats) { conv in
                            conversationCard(conv: conv)
                        }
                    }
                    
                    if !unassignedChats.isEmpty {
                        Text("Pending Unassigned Queue (\(unassignedChats.count))")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.secondaryColor)
                            .padding(.top, 8)
                        
                        ForEach(unassignedChats) { conv in
                            conversationCard(conv: conv)
                        }
                    }
                }
            .padding(.horizontal)
        }
    }
    
    private func conversationCard(conv: ConversationDto) -> some View {
        let visitor = socketManager.visitorsList.first(where: { $0.id == conv.visitorId })
        let visitorName = visitor?.name ?? "VisitorSession"
        let isUnassigned = conv.status == "Unassigned"
        
        return Button(action: {
            onNavigateToChat(conv.id, visitorName, conv.visitorId)
        }) {
            HStack {
                ZStack {
                    Circle()
                        .fill(isUnassigned ? theme.primaryColor : Color(red: 38/255, green: 38/255, blue: 38/255))
                        .frame(width: 36, height: 36)
                    
                    Text(isUnassigned ? "❓" : "💬")
                        .font(.system(size: 16))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(visitorName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text(isUnassigned ? "Queued • Unassigned" : "In Progress • Active")
                        .font(.system(size: 11))
                        .foregroundColor(isUnassigned ? theme.secondaryColor : theme.textGrayColor)
                }
                
                Spacer()
                
                Image(systemName: "play.fill")
                    .foregroundColor(isUnassigned ? theme.secondaryColor : .gray)
                    .font(.system(size: 12))
            }
            .padding(16)
            .background(isUnassigned ? Color(red: 43/255, green: 7/255, blue: 7/255) : theme.surfaceColor)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isUnassigned ? Color(red: 127/255, green: 29/255, blue: 29/255) : theme.borderColor, lineWidth: 1)
            )
        }
    }
}

// MARK: - TEAM REGISTRY SUB-VIEW
struct TeamTab: View {
    @StateObject private var socketManager = SocketManager.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var showAddDialog = false
    @State private var newName = ""
    @State private var newEmail = ""
    @State private var newPassword = ""
    @State private var isLoading = false
    @State private var statusMessage = ""
    @State private var isSuccess = false
    
    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Operational Staff Team")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(.white)
                            
                            Text("Real-time organization registry")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            newName = ""
                            newEmail = ""
                            newPassword = ""
                            statusMessage = ""
                            isSuccess = false
                            showAddDialog = true
                        }) {
                            Text("+ Add Agent")
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(theme.primaryColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
                    .padding(.top, 16)
                    
                    if socketManager.agentsList.isEmpty {
                        Text("No team members registered yet.")
                            .foregroundColor(theme.textGrayColor)
                            .font(.system(size: 14))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 80)
                    } else {
                        ForEach(socketManager.agentsList) { agent in
                            agentCard(agent: agent)
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .sheet(isPresented: $showAddDialog) {
            registerAgentSheet
        }
    }
    
    private func agentCard(agent: UserProfile) -> some View {
        HStack {
            ZStack {
                Circle()
                    .fill(Color(red: 38/255, green: 38/255, blue: 38/255))
                    .frame(width: 36, height: 36)
                
                Text(String(agent.name.prefix(1)).uppercased())
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                
                Text(agent.email)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(agent.role)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(agent.role == "Admin" ? theme.secondaryColor : Color(red: 100/255, green: 116/255, blue: 139/255))
                
                HStack(spacing: 6) {
                    Circle()
                        .fill(theme.getStatusColor(agent.status))
                        .frame(width: 6, height: 6)
                    
                    Text(agent.status)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black)
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(theme.borderColor, lineWidth: 1)
                )
            }
        }
        .padding(14)
        .background(theme.surfaceColor)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(theme.borderColor, lineWidth: 1)
        )
    }
    
    private var registerAgentSheet: some View {
        ZStack {
            Color(red: 18/255, green: 18/255, blue: 18/255).ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Register New Organization Agent")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 24)
                
                Text("Provide account details to generate a new live chat employee console profile.")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                VStack(spacing: 16) {
                    TextField("Agent Display Name", text: $newName)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                        .disabled(isLoading || isSuccess)
                    
                    TextField("Email Address", text: $newEmail)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                        .disabled(isLoading || isSuccess)
                    
                    SecureField("Password credential", text: $newPassword)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                        .disabled(isLoading || isSuccess)
                }
                .padding(.horizontal)
                
                if !statusMessage.isEmpty {
                    Text(statusMessage)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(isSuccess ? Color.green : theme.secondaryColor)
                        .padding(.horizontal)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    if !isSuccess {
                        Button(action: { showAddDialog = false }) {
                            Text("Cancel")
                                .fontWeight(.semibold)
                                .foregroundColor(.gray)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                        }
                        .disabled(isLoading)
                        
                        Button(action: registerAgent) {
                            HStack {
                                if isLoading {
                                    ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Register")
                                        .fontWeight(.bold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(theme.primaryColor)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                        .disabled(isLoading)
                    } else {
                        Button(action: { showAddDialog = false }) {
                            Text("Done")
                                .fontWeight(.bold)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(theme.primaryColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
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
                    statusMessage = "Agent successfully registered!"
                    socketManager.agentsList.append(response.agent)
                    NetworkClient.shared.cachedAgents = socketManager.agentsList
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
                    Text("Console Workspace Settings")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Customize preferences and manage your employee profile")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                .padding(.top, 16)
                
                // 1. Theme Configuration Card
                VStack(alignment: .leading, spacing: 12) {
                    Text("Workspace Theme Selection")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Toggle dynamic palette presets for the mobile interface")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                    
                    HStack(spacing: 12) {
                        Button(action: { theme.themeMode = "dark" }) {
                            Text("🎬 Dark Mode")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                                .background(theme.themeMode == "dark" ? Color(red: 43/255, green: 7/255, blue: 7/255) : Color(red: 30/255, green: 30/255, blue: 30/255))
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(theme.themeMode == "dark" ? theme.primaryColor : Color.clear, lineWidth: 1)
                                )
                        }
                        
                        Button(action: { theme.themeMode = "light" }) {
                            Text("☀️ Light Mode")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.themeMode == "light" ? .black : .white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                                .background(theme.themeMode == "light" ? Color(red: 226/255, green: 232/255, blue: 240/255) : Color(red: 30/255, green: 30/255, blue: 30/255))
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(theme.themeMode == "light" ? theme.primaryColor : Color.clear, lineWidth: 1)
                                )
                        }
                    }
                }
                .padding(16)
                .background(theme.surfaceColor)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                
                // 2. Profile Details Form Card
                VStack(alignment: .leading, spacing: 14) {
                    Text("Employee Profile Configuration")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Update login credentials and console details.")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                    
                    Divider().background(Color(red: 38/255, green: 38/255, blue: 38/255))
                    
                    // Email input (disabled)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Registered Email (Read-only)")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                        
                        Text(emailReadonly)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.4))
                            .foregroundColor(.gray)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1))
                    }
                    
                    // Display name input
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Display Name")
                            .font(.system(size: 11))
                            .foregroundColor(.white)
                        
                        TextField("", text: $nameInput)
                            .padding()
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                            .disabled(isLoading)
                    }
                    
                    // Password input
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Change Password (Leave blank to keep current)")
                            .font(.system(size: 11))
                            .foregroundColor(.white)
                        
                        SecureField("", text: $passwordInput)
                            .padding()
                            .background(Color.black)
                            .foregroundColor(.white)
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
                                Text("Save Configurations")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(theme.primaryColor)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(isLoading)
                }
                .padding(16)
                .background(theme.surfaceColor)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
            }
            .padding(.horizontal)
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
                let updated = try await networkClient.updateProfile(request: UpdateProfileRequest(
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
