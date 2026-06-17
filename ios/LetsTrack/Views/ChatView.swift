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
    
    // Visitor metadata
    @State private var visitorCountry = "Unknown"
    @State private var visitorCity = "Unknown"
    @State private var visitorDevice = "Desktop"
    @State private var visitorUrl = "/"
    @State private var visitorEmail = ""
    @State private var visitorPhone = ""
    @State private var visitorMuted = false
    
    // Panels/Dialogs toggles
    @State private var isDetailsExpanded = false
    @State private var showEditDialog = false
    @State private var showAssignMenu = false
    
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
                .background(Color.black)
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
        .background(Color.black.ignoresSafeArea())
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
        .onAppear(perform: loadChatLogs)
        .onDisappear(perform: cleanupSubscriptions)
    }
    
    // Custom Chat navigation bar
    private var customNavBarHeader: some View {
        HStack(spacing: 12) {
            // Back button
            Button(action: onNavigateBack) {
                Image(systemName: "chevron.left")
                    .foregroundColor(.white)
                    .font(.system(size: 18, weight: .bold))
            }
            
            // Visitor info badge click to Edit
            Button(action: { showEditDialog = true }) {
                HStack(spacing: 8) {
                    Image("app_logo")
                        .resizable()
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(theme.primaryColor, lineWidth: 1))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(visitorMuted ? "\(visitorName) 🔇" : visitorName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text(isVisitorTyping ? "typing..." : "Connected via Widget (Tap to Edit)")
                            .font(.system(size: 10))
                            .foregroundColor(isVisitorTyping ? theme.secondaryColor : .gray)
                    }
                }
            }
            
            Spacer()
            
            // Claim / Release / Reassign buttons
            HStack(spacing: 6) {
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
                        let currentAssignee = socketManager.agentsList.first(where: { $0.id == assignedAgentId })?.name ?? "Assign 👤"
                        Text(currentAssignee)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color(red: 30/255, green: 41/255, blue: 59/255))
                            .cornerRadius(8)
                    }
                }
                
                if assignedAgentId == selfId {
                    Button("Release") {
                        socketManager.assignChat(conversationId: conversationId, agentId: nil)
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.primaryColor)
                    .cornerRadius(8)
                } else {
                    Button("Claim") {
                        socketManager.assignChat(conversationId: conversationId, agentId: selfId)
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.primaryColor)
                    .cornerRadius(8)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(red: 18/255, green: 18/255, blue: 18/255))
    }
    
    // Details expandable panel
    private var expandableDetailsPanel: some View {
        VStack(spacing: 0) {
            Button(action: {
                withAnimation { isDetailsExpanded.toggle() }
            }) {
                HStack {
                    Text("Visitor Info & Navigation Options")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.secondaryColor)
                    
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
                                .foregroundColor(.gray)
                            Text("🗺️ \(visitorCity), \(visitorCountry)")
                                .font(.system(size: 13))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("DEVICE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.gray)
                            Text(visitorDevice.lowercased() == "mobile" ? "📱 Mobile" : (visitorDevice.lowercased() == "tablet" ? "📟 Tablet" : "💻 Desktop"))
                                .font(.system(size: 13))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("EMAIL")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.gray)
                            Text(visitorEmail.isEmpty ? "None" : visitorEmail)
                                .font(.system(size: 13))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PHONE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.gray)
                            Text(visitorPhone.isEmpty ? "None" : visitorPhone)
                                .font(.system(size: 13))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CURRENTLY VIEWING")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.gray)
                        Text(visitorUrl)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(theme.secondaryColor)
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
                Text(msg.text)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(theme.secondaryColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color(red: 43/255, green: 7/255, blue: 7/255))
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color(red: 127/255, green: 29/255, blue: 29/255), lineWidth: 1)
                    )
                Spacer()
            }
            .padding(.vertical, 4)
        } else {
            HStack {
                if isSelf { Spacer() }
                
                VStack(alignment: isSelf ? .trailing : .leading, spacing: 2) {
                    Text(msg.senderName)
                        .font(.system(size: 10))
                        .foregroundColor(theme.textGrayColor)
                    
                    Text(msg.text)
                        .font(.system(size: 14))
                        .foregroundColor(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(isSelf ? theme.primaryColor : Color(red: 30/255, green: 30/255, blue: 30/255))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(isSelf ? Color(red: 127/255, green: 29/255, blue: 29/255) : theme.borderColor, lineWidth: 1)
                        )
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
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color(red: 30/255, green: 30/255, blue: 30/255))
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
                            .foregroundColor(.gray)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                    } else {
                        ForEach(quickRepliesList) { qr in
                            Button(action: { chatInput = qr.text }) {
                                Text("\(qr.shortcut): \(qr.text)")
                                    .font(.system(size: 11))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color(red: 30/255, green: 30/255, blue: 30/255))
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
            .background(Color(red: 18/255, green: 18/255, blue: 18/255))
        }
    }
    
    // Bottom sending panel
    private var chatInputPanel: some View {
        VStack(spacing: 0) {
            Divider().background(theme.borderColor)
            HStack(spacing: 8) {
                TextField("Reply back to customer...", text: $chatInput)
                    .padding(10)
                    .background(Color.black)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding(10)
                        .background(theme.primaryColor)
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(red: 18/255, green: 18/255, blue: 18/255))
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
        // Find conversation details
        if let conversation = socketManager.conversationsList.first(where: { $0.id == conversationId }) {
            self.assignedAgentId = conversation.assignedAgentId
            self.status = conversation.status
        }
        
        // REST history pulls
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
                }
            }
        }
        
        // Sockets real-time observations
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
            Color(red: 30/255, green: 41/255, blue: 59/255).ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Edit Visitor Details")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 24)
                
                VStack(spacing: 16) {
                    // Name
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Full Name")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                        TextField("", text: $currentName)
                            .padding(12)
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                    
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email Address")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                        TextField("", text: $currentEmail)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                    
                    // Phone
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Phone Number")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                        TextField("", text: $currentPhone)
                            .keyboardType(.phonePad)
                            .padding(12)
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                    
                    // Mute Toggle
                    Toggle(isOn: $currentMuted) {
                        Text("Mute & Suppress Alerts")
                            .font(.system(size: 14))
                            .foregroundColor(.white)
                    }
                    .tint(theme.secondaryColor)
                    .padding(.vertical, 8)
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    
                    Button(action: saveVisitorDetails) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Save")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(theme.secondaryColor)
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
