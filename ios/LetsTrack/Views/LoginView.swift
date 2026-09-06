import SwiftUI
import GoogleSignIn

struct LoginView: View {
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String? = nil
    @State private var isLoading = false
    @State private var isGoogleLoading = false
    
    // Reset password dialog state
    @State private var showResetDialog = false
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            // Subtle ambient background gradient
            VStack {
                Circle()
                    .fill(theme.primaryColor.opacity(theme.isDark ? 0.15 : 0.08))
                    .frame(width: 320, height: 320)
                    .blur(radius: 80)
                    .offset(x: -80, y: -120)
                Spacer()
                Circle()
                    .fill(Color(red: 239/255, green: 68/255, blue: 68/255).opacity(theme.isDark ? 0.12 : 0.06))
                    .frame(width: 300, height: 300)
                    .blur(radius: 80)
                    .offset(x: 100, y: 100)
            }
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer(minLength: 24)
                    
                    // Theme toggle on top right
                    HStack {
                        Spacer()
                        Button(action: {
                            theme.themeMode = theme.isDark ? "light" : "dark"
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: theme.isDark ? "sun.max.fill" : "moon.fill")
                                    .foregroundColor(theme.isDark ? .yellow : theme.primaryColor)
                                Text(theme.isDark ? "Light" : "Dark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(theme.surfaceColor)
                            .cornerRadius(20)
                            .overlay(RoundedRectangle(cornerRadius: 20).stroke(theme.borderColor, lineWidth: 1))
                            .shadow(color: Color.black.opacity(0.05), radius: 4)
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    // App Logo & Brand Header
                    VStack(spacing: 12) {
                        Image("app_logo")
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 88, height: 88)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .overlay(
                                RoundedRectangle(cornerRadius: 22)
                                    .stroke(theme.primaryColor.opacity(0.4), lineWidth: 2)
                            )
                            .shadow(color: theme.primaryColor.opacity(0.25), radius: 16, y: 8)
                        
                        VStack(spacing: 4) {
                            Text("LetsTrack")
                                .font(.system(size: 30, weight: .black))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            Text("Omnichannel Customer Communication Hub")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(theme.primaryColor)
                        }
                        
                        // Omnichannel channel pills
                        HStack(spacing: 8) {
                            channelBadge(title: "WhatsApp", icon: "message.fill", color: Color(red: 37/255, green: 211/255, blue: 102/255))
                            channelBadge(title: "Instagram", icon: "camera.fill", color: Color(red: 225/255, green: 48/255, blue: 108/255))
                            channelBadge(title: "Facebook", icon: "person.2.fill", color: Color(red: 24/255, green: 119/255, blue: 242/255))
                            channelBadge(title: "LiveChat", icon: "bubble.left.and.bubble.right.fill", color: theme.primaryColor)
                        }
                        .padding(.top, 4)
                    }
                    
                    // Main Login Card
                    VStack(spacing: 16) {
                        // Email field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Work Email")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            TextField("name@company.com", text: $email)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .padding()
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(theme.borderColor, lineWidth: 1)
                                )
                        }
                        
                        // Password field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Password")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(theme.onSurfaceColor)
                            
                            SecureField("Enter your password", text: $password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .padding()
                                .background(theme.inputBackground)
                                .foregroundColor(theme.onSurfaceColor)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(theme.borderColor, lineWidth: 1)
                                )
                        }
                        
