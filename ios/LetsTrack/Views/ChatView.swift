import SwiftUI
import Combine
import PhotosUI

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
    @State private var visitorAvatarUrl = ""
    @State private var visitorCountry = "Unknown"
    @State private var visitorCity = "Unknown"
    @State private var visitorDevice = "Desktop"
    @State private var visitorUrl = "/"
    @State private var visitorEmail = ""
    @State private var visitorPhone = ""
    @State private var visitorAbout = ""
    @State private var visitorCompany = ""
    @State private var visitorTags: [String] = []
    @State private var visitorMuted = false
    @State private var visitorFirstSeen = ""
    @State private var visitorLastActive = ""
    
    // Image attachment state
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var pendingImageDataList: [Data] = []
    @State private var isUploadingMedia = false
    @State private var fullScreenImageUrl: String? = nil
    
    // Panels/Dialogs toggles
    @State private var isDetailsExpanded = false
    @State private var showProfileSheet = false
    @State private var showAssignMenu = false
    @State private var showCreateLeadDialog = false
    @State private var leadCreatedToast = false
    @State private var isSavingVisitorContact = false
    @State private var visitorContactSaved = false
    @State private var showDeleteConfirm = false
    @State private var isDeletingConversation = false
    
    // Quick Replies & Pitches
    @State private var quickRepliesList: [QuickReplyDto] = []
    @State private var pitchesList: [UpsellPitchDto] = []
    @State private var showPitchesSheet = false
    
    // Subscriptions bag
    @State private var cancellables = Set<AnyCancellable>()
    
    var selfId: String {
        networkClient.currentUser?.id ?? ""
    }
    
    var isAdmin: Bool {
        networkClient.currentUser?.isAdmin == true
    }
    
    var body: some View {
        ZStack {
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
                        Text("Action completed successfully!")
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
                
                // Input panel with Photo attachments & Pitch launcher
                chatInputPanel
            }
            .background(theme.backgroundColor.ignoresSafeArea())
            .navigationBarBackButtonHidden(true)
            
            // Full Screen Image Viewer Modal
            if let imgUrl = fullScreenImageUrl {
                FullScreenPhotoViewer(imageUrl: imgUrl) {
                    fullScreenImageUrl = nil
                }
            }
        }
        .sheet(isPresented: $showProfileSheet) {
            WhatsAppCustomerProfileSheet(
                isPresented: $showProfileSheet,
                visitorId: visitorId,
                conversationId: conversationId,
                currentName: visitorName,
                currentAvatarUrl: visitorAvatarUrl,
                currentEmail: visitorEmail,
                currentPhone: visitorPhone,
                currentAbout: visitorAbout,
                currentCompany: visitorCompany,
                currentCity: visitorCity,
                currentCountry: visitorCountry,
                currentUrl: visitorUrl,
                currentTags: visitorTags,
                currentMuted: visitorMuted,
                channel: channel,
                sharedMedia: messagesList.compactMap { $0.attachmentUrl }.filter { !$0.isEmpty },
                onSave: { updated in
                    visitorName = updated.name
                    visitorAvatarUrl = updated.avatarUrl ?? ""
                    visitorEmail = updated.email ?? ""
                    visitorPhone = updated.phoneNumber ?? ""
                    visitorAbout = updated.about ?? ""
                    visitorCompany = updated.company ?? ""
                    visitorTags = updated.tags ?? []
                    visitorMuted = updated.isMuted ?? false
                },
                onConvertToLead: {
                    showProfileSheet = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showCreateLeadDialog = true
                    }
                },
                onDeleteConversation: {
                    showProfileSheet = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showDeleteConfirm = true
                    }
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
                company: visitorCompany,
                source: channel,
                status: "New",
                dealValue: "",
                note: "Converted from active \(channel) conversation",
                conversationId: conversationId,
                visitorId: visitorId
            )
            .environmentObject(theme)
        }
        .sheet(isPresented: $showPitchesSheet) {
            PitchesPickerSheet(
                isPresented: $showPitchesSheet,
                pitches: pitchesList,
                onSelectPitch: { pitch in
                    chatInput = pitch.pitchText
                }
            )
            .environmentObject(theme)
        }
        .alert("Delete Conversation", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                performDeleteConversation()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this conversation with \(visitorName)? All chat history will be permanently removed.")
        }
        .onAppear(perform: loadChatLogs)
        .onDisappear(perform: cleanupSubscriptions)
    }
    
    // Custom Chat navigation bar (Clean: Visitor name + Live Status only)
    private var customNavBarHeader: some View {
        HStack(spacing: 10) {
            // Back button
            Button(action: onNavigateBack) {
                Image(systemName: "chevron.left")
                    .foregroundColor(theme.onSurfaceColor)
                    .font(.system(size: 16, weight: .bold))
                    .frame(width: 32, height: 32)
            }
            
            // Visitor info badge click to open profile
            Button(action: { showProfileSheet = true }) {
                HStack(spacing: 8) {
                    ZStack(alignment: .bottomTrailing) {
                        if !visitorAvatarUrl.isEmpty {
                            AsyncImage(url: URL(string: visitorAvatarUrl)) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill()
                                } else {
                                    Circle().fill(theme.primaryColor.opacity(0.2))
                                }
                            }
                            .frame(width: 38, height: 38)
                            .clipShape(Circle())
                        } else {
                            Circle()
                                .fill(LinearGradient(
                                    colors: [theme.primaryColor.opacity(0.2), theme.primaryColor.opacity(0.4)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 38, height: 38)
                                .overlay(
                                    Text(String(visitorName.prefix(1)).uppercased())
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundColor(theme.primaryColor)
                                )
                        }
                        
                        BrandLogoView(source: channel, size: 14)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(visitorMuted ? "\(visitorName) 🔇" : visitorName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                            .lineLimit(1)
                        
                        HStack(spacing: 4) {
                            if channel == "livechat" {
                                Circle()
                                    .fill(isVisitorTyping ? theme.secondaryColor : Color.green)
                                    .frame(width: 6, height: 6)
                                Text(isVisitorTyping ? "typing..." : "Online")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(isVisitorTyping ? theme.secondaryColor : Color.green)
                            } else {
                                Text(isVisitorTyping ? "typing..." : channel.capitalized)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(theme.textGrayColor)
                            }
                        }
                    }
                }
            }
            
            Spacer()
            
            // Delete Conversation Button
            Button(action: {
                theme.triggerHaptic(style: .rigid)
                showDeleteConfirm = true
            }) {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.red.opacity(0.85))
                    .padding(8)
                    .background(Color.red.opacity(0.1))
                    .clipShape(Circle())
            }
            
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
                    
                    // Quick Action: Save to Device Contacts
                    Button(action: {
                        guard !isSavingVisitorContact else { return }
                        isSavingVisitorContact = true
                        ContactHelper.shared.saveContact(
                            fullName: visitorName,
                            phone: visitorPhone.isEmpty ? nil : visitorPhone,
                            email: visitorEmail.isEmpty ? nil : visitorEmail,
                            company: visitorCompany.isEmpty ? nil : visitorCompany,
                            note: nil
                        ) { success, msg in
                            DispatchQueue.main.async {
                                self.isSavingVisitorContact = false
                                if success {
                                    self.visitorContactSaved = true
                                    withAnimation { leadCreatedToast = true }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                                        withAnimation { leadCreatedToast = false }
                                    }
                                }
                            }
                        }
                    }) {
                        HStack {
                            if isSavingVisitorContact {
                                ProgressView()
                                    .tint(theme.primaryColor)
                                    .scaleEffect(0.7)
                            } else if visitorContactSaved {
                                Image(systemName: "checkmark")
                                Text("Saved to Contacts")
                            } else {
                                Image(systemName: "person.crop.circle.badge.plus")
                                Text("Save Visitor to iPhone Contacts")
                            }
                        }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(visitorContactSaved ? Color(red: 22/255, green: 163/255, blue: 74/255) : theme.primaryColor)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 10)
                        .background(visitorContactSaved ? Color(red: 22/255, green: 163/255, blue: 74/255).opacity(0.12) : theme.primaryColor.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .disabled(isSavingVisitorContact)
                    .padding(.top, 2)
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
                    
                    VStack(alignment: isSelf ? .trailing : .leading, spacing: 6) {
                        // Image attachment preview if present
                        if let att = msg.attachmentUrl, !att.isEmpty {
                            Button(action: {
                                fullScreenImageUrl = att
                            }) {
                                AsyncImage(url: URL(string: att)) { phase in
                                    switch phase {
                                    case .empty:
                                        ZStack {
                                            Rectangle()
                                                .fill(theme.inputBackground)
                                                .frame(width: 220, height: 160)
                                            ProgressView()
                                        }
                                        .cornerRadius(10)
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .scaledToFill()
                                            .frame(maxWidth: 240, maxHeight: 200)
                                            .clipped()
                                            .cornerRadius(10)
                                    case .failure:
                                        HStack(spacing: 6) {
                                            Image(systemName: "photo.fill")
                                            Text("Photo Attachment")
                                                .font(.system(size: 12))
                                        }
                                        .padding(10)
                                        .background(theme.inputBackground)
                                        .cornerRadius(8)
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                            }
                        }
                        
                        if !msg.text.trimmingCharacters(in: .whitespaces).isEmpty {
                            Text(formatMessageText(text: msg.text))
                                .font(.system(size: 14))
                                .foregroundColor(isSelf ? .white : theme.onSurfaceColor)
                        }
                    }
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
                            Button(action: {
                                theme.triggerHaptic(style: .light)
                                chatInput = qr.text
                            }) {
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
    
    // Bottom sending panel with photo attachments & pitch templates
    private var chatInputPanel: some View {
        VStack(spacing: 0) {
            Divider().background(theme.borderColor)
            
            // Attachment Preview Tray
            if !pendingImageDataList.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(pendingImageDataList.enumerated()), id: \.offset) { index, data in
                            if let uiImg = UIImage(data: data) {
                                ZStack(alignment: .topTrailing) {
                                    Image(uiImage: uiImg)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 60, height: 60)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.primaryColor, lineWidth: 1.5))
                                    
                                    Button(action: {
                                        pendingImageDataList.remove(at: index)
                                    }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 16))
                                            .foregroundColor(.red)
                                            .background(Color.white.clipShape(Circle()))
                                    }
                                    .offset(x: 4, y: -4)
                                }
                                .padding(.top, 6)
                                .padding(.trailing, 4)
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 6)
                }
                .background(theme.surfaceColor)
            }
            
            HStack(spacing: 8) {
                // Pitch Quick Insert Launcher
                Button(action: {
                    theme.triggerHaptic(style: .light)
                    showPitchesSheet = true
                }) {
                    HStack(spacing: 2) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 12, weight: .black))
                        Text("Pitch")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                    .padding(.horizontal, 8)
                    .frame(height: 36)
                    .background(Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.12))
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.3), lineWidth: 1))
                }
                
                // Photo Picker Attachment Button
                PhotosPicker(
                    selection: $selectedPhotoItems,
                    maxSelectionCount: 3,
                    matching: .images
                ) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(theme.primaryColor)
                        .frame(width: 36, height: 36)
                        .background(theme.inputBackground)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                }
                .onChange(of: selectedPhotoItems) { newItems in
                    Task {
                        for item in newItems {
                            if let data = try? await item.loadTransferable(type: Data.self) {
                                await MainActor.run {
                                    self.pendingImageDataList.append(data)
                                }
                            }
                        }
                        await MainActor.run {
                            self.selectedPhotoItems.removeAll()
                        }
                    }
                }
                
                TextField("Reply back to customer...", text: $chatInput)
                    .padding(10)
                    .background(theme.inputBackground)
                    .foregroundColor(theme.onSurfaceColor)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                
                Button(action: sendMessage) {
                    if isUploadingMedia {
                        ProgressView()
                            .tint(.white)
                            .padding(10)
                            .background(theme.primaryColor)
                            .clipShape(Circle())
                    } else {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(.white)
                            .padding(10)
                            .background(theme.primaryColor)
                            .clipShape(Circle())
                            .shadow(color: theme.primaryColor.opacity(0.3), radius: 4, y: 2)
                    }
                }
                .disabled(isUploadingMedia)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(theme.surfaceColor)
        }
    }
    
    private func sendMessage() {
        let text = chatInput.trimmingCharacters(in: .whitespaces)
        let hasImages = !pendingImageDataList.isEmpty
        
        guard !text.isEmpty || hasImages else { return }
        
        theme.triggerHaptic(style: .medium)
        
        if hasImages {
            isUploadingMedia = true
            let imagesToSend = pendingImageDataList
            pendingImageDataList.removeAll()
            let messageText = text
            chatInput = ""
            
            Task {
                var uploadedUrls: [String] = []
                for imgData in imagesToSend {
                    if let url = try? await NetworkClient.shared.uploadImage(data: imgData) {
                        uploadedUrls.append(url)
                    }
                }
                
                await MainActor.run {
                    self.isUploadingMedia = false
                    if let firstUrl = uploadedUrls.first {
                        // Dispatch with attachment
                        self.socketManager.sendAgentMessage(
                            conversationId: self.conversationId,
                            visitorId: self.visitorId,
                            text: messageText,
                            attachmentUrl: firstUrl,
                            attachmentType: "image/jpeg"
                        )
                    } else if !messageText.isEmpty {
                        self.socketManager.sendAgentMessage(
                            conversationId: self.conversationId,
                            visitorId: self.visitorId,
                            text: messageText
                        )
                    }
                }
            }
        } else {
            socketManager.sendAgentMessage(
                conversationId: conversationId,
                visitorId: visitorId,
                text: text
            )
            chatInput = ""
        }
    }
    
    private func performDeleteConversation() {
        isDeletingConversation = true
        Task {
            do {
                try await networkClient.deleteConversation(conversationId: conversationId)
                await MainActor.run {
                    self.isDeletingConversation = false
                    self.onNavigateBack()
                }
            } catch {
                print("Failed to delete conversation: \(error)")
                await MainActor.run {
                    self.isDeletingConversation = false
                    self.onNavigateBack()
                }
            }
        }
    }
    
    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.25)) {
            if isVisitorTyping {
                proxy.scrollTo("typing_indicator", anchor: .bottom)
            } else if let last = messagesList.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
    
    private func formatTimestamp(isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: isoString)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: isoString)
        }
        
        guard let d = date else { return "Just now" }
        let out = DateFormatter()
        out.dateFormat = "h:mm a"
        return out.string(from: d)
    }
    
    private func formatMessageText(text: String) -> String {
        text.replacingOccurrences(of: "\n", with: " ")
    }
    
    private func loadChatLogs() {
        Task {
            if let msgs = try? await networkClient.getMessages(conversationId: conversationId) {
                await MainActor.run {
                    self.messagesList = msgs
                }
            }
            if let qr = try? await networkClient.getQuickReplies() {
                await MainActor.run {
                    self.quickRepliesList = qr
                }
            }
            if let pitches = try? await networkClient.getPitches() {
                await MainActor.run {
                    self.pitchesList = pitches
                }
            }
            if let visitor = try? await networkClient.getVisitor(visitorId: visitorId) {
                await MainActor.run {
                    self.visitorAvatarUrl = visitor.avatarUrl ?? ""
                    self.visitorCountry = visitor.country
                    self.visitorCity = visitor.city
                    self.visitorDevice = visitor.deviceType
                    self.visitorUrl = visitor.currentUrl ?? "/"
                    self.visitorEmail = visitor.email ?? ""
                    self.visitorPhone = visitor.phoneNumber ?? ""
                    self.visitorAbout = visitor.about ?? ""
                    self.visitorCompany = visitor.company ?? ""
                    self.visitorTags = visitor.tags ?? []
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

// MARK: - Full Screen Zoomable Photo Viewer Modal
struct FullScreenPhotoViewer: View {
    let imageUrl: String
    let onDismiss: () -> Void
    
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var savedToast = false
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            AsyncImage(url: URL(string: imageUrl)) { phase in
                switch phase {
                case .empty:
                    ProgressView().tint(.white)
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .offset(offset)
                        .gesture(
                            MagnificationGesture()
                                .onChanged { val in
                                    scale = lastScale * val
                                }
                                .onEnded { _ in
                                    lastScale = max(1.0, min(scale, 4.0))
                                    scale = lastScale
                                }
                        )
                        .simultaneousGesture(
                            TapGesture(count: 2)
                                .onEnded {
                                    withAnimation(.spring()) {
                                        if scale > 1.0 {
                                            scale = 1.0
                                            lastScale = 1.0
                                            offset = .zero
                                            lastOffset = .zero
                                        } else {
                                            scale = 2.5
                                            lastScale = 2.5
                                        }
                                    }
                                }
                        )
                        .simultaneousGesture(
                            DragGesture()
                                .onChanged { val in
                                    if scale > 1.0 {
                                        offset = CGSize(
                                            width: lastOffset.width + val.translation.width,
                                            height: lastOffset.height + val.translation.height
                                        )
                                    }
                                }
                                .onEnded { _ in
                                    lastOffset = offset
                                }
                        )
                case .failure:
                    Text("Could not load full size image")
                        .foregroundColor(.white)
                @unknown default:
                    EmptyView()
                }
            }
            
            VStack {
                HStack {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.white)
                            .padding(16)
                    }
                    
                    Spacer()
                    
                    Button(action: saveImageToLibrary) {
                        Image(systemName: "square.and.arrow.down")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .padding(16)
                    }
                }
                
                Spacer()
                
                if savedToast {
                    Text("Saved to Camera Roll")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.black.opacity(0.75))
                        .cornerRadius(20)
                        .padding(.bottom, 24)
                }
            }
        }
    }
    
    private func saveImageToLibrary() {
        guard let url = URL(string: imageUrl) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let uiImg = UIImage(data: data) else { return }
            UIImageWriteToSavedPhotosAlbum(uiImg, nil, nil, nil)
            DispatchQueue.main.async {
                withAnimation { savedToast = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                    withAnimation { savedToast = false }
                }
            }
        }.resume()
    }
}

