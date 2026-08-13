import SwiftUI
import Combine

class ThemeManager: ObservableObject {
    @Published var themeMode: String = "dark" {
        didSet {
            UserDefaults.standard.set(themeMode, forKey: "theme_mode")
        }
    }
    
    init() {
        self.themeMode = UserDefaults.standard.string(forKey: "theme_mode") ?? "dark"
    }
    
    var isDark: Bool {
        themeMode == "dark"
    }
    
    var primaryColor: Color {
        Color(red: 220/255, green: 38/255, blue: 38/255) // Accent Red (Netflix/Premium red: #DC2626)
    }
    
    var secondaryColor: Color {
        Color(red: 239/255, green: 68/255, blue: 68/255) // Light red: #EF4444
    }
    
    var backgroundColor: Color {
        isDark ? Color.black : Color.white
    }
    
    var surfaceColor: Color {
        isDark ? Color(red: 18/255, green: 18/255, blue: 18/255) : Color(red: 241/255, green: 245/255, blue: 249/255)
    }
    
    var onSurfaceColor: Color {
        isDark ? Color.white : Color(red: 15/255, green: 23/255, blue: 42/255)
    }
    
    var borderColor: Color {
        isDark ? Color(red: 38/255, green: 38/255, blue: 38/255) : Color(red: 226/255, green: 232/255, blue: 240/255)
    }
    
    var textGrayColor: Color {
        Color(red: 148/255, green: 163/255, blue: 184/255) // Slate gray: #94A3B8
    }
    
    var statusOnlineColor: Color {
        Color(red: 16/255, green: 185/255, blue: 129/255) // Online emerald: #10B981
    }
    
    var statusAwayColor: Color {
        Color(red: 245/255, green: 158/255, blue: 11/255) // Away amber: #F59E0B
    }
    
    var statusOfflineColor: Color {
        Color(red: 100/255, green: 116/255, blue: 139/255) // Offline slate: #64748B
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