                        if let error = errorMessage {
                            HStack(spacing: 6) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(theme.secondaryColor)
                                    .font(.system(size: 13))
                                Text(error)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(theme.secondaryColor)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        
                        // Submit Button
                        Button(action: performLogin) {
                            HStack(spacing: 8) {
                                if isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Sign In to Workspace")
                                        .font(.system(size: 15, weight: .bold))
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 14, weight: .bold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(
                                LinearGradient(
                                    colors: [theme.primaryColor, theme.secondaryColor],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: theme.primaryColor.opacity(0.35), radius: 8, y: 4)
                        }
                        .disabled(isLoading || isGoogleLoading)
                        
                        // Divider / Or
                        HStack {
                            Rectangle().frame(height: 1).foregroundColor(theme.borderColor)
                            Text("OR")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                                .padding(.horizontal, 8)
                            Rectangle().frame(height: 1).foregroundColor(theme.borderColor)
                        }
                        .padding(.vertical, 2)
                        
                        // Continue with Google Button
                        Button(action: performGoogleSignIn) {
                            HStack(spacing: 10) {
                                if isGoogleLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: theme.onSurfaceColor))
                                } else {
                                    GoogleLogoView()
                                        .frame(width: 18, height: 18)
                                    
                                    Text("Continue with Google")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(theme.onSurfaceColor)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(theme.surfaceColor)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(theme.borderColor, lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(theme.isDark ? 0.3 : 0.05), radius: 4, y: 2)
                        }
                        .disabled(isLoading || isGoogleLoading)
                        
                        // 1-Click Demo Sandbox Launcher
                        Button(action: fillDemoCredentials) {
                            HStack(spacing: 6) {
                                Image(systemName: "sparkles")
                                    .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                                Text("⚡ 1-Click Demo Sandbox")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(theme.onSurfaceColor)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(theme.inputBackground)
                            .cornerRadius(10)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color(red: 245/255, green: 158/255, blue: 11/255).opacity(0.4), lineWidth: 1)
                            )
                        }
                        
                        // Forgot password button
                        Button(action: { showResetDialog = true }) {
                            Text("Forgot Password?")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(theme.primaryColor)
                        }
                        .padding(.top, 4)
                    }
                    .padding(22)
                    .background(theme.surfaceColor)
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(theme.borderColor, lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(theme.isDark ? 0.4 : 0.06), radius: 16, y: 8)
                    
                    Spacer()
                }
                .padding(.horizontal, 20)
            }
        }
        .sheet(isPresented: $showResetDialog) {
            ResetPasswordSheet(isPresented: $showResetDialog)
                .environmentObject(theme)
        }
    }
    
    private func channelBadge(title: String, icon: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(theme.onSurfaceColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(theme.surfaceColor)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.borderColor, lineWidth: 1))
    }
    
    private func fillDemoCredentials() {
        email = "admin@vrhere.in"
        password = "password123"
        performLogin()
    }
    
    private func performLogin() {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty,
              !password.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter both credentials."
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                _ = try await networkClient.login(request: LoginRequest(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password.trimmingCharacters(in: .whitespaces)
                ))
                // Connect sockets on success
                SocketManager.shared.connectSocket()
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    private func performGoogleSignIn() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            errorMessage = "Unable to present Google Sign-In interface."
            return
        }
        
        isGoogleLoading = true
        errorMessage = nil
        
        if GIDSignIn.sharedInstance.configuration == nil {
            if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
               let dict = NSDictionary(contentsOfFile: path),
               let clientID = dict["CLIENT_ID"] as? String {
                GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            } else {
                GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: "101383899067-du9bq7vrbo0jm02lv4ndtl5n1k4gml34.apps.googleusercontent.com")
            }
        }
        
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { result, error in
            if let error = error {
                DispatchQueue.main.async {
                    self.isGoogleLoading = false
                    let nsError = error as NSError
                    if nsError.code != GIDSignInError.canceled.rawValue {
                        self.errorMessage = error.localizedDescription
                    }
                }
                return
            }
            
            guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                DispatchQueue.main.async {
                    self.isGoogleLoading = false
                    self.errorMessage = "Failed to retrieve Google ID Token."
                }
                return
            }
            
            Task {
                do {
                    _ = try await self.networkClient.googleLogin(idToken: idToken)
                    SocketManager.shared.connectSocket()
                } catch {
                    await MainActor.run {
                        self.errorMessage = error.localizedDescription
                        self.isGoogleLoading = false
                    }
                }
            }
        }
    }
}

// MARK: - Google Logo Component
struct GoogleLogoView: View {
    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            let center = CGPoint(x: w / 2, y: h / 2)
            let radius = min(w, h) / 2
            let innerRadius = radius * 0.55
            
