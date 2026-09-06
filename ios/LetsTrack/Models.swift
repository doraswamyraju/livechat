import Foundation

// ============================================
// DTO DEFINITIONS
// ============================================

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct GoogleLoginRequest: Codable {
    let credential: String
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
    var source: String?
    var channel: String?
    var firstSeen: String?
    var lastSeen: String?
    
    var resolvedChannel: String {
        if let ch = channel, !ch.isEmpty { return ch }
        if let src = source, !src.isEmpty { return src }
        let lowName = name.lowercased()
        if lowName.contains("whatsapp") || (phoneNumber != nil && !phoneNumber!.isEmpty) {
            return "whatsapp"
        } else if lowName.contains("insta") || lowName.contains("ig") {
            return "instagram"
        } else if lowName.contains("facebook") || lowName.contains("fb") {
            return "facebook"
        }
        return "livechat"
    }
}

struct ConversationDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    let visitorId: String
    var status: String
    var assignedAgentId: String?
    var channel: String?
    var lastMessage: String?
    var unreadCount: Int?
    var updatedAt: String
    
    var resolvedChannel: String {
        if let ch = channel, !ch.isEmpty { return ch }
        return "livechat"
    }
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

// ============================================
// LEAD MANAGEMENT SYSTEM DTOs
// ============================================

struct LeadNoteDto: Codable, Identifiable, Equatable {
    var id: String { _id ?? UUID().uuidString }
    let _id: String?
    let text: String
    let authorName: String?
    let createdAt: String?
}

struct LeadDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    var name: String
    var email: String?
    var phone: String?
    var company: String?
    var source: String // "livechat", "whatsapp", "instagram", "facebook", "meta_ads", "manual", "website"
    var status: String // "New", "Contacted", "Qualified", "Proposal", "Won", "Lost"
    var dealValue: Double?
    var currency: String?
    var score: Int?
    var notes: [LeadNoteDto]?
    var tags: [String]?
    var assignedAgentId: String?
    var assignedAgentName: String?
    var conversationId: String?
    var visitorId: String?
    var createdAt: String?
    var updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case _id, name, email, phone, company, source, status, dealValue, currency, score, notes, tags, assignedAgentId, assignedAgentName, conversationId, visitorId, createdAt, updatedAt
    }
}

struct CreateLeadRequest: Codable {
    let name: String
    let email: String?
    let phone: String?
    let company: String?
    let source: String?
    let status: String?
    let dealValue: Double?
    let currency: String?
    let score: Int?
    let notes: [String]?
    let tags: [String]?
    let assignedAgentId: String?
    let conversationId: String?
    let visitorId: String?
}

struct LeadStatsDto: Codable {
    let totalLeads: Int
    let newLeads: Int
    let wonLeads: Int
    let lostLeads: Int
    let totalPipelineValue: Double
    let wonValue: Double
    let conversionRate: Double
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
