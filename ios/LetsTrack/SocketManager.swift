import Foundation
import SocketIO
import Combine
import SwiftUI

struct DeepLinkTarget: Equatable {
    let conversationId: String
    let visitorName: String
    let visitorId: String
}

class SocketManager: ObservableObject {
    static let shared = SocketManager()
    
    private var manager: SocketIO.SocketManager?
    private var socket: SocketIO.SocketIOClient?
    
    @Published var isConnected = false
    @Published var pendingDeepLink: DeepLinkTarget? = nil
    @Published var visitorsList: [VisitorDto] = []
    @Published var conversationsList: [ConversationDto] = []
    @Published var agentsList: [UserProfile] = []
    @Published var selfStatus = "Offline"
    
    // For specific chat screens to observe message events
    let visitorMessagePublisher = PassthroughSubject<(conversationId: String, visitorId: String, message: MessageDto, visitor: VisitorDto), Never>()
    let agentMessagePublisher = PassthroughSubject<(conversationId: String, message: MessageDto), Never>()
    let typingStatusPublisher = PassthroughSubject<(conversationId: String, isTyping: Bool), Never>()
    let navigationPathPublisher = PassthroughSubject<(visitorId: String, currentUrl: String), Never>()
    let chatAssignedPublisher = PassthroughSubject<(conversationId: String, status: String, assignedAgentId: String?, systemMessage: MessageDto?), Never>()
    let startConversationSuccessPublisher = PassthroughSubject<ConversationDto, Never>()
    
    private init() {}
    
    func connectSocket() {
        guard let tenantId = NetworkClient.shared.currentTenant?.id,
              let agentId = NetworkClient.shared.currentUser?.id else {
            print("Cannot connect socket: User is not authenticated.")
            return
        }
        
        if manager == nil {
            let url = URL(string: "https://letstrack.manacity.in")!
            manager = SocketIO.SocketManager(
                socketURL: url,
                config: [.log(false), .forceNew(true), .reconnects(true)]
            )
            // Namespace /dashboard
            socket = manager?.socket(forNamespace: "/dashboard")
        }
        
        guard let s = socket else { return }
        
        s.removeAllHandlers()
        
        // Connect events
        s.on(clientEvent: .connect) { [weak self] _, _ in
            guard let self = self else { return }
            print("Socket connected successfully!")
            self.isConnected = true
            
            // Perform agent initialization handshake
            let initData: [String: Any] = [
                "tenantId": tenantId,
                "agentId": agentId
            ]
            s.emit("agent-init", initData)
        }
        
        s.on(clientEvent: .disconnect) { [weak self] _, _ in
            guard let self = self else { return }
            self.isConnected = false
            print("Socket disconnected.")
        }
        
        // 1. Dashboard sync on authentication
        s.on("dashboard-sync") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any] else { return }
            
            // Parse visitors
            if let visArray = dict["visitors"] as? [[String: Any]] {
                self.visitorsList = visArray.compactMap { self.parseVisitor(from: $0) }
            }
            
            // Parse conversations
            if let convArray = dict["conversations"] as? [[String: Any]] {
                self.conversationsList = convArray.compactMap { self.parseConversation(from: $0) }
            }
            