            // Blue right bar & arc
            var bluePath = Path()
            bluePath.move(to: CGPoint(x: center.x + radius, y: center.y))
            bluePath.addLine(to: CGPoint(x: center.x + innerRadius * 0.2, y: center.y))
            bluePath.addLine(to: CGPoint(x: center.x + innerRadius * 0.2, y: center.y - innerRadius * 0.6))
            bluePath.addLine(to: CGPoint(x: center.x + radius, y: center.y - innerRadius * 0.6))
            bluePath.addArc(center: center, radius: radius, startAngle: .degrees(-25), endAngle: .degrees(45), clockwise: false)
            context.fill(bluePath, with: .color(Color(red: 66/255, green: 133/255, blue: 244/255)))
            
            // Red top arc
            var redPath = Path()
            redPath.addArc(center: center, radius: radius, startAngle: .degrees(190), endAngle: .degrees(315), clockwise: false)
            redPath.addArc(center: center, radius: innerRadius, startAngle: .degrees(315), endAngle: .degrees(190), clockwise: true)
            context.fill(redPath, with: .color(Color(red: 234/255, green: 67/255, blue: 53/255)))
            
            // Yellow left arc
            var yellowPath = Path()
            yellowPath.addArc(center: center, radius: radius, startAngle: .degrees(130), endAngle: .degrees(190), clockwise: false)
            yellowPath.addArc(center: center, radius: innerRadius, startAngle: .degrees(190), endAngle: .degrees(130), clockwise: true)
            context.fill(yellowPath, with: .color(Color(red: 251/255, green: 188/255, blue: 5/255)))
            
            // Green bottom arc
            var greenPath = Path()
            greenPath.addArc(center: center, radius: radius, startAngle: .degrees(45), endAngle: .degrees(130), clockwise: false)
            greenPath.addArc(center: center, radius: innerRadius, startAngle: .degrees(130), endAngle: .degrees(45), clockwise: true)
            context.fill(greenPath, with: .color(Color(red: 52/255, green: 168/255, blue: 83/255)))
        }
    }
}

// MARK: - Reset Password Sheet Modal
struct ResetPasswordSheet: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var theme: ThemeManager
    
    @State private var resetEmail = ""
    @State private var resetPassword = ""
    @State private var resetMessage = ""
    @State private var isResetSuccess = false
    @State private var resetLoading = false
    
    var body: some View {
        ZStack {
            theme.backgroundColor.ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Reset Password")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(theme.onSurfaceColor)
                    .padding(.top, 24)
                
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Registered Work Email")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        TextField("admin@company.com", text: $resetEmail)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("New Password")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.onSurfaceColor)
                        
                        SecureField("Minimum 6 characters", text: $resetPassword)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(theme.inputBackground)
                            .foregroundColor(theme.onSurfaceColor)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.borderColor, lineWidth: 1))
                    }
                    
                    if !resetMessage.isEmpty {
                        Text(resetMessage)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(isResetSuccess ? Color.green : theme.secondaryColor)
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(theme.textGrayColor)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    
                    Button(action: performReset) {
                        HStack {
                            if resetLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Update Password")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(theme.primaryColor)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(resetLoading)
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private func performReset() {
        guard !resetEmail.trimmingCharacters(in: .whitespaces).isEmpty,
              !resetPassword.trimmingCharacters(in: .whitespaces).isEmpty else {
            resetMessage = "Please enter both fields."
            isResetSuccess = false
            return
        }
        
        resetLoading = true
        resetMessage = ""
        
        Task {
            do {
                let res = try await NetworkClient.shared.resetPassword(request: ResetPasswordRequest(
                    email: resetEmail.trimmingCharacters(in: .whitespaces),
                    newPassword: resetPassword.trimmingCharacters(in: .whitespaces)
                ))
                await MainActor.run {
                    isResetSuccess = true
                    resetMessage = res.message
                    resetLoading = false
                }
            } catch {
                await MainActor.run {
                    isResetSuccess = false
                    resetMessage = error.localizedDescription
                    resetLoading = false
                }
            }
        }
    }
}
