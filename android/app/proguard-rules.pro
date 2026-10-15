# Keep LetsTrack Network DTOs, Interfaces & Models
-keep class com.letstrack.agent.network.** { *; }
-keep interface com.letstrack.agent.network.** { *; }
-keep interface com.letstrack.agent.network.LetsTrackApi { *; }

# Preserve reflection signatures for Retrofit & Coroutines
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault
-keepattributes *Annotation*

# Crucial: Prevent R8 from stripping generic type parameters from Kotlin Coroutine Continuation
-keep class kotlin.coroutines.Continuation { *; }
-keep class kotlin.coroutines.** { *; }

# Retrofit service method signatures
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# Gson rules
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# Socket.io & OkHttp
-keep class io.socket.** { *; }
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Firebase Messaging & Google Auth
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Kotlin
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
