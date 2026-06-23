import SwiftUI
import FirebaseCore
import FirebaseMessaging
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        
        // 1. Check if GoogleService-Info.plist exists before configuring Firebase to prevent crash
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
            print("[Push Notification Debug] Firebase configured successfully.")
        } else {
            print("[Push Notification Debug] WARNING: GoogleService-Info.plist not found. FCM will not be initialized.")
        }
        
        // 2. Request remote notification authorization
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
            if let error = error {
                print("[Push Notification Debug] Error requesting notification auth: \(error)")
            } else {
                print("[Push Notification Debug] Notification authorization granted: \(granted)")
            }
        }
        
        application.registerForRemoteNotifications()
        return true
    }
    
    // APNs registration succeeded
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("[Push Notification Debug] APNs Device Token: \(tokenString)")
        // Pass APNs token to Firebase Messaging
        Messaging.messaging().apnsToken = deviceToken
    }
    
    // APNs registration failed
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[Push Notification Debug] Failed to register for remote notifications: \(error)")
    }
    
    // Receive FCM registration token
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("[Push Notification Debug] Firebase FCM Token: \(String(describing: fcmToken))")
        if let fcmToken = fcmToken {
            // Save token to UserDefaults for persistence across authentication states
            UserDefaults.standard.set(fcmToken, forKey: "fcm_token")
            
            // Only try to register if we are already authenticated
            if NetworkClient.shared.isAuthenticated {
                Task {
                    do {
                        try await NetworkClient.shared.registerFcmToken(fcmToken: fcmToken)
                        print("[Push Notification Debug] FCM Token registered successfully with backend.")
                    } catch {
                        print("[Push Notification Debug] Failed to register FCM Token with backend: \(error)")
                    }
                }
            } else {
                print("[Push Notification Debug] User is not authenticated yet. Saved FCM token locally.")
            }
        }
    }
    
    // Handle foreground notifications
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([[.banner, .sound, .badge]])
    }
    
    // Handle notification click/tap
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("[Push Notification Debug] Notification tapped with userInfo: \(userInfo)")
        
        if let conversationId = userInfo["conversationId"] as? String {
            let visitorName = userInfo["visitorName"] as? String ?? "Visitor"
            let visitorId = userInfo["visitorId"] as? String ?? ""
            
            DispatchQueue.main.async {
                SocketManager.shared.pendingDeepLink = DeepLinkTarget(
                    conversationId: conversationId,
                    visitorName: visitorName,
                    visitorId: visitorId
                )
                print("[Push Notification Debug] Set pending deep link: \(conversationId) for \(visitorName)")
            }
        }
        
        completionHandler()
    }
}

@main
struct LetsTrackApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
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