// MARK: - Pitches Picker Sheet
struct PitchesPickerSheet: View {
    @Binding var isPresented: Bool
    let pitches: [UpsellPitchDto]
    let onSelectPitch: (UpsellPitchDto) -> Void
    @EnvironmentObject var theme: ThemeManager
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 16) {
                HStack {
                    Text("⚡ Quick Upsell Pitches")
                        .font(.system(size: 18, weight: .black))
                        .foregroundColor(theme.onSurfaceColor)
                    Spacer()
                    Button("Close") { isPresented = false }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(theme.primaryColor)
                }
                .padding(.horizontal)
                .padding(.top, 18)
                
                if pitches.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "bolt.slash")
                            .font(.system(size: 32))
                            .foregroundColor(theme.textGrayColor)
                        Text("No pitches available.")
                            .font(.system(size: 14))
                            .foregroundColor(theme.textGrayColor)
                    }
                    .frame(maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            ForEach(pitches) { p in
                                Button(action: {
                                    theme.triggerHaptic(style: .medium)
                                    onSelectPitch(p)
                                    isPresented = false
                                }) {
                                    VStack(alignment: .leading, spacing: 6) {
                                        HStack {
                                            Text(p.title)
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(theme.onSurfaceColor)
                                            Spacer()
                                            Text(p.badgeText)
                                                .font(.system(size: 10, weight: .black))
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 3)
                                                .background(Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.18))
                                                .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                                                .cornerRadius(6)
                                        }
                                        
                                        Text(p.pitchText)
                                            .font(.system(size: 12))
                                            .foregroundColor(theme.textGrayColor)
                                            .multilineTextAlignment(.leading)
                                    }
                                    .padding(14)
                                    .background(theme.surfaceColor)
                                    .cornerRadius(12)
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 24)
                    }
                }
            }
        }
    }
}

