import SwiftUI

struct LoginView: View {
    @StateObject private var networkClient = NetworkClient.shared
    @EnvironmentObject var theme: ThemeManager
    
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String? = nil
    @State private var isLoading = false
    
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
