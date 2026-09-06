import Foundation
import SwiftUI
import Contacts
import ContactsUI

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
    
    var isSuperAdmin: Bool {
        let r = role.lowercased().replacingOccurrences(of: " ", with: "")
        return r == "superadmin"
    }
    
    var isAdmin: Bool {
        let r = role.lowercased().replacingOccurrences(of: " ", with: "")
        return r == "admin" || r == "superadmin"
    }
}

struct TenantWorkspaceDto: Codable, Identifiable, Hashable {
    var id: String { _id }
    let _id: String
    let name: String
    let domain: String
    let apiKey: String?
    let plan: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case _id, name, domain, apiKey, plan, createdAt
    }
}

struct SubscriptionUsageDto: Codable, Equatable {
    var planName: String = "Enterprise"
    var renewalDate: String? = nil
    var activeSeats: Int = 1
    var maxSeats: Int = 5
    var leadsThisMonth: Int = 0
    var maxLeads: Int = 5000
    var whatsappApiEnabled: Bool = true
    var metaAdsSyncEnabled: Bool = true
}

struct MetaChannelStatusDto: Codable, Equatable {
    var whatsappConnected: Bool = true
    var whatsappPhone: String? = "+91 98765 43210"
    var instagramConnected: Bool = true
    var instagramHandle: String? = "@letstrack_live"
    var facebookConnected: Bool = true
    var facebookPageName: String? = "LetsTrack Omnichannel"
    var liveChatActive: Bool = true
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
    var avatarUrl: String?
    var email: String?
    var phoneNumber: String?
    var country: String
    var city: String
    var deviceType: String
    var currentUrl: String?
    var about: String?
    var company: String?
    var tags: [String]?
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
    var attachmentUrl: String?
    var attachmentType: String?
    var mediaUrls: [String]?
    let timestamp: String
}

struct UploadResponseDto: Codable {
    let url: String
    let filename: String?
    let relativeUrl: String?
}

struct WidgetSettingsDto: Codable {
    var primaryColor: String?
    var headingText: String?
    var welcomeMessage: String?
    var preChatEnabled: Bool?
    var position: String?
    var headerTextColor: String?
    var gradientColor: String?
    var useGradient: Bool?
    var statusText: String?
    var borderRadius: Int?
    var launcherText: String?
    var hideBranding: Bool?
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

struct LeadMetaDataDto: Codable, Equatable {
    let campaignName: String?
    let campaignId: String?
    let adName: String?
    let adId: String?
    let formId: String?
    let pageId: String?
    let formAnswers: [String: String]?
}

struct LeadAgentDto: Codable, Equatable {
    let _id: String?
    let name: String?
    let email: String?
    let avatarUrl: String?
}

struct LeadDto: Codable, Identifiable, Equatable {
    var id: String { _id }
    let _id: String
    var name: String
    var email: String?
    var phone: String?
    var company: String?
    var source: String
    var status: String
    var dealValue: Double?
    var currency: String?
    var score: Int?
    var notes: [LeadNoteDto]?
    var tags: [String]?
    var assignedAgentId: String?
    var assignedAgentName: String?
    var metaData: LeadMetaDataDto?
    var conversationId: String?
    var visitorId: String?
    var createdAt: String?
    var updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case _id, name, email, phone, phoneNumber, company, source, status, dealValue, currency, score, notes, tags, assignedAgentId, assignedAgentName, metaData, conversationId, visitorId, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        _id = try container.decode(String.self, forKey: ._id)
        name = (try? container.decodeIfPresent(String.self, forKey: .name)) ?? "Lead"
        email = try? container.decodeIfPresent(String.self, forKey: .email)
        
        let rawPhone = try? container.decodeIfPresent(String.self, forKey: .phone)
        let rawPhoneNumber = try? container.decodeIfPresent(String.self, forKey: .phoneNumber)
        phone = rawPhone ?? rawPhoneNumber
        
        company = try? container.decodeIfPresent(String.self, forKey: .company)
        source = (try? container.decodeIfPresent(String.self, forKey: .source)) ?? "manual"
        status = (try? container.decodeIfPresent(String.self, forKey: .status)) ?? "New"
        
