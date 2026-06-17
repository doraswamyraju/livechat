// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LetsTrack",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "LetsTrack",
            targets: ["LetsTrack"]),
    ],
    dependencies: [
        // Socket.io Client library matching the Android implementation dependencies
        .package(url: "https://github.com/socketio/socket.io-client-swift.git", from: "16.1.0"),
        // Firebase iOS SDK for Firebase Cloud Messaging (FCM)
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "10.0.0")
    ],
    targets: [
        .target(
            name: "LetsTrack",
            dependencies: [
                .product(name: "SocketIO", package: "socket.io-client-swift"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk")
            ],
            path: "."
        )
    ]
)
