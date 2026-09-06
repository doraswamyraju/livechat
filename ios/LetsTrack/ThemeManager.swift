import SwiftUI
import Combine

class ThemeManager: ObservableObject {
    @Published var themeMode: String = "light" {
        didSet {
            UserDefaults.standard.set(themeMode, forKey: "theme_mode")
        }
    }
    
    @Published var accentColorKey: String = "red" {
        didSet {
            UserDefaults.standard.set(accentColorKey, forKey: "accent_color_key")
        }
    }
    
    @Published var hapticsEnabled: Bool = true {
        didSet {
            UserDefaults.standard.set(hapticsEnabled, forKey: "haptics_enabled")
        }
    }
    
    @Published var soundsEnabled: Bool = true {
        didSet {
            UserDefaults.standard.set(soundsEnabled, forKey: "sounds_enabled")
        }
    }
    
    init() {
        self.themeMode = UserDefaults.standard.string(forKey: "theme_mode") ?? "light"
        self.accentColorKey = UserDefaults.standard.string(forKey: "accent_color_key") ?? "red"
        self.hapticsEnabled = UserDefaults.standard.object(forKey: "haptics_enabled") as? Bool ?? true
        self.soundsEnabled = UserDefaults.standard.object(forKey: "sounds_enabled") as? Bool ?? true
    }
    
    var isDark: Bool {
        themeMode == "dark"
    }
    
    // Dynamic Brand Accent Color
    var primaryColor: Color {
        switch accentColorKey.lowercased() {
        case "blue":
            return Color(red: 37/255, green: 99/255, blue: 235/255) // Royal Blue #2563EB
        case "emerald":
            return Color(red: 16/255, green: 185/255, blue: 129/255) // Emerald #10B981
        case "purple":
            return Color(red: 124/255, green: 58/255, blue: 237/255) // Violet #7C3AED
        case "amber":
            return Color(red: 245/255, green: 158/255, blue: 11/255) // Amber #F59E0B
        case "pink":
            return Color(red: 236/255, green: 72/255, blue: 153/255) // Rose Pink #EC4899
        default:
            return Color(red: 220/255, green: 38/255, blue: 38/255) // Crimson Red #DC2626
        }
    }
    
    var secondaryColor: Color {
        switch accentColorKey.lowercased() {
        case "blue":
            return Color(red: 96/255, green: 165/255, blue: 250/255)
        case "emerald":
            return Color(red: 52/255, green: 211/255, blue: 153/255)
        case "purple":
            return Color(red: 167/255, green: 139/255, blue: 250/255)
        case "amber":
            return Color(red: 251/255, green: 191/255, blue: 36/255)
        case "pink":
            return Color(red: 244/255, green: 114/255, blue: 182/255)
        default:
            return Color(red: 239/255, green: 68/255, blue: 68/255)
        }
    }
    
    func triggerHaptic(style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        guard hapticsEnabled else { return }
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
    
    var backgroundColor: Color {
        isDark ? Color(red: 10/255, green: 15/255, blue: 29/255) : Color(red: 248/255, green: 250/255, blue: 252/255)
    }
    
    var surfaceColor: Color {
        isDark ? Color(red: 18/255, green: 24/255, blue: 38/255) : Color.white
    }
    
    var cardBackground: Color {
        isDark ? Color(red: 24/255, green: 32/255, blue: 47/255) : Color.white
    }
    
    var onSurfaceColor: Color {
        isDark ? Color.white : Color(red: 15/255, green: 23/255, blue: 42/255)
    }
    
    var borderColor: Color {
        isDark ? Color(red: 38/255, green: 48/255, blue: 66/255) : Color(red: 226/255, green: 232/255, blue: 240/255)
    }
    
    var textGrayColor: Color {
        isDark ? Color(red: 148/255, green: 163/255, blue: 184/255) : Color(red: 100/255, green: 116/255, blue: 139/255)
    }
    
    var inputBackground: Color {
        isDark ? Color(red: 12/255, green: 18/255, blue: 30/255) : Color(red: 241/255, green: 245/255, blue: 249/255)
    }
    
    var statusOnlineColor: Color {
        Color(red: 16/255, green: 185/255, blue: 129/255) // Emerald #10B981
    }
    
    var statusAwayColor: Color {
        Color(red: 245/255, green: 158/255, blue: 11/255) // Amber #F59E0B
    }
    
    var statusOfflineColor: Color {
        Color(red: 148/255, green: 163/255, blue: 184/255)
    }
    
    func getStatusColor(_ status: String) -> Color {
        switch status {
        case "Online":
            return statusOnlineColor
        case "Away":
            return statusAwayColor
        default:
            return statusOfflineColor
        }
    }
    
    // Channel-specific branding colors
    func getChannelColor(_ channel: String) -> Color {
        switch channel.lowercased() {
        case "whatsapp":
            return Color(red: 37/255, green: 211/255, blue: 102/255)
        case "instagram":
            return Color(red: 225/255, green: 48/255, blue: 108/255)
        case "facebook":
            return Color(red: 24/255, green: 119/255, blue: 242/255)
        case "meta_ads", "meta ads", "facebook_ads":
            return Color(red: 0/255, green: 129/255, blue: 251/255)
        default:
            return primaryColor
        }
    }
}

func formatMessageText(text: String) -> String {
    let pattern = "\\[timestamp:([^\\]]+)\\]"
    guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return text }
    
    let nsString = text as NSString
    let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))
    
    var result = text
    for match in matches.reversed() {
        let isoRange = match.range(at: 1)
        let isoString = nsString.substring(with: isoRange)
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: isoString)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: isoString)
        }
        
        if let date = date {
            let outputFormatter = DateFormatter()
            outputFormatter.dateFormat = "MMM d, yyyy, h:mm a"
            outputFormatter.timeZone = TimeZone.current
            let formatted = outputFormatter.string(from: date)
            result = (result as NSString).replacingCharacters(in: match.range, with: formatted)
        }
    }
    return result
}

func formatTimestamp(isoString: String) -> String {
    if isoString.isEmpty { return "" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: isoString)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: isoString)
    }
    guard let date = date else { return isoString }
    
    let outputFormatter = DateFormatter()
    outputFormatter.dateFormat = "h:mm a"
    outputFormatter.timeZone = TimeZone.current
    return outputFormatter.string(from: date)
}

func formatTimestampFull(isoString: String) -> String {
    if isoString.isEmpty { return "" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: isoString)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: isoString)
    }
    guard let date = date else { return isoString }
    
    let outputFormatter = DateFormatter()
    outputFormatter.dateFormat = "MMM d, yyyy, h:mm a"
    outputFormatter.timeZone = TimeZone.current
    return outputFormatter.string(from: date)
}

func formatRelativeTime(isoString: String) -> String {
    if isoString.isEmpty { return "" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: isoString)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: isoString)
    }
    guard let date = date else { return "" }
    
    let interval = Date().timeIntervalSince(date)
    if interval < 60 {
        return "now"
    } else if interval < 3600 {
        let mins = Int(interval / 60)
        return "\(mins)m"
    } else if interval < 86400 {
        let hours = Int(interval / 3600)
        return "\(hours)h"
    } else {
        let days = Int(interval / 86400)
        return "\(days)d"
    }
}