        if let dv = try? container.decodeIfPresent(Double.self, forKey: .dealValue) {
            dealValue = dv
        } else if let dvInt = try? container.decodeIfPresent(Int.self, forKey: .dealValue) {
            dealValue = Double(dvInt)
        } else {
            dealValue = nil
        }
        
        currency = (try? container.decodeIfPresent(String.self, forKey: .currency)) ?? "INR"
        score = try? container.decodeIfPresent(Int.self, forKey: .score)
        notes = try? container.decodeIfPresent([LeadNoteDto].self, forKey: .notes)
        tags = try? container.decodeIfPresent([String].self, forKey: .tags)
        
        // Flexibly decode assignedAgentId (can be populated object or raw String)
        if let agentObj = try? container.decodeIfPresent(LeadAgentDto.self, forKey: .assignedAgentId) {
            assignedAgentId = agentObj._id
            assignedAgentName = agentObj.name
        } else if let agentIdStr = try? container.decodeIfPresent(String.self, forKey: .assignedAgentId) {
            assignedAgentId = agentIdStr
            assignedAgentName = try? container.decodeIfPresent(String.self, forKey: .assignedAgentName)
        } else {
            assignedAgentId = nil
            assignedAgentName = try? container.decodeIfPresent(String.self, forKey: .assignedAgentName)
        }
        
        metaData = try? container.decodeIfPresent(LeadMetaDataDto.self, forKey: .metaData)
        conversationId = try? container.decodeIfPresent(String.self, forKey: .conversationId)
        visitorId = try? container.decodeIfPresent(String.self, forKey: .visitorId)
        createdAt = try? container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try? container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(_id, forKey: ._id)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(phone, forKey: .phone)
        try container.encodeIfPresent(company, forKey: .company)
        try container.encode(source, forKey: .source)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(dealValue, forKey: .dealValue)
        try container.encodeIfPresent(currency, forKey: .currency)
        try container.encodeIfPresent(score, forKey: .score)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encodeIfPresent(tags, forKey: .tags)
        try container.encodeIfPresent(assignedAgentId, forKey: .assignedAgentId)
        try container.encodeIfPresent(assignedAgentName, forKey: .assignedAgentName)
        try container.encodeIfPresent(metaData, forKey: .metaData)
        try container.encodeIfPresent(conversationId, forKey: .conversationId)
        try container.encodeIfPresent(visitorId, forKey: .visitorId)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
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

struct LeadStatsDto: Codable, Equatable {
    var totalLeads: Int = 0
    var newLeads: Int = 0
    var wonLeads: Int = 0
    var lostLeads: Int = 0
    var totalPipelineValue: Double = 0.0
    var wonValue: Double = 0.0
    var conversionRate: Double = 0.0
    
    enum CodingKeys: String, CodingKey {
        case totalLeads, newLeads, wonLeads, lostLeads, totalPipelineValue, totalDealValue, wonValue, wonDealValue, conversionRate, stages
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalLeads = (try? container.decodeIfPresent(Int.self, forKey: .totalLeads)) ?? 0
        
        let stages = try? container.decodeIfPresent([String: Int].self, forKey: .stages)
        newLeads = (try? container.decodeIfPresent(Int.self, forKey: .newLeads)) ?? (stages?["New"] ?? 0)
        wonLeads = (try? container.decodeIfPresent(Int.self, forKey: .wonLeads)) ?? (stages?["Won"] ?? 0)
        lostLeads = (try? container.decodeIfPresent(Int.self, forKey: .lostLeads)) ?? (stages?["Lost"] ?? 0)
        
        let pipeVal = try? container.decodeIfPresent(Double.self, forKey: .totalPipelineValue)
        let dealVal = try? container.decodeIfPresent(Double.self, forKey: .totalDealValue)
        totalPipelineValue = pipeVal ?? dealVal ?? 0.0
        
        let wonVal = try? container.decodeIfPresent(Double.self, forKey: .wonValue)
        let wonDealVal = try? container.decodeIfPresent(Double.self, forKey: .wonDealValue)
        wonValue = wonVal ?? wonDealVal ?? 0.0
        
