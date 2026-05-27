package com.letstrack.agent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.google.firebase.messaging.FirebaseMessaging
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letstrack.agent.network.LoginRequest
import com.letstrack.agent.network.NetworkClient
import com.letstrack.agent.ui.ChatScreen
import com.letstrack.agent.ui.DashboardScreen
import kotlinx.coroutines.launch
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    private val _intentFlow = kotlinx.coroutines.flow.MutableStateFlow<android.content.Intent?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        _intentFlow.value = intent
        
        // Prompt for notification permission on Android 13+ (Tiramisu API 33)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFFDC2626), // Netflix Red Accent
                    onPrimary = Color.White,
                    surface = Color(0xFF121212), // Dark Premium surface
                    onSurface = Color.White,
                    background = Color(0xFF000000), // Pure Black background
                    onBackground = Color.White
                )
            ) {
                val activeIntent by _intentFlow.collectAsState(initial = intent)
                AppNavigator(activeIntent)
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        _intentFlow.value = intent
    }
}

@Composable
fun AppNavigator(intent: android.content.Intent?) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var currentScreen by remember {
        mutableStateOf(
            run {
                val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                val token = prefs.getString("auth_token", null)
                val userJson = prefs.getString("user_profile", null)
                val tenantJson = prefs.getString("tenant_details", null)
                if (token != null && userJson != null && tenantJson != null) {
                    try {
                        val gson = com.google.gson.Gson()
                        val user = gson.fromJson(userJson, com.letstrack.agent.network.UserProfile::class.java)
                        val tenant = gson.fromJson(tenantJson, com.letstrack.agent.network.TenantDetails::class.java)
                        NetworkClient.setAuth(token, user, tenant)
                        "dashboard"
                    } catch (e: Exception) {
                        e.printStackTrace()
                        "login"
                    }
                } else {
                    "login"
                }
            }
        )
    }
    
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(currentScreen) {
        if (currentScreen == "dashboard" && NetworkClient.currentUser != null) {
            try {
                FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val fcmToken = task.result
                        coroutineScope.launch {
                            try {
                                NetworkClient.api.registerFcmToken(
                                    NetworkClient.getAuthHeader(),
                                    com.letstrack.agent.network.FcmTokenRequest(fcmToken)
                                )
                            } catch (err: Exception) {
                                err.printStackTrace()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Chat parameters
    var activeConversationId by remember { mutableStateOf("") }
    var activeVisitorName by remember { mutableStateOf("") }
    var activeVisitorId by remember { mutableStateOf("") }
    var activeVisitorCountry by remember { mutableStateOf("") }
    var activeVisitorCity by remember { mutableStateOf("") }
    var activeVisitorDevice by remember { mutableStateOf("") }
    var activeVisitorUrl by remember { mutableStateOf("") }
    var activeVisitorEmail by remember { mutableStateOf("") }
    var activeVisitorPhone by remember { mutableStateOf("") }

    var initialDashboardTab by remember { mutableStateOf(0) }

    // Read intent parameters on startup or intent updates
    LaunchedEffect(intent) {
        intent?.let {
            val convId = it.getStringExtra("conversationId")
            val name = it.getStringExtra("visitorName")
            val type = it.getStringExtra("type")
            
            if (currentScreen == "dashboard" || currentScreen == "chat") {
                if (!convId.isNullOrEmpty()) {
                    activeConversationId = convId
                    activeVisitorName = name ?: "Visitor"
                    activeVisitorId = it.getStringExtra("visitorId") ?: ""
                    currentScreen = "chat"
                } else if (type == "new-visitor") {
                    initialDashboardTab = 1 // Navigate to Traffic logs
                    currentScreen = "dashboard"
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
    ) {
        when (currentScreen) {
            "login" -> LoginView(onLoginSuccess = { currentScreen = "dashboard" })
            
            "dashboard" -> DashboardScreen(
                initialTab = initialDashboardTab,
                onNavigateToChat = { convId, name, visId, country, city, device, url, email, phone ->
                    activeConversationId = convId
                    activeVisitorName = name
                    activeVisitorId = visId
                    activeVisitorCountry = country ?: "Unknown"
                    activeVisitorCity = city ?: "Unknown"
                    activeVisitorDevice = device ?: "Desktop"
                    activeVisitorUrl = url ?: "/"
                    activeVisitorEmail = email ?: ""
                    activeVisitorPhone = phone ?: ""
                    currentScreen = "chat"
                },
                onSignOut = {
                    val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                    prefs.edit()
                        .remove("auth_token")
                        .remove("user_profile")
                        .remove("tenant_details")
                        .apply()
                    NetworkClient.disconnectSocket()
                    currentScreen = "login"
                }
            )
            
            "chat" -> ChatScreen(
                conversationId = activeConversationId,
                visitorName = activeVisitorName,
                visitorId = activeVisitorId,
                initialCountry = activeVisitorCountry,
                initialCity = activeVisitorCity,
                initialDevice = activeVisitorDevice,
                initialUrl = activeVisitorUrl,
                initialEmail = activeVisitorEmail,
                initialPhone = activeVisitorPhone,
                onNavigateBack = { currentScreen = "dashboard" }
            )
        }
    }
}

@Composable
fun LoginView(onLoginSuccess: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // App Logo with premium border
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "LetsTrack Logo",
            modifier = Modifier
                .size(110.dp)
                .clip(CircleShape)
                .border(2.dp, Color(0xFFDC2626), CircleShape),
            contentScale = ContentScale.Crop
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "LetsTrack",
            fontSize = 32.sp,
            fontWeight = FontWeight.Black,
            color = Color.White
        )
        Text(
            text = "Real-time Mobile Tracking Console",
            fontSize = 12.sp,
            color = Color(0xFFEF4444), // Accent Red
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 2.dp, bottom = 32.dp)
        )

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF262626), RoundedCornerShape(16.dp))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Email field
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Username") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFFDC2626),
                        unfocusedBorderColor = Color(0xFF262626),
                        focusedLabelColor = Color(0xFFDC2626),
                        cursorColor = Color(0xFFDC2626)
                    ),
                    singleLine = true
                )

                // Password field
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password credential") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFFDC2626),
                        unfocusedBorderColor = Color(0xFF262626),
                        focusedLabelColor = Color(0xFFDC2626),
                        cursorColor = Color(0xFFDC2626)
                    ),
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = Color(0xFFEF4444),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Submit button
                Button(
                    onClick = {
                        if (email.trim().isNotEmpty() && password.trim().isNotEmpty()) {
                            isLoading = true
                            errorMessage = null
                            coroutineScope.launch {
                                try {
                                    val req = LoginRequest(email.trim(), password.trim())
                                    val res = NetworkClient.api.login(req)
                                    
                                    // Save credentials in memory
                                    NetworkClient.setAuth(res.token, res.user, res.tenant)
                                    
                                    // Save credentials to SharedPreferences
                                    val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                                    val gson = com.google.gson.Gson()
                                    prefs.edit()
                                        .putString("auth_token", res.token)
                                        .putString("user_profile", gson.toJson(res.user))
                                        .putString("tenant_details", gson.toJson(res.tenant))
                                        .apply()
                                    
                                    // Fetch and upload Firebase FCM Token for push notifications
                                    try {
                                        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                                            if (task.isSuccessful) {
                                                val fcmToken = task.result
                                                coroutineScope.launch {
                                                    try {
                                                        NetworkClient.api.registerFcmToken(
                                                            NetworkClient.getAuthHeader(),
                                                            com.letstrack.agent.network.FcmTokenRequest(fcmToken)
                                                        )
                                                    } catch (err: Exception) {
                                                        err.printStackTrace()
                                                    }
                                                }
                                            }
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }

                                    isLoading = false
                                    onLoginSuccess()
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                    errorMessage = "Invalid credentials or network failure."
                                    isLoading = false
                                }
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFDC2626),
                        contentColor = Color.White
                    ),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text("Sign In to Account", fontWeight = FontWeight.Bold)
                    }
                }

                var showResetDialog by remember { mutableStateOf(false) }
                var resetEmail by remember { mutableStateOf("") }
                var resetPassword by remember { mutableStateOf("") }
                var resetLoading by remember { mutableStateOf(false) }
                var resetMessage by remember { mutableStateOf("") }
                var isResetSuccess by remember { mutableStateOf(false) }

                TextButton(
                    onClick = { showResetDialog = true },
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text("Forgot Password?", color = Color(0xFFEF4444), fontWeight = FontWeight.SemiBold)
                }

                if (showResetDialog) {
                    AlertDialog(
                        onDismissRequest = {
                            if (!resetLoading) {
                                showResetDialog = false
                                resetEmail = ""
                                resetPassword = ""
                                resetMessage = ""
                                isResetSuccess = false
                            }
                        },
                        title = {
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Image(
                                        painter = painterResource(id = R.drawable.app_logo),
                                        contentDescription = "Logo",
                                        modifier = Modifier
                                            .size(50.dp)
                                            .clip(CircleShape)
                                            .border(1.dp, Color(0xFFDC2626), CircleShape)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("Reset Password", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 20.sp)
                                }
                            }
                        },
                        containerColor = Color(0xFF121212),
                        modifier = Modifier.border(1.dp, Color(0xFF262626), RoundedCornerShape(28.dp)),
                        text = {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    "Enter your registered email address and your desired new password.",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 13.sp
                                )

                                OutlinedTextField(
                                    value = resetEmail,
                                    onValueChange = { resetEmail = it },
                                    label = { Text("Email Address") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = Color(0xFFDC2626),
                                        unfocusedBorderColor = Color(0xFF262626),
                                        focusedLabelColor = Color(0xFFDC2626),
                                        cursorColor = Color(0xFFDC2626)
                                    ),
                                    singleLine = true,
                                    enabled = !resetLoading && !isResetSuccess
                                )

                                OutlinedTextField(
                                    value = resetPassword,
                                    onValueChange = { resetPassword = it },
                                    label = { Text("New Password") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = Color(0xFFDC2626),
                                        unfocusedBorderColor = Color(0xFF262626),
                                        focusedLabelColor = Color(0xFFDC2626),
                                        cursorColor = Color(0xFFDC2626)
                                    ),
                                    visualTransformation = PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                                    singleLine = true,
                                    enabled = !resetLoading && !isResetSuccess
                                )

                                if (resetMessage.isNotEmpty()) {
                                    Text(
                                        text = resetMessage,
                                        color = if (isResetSuccess) Color(0xFF10B981) else Color(0xFFEF4444),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        },
                        confirmButton = {
                            if (!isResetSuccess) {
                                Button(
                                    onClick = {
                                        if (resetEmail.trim().isNotEmpty() && resetPassword.trim().length >= 6) {
                                            resetLoading = true
                                            resetMessage = ""
                                            coroutineScope.launch {
                                                try {
                                                    val req = com.letstrack.agent.network.ResetPasswordRequest(
                                                        resetEmail.trim(),
                                                        resetPassword.trim()
                                                    )
                                                    val res = NetworkClient.api.resetPassword(req)
                                                    resetMessage = res.message
                                                    isResetSuccess = true
                                                    resetLoading = false
                                                } catch (e: Exception) {
                                                    e.printStackTrace()
                                                    resetMessage = "Password reset failed. Verify email or connectivity."
                                                    resetLoading = false
                                                }
                                            }
                                        } else {
                                            resetMessage = "Enter valid email and password (min 6 chars)."
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                                    enabled = !resetLoading
                                ) {
                                    if (resetLoading) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                                    } else {
                                        Text("Reset Password")
                                    }
                                }
                            } else {
                                Button(
                                    onClick = {
                                        showResetDialog = false
                                        resetEmail = ""
                                        resetPassword = ""
                                        resetMessage = ""
                                        isResetSuccess = false
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                                ) {
                                    Text("Close")
                                }
                            }
                        },
                        dismissButton = {
                            if (!resetLoading && !isResetSuccess) {
                                TextButton(
                                    onClick = {
                                        showResetDialog = false
                                        resetEmail = ""
                                        resetPassword = ""
                                        resetMessage = ""
                                        isResetSuccess = false
                                    }
                                ) {
                                    Text("Cancel", color = Color(0xFF94A3B8))
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}