// MARK: - WhatsApp-Style Customer Profile & Details Sheet
struct WhatsAppCustomerProfileSheet: View {
    @Binding var isPresented: Bool
    let visitorId: String
    let conversationId: String
    
    @State var currentName: String
    @State var currentAvatarUrl: String
    @State var currentEmail: String
    @State var currentPhone: String
    @State var currentAbout: String
    @State var currentCompany: String
    @State var currentCity: String
    @State var currentCountry: String
    @State var currentUrl: String
    @State var currentTags: [String]
    @State var currentMuted: Bool
    let channel: String
    let sharedMedia: [String]
    
    let onSave: (VisitorDto) -> Void
    let onConvertToLead: () -> Void
    let onDeleteConversation: () -> Void
    
    @EnvironmentObject var theme: ThemeManager
    @State private var isSaving = false
    @State private var isSavingContact = false
    @State private var contactSavedSuccess = false
    @State private var newTagInput = ""
    @State private var selectedMediaPreview: String? = nil
    
    // Photo picker for customer avatar
    @State private var selectedAvatarItem: PhotosPickerItem? = nil
    @State private var isUploadingAvatar = false
    
    // Top URLs state
    @State private var topUrls: [TopUrlAnalyticsDto] = []
    @State private var isLoadingTopUrls = false
    