        if let crDouble = try? container.decodeIfPresent(Double.self, forKey: .conversionRate) {
            conversionRate = crDouble
        } else if let crStr = try? container.decodeIfPresent(String.self, forKey: .conversionRate) {
            conversionRate = Double(crStr) ?? 0.0
        } else {
            conversionRate = 0.0
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(totalLeads, forKey: .totalLeads)
        try container.encode(newLeads, forKey: .newLeads)
        try container.encode(wonLeads, forKey: .wonLeads)
        try container.encode(lostLeads, forKey: .lostLeads)
        try container.encode(totalPipelineValue, forKey: .totalPipelineValue)
        try container.encode(wonValue, forKey: .wonValue)
        try container.encode(conversionRate, forKey: .conversionRate)
    }
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

// ============================================
// NATIVE DEVICE CONTACTS HELPER & PICKER
// ============================================
import Contacts
import ContactsUI

final class ContactHelper {
    static let shared = ContactHelper()
    private let contactStore = CNContactStore()
    
    func saveContact(
        fullName: String,
        phone: String?,
        email: String?,
        company: String?,
        note: String? = nil,
        completion: ((Bool, String) -> Void)? = nil
    ) {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .notDetermined {
            contactStore.requestAccess(for: .contacts) { granted, error in
                if granted {
                    self.performSaveOrUpdate(fullName: fullName, phone: phone, email: email, company: company, completion: completion)
                } else {
                    let errMsg = error?.localizedDescription ?? "Contacts permission was not granted."
                    DispatchQueue.main.async {
                        completion?(false, errMsg)
                    }
                }
            }
        } else if status == .authorized || status.rawValue == 4 /* .limited on iOS 18+ */ {
            performSaveOrUpdate(fullName: fullName, phone: phone, email: email, company: company, completion: completion)
        } else {
            DispatchQueue.main.async {
                completion?(false, "Please allow Contacts permission in iOS Settings to save leads.")
            }
        }
    }
    
    private func performSaveOrUpdate(
        fullName: String,
        phone: String?,
        email: String?,
        company: String?,
        completion: ((Bool, String) -> Void)?
    ) {
        let trimmedName = fullName.trimmingCharacters(in: .whitespaces)
        let trimmedPhone = phone?.trimmingCharacters(in: .whitespaces)
        let trimmedEmail = email?.trimmingCharacters(in: .whitespaces)
        let trimmedCompany = company?.trimmingCharacters(in: .whitespaces)
        
        let keysToFetch: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor
        ]
        
        var existingContact: CNContact? = nil
        
        // 1. Try finding existing contact by phone
        if let p = trimmedPhone, !p.isEmpty {
            let cleanDigits = p.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
            if !cleanDigits.isEmpty {
                let predicate = CNContact.predicateForContacts(matching: CNPhoneNumber(stringValue: p))
                if let contacts = try? contactStore.unifiedContacts(matching: predicate, keysToFetch: keysToFetch),
                   let match = contacts.first {
                    existingContact = match
                }
            }
        }
        
        // 2. Try finding existing contact by email if not found by phone
        if existingContact == nil, let em = trimmedEmail, !em.isEmpty {
            let predicate = CNContact.predicateForContacts(matchingEmailAddress: em)
            if let contacts = try? contactStore.unifiedContacts(matching: predicate, keysToFetch: keysToFetch),
               let match = contacts.first {
                existingContact = match
            }
        }
        
        // 3. Try finding existing contact by exact matching name if not found
        if existingContact == nil, !trimmedName.isEmpty {
            let predicate = CNContact.predicateForContacts(matchingName: trimmedName)
            if let contacts = try? contactStore.unifiedContacts(matching: predicate, keysToFetch: keysToFetch) {
                existingContact = contacts.first(where: {
                    let cName = "\($0.givenName) \($0.familyName)".trimmingCharacters(in: .whitespaces)
                    return cName.caseInsensitiveCompare(trimmedName) == .orderedSame
                })
            }
        }
        
        let saveRequest = CNSaveRequest()
        
