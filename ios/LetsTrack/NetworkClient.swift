import Foundation
import Combine

final class NetworkClient: ObservableObject {
    static let shared = NetworkClient()
    
    private let baseURL = "https://letstrack.manacity.in"
    
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
                
                // Re-register FCM token on startup if we have it saved
                if let fcmToken = userDefaults.string(forKey: "fcm_token") {
                    Task {
                        do {
                            try await self.registerFcmToken(fcmToken: fcmToken)
                            print("[Push Notification Debug] FCM Token re-registered successfully on launch.")
                        } catch {
                            print("[Push Notification Debug] Failed to re-register FCM Token on launch: \(error)")
                        }
                    }
                }
            } catch {
                print("[Session Decode Debug] Failed to decode saved profile sessions with error: \(error)")
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
        
        // Register saved FCM token if available
        if let fcmToken = userDefaults.string(forKey: "fcm_token") {
            Task {
                do {
                    try await self.registerFcmToken(fcmToken: fcmToken)
                    print("[Push Notification Debug] FCM Token registered successfully with backend on login.")
                } catch {
                    print("[Push Notification Debug] Failed to register FCM Token with backend on login: \(error)")
                }
            }
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
    
    func googleLogin(idToken: String) async throws -> LoginResponse {
        let url = URL(string: "\(baseURL)/api/auth/google-login")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let requestPayload = GoogleLoginRequest(credential: idToken)
        urlRequest.httpBody = try encoder.encode(requestPayload)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "NetworkClient", code: 500, userInfo: [NSLocalizedDescriptionKey: "Server response error."])
        }
        
        if !(200...299).contains(httpResponse.statusCode) {
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = errorJson["error"] as? String {
                throw NSError(domain: "NetworkClient", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
            }
            throw NSError(domain: "NetworkClient", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Google Sign-In failed on server."])
        }
        
        let loginResponse = try decoder.decode(LoginResponse.self, from: data)
        
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
    
    // MARK: - Lead Management APIs
    
    func getLeads(search: String? = nil, status: String? = nil, source: String? = nil) async throws -> [LeadDto] {
        var urlComponents = URLComponents(string: "\(baseURL)/api/leads")!
        var queryItems: [URLQueryItem] = []
        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        if let status = status, status != "All" && !status.isEmpty {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let source = source, source != "All" && !source.isEmpty {
            queryItems.append(URLQueryItem(name: "source", value: source))
        }
        if !queryItems.isEmpty {
            urlComponents.queryItems = queryItems
        }
        
        var urlRequest = URLRequest(url: urlComponents.url!)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch leads."])
        }
        
        // Backend returns { leads: [...], total, page, pages }
        struct LeadsResponse: Codable {
            let leads: [LeadDto]
        }
        
        if let resp = try? decoder.decode(LeadsResponse.self, from: data) {
            return resp.leads
        }
        return try decoder.decode([LeadDto].self, from: data)
    }
    
    func createLead(request: CreateLeadRequest) async throws -> LeadDto {
        let url = URL(string: "\(baseURL)/api/leads")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to create lead."])
        }
        
        return try decoder.decode(LeadDto.self, from: data)
    }
    
    func updateLead(leadId: String, fields: [String: Any]) async throws -> LeadDto {
        let url = URL(string: "\(baseURL)/api/leads/\(leadId)")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: fields)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to update lead."])
        }
        
        return try decoder.decode(LeadDto.self, from: data)
    }
    
    func getLeadStats() async throws -> LeadStatsDto {
        let url = URL(string: "\(baseURL)/api/leads/stats")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch lead stats."])
        }
        
        return try decoder.decode(LeadStatsDto.self, from: data)
    }
    
    func addLeadNote(leadId: String, text: String) async throws -> LeadDto {
        let url = URL(string: "\(baseURL)/api/leads/\(leadId)/notes")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(getAuthHeader(), forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: ["text": text])
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NetworkClient", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to add note to lead."])
        }
        
        return try decoder.decode(LeadDto.self, from: data)
    }
}