    var cleanPhone: String {
        currentPhone.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
    }
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 16) {
                    // Top Navigation Header
                    HStack {
                        Button(action: { isPresented = false }) {
                            Text("Done")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(theme.primaryColor)
                        }
                        Spacer()
                        Text("Customer Details")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        Spacer()
                        Button(action: saveDetails) {
                            if isSaving {
                                ProgressView().tint(theme.primaryColor)
                            } else {
                                Text("Save")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(theme.primaryColor)
                            }
                        }
                        .disabled(isSaving)
                    }
                    .padding(.horizontal)
                    .padding(.top, 16)
                    
                    // 1. WhatsApp Hero Card (With Avatar Photo Upload)
                    VStack(spacing: 10) {
                        ZStack(alignment: .bottomTrailing) {
                            PhotosPicker(selection: $selectedAvatarItem, matching: .images) {
                                ZStack {
                                    if !currentAvatarUrl.isEmpty {
                                        AsyncImage(url: URL(string: currentAvatarUrl)) { phase in
                                            if let img = phase.image {
                                                img.resizable().scaledToFill()
                                            } else {
                                                Circle().fill(theme.primaryColor.opacity(0.2))
                                            }
                                        }
                                        .frame(width: 88, height: 88)
                                        .clipShape(Circle())
                                    } else {
                                        Circle()
                                            .fill(LinearGradient(
                                                colors: [theme.primaryColor.opacity(0.3), theme.primaryColor],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            ))
                                            .frame(width: 88, height: 88)
                                            .overlay(
                                                Text(String(currentName.prefix(1)).uppercased())
                                                    .font(.system(size: 34, weight: .black))
                                                    .foregroundColor(.white)
                                            )
                                    }
                                    
                                    if isUploadingAvatar {
                                        Circle()
                                            .fill(Color.black.opacity(0.5))
                                            .frame(width: 88, height: 88)
                                            .overlay(ProgressView().tint(.white))
                                    }
                                }
                            }
                            .onChange(of: selectedAvatarItem) { item in
                                guard let item = item else { return }
                                uploadCustomerAvatar(item: item)
                            }
                            
                            // Upload camera badge overlay
                            Circle()
                                .fill(theme.primaryColor)
                                .frame(width: 26, height: 26)
                                .overlay(
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.white)
                                )
                                .overlay(Circle().stroke(theme.surfaceColor, lineWidth: 2))
                        }
                        
                        Text(currentName.isEmpty ? "Visitor" : currentName)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        if !currentPhone.isEmpty {
                            Text(currentPhone)
                                .font(.system(size: 14))
                                .foregroundColor(theme.textGrayColor)
                        }
                        
                        // Action Bar (WhatsApp, Email, Save Contact, Lead)
                        HStack(spacing: 16) {
                            // WhatsApp
                            actionRoundButton(icon: "message.fill", label: "WhatsApp", color: Color(red: 37/255, green: 211/255, blue: 102/255)) {
                                guard let url = URL(string: "https://wa.me/\(cleanPhone)"), !cleanPhone.isEmpty else { return }
                                UIApplication.shared.open(url)
                            }
                            
                            // Mail
                            actionRoundButton(icon: "envelope.fill", label: "Mail", color: Color.blue) {
                                guard let url = URL(string: "mailto:\(currentEmail)"), !currentEmail.isEmpty else { return }
                                UIApplication.shared.open(url)
                            }
                            
                            // Save Contact
                            actionRoundButton(icon: contactSavedSuccess ? "checkmark" : "person.crop.circle.badge.plus", label: "Save", color: theme.primaryColor) {
                                saveToContacts()
                            }
                            
                            // Convert to Lead
                            actionRoundButton(icon: "bolt.fill", label: "Lead", color: Color.orange) {
                                onConvertToLead()
                            }
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 2. WhatsApp "About / Bio" Section
                    VStack(alignment: .leading, spacing: 6) {
                        Text("ABOUT & STATUS")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        
                        TextField("e.g. Inquiring about enterprise growth plan...", text: $currentAbout)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(10)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.borderColor, lineWidth: 1))
                    }
                    .padding(16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 3. Contact & Profile Info Cards
                    VStack(alignment: .leading, spacing: 12) {
                        Text("CONTACT DETAILS")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(theme.textGrayColor)
                        
                        VStack(spacing: 12) {
                            customField(title: "Full Name", text: $currentName, icon: "person.fill")
                            customField(title: "Phone Number", text: $currentPhone, icon: "phone.fill", keyboard: .phonePad)
                            customField(title: "Email Address", text: $currentEmail, icon: "envelope.fill", keyboard: .emailAddress)
                            customField(title: "Company / Business", text: $currentCompany, icon: "building.2.fill")
                            
                            HStack(spacing: 12) {
                                customField(title: "City", text: $currentCity, icon: "mappin.circle.fill")
                                customField(title: "Country", text: $currentCountry, icon: "globe")
                            }
                        }
                    }
                    .padding(16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 4. Top 5 High-Converting URLs & Exit Dwell Times
                    topHighConvertingUrlsSection
                    
                    // 5. Shared Media Gallery
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("SHARED MEDIA & PHOTOS")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                            Spacer()
                            Text("\(sharedMedia.count)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(theme.primaryColor)
                        }
                        
                        if sharedMedia.isEmpty {
                            Text("No shared photos yet in this chat.")
                                .font(.system(size: 12))
                                .foregroundColor(theme.textGrayColor)
                                .padding(.vertical, 8)
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(sharedMedia, id: \.self) { url in
                                        Button(action: { selectedMediaPreview = url }) {
                                            AsyncImage(url: URL(string: url)) { phase in
                                                if let img = phase.image {
                                                    img.resizable().scaledToFill()
                                                } else {
                                                    Rectangle().fill(theme.inputBackground)
                                                }
                                            }
                                            .frame(width: 70, height: 70)
                                            .cornerRadius(8)
                                            .clipped()
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 6. CRM Lead Pipeline Action & Tags
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("LEAD PIPELINE")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Color.orange)
                                Text("Convert or Manage Lead")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                            Spacer()
                            Button(action: onConvertToLead) {
                                HStack(spacing: 4) {
                                    Image(systemName: "bolt.fill")
                                    Text("Open Lead Editor")
                                }
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.orange)
                                .cornerRadius(8)
                            }
                        }
                        
                        // Interactive Tag Chips
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Tags")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(theme.textGrayColor)
                            
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(currentTags, id: \.self) { tag in
                                        HStack(spacing: 4) {
                                            Text(tag)
                                                .font(.system(size: 11, weight: .bold))
                                            Button(action: {
                                                currentTags.removeAll(where: { $0 == tag })
                                            }) {
                                                Image(systemName: "xmark")
                                                    .font(.system(size: 9, weight: .bold))
                                            }
                                        }
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(theme.primaryColor.opacity(0.12))
                                        .foregroundColor(theme.primaryColor)
                                        .cornerRadius(6)
                                    }
                                    
                                    HStack(spacing: 4) {
                                        TextField("+ Tag", text: $newTagInput, onCommit: {
                                            let trimmed = newTagInput.trimmingCharacters(in: .whitespaces)
                                            if !trimmed.isEmpty && !currentTags.contains(trimmed) {
                                                currentTags.append(trimmed)
                                                newTagInput = ""
                                            }
                                        })
                                        .font(.system(size: 11))
                                        .frame(width: 60)
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(theme.inputBackground)
                                    .cornerRadius(6)
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 7. Mute Notifications
                    VStack(alignment: .leading, spacing: 10) {
                        Toggle(isOn: $currentMuted) {
                            HStack(spacing: 8) {
                                Image(systemName: "bell.slash.fill")
                                    .foregroundColor(theme.primaryColor)
                                Text("Mute Notifications")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                        }
                        .tint(theme.primaryColor)
                    }
                    .padding(16)
                    .background(theme.surfaceColor)
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
                    .padding(.horizontal)
                    
                    // 8. Delete Conversation Action
                    Button(action: onDeleteConversation) {
                        HStack {
                            Image(systemName: "trash")
                            Text("Delete Chat History")
                                .fontWeight(.bold)
                        }
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color.red.opacity(0.12))
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.red.opacity(0.25), lineWidth: 1))
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 24)
                }
            }
            .onAppear(perform: loadTopUrls)
            
            if let preview = selectedMediaPreview {
                FullScreenPhotoViewer(imageUrl: preview) {
                    selectedMediaPreview = nil
                }
            }
        }
    }
    
    // Top 5 High-Converting URLs View
    private var topHighConvertingUrlsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("📍 TOP 5 HIGH-CONVERTING URLS & DWELL TIMES")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(theme.textGrayColor)
                Spacer()
                if isLoadingTopUrls {
                    ProgressView().scaleEffect(0.6)
                }
            }
            
            if topUrls.isEmpty && !isLoadingTopUrls {
                Text("No URL analytics recorded yet.")
                    .font(.system(size: 12))
                    .foregroundColor(theme.textGrayColor)
                    .padding(.vertical, 6)
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
        .padding(16)
        .background(theme.surfaceColor)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.borderColor, lineWidth: 1))
        .padding(.horizontal)
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
    
    private func uploadCustomerAvatar(item: PhotosPickerItem) {
        isUploadingAvatar = true
        Task {
            if let data = try? await item.loadTransferable(type: Data.self),
               let uploadedUrl = try? await NetworkClient.shared.uploadImage(data: data) {
                await MainActor.run {
                    self.currentAvatarUrl = uploadedUrl
                    self.isUploadingAvatar = false
                }
            } else {
                await MainActor.run { self.isUploadingAvatar = false }
            }
        }
    }
    
    private func customField(title: String, text: Binding<String>, icon: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(theme.textGrayColor)
            
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(theme.primaryColor)
                    .frame(width: 16)
                
                TextField("", text: text)
                    .keyboardType(keyboard)
                    .font(.system(size: 13))
                    .foregroundColor(theme.onSurfaceColor)
            }
            .padding(10)
            .background(theme.inputBackground)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
        }
    }
    
    private func actionRoundButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: {
            theme.triggerHaptic(style: .medium)
            action()
        }) {
            VStack(spacing: 4) {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(color)
                    )
                
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(theme.onSurfaceColor)
            }
        }
    }
    
    private func saveToContacts() {
        guard !isSavingContact else { return }
        isSavingContact = true
        ContactHelper.shared.saveContact(
            fullName: currentName,
            phone: currentPhone.isEmpty ? nil : currentPhone,
            email: currentEmail.isEmpty ? nil : currentEmail,
            company: currentCompany.isEmpty ? nil : currentCompany,
            note: currentAbout.isEmpty ? nil : currentAbout
        ) { success, _ in
            DispatchQueue.main.async {
                self.isSavingContact = false
                if success {
                    self.contactSavedSuccess = true
                }
            }
        }
    }
    
    private func saveDetails() {
        isSaving = true
        let body: [String: Any] = [
            "name": currentName.trimmingCharacters(in: .whitespaces),
            "avatarUrl": currentAvatarUrl,
            "email": currentEmail.trimmingCharacters(in: .whitespaces),
            "phoneNumber": currentPhone.trimmingCharacters(in: .whitespaces),
            "about": currentAbout.trimmingCharacters(in: .whitespaces),
            "company": currentCompany.trimmingCharacters(in: .whitespaces),
            "city": currentCity.trimmingCharacters(in: .whitespaces),
            "country": currentCountry.trimmingCharacters(in: .whitespaces),
            "tags": currentTags,
            "isMuted": currentMuted
        ]
        
        Task {
            do {
                let updated = try await NetworkClient.shared.updateVisitor(visitorId: visitorId, fields: body)
                await MainActor.run {
                    self.onSave(updated)
                    self.isSaving = false
                    self.isPresented = false
                }
            } catch {
                print("Failed to save visitor details: \(error)")
                await MainActor.run { self.isSaving = false }
            }
        }
    }
}
