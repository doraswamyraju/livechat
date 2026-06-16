import SwiftUI

@main
struct LetsTrackApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var networkClient = NetworkClient.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .preferredColorScheme(themeManager.isDark ? .dark : .light)
                .onAppear {
                    // Connect socket if authenticated on startup
                    if networkClient.isAuthenticated {
                        SocketManager.shared.connectSocket()
                    }
                }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var theme: ThemeManager
    @ObservedObject var networkClient = NetworkClient.shared
    
    var body: some View {
        Group {
            if networkClient.isAuthenticated {
                DashboardView()
                    .environmentObject(theme)
            } else {
                LoginView()
                    .environmentObject(theme)
            }
        }
        .animation(.default, value: networkClient.isAuthenticated)
    }
}
