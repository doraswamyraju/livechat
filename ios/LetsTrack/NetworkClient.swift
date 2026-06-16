import Foundation
import Combine

class NetworkClient: ObservableObject {
    static let shared = NetworkClient()
    
    private let baseURL = "https://livechat.vrhere.in"
    
    @Published var currentUser: UserProfile?
    @Published var currentTenant: TenantDetails?
    @Published var authToken: String?
    @Published var cachedAgents: [UserProfile] = []
    
    private let userDefaults = UserDefaults.standard
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    
    private init() {
        // Load saved session on initialization
        if let token = userDefaults.string(forKey: "auth_token"),
           let userJson = userDefaults.data(forKey: "user_profile"),
           let tenantJson = userDefaults.data(forKey: "tenant_details") {
            do {
                let user = try decoder.decode(UserProfile.self, from: userJson)
                let tenant = try decoder.decode(TenantDetails.self, from: tenantJson)
                self.authToken = token
                self.currentUser = user
                self.currentTenant = tenant
            } catch {
                print("Failed to decode saved profile sessions: \(error)")
                clearAuth()
            }
        }
    }
    
    var isAuthenticated: Bool {
        authToken != nil && currentUser != nil && currentTenant != nil
    }
    
    func setAuth(token: String, user: UserProfile, tenant: TenantDetails) {
        self.authToken = token
        self.currentUser = user
        self.currentTenant = tenant
        
        userDefaults.set(token, forKey: "auth_token")
        if let userJson = try? encoder.encode(user) {
            userDefaults.set(userJson, forKey: "user_profile")
        }
        if let tenantJson = try? encoder.encode(tenant) {
            userDefaults.set(tenantJson, forKey: "tenant_details")
        }
    }
    
    func clearAuth() {
        self.authToken = nil
        self.currentUser = nil
        self.currentTenant = nil
        
        userDefaults.removeObject(forKey: "auth_token")
        userDefaults.removeObject(forKey: "user_profile")
        userDefaults.removeObject(forKey: "tenant_details")
        
        // Disconnect sockets
        SocketManager.shared.disconnectSocket()
    }
    
    func getAuthHeader() -> String {
        guard let token = authToken else { return "" }
        return "Bearer \(token)"
    }
    
    // MARK: - API Calls
    
    func login(request: LoginRequest) async throws -> LoginResponse {
        let url = URL(string: "\(baseURL)/api/auth/login")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 401, userInfo: [NSLocalizedDescriptionKey: "Invalid credentials or network failure."])
        }
        
        let loginResponse = try decoder.decode(LoginResponse.self, from: data)
        
        // Update state on Main thread
        await MainActor.run {
            self.setAuth(token: loginResponse.token, user: loginResponse.user, tenant: loginResponse.tenant)
        }
        
        return loginResponse
    }
    
    func resetPassword(request: ResetPasswordRequest) async throws -> ResetPasswordResponse {
        let url = URL(string: "\(baseURL)/api/auth/reset-password")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Password reset failed."])
        }
        
        return try decoder.decode(ResetPasswordResponse.self, from: data)
    }
    
    func getAnalytics() async throws -> AnalyticsResponse {
        let url = URL(string: "\(baseURL)/api/analytics/summary")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try decoder.decode(AnalyticsResponse.self, from: data)
    }
    
    func getMessages(conversationId: String) async throws -> [MessageDto] {
        let url = URL(string: "\(baseURL)/api/conversations/\(conversationId)/messages")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try decoder.decode([MessageDto].self, from: data)
    }
    
    func registerFcmToken(fcmToken: String) async throws {
        let url = URL(string: "\(baseURL)/api/auth/fcm-token")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(FcmTokenRequest(fcmToken: fcmToken))
        
        _ = try await URLSession.shared.data(for: urlRequest)
    }
    
    func getQuickReplies() async throws -> [QuickReplyDto] {
        let url = URL(string: "\(baseURL)/api/quick-replies")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try decoder.decode([QuickReplyDto].self, from: data)
    }
    
    func updateProfile(request: UpdateProfileRequest) async throws -> UserProfile {
        let url = URL(string: "\(baseURL)/api/auth/profile")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        let updatedUser = try decoder.decode(UserProfile.self, from: data)
        
        await MainActor.run {
            self.currentUser = updatedUser
            if let userJson = try? encoder.encode(updatedUser) {
                userDefaults.set(userJson, forKey: "user_profile")
            }
        }
        
        return updatedUser
    }
    
    func registerAgent(request: RegisterAgentRequest) async throws -> RegisterAgentResponse {
        let url = URL(string: "\(baseURL)/api/auth/register-agent")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Registration failed. Email might already exist."])
        }
        
        return try decoder.decode(RegisterAgentResponse.self, from: data)
    }
    
    func getVisitor(visitorId: String) async throws -> VisitorDto {
        let url = URL(string: "\(baseURL)/api/visitors/\(visitorId)")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try decoder.decode(VisitorDto.self, from: data)
    }
    
    func updateVisitor(visitorId: String, fields: [String: Any]) async throws -> VisitorDto {
        let url = URL(string: "\(baseURL)/api/visitors/\(visitorId)")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let jsonSerialization = try JSONSerialization.data(withJSONObject: fields)
        urlRequest.httpBody = jsonSerialization
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try decoder.decode(VisitorDto.self, from: data)
    }
}
