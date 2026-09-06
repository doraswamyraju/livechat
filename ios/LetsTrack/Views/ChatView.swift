import SwiftUI
import Combine

struct ChatView: View {
    let conversationId: String
    @State var visitorName: String
    let visitorId: String
    let onNavigateBack: () -> Void
    
    @StateObject private var socketManager = SocketManager.shared
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var messagesList: [MessageDto] = []
    @State private var chatInput = ""
    @State private var isVisitorTyping = false
    
    // Conversation properties
    @State private var assignedAgentId: String? = nil
    @State private var status = "Unassigned"
    @State private var channel = "livechat"
    
    // Visitor metadata
    @State private var visitorCountry = "Unknown"
    @State private var visitorCity = "Unknown"
    @State private var visitorDevice = "Desktop"
    @State private var visitorUrl = "/"
    @State private var visitorEmail = ""
    @State private var visitorPhone = ""
    @State private var visitorMuted = false
    @State private var visitorFirstSeen = ""
    @State private var visitorLastActive = ""
    
    // Panels/Dialogs toggles
    @State private var isDetailsExpanded = false
    @State private var showEditDialog = false
    @State private var showAssignMenu = false
    @State private var showCreateLeadDialog = false
    @State private var leadCreatedToast = false
    
    @State private var quickRepliesList: [QuickReplyDto] = []
    
    // Subscriptions bag
    @State private var cancellables = Set<AnyCancellable>()
    
    var selfId: String {
        networkClient.currentUser?.id ?? ""
    }
    
    var isAdmin: Bool {
        networkClient.currentUser?.role == "Admin"
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            customNavBarHeader
            
            // Expandable details panel drawer
            expandableDetailsPanel
            
            // Lead Created Banner
            if leadCreatedToast {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Lead successfully created and linked to this chat!")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.12))
            }
            
            // Message logs viewport
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messagesList) { msg in
                            messageBubble(msg: msg)
                        }
                        