        if let existing = existingContact, let mutable = existing.mutableCopy() as? CNMutableContact {
            // Update / merge into existing contact without duplicating
            var updatedAny = false
            
            if mutable.givenName.isEmpty && mutable.familyName.isEmpty && !trimmedName.isEmpty {
                let parts = trimmedName.components(separatedBy: " ")
                mutable.givenName = parts.first ?? ""
                if parts.count > 1 {
                    mutable.familyName = parts.dropFirst().joined(separator: " ")
                }
                updatedAny = true
            }
            
            if let comp = trimmedCompany, !comp.isEmpty && mutable.organizationName.isEmpty {
                mutable.organizationName = comp
                updatedAny = true
            }
            
            if let p = trimmedPhone, !p.isEmpty {
                let cleanNew = p.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
                let alreadyHasPhone = mutable.phoneNumbers.contains {
                    let existingClean = $0.value.stringValue.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
                    return existingClean == cleanNew || (!cleanNew.isEmpty && cleanNew.count >= 10 && existingClean.hasSuffix(cleanNew.suffix(10)))
                }
                if !alreadyHasPhone {
                    mutable.phoneNumbers.append(CNLabeledValue(label: CNLabelPhoneNumberMain, value: CNPhoneNumber(stringValue: p)))
                    updatedAny = true
                }
            }
            
            if let em = trimmedEmail, !em.isEmpty {
                let alreadyHasEmail = mutable.emailAddresses.contains {
                    ($0.value as String).caseInsensitiveCompare(em) == .orderedSame
                }
                if !alreadyHasEmail {
                    mutable.emailAddresses.append(CNLabeledValue(label: CNLabelWork, value: em as NSString))
                    updatedAny = true
                }
            }
            
            if updatedAny {
                saveRequest.update(mutable)
                do {
                    try contactStore.execute(saveRequest)
                    DispatchQueue.main.async {
                        completion?(true, "Updated \(trimmedName) in iPhone Contacts!")
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion?(false, "Error updating Contact: \(error.localizedDescription)")
                    }
                }
            } else {
                DispatchQueue.main.async {
                    completion?(true, "\(trimmedName) is already in iPhone Contacts!")
                }
            }
        } else {
            // Create new contact
            let contact = CNMutableContact()
            let parts = trimmedName.components(separatedBy: " ")
            if let first = parts.first { contact.givenName = first }
            if parts.count > 1 { contact.familyName = parts.dropFirst().joined(separator: " ") }
            if let comp = trimmedCompany, !comp.isEmpty { contact.organizationName = comp }
            if let p = trimmedPhone, !p.isEmpty {
                contact.phoneNumbers = [CNLabeledValue(label: CNLabelPhoneNumberMain, value: CNPhoneNumber(stringValue: p))]
            }
            if let e = trimmedEmail, !e.isEmpty {
                contact.emailAddresses = [CNLabeledValue(label: CNLabelWork, value: e as NSString)]
            }
            
            saveRequest.add(contact, toContainerWithIdentifier: nil)
            do {
                try contactStore.execute(saveRequest)
                DispatchQueue.main.async {
                    completion?(true, "Saved \(trimmedName) to iPhone Contacts!")
                }
            } catch {
                DispatchQueue.main.async {
                    completion?(false, "Error saving to Contacts: \(error.localizedDescription)")
                }
            }
        }
    }
}

struct ContactPickerView: UIViewControllerRepresentable {
    @Environment(\.presentationMode) var presentationMode
    let onContactSelected: (_ name: String?, _ phone: String?, _ email: String?, _ company: String?) -> Void
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: CNContactPickerViewController, context: Context) {}
    
    class Coordinator: NSObject, CNContactPickerDelegate {
        var parent: ContactPickerView
        
        init(_ parent: ContactPickerView) {
            self.parent = parent
        }
        
        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            let fullName = "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
            let phone = contact.phoneNumbers.first?.value.stringValue
            let email = contact.emailAddresses.first?.value as String?
            let company = contact.organizationName.isEmpty ? nil : contact.organizationName
            
            parent.onContactSelected(
                fullName.isEmpty ? nil : fullName,
                phone,
                email,
                company
            )
            parent.presentationMode.wrappedValue.dismiss()
        }
        
