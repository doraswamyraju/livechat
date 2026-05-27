package com.letstrack.agent.network

import com.google.gson.Gson
import io.socket.client.IO
import io.socket.client.Socket
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.net.URISyntaxException

// ============================================
// DTO DEFINITIONS
// ============================================
data class LoginRequest(val email: String, val password: String)

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val status: String
)

data class TenantDetails(
    val id: String,
    val name: String,
    val domain: String,
    val apiKey: String
)

data class LoginResponse(
    val token: String,
    val user: UserProfile,
    val tenant: TenantDetails
)

data class AnalyticsResponse(
    val totalVisitors: Int,
    val onlineVisitors: Int,
    val activeConversations: Int,
    val unassignedConversations: Int,
    val totalChats: Int,
    val totalAgents: Int,
    val onlineAgents: Int
)

data class VisitorDto(
    val _id: String,
    val name: String,
    val email: String?,
    val phoneNumber: String? = null,
    val country: String,
    val city: String,
    val deviceType: String,
    val currentUrl: String?,
    val isOnline: Boolean,
    val isMuted: Boolean? = false
)

data class ConversationDto(
    val _id: String,
    val visitorId: String,
    val status: String,
    val assignedAgentId: String?,
    val updatedAt: String
)

data class MessageDto(
    val _id: String,
    val conversationId: String,
    val senderType: String,
    val senderId: String,
    val senderName: String,
    val text: String,
    val timestamp: String
)

data class FcmTokenRequest(val fcmToken: String)

data class ResetPasswordRequest(val email: String, val newPassword: String)
data class ResetPasswordResponse(val message: String)

data class QuickReplyDto(
    val _id: String,
    val tenantId: String,
    val shortcut: String,
    val text: String
)

data class UpdateProfileRequest(
    val name: String?,
    val avatarUrl: String?,
    val password: String?
)

// ============================================
// RETROFIT API INTERFACES
// ============================================
interface LetsTrackApi {
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @POST("/api/auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): ResetPasswordResponse

    @GET("/api/analytics/summary")
    suspend fun getAnalytics(@Header("Authorization") token: String): AnalyticsResponse

    @GET("/api/conversations/{id}/messages")
    suspend fun getMessages(
        @Header("Authorization") token: String,
        @Path("id") conversationId: String
    ): List<MessageDto>

    @POST("/api/auth/fcm-token")
    suspend fun registerFcmToken(
        @Header("Authorization") token: String,
        @Body request: FcmTokenRequest
    ): retrofit2.Response<Unit>

    @GET("/api/quick-replies")
    suspend fun getQuickReplies(@Header("Authorization") token: String): List<QuickReplyDto>

    @PUT("/api/auth/profile")
    suspend fun updateProfile(
        @Header("Authorization") token: String,
        @Body request: UpdateProfileRequest
    ): UserProfile

    @PUT("/api/visitors/{id}")
    suspend fun updateVisitor(
        @Header("Authorization") token: String,
        @Path("id") visitorId: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): VisitorDto

    @GET("/api/visitors/{id}")
    suspend fun getVisitor(
        @Header("Authorization") token: String,
        @Path("id") visitorId: String
    ): VisitorDto
}

// ============================================
// UNIFIED NETWORK CLIENT MANAGER
// ============================================
object NetworkClient {
    private const val BASE_URL = "https://livechat.vrhere.in"

    private var authToken: String? = null
    var currentUser: UserProfile? = null
    var currentTenant: TenantDetails? = null

    val gson = Gson()
    
    // Retrofit service
    val api: LetsTrackApi by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()

        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(LetsTrackApi::class.java)
    }

    // Socket.io instance
    private var socket: Socket? = null

    fun setAuth(token: String, user: UserProfile, tenant: TenantDetails) {
        authToken = "Bearer $token"
        currentUser = user
        currentTenant = tenant
    }

    fun getAuthHeader(): String = authToken ?: ""

    @Synchronized
    fun getSocketInstance(): Socket {
        if (socket == null) {
            try {
                val opts = IO.Options().apply {
                    forceNew = true
                    reconnection = true
                }
                // Connect to `/dashboard` namespace
                socket = IO.socket("$BASE_URL/dashboard", opts)
            } catch (e: URISyntaxException) {
                e.printStackTrace()
            }
        }
        return socket!!
    }

    fun connectSocket() {
        val s = getSocketInstance()
        if (!s.connected()) {
            s.connect()
            
            // On connect, authenticate
            s.on(Socket.EVENT_CONNECT) {
                val initData = JSONObject().apply {
                    put("tenantId", currentTenant?.id)
                    put("agentId", currentUser?.id)
                }
                s.emit("agent-init", initData)
            }
        } else {
            // Already connected, immediately emit agent-init to ensure lists sync!
            val initData = JSONObject().apply {
                put("tenantId", currentTenant?.id)
                put("agentId", currentUser?.id)
            }
            s.emit("agent-init", initData)
        }
    }

    fun disconnectSocket() {
        socket?.disconnect()
        socket = null
    }
}