            // Parse agents
            if let agentArray = dict["agents"] as? [[String: Any]] {
                self.agentsList = agentArray.compactMap { self.parseUserProfile(from: $0) }
                NetworkClient.shared.cachedAgents = self.agentsList
                
                // Self status sync
                if let me = self.agentsList.first(where: { $0.id == agentId }) {
                    self.selfStatus = me.status
                }
            }
        }
        
        // 2. Visitor connected
        s.on("visitor-connected") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let visitor = self.parseVisitor(from: dict) else { return }
            
            self.visitorsList = self.visitorsList.filter { $0.id != visitor.id } + [visitor]
        }
        
        // 3. Visitor navigated paths
        s.on("visitor-navigated") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let vId = dict["visitorId"] as? String,
                  let url = dict["currentUrl"] as? String else { return }
            
            self.visitorsList = self.visitorsList.map {
                var temp = $0
                if temp.id == vId {
                    temp.currentUrl = url
                }
                return temp
            }
            self.navigationPathPublisher.send((visitorId: vId, currentUrl: url))
        }
        
        // 4. Visitor disconnected
        s.on("visitor-disconnected") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let vId = dict["visitorId"] as? String else { return }
            
            self.visitorsList = self.visitorsList.map {
                var temp = $0
                if temp.id == vId {
                    temp.isOnline = false
                }
                return temp
            }
        }
        
        // 5. Chat Assigned updates
        s.on("chat-assigned-update") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let convObj = dict["conversation"] as? [String: Any],
                  let conversation = self.parseConversation(from: convObj) else { return }
            
            self.conversationsList = self.conversationsList.map {
                if $0.id == conversation.id {
                    return conversation
                }
                return $0
            }
            
            var sysMsg: MessageDto? = nil
            if let sysObj = dict["systemMessage"] as? [String: Any] {
                sysMsg = self.parseMessage(from: sysObj, conversationId: conversation.id)
            }
            
            self.chatAssignedPublisher.send((
                conversationId: conversation.id,
                status: conversation.status,
                assignedAgentId: conversation.assignedAgentId,
                systemMessage: sysMsg
            ))
        }
        
        // 6. Agent presence updates
        s.on("agent-status-changed") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let aId = dict["agentId"] as? String,
                  let status = dict["status"] as? String else { return }
            
            self.agentsList = self.agentsList.map {
                if $0.id == aId {
                    return UserProfile(id: $0.id, name: $0.name, email: $0.email, role: $0.role, status: status)
                }
                return $0
            }
            NetworkClient.shared.cachedAgents = self.agentsList
            
            if aId == agentId {
                self.selfStatus = status
            }
        }
        
        // 7. Visitor message incoming
        s.on("visitor-msg") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let convObj = dict["conversation"] as? [String: Any],
                  let conversation = self.parseConversation(from: convObj),
                  let visitorObj = dict["visitor"] as? [String: Any],
                  let visitor = self.parseVisitor(from: visitorObj),
                  let msgObj = dict["message"] as? [String: Any] else { return }
            
            let message = self.parseMessage(from: msgObj, conversationId: conversation.id)
            
            self.visitorsList = self.visitorsList.filter { $0.id != visitor.id } + [visitor]
            self.conversationsList = self.conversationsList.filter { $0.id != conversation.id } + [conversation]
            
            self.visitorMessagePublisher.send((conversationId: conversation.id, visitorId: visitor.id, message: message, visitor: visitor))
        }
        
        // 8. Agent message received (sync with other panels)
        s.on("agent-msg-received") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let cId = dict["conversationId"] as? String,
                  let msgObj = dict["message"] as? [String: Any] else { return }
            
            let message = self.parseMessage(from: msgObj, conversationId: cId)
            self.agentMessagePublisher.send((conversationId: cId, message: message))
        }
        
        // 9. Visitor Typing indicator
        s.on("visitor-typing") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let cId = dict["conversationId"] as? String,
                  let isTyping = dict["isTyping"] as? Bool else { return }
            
            self.typingStatusPublisher.send((conversationId: cId, isTyping: isTyping))
        }
        
        // 10. Start conversation success (proactive chat initiation trigger)
        s.on("start-conversation-success") { [weak self] data, _ in
            guard let self = self,
                  let dict = data.first as? [String: Any],
                  let convObj = dict["conversation"] as? [String: Any],
                  let conversation = self.parseConversation(from: convObj) else { return }
            
            self.conversationsList = self.conversationsList.filter { $0.id != conversation.id } + [conversation]
            self.startConversationSuccessPublisher.send(conversation)
        }
        
        // Connect socket client
        s.connect()
    }
    
    func disconnectSocket() {
        socket?.disconnect()
        socket = nil
        manager = nil
        isConnected = false
    }
    
    // MARK: - Emitted Event wrappers
    
    func updateStatus(status: String) {
        socket?.emit("agent-status-update", ["status": status])
    }
    
    func startConversation(visitorId: String) {
        socket?.emit("start-conversation", ["visitorId": visitorId])
    }
    
    func assignChat(conversationId: String, agentId: String?) {
        if let id = agentId {
            socket?.emit("assign-chat", ["conversationId": conversationId, "assignedAgentId": id])
        } else {
            socket?.emit("assign-chat", ["conversationId": conversationId, "assignedAgentId": NSNull()])
        }
    }
    
    func sendAgentMessage(conversationId: String, visitorId: String, text: String) {
        let payload: [String: Any] = [
            "conversationId": conversationId,
            "visitorId": visitorId,
            "text": text
        ]
        socket?.emit("agent-msg", payload)
    }
    
    // MARK: - Local Parsers
    
    private func parseVisitor(from dict: [String: Any]) -> VisitorDto? {
        guard let id = dict["_id"] as? String,
              let name = dict["name"] as? String else { return nil }
        
        return VisitorDto(
            _id: id,
            name: name,
            email: dict["email"] as? String,
            phoneNumber: dict["phoneNumber"] as? String,
            country: dict["country"] as? String ?? "Unknown",
            city: dict["city"] as? String ?? "Unknown",
            deviceType: dict["deviceType"] as? String ?? "Desktop",
            currentUrl: dict["currentUrl"] as? String,
            isOnline: dict["isOnline"] as? Bool ?? false,
            isMuted: dict["isMuted"] as? Bool ?? false
        )
    }
    
    private func parseConversation(from dict: [String: Any]) -> ConversationDto? {
        guard let id = dict["_id"] as? String,
              let visitorRaw = dict["visitorId"] else { return nil }
              
        let vId: String
        if let visDict = visitorRaw as? [String: Any] {
            vId = visDict["_id"] as? String ?? ""
        } else {
            vId = String(describing: visitorRaw)
        }
        
        let assignedId: String?
        if let agentRaw = dict["assignedAgentId"] {
            if let agentDict = agentRaw as? [String: Any] {
                assignedId = agentDict["_id"] as? String
            } else if !(agentRaw is NSNull) {
                assignedId = String(describing: agentRaw)
            } else {
                assignedId = nil
            }
        } else {
            assignedId = nil
        }
        
        return ConversationDto(
            _id: id,
            visitorId: vId,
            status: dict["status"] as? String ?? "Unassigned",
            assignedAgentId: assignedId,
            updatedAt: dict["updatedAt"] as? String ?? ""
        )
    }
    
    private func parseUserProfile(from dict: [String: Any]) -> UserProfile? {
        guard let id = dict["_id"] as? String,
              let name = dict["name"] as? String,
              let email = dict["email"] as? String else { return nil }
              
        return UserProfile(
            id: id,
            name: name,
            email: email,
            role: dict["role"] as? String ?? "Agent",
            status: dict["status"] as? String ?? "Offline"
        )
    }
    
    private func parseMessage(from dict: [String: Any], conversationId: String) -> MessageDto {
        return MessageDto(
            _id: dict["_id"] as? String ?? UUID().uuidString,
            conversationId: conversationId,
            senderType: dict["senderType"] as? String ?? "System",
            senderId: dict["senderId"] as? String ?? "SYSTEM",
            senderName: dict["senderName"] as? String ?? "System",
            text: dict["text"] as? String ?? "",
            timestamp: dict["timestamp"] as? String ?? ""
        )
    }
}
