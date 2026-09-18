# iOS App Store Rejection & "Sign in with Apple" Implementation Plan

## Rejection Summary
- **App Name**: LetsTrack - Live Chat & CRM
- **Submission ID**: `dacc5506-3cf3-4db8-8ca4-0e2d3af980a4`
- **Review Date**: September 17, 2026
- **Version Reviewed**: 1.0 (5)
- **Guideline**: [Guideline 4.8 - Design - Login Services](https://developer.apple.com/app-store/review/guidelines/#login-services)
- **Issue**: The app offers Google Sign-In as a third-party login option, but does not provide **Sign in with Apple** (or equivalent privacy-preserving login service) with equal prominence.

---

## Selected Solution: Option 1 - Implement Sign in with Apple

### 1. Apple Developer Portal & Xcode Configuration
1. **Apple Developer Account**:
   - Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
   - Select the App ID for `com.letstrack.agent` (or your bundle identifier).
   - Enable **Sign In with Apple**.
   - Save changes.
2. **Xcode Project Setup**:
   - Open `ios/LetsTrack.xcodeproj` in Xcode.
   - Select the `LetsTrack` target > **Signing & Capabilities**.
   - Click `+ Capability` and add **Sign in with Apple**.
   - Ensure the entitlement file is generated and included in build settings.

---

### 2. iOS App Changes

#### A. Modify `ios/LetsTrack/Views/LoginView.swift`
- Import `AuthenticationServices`.
- Add `SignInWithAppleButton` next to / above the Google Sign-in button.
- Handle authorization response:
  - Extract `ASAuthorizationAppleIDCredential`.
  - Obtain `identityToken` (JWT string), `userIdentifier`, `fullName`, and `email`.
  - Pass the payload to `NetworkClient.shared.appleLogin(...)`.

#### B. Modify `ios/LetsTrack/NetworkClient.swift`
- Add `appleLogin(identityToken:userIdentifier:fullName:email:) async throws -> AuthResponse` method.
- POST payload to `/api/auth/apple`:
  ```json
  {
    "identityToken": "<jwt_string>",
    "appleUserId": "<userIdentifier>",
    "name": "<fullName>",
    "email": "<email>"
  }
  ```
- Store returned auth token and agent profile.

---

### 3. Backend Changes

#### Modify `backend/server.js` (or auth router)
- Add route `POST /api/auth/apple`:
  1. Receive `identityToken`, `appleUserId`, `name`, `email`.
  2. Verify/decode Apple JWT identity token (using `apple-signin-auth` or `jsonwebtoken` + Apple public keys via `https://appleid.apple.com/auth/keys`).
  3. Find existing user by `appleUserId` or `email`, or create a new user/agent profile.
  4. Generate and return workspace JWT session token + user payload.

---

### 4. Build & Resubmission Steps
1. Increment the build version number in `ios/LetsTrack.xcodeproj` (e.g., from `1.0 (5)` to `1.0 (6)`).
2. Test Sign in with Apple flow on a physical iOS device / simulator.
3. Archive and upload the new build to App Store Connect / TestFlight.
4. Select the new build in App Store Connect and reply to the review note confirming **Sign in with Apple** has been added in accordance with Guideline 4.8.
5. Resubmit for Review.
