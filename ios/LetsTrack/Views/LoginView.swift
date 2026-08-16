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
    @State private var resetEmail = ""
    @State private var resetPassword = ""
    @State private var resetMessage = ""
    @State private var isResetSuccess = false
    @State private var resetLoading = false
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 40)
                    
                    // App Logo
                    Image("app_logo")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 110, height: 110)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(theme.primaryColor, lineWidth: 2))
                        .shadow(color: theme.primaryColor.opacity(0.3), radius: 10)
                    
                    VStack(spacing: 4) {
                        Text("LetsTrack")
                            .font(.system(size: 32, weight: .black))
                            .foregroundColor(.white)
                        
                        Text("Real-time Mobile Tracking Console")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(theme.secondaryColor)
                    }
                    
                    // Form Card
                    VStack(spacing: 16) {
                        // Email field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email Username")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(theme.primaryColor)
                            
                            TextField("", text: $email)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .padding()
                                .background(Color.black)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                                )
                        }
                        
                        // Password field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Password credential")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(theme.primaryColor)
                            
                            SecureField("", text: $password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .padding()
                                .background(Color.black)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                                )
                        }
                        
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.secondaryColor)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        
                        // Submit Button
                        Button(action: performLogin) {
                            HStack {
                                if isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Sign In to Account")
                                        .fontWeight(.bold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(theme.primaryColor)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                        .disabled(isLoading || isGoogleLoading)
                        
                        // Divider / Or
                        HStack {
                            Rectangle().frame(height: 1).foregroundColor(Color(red: 38/255, green: 38/255, blue: 38/255))
                            Text("OR")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(theme.textGrayColor)
                                .padding(.horizontal, 8)
                            Rectangle().frame(height: 1).foregroundColor(Color(red: 38/255, green: 38/255, blue: 38/255))
                        }
                        .padding(.vertical, 4)
                        
                        // Continue with Google Button
                        Button(action: performGoogleSignIn) {
                            HStack(spacing: 12) {
                                if isGoogleLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                } else {
                                    GoogleLogoView()
                                        .frame(width: 20, height: 20)
                                    
                                    Text("Continue with Google")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundColor(Color(red: 30/255, green: 30/255, blue: 30/255))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.white)
                            .cornerRadius(8)
                            .shadow(color: Color.black.opacity(0.15), radius: 4, x: 0, y: 2)
                        }
                        .disabled(isLoading || isGoogleLoading)
                        
                        // Google Sign-In Button
                        Button(action: performGoogleLogin) {
                            HStack(spacing: 8) {
                                Image(systemName: "g.circle.fill")
                                    .font(.system(size: 18))
                                Text("Continue with Google")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.white.opacity(0.05))
                            .foregroundColor(.white)
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                            )
                        }
                        .disabled(isLoading)
                        
                        // Forgot password button

                        Button(action: { showResetDialog = true }) {
                            Text("Forgot Password?")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(theme.secondaryColor)
                        }
                        .padding(.top, 8)
                    }
                    .padding(20)
                    .background(Color(red: 18/255, green: 18/255, blue: 18/255))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                    )
                    
                    Spacer()
                }
                .padding(24)
            }
        }
        .sheet(isPresented: $showResetDialog) {
            ResetPasswordSheet(isPresented: $showResetDialog)
                .environmentObject(theme)
        }
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
>>>>>>> 0102aa8 (feat(ios): add native Google Sign-In SDK integration with Google Cloud Client ID)
    }
}


// MARK: - Reset Password Sheet Modal
struct ResetPasswordSheet: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var theme: ThemeManager
    
    @State private var email = ""
    @State private var password = ""
    @State private var resetMessage = ""
    @State private var isSuccess = false
    @State private var isLoading = false
    
    var body: some View {
        ZStack {
            Color(red: 18/255, green: 18/255, blue: 18/255).ignoresSafeArea()
            
            VStack(spacing: 20) {
                // Header
                VStack(spacing: 8) {
                    Image("app_logo")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 50, height: 50)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(theme.primaryColor, lineWidth: 1))
                    
                    Text("Reset Password")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.top, 24)
                
                Text("Enter your registered email address and your desired new password.")
                    .font(.system(size: 13))
                    .foregroundColor(theme.textGrayColor)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                VStack(spacing: 16) {
                    // Email input
                    TextField("Email Address", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                        )
                        .disabled(isLoading || isSuccess)
                    
                    // Password input
                    SecureField("New Password", text: $password)
                        .autocapitalization(.none)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 38/255, green: 38/255, blue: 38/255), lineWidth: 1)
                        )
                        .disabled(isLoading || isSuccess)
                }
                .padding(.horizontal)
                
                if !resetMessage.isEmpty {
                    Text(resetMessage)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(isSuccess ? Color.green : theme.secondaryColor)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                
                Spacer()
                
                // Confirm Actions
                HStack(spacing: 12) {
                    if !isSuccess {
                        Button(action: { isPresented = false }) {
                            Text("Cancel")
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textGrayColor)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                        }
                        .disabled(isLoading)
                        
                        Button(action: performReset) {
                            HStack {
                                if isLoading {
                                    ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Reset Password")
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
                    } else {
                        Button(action: { isPresented = false }) {
                            Text("Close")
                                .fontWeight(.bold)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(theme.primaryColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }
    
    private func performReset() {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty,
              password.trimmingCharacters(in: .whitespaces).count >= 6 else {
            resetMessage = "Enter valid email and password (min 6 chars)."
            return
        }
        
        isLoading = true
        resetMessage = ""
        
        Task {
            do {
                let response = try await NetworkClient.shared.resetPassword(request: ResetPasswordRequest(
                    email: email.trimmingCharacters(in: .whitespaces),
                    newPassword: password.trimmingCharacters(in: .whitespaces)
                ))
                await MainActor.run {
                    resetMessage = response.message
                    isSuccess = true
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    resetMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