                        if isVisitorTyping {
                            visitorTypingIndicator
                                .id("typing_indicator")
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 16)
                }
                .background(theme.backgroundColor)
                .onChange(of: messagesList) { _ in
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: isVisitorTyping) { _ in
                    scrollToBottom(proxy: proxy)
                }
                .onAppear {
                    scrollToBottom(proxy: proxy)
                }
            }
            
            // Quick replies suggestion chips
            quickRepliesScrollView
            
            // Input panel
            chatInputPanel
        }
        .background(theme.backgroundColor.ignoresSafeArea())
        .navigationBarBackButtonHidden(true)
        .sheet(isPresented: $showEditDialog) {
            EditVisitorSheet(
                isPresented: $showEditDialog,
                visitorId: visitorId,
                currentName: visitorName,
                currentEmail: visitorEmail,
                currentPhone: visitorPhone,
                currentMuted: visitorMuted,
                onSave: { updated in
                    visitorName = updated.name
                    visitorEmail = updated.email ?? ""
                    visitorPhone = updated.phoneNumber ?? ""
                    visitorMuted = updated.isMuted ?? false
                }
            )
            .environmentObject(theme)
        }
        .sheet(isPresented: $showCreateLeadDialog) {
            CreateLeadSheet(
                isPresented: $showCreateLeadDialog,
                onLeadCreated: { _ in
                    withAnimation { leadCreatedToast = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                        withAnimation { leadCreatedToast = false }
                    }
                },
                name: visitorName,
                email: visitorEmail,
                phone: visitorPhone,
                company: "",
                source: channel,
                status: "New",
                dealValue: "",
                note: "Converted from active \(channel) conversation",
                conversationId: conversationId,
                visitorId: visitorId
            )
            .environmentObject(theme)
        }
        .onAppear(perform: loadChatLogs)
        .onDisappear(perform: cleanupSubscriptions)
    }
    
    // Custom Chat navigation bar
    private var customNavBarHeader: some View {
        HStack(spacing: 10) {
            // Back button
            Button(action: onNavigateBack) {
                Image(systemName: "chevron.left")
                    .foregroundColor(theme.onSurfaceColor)
                    .font(.system(size: 16, weight: .bold))
                    .frame(width: 32, height: 32)
            }
            
            // Visitor info badge click to Edit
            Button(action: { showEditDialog = true }) {
                HStack(spacing: 8) {
                    ZStack(alignment: .bottomTrailing) {
                        Circle()
                            .fill(LinearGradient(
                                colors: [theme.primaryColor.opacity(0.2), theme.primaryColor.opacity(0.4)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Text(String(visitorName.prefix(1)).uppercased())
                                    .font(.system(size: 15, weight: .black))
                                    .foregroundColor(theme.primaryColor)
                            )
                        
                        Circle()
                            .fill(theme.getChannelColor(channel))
                            .frame(width: 12, height: 12)
                            .overlay(Circle().stroke(theme.surfaceColor, lineWidth: 1.5))
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(visitorMuted ? "\(visitorName) 🔇" : visitorName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                            .lineLimit(1)
                        
                        Text(isVisitorTyping ? "typing..." : "via \(channel.capitalized)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(isVisitorTyping ? theme.secondaryColor : theme.textGrayColor)
                    }
                }
            }
            
            Spacer()
            
            // Convert to Lead Action Button
            Button(action: { showCreateLeadDialog = true }) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text("Lead")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    LinearGradient(
                        colors: [Color(red: 245/255, green: 158/255, blue: 11/255), Color(red: 217/255, green: 119/255, blue: 6/255)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(8)
                .shadow(color: Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.3), radius: 4)
            }
            
            // Claim / Release / Reassign buttons
            if isAdmin {
                Menu {
                    Button("General Queue (Unassigned)") {
                        socketManager.assignChat(conversationId: conversationId, agentId: nil)
                    }
                    
                    ForEach(socketManager.agentsList) { agent in
                        Button(action: {
                            socketManager.assignChat(conversationId: conversationId, agentId: agent.id)
                        }) {
                            HStack {
                                Text("\(agent.name) (\(agent.role))")
                                if assignedAgentId == agent.id {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    let currentAssignee = socketManager.agentsList.first(where: { $0.id == assignedAgentId })?.name ?? "Assign"
                    Text(currentAssignee)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(theme.onSurfaceColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
            }
            
            if assignedAgentId == selfId {
                Button("Release") {
                    socketManager.assignChat(conversationId: conversationId, agentId: nil)
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(theme.primaryColor)
                .cornerRadius(8)
            } else {
                Button("Claim") {
                    socketManager.assignChat(conversationId: conversationId, agentId: selfId)
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(theme.primaryColor)
                .cornerRadius(8)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(theme.surfaceColor)
        .overlay(Rectangle().frame(height: 1).foregroundColor(theme.borderColor), alignment: .bottom)
    }
    
    // Details expandable panel
    private var expandableDetailsPanel: some View {
        VStack(spacing: 0) {
            Button(action: {
                withAnimation { isDetailsExpanded.toggle() }
            }) {
                HStack {
                    Text("Visitor & Channel Insights")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.primaryColor)
                    
                    Spacer()
                    
                    Text(isDetailsExpanded ? "Hide details ▲" : "Show details ▼")
                        .font(.system(size: 11))
                        .foregroundColor(theme.textGrayColor)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(theme.surfaceColor)
            }
            
            if isDetailsExpanded {
                VStack(alignment: .leading, spacing: 10) {
                    Divider().background(theme.borderColor)
                    
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("LOCATION")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                            Text("🗺️ \(visitorCity), \(visitorCountry)")
                                .font(.system(size: 13))
                                .foregroundColor(theme.onSurfaceColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("DEVICE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                            Text(visitorDevice.lowercased() == "mobile" ? "📱 Mobile" : (visitorDevice.lowercased() == "tablet" ? "📟 Tablet" : "💻 Desktop"))
                                .font(.system(size: 13))
                                .foregroundColor(theme.onSurfaceColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("EMAIL")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                            Text(visitorEmail.isEmpty ? "None" : visitorEmail)
                                .font(.system(size: 13))
                                .foregroundColor(theme.onSurfaceColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PHONE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                            Text(visitorPhone.isEmpty ? "None" : visitorPhone)
                                .font(.system(size: 13))
                                .foregroundColor(theme.onSurfaceColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CURRENTLY VIEWING")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        Text(visitorUrl)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(theme.primaryColor)
                    }
                }
                .padding(14)
                .background(theme.surfaceColor)
            }
            
            Divider().background(theme.borderColor)
        }
    }
    
    // Bubble messages board
    @ViewBuilder
    private func messageBubble(msg: MessageDto) -> some View {
        let isSelf = msg.senderType == "Agent" && msg.senderId == selfId
        let isSystem = msg.senderType == "System"
        
        if isSystem {
            HStack {
                Spacer()
                Text(formatMessageText(text: msg.text))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.secondaryColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(theme.primaryColor.opacity(0.1))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(theme.primaryColor.opacity(0.2), lineWidth: 1)
                    )
                Spacer()
            }
            .padding(.vertical, 4)
        } else {
            HStack {
                if isSelf { Spacer() }
                
                VStack(alignment: isSelf ? .trailing : .leading, spacing: 3) {
                    Text("\(msg.senderName) • \(formatTimestamp(isoString: msg.timestamp))")
                        .font(.system(size: 10))
                        .foregroundColor(theme.textGrayColor)
                    
                    Text(formatMessageText(text: msg.text))
                        .font(.system(size: 14))
                        .foregroundColor(isSelf ? .white : theme.onSurfaceColor)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(isSelf ? theme.primaryColor : theme.surfaceColor)
                        .cornerRadius(14)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(isSelf ? Color.clear : theme.borderColor, lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(isSelf ? 0.2 : (theme.isDark ? 0.3 : 0.04)), radius: 4, y: 2)
                }
                
                if !isSelf { Spacer() }
            }
        }
    }
    
    private var visitorTypingIndicator: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("typing...")
                    .font(.system(size: 11))
                    .foregroundColor(theme.secondaryColor)
                
                Text("•••")
                    .font(.system(size: 14))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(theme.surfaceColor)
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
            }
            Spacer()
        }
    }
    
    // Suggestion chips
    private var quickRepliesScrollView: some View {
        VStack(spacing: 0) {
            Divider().background(theme.borderColor)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if quickRepliesList.isEmpty {
                        Text("No quick replies configured.")
                            .font(.system(size: 11))
                            .foregroundColor(theme.textGrayColor)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                    } else {
                        ForEach(quickRepliesList) { qr in
                            Button(action: { chatInput = qr.text }) {
                                Text("\(qr.shortcut): \(qr.text)")
                                    .font(.system(size: 11))
                                    .foregroundColor(theme.onSurfaceColor)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(theme.surfaceColor)
                                    .cornerRadius(16)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(theme.borderColor, lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .background(theme.surfaceColor)
        }
    }
    
    // Bottom sending panel
    private var chatInputPanel: some View {
        VStack(spacing: 0) {
            Divider().background(theme.borderColor)
            HStack(spacing: 8) {
                TextField("Reply back to customer...", text: $chatInput)
                    .padding(10)
                    .background(theme.inputBackground)
                    .foregroundColor(theme.onSurfaceColor)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding(10)
                        .background(theme.primaryColor)
                        .clipShape(Circle())
                        .shadow(color: theme.primaryColor.opacity(0.3), radius: 4, y: 2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(theme.surfaceColor)
        }
    }
    
    private func sendMessage() {
        guard !chatInput.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        socketManager.sendAgentMessage(conversationId: conversationId, visitorId: visitorId, text: chatInput.trimmingCharacters(in: .whitespaces))
        chatInput = ""
    }
    
    private func scrollToBottom(proxy: ScrollViewProxy) {
        if isVisitorTyping {
            withAnimation { proxy.scrollTo("typing_indicator", anchor: .bottom) }
        } else if let last = messagesList.last {
            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
        }
    }
    
    private func loadChatLogs() {
        if let conversation = socketManager.conversationsList.first(where: { $0.id == conversationId }) {
            self.assignedAgentId = conversation.assignedAgentId
            self.status = conversation.status
            self.channel = conversation.resolvedChannel
        }
        
        Task {
            if let list = try? await NetworkClient.shared.getMessages(conversationId: conversationId) {
                await MainActor.run { self.messagesList = list }
            }
            
            if let replies = try? await NetworkClient.shared.getQuickReplies() {
                await MainActor.run { self.quickRepliesList = replies }
            }
            
            if let visitor = try? await NetworkClient.shared.getVisitor(visitorId: visitorId) {
                await MainActor.run {
                    self.visitorCountry = visitor.country
                    self.visitorCity = visitor.city
                    self.visitorDevice = visitor.deviceType
                    self.visitorUrl = visitor.currentUrl ?? "/"
                    self.visitorEmail = visitor.email ?? ""
                    self.visitorPhone = visitor.phoneNumber ?? ""
                    self.visitorMuted = visitor.isMuted ?? false
                    self.visitorFirstSeen = visitor.firstSeen ?? ""
                    self.visitorLastActive = visitor.lastSeen ?? ""
                    if self.channel == "livechat" {
                        self.channel = visitor.resolvedChannel
                    }
                }
            }
        }
        
        socketManager.visitorMessagePublisher
            .filter { $0.conversationId == conversationId }
            .receive(on: RunLoop.main)
            .sink { payload in
                self.messagesList.append(payload.message)
                self.isVisitorTyping = false
            }
            .store(in: &cancellables)
            
        socketManager.agentMessagePublisher
            .filter { $0.conversationId == conversationId }
            .receive(on: RunLoop.main)
            .sink { payload in
                self.messagesList.append(payload.message)
            }
            .store(in: &cancellables)
            
        socketManager.typingStatusPublisher
            .filter { $0.conversationId == conversationId }
            .receive(on: RunLoop.main)
            .sink { payload in
                self.isVisitorTyping = payload.isTyping
            }
            .store(in: &cancellables)
            
        socketManager.navigationPathPublisher
            .filter { $0.visitorId == visitorId }
            .receive(on: RunLoop.main)
            .sink { payload in
                self.visitorUrl = payload.currentUrl
            }
            .store(in: &cancellables)
            
        socketManager.chatAssignedPublisher
            .filter { $0.conversationId == conversationId }
            .receive(on: RunLoop.main)
            .sink { payload in
                self.status = payload.status
                self.assignedAgentId = payload.assignedAgentId
                if let sys = payload.systemMessage {
                    self.messagesList.append(sys)
                }
            }
            .store(in: &cancellables)
    }
    
    private func cleanupSubscriptions() {
        cancellables.removeAll()
    }
}

// MARK: - Edit Visitor Details Sheet Modal
struct EditVisitorSheet: View {
    @Binding var isPresented: Bool
    let visitorId: String
    
    @State var currentName: String
    @State var currentEmail: String
    @State var currentPhone: String
    @State var currentMuted: Bool
    
    let onSave: (VisitorDto) -> Void
    
    @EnvironmentObject var theme: ThemeManager
    @State private var isLoading = false
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Edit Customer Profile")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Full Name")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        TextField("", text: $currentName)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email Address")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        TextField("", text: $currentEmail)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Phone Number")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        TextField("", text: $currentPhone)
                            .keyboardType(.phonePad)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    Toggle(isOn: $currentMuted) {
                        Text("Mute Notifications")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(theme.onSurfaceColor)
                    }
                    .tint(theme.primaryColor)
                    .padding(.vertical, 8)
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(theme.textGrayColor)
                        .frame(maxWidth: .infinity)
                    
                    Button(action: saveVisitorDetails) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Save Changes")
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
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private func saveVisitorDetails() {
        isLoading = true
        
        let body: [String: Any] = [
            "name": currentName.trimmingCharacters(in: .whitespaces),
            "email": currentEmail.trimmingCharacters(in: .whitespaces),
            "phoneNumber": currentPhone.trimmingCharacters(in: .whitespaces),
            "isMuted": currentMuted
        ]
        
        Task {
            do {
                let updated = try await NetworkClient.shared.updateVisitor(visitorId: visitorId, fields: body)
                await MainActor.run {
                    onSave(updated)
                    isLoading = false
                    isPresented = false
                }
            } catch {
                print("Failed to save visitor details: \(error)")
                await MainActor.run { isLoading = false }
            }
        }
    }
}
