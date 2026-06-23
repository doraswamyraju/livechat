import Foundation

// ============================================
// DTO DEFINITIONS
// ============================================

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct UserProfile: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let email: String
    let role: String
    let status: String
    
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, email, role, status
    }
    
    // Fallback parser since MongoDB/Retrofit formats can differ (some responses might return `id` as `id`)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = (try? container.decode(String.self, forKey: .role)) ?? "Agent"
        status = (try? container.decode(String.self, forKey: .status)) ?? "Offline"
        
        if let decodedId = try? container.decode(String.self, forKey: .id) {
            id = decodedId
        } else {
            let containerRaw = try decoder.container(keyedBy: AdditionalKeys.self)
            id = try containerRaw.decode(String.self, forKey: .idFallback)
        }
    }
    
    private enum AdditionalKeys: String, CodingKey {
        case idFallback = "id"
    }
    
    init(id: String, name: String, email: String, role: String, status: String) {
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.status = status
    }
}

struct TenantDetails: Codable, Hashable {
    let id: String
    let name: String
    let domain: String
    let apiKey: String
    
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, domain, apiKey
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        domain = (try? container.decode(String.self, forKey: .domain)) ?? ""
        apiKey = (try? container.decode(String.self, forKey: .apiKey)) ?? ""
        
        if let decodedId = try? container.decode(String.self, forKey: .id) {
            id = decodedId
        } else {
            let containerRaw = try decoder.container(keyedBy: AdditionalKeys.self)
            id = try containerRaw.decode(String.self, forKey: .idFallback)
        }
    }
    
    private enum AdditionalKeys: String, CodingKey {
        case idFallback = "id"
    }
    
    init(id: String, name: String, domain: String, apiKey: String) {
        self.id = id
        self.name = name
        self.domain = domain
        self.apiKey = apiKey
    }
}

struct LoginResponse: Codable {
    let token: String
    let user: UserProfile
    let tenant: TenantDetails
}

struct AnalyticsResponse: Codable {
    let totalVisitors: Int
    let onlineVisitors: Int
    let activeConversations: Int
    let unassignedConversations: Int
    let totalChats: Int
    let totalAgents: Int
    let onlineAgents: Int
}

struct VisitorDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    var name: String
    var email: String?
    var phoneNumber: String?
    var country: String
    var city: String
    var deviceType: String
    var currentUrl: String?
    var isOnline: Bool
    var isMuted: Bool?
}

struct ConversationDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    let visitorId: String
    var status: String
    var assignedAgentId: String?
    var updatedAt: String
}

struct MessageDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    let conversationId: String
    let senderType: String // "Agent", "Visitor", "System"
    let senderId: String
    let senderName: String
    let text: String
    let timestamp: String
}

struct FcmTokenRequest: Codable {
    let fcmToken: String
}

struct ResetPasswordRequest: Codable {
    let email: String
    let newPassword: String
}

struct ResetPasswordResponse: Codable {
    let message: String
}

struct QuickReplyDto: Codable, Identifiable, Hashable {
    var id: String { _id }
    let _id: String
    let tenantId: String
    let shortcut: String
    let text: String
}

struct UpdateProfileRequest: Codable {
    let name: String?
    let avatarUrl: String?
    let password: String?
}

struct RegisterAgentRequest: Codable {
    let name: String
    let email: String
    let password: String
}

struct RegisterAgentResponse: Codable {
    let message: String
    let agent: UserProfile
}