        func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

// ============================================
// META ADS & CAMPAIGN MANAGEMENT MODELS
// ============================================
struct AdAccountDto: Codable, Identifiable {
    let id: String
    let accountId: String?
    let name: String
    let accountStatus: String?
    let currency: String?
    let timezone: String?
    let balance: String?
    let spendCap: String?
    let totalSpent: String?
}

struct AdSetDto: Codable {
    let name: String?
    let locations: [String]?
    let ageRange: String?
    let interests: [String]?
    let placements: [String]?
}

struct AdCreativeDto: Codable {
    let headline: String?
    let primaryText: String?
    let callToAction: String?
    let destination: String?
    let mediaType: String?
    let previewImage: String?
}

struct AdCampaignDto: Codable, Identifiable {
    let id: String
    let accountId: String?
    let name: String
    var status: String // ACTIVE | PAUSED
    let objective: String?
    let buyingType: String?
    var dailyBudget: String?
    var rawDailyBudget: Double?
    let impressions: Int?
    let reach: Int?
    let clicks: Int?
    let ctr: String?
    let cpc: String?
    let spend: String?
    let conversions: Int?
    let targetUrl: String?
    let adSet: AdSetDto?
    let adCreative: AdCreativeDto?
    let createdAt: String?
}

struct CreateCampaignRequest: Codable {
    let accountId: String?
    let name: String
    let objective: String
    let dailyBudget: Double
    let targetUrl: String?
    let adSetName: String?
    let locations: [String]?
    let ageRange: String?
    let interests: [String]?
    let placements: [String]?
    let headline: String?
    let primaryText: String?
    let callToAction: String?
    let destination: String?
    let previewImage: String?
}

// MARK: - Upsell Pitch & Analytics DTOs
struct UpsellPitchDto: Codable, Identifiable, Equatable {
    var id: String { _id ?? UUID().uuidString }
    var _id: String?
    var title: String
    var badgeText: String
    var targetSubpath: String?
    var pitchText: String
}

struct TopUrlAnalyticsDto: Codable, Identifiable, Equatable {
    var id: String { path }
    var path: String
    var fullUrl: String
    var visits: Int
    var avgDwellSeconds: Int
    var dwellDisplay: String
    var conversionRate: Int
    var exitRate: Int
}

// MARK: - Official Brand Logos View
struct BrandLogoView: View {
    let source: String
    var size: CGFloat = 20
    
    private var normalizedSource: String {
        let s = source.lowercased()
        if s.contains("whatsapp") { return "whatsapp" }
        if s.contains("insta") || s.contains("ig") { return "instagram" }
        if s.contains("face") || s.contains("fb") { return "facebook" }
        return "livechat"
    }
    
    var body: some View {
        ZStack {
            switch normalizedSource {
            case "whatsapp":
                Circle()
                    .fill(Color(red: 37/255, green: 211/255, blue: 102/255))
                    .frame(width: size, height: size)
                Image(systemName: "phone.fill")
                    .font(.system(size: size * 0.52, weight: .bold))
                    .foregroundColor(.white)
            case "instagram":
                Circle()
                    .fill(LinearGradient(
                        colors: [
                            Color(red: 131/255, green: 58/255, blue: 180/255),
                            Color(red: 253/255, green: 29/255, blue: 29/255),
                            Color(red: 252/255, green: 175/255, blue: 69/255)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: size, height: size)
                Image(systemName: "camera.fill")
                    .font(.system(size: size * 0.52, weight: .bold))
                    .foregroundColor(.white)
            case "facebook":
                Circle()
                    .fill(Color(red: 24/255, green: 119/255, blue: 242/255))
                    .frame(width: size, height: size)
                Text("f")
                    .font(.system(size: size * 0.65, weight: .black, design: .rounded))
                    .foregroundColor(.white)
            default:
                Circle()
                    .fill(LinearGradient(
                        colors: [Color(red: 124/255, green: 58/255, blue: 237/255), Color(red: 79/255, green: 70/255, blue: 229/255)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: size, height: size)
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: size * 0.48, weight: .bold))
                    .foregroundColor(.white)
            }
        }
    }
}


