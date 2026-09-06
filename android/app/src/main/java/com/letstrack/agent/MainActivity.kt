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
import androidx.compose.ui.graphics.Brush
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
            val context = androidx.compose.ui.platform.LocalContext.current
            val prefs = remember { context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE) }
            var currentTheme by remember {
                mutableStateOf(prefs.getString("theme_mode", "light") ?: "light")
            }

            val isDark = currentTheme == "dark"
            val colorScheme = if (!isDark) {
                lightColorScheme(
                    primary = Color(0xFFDC2626), // Accent Red
                    onPrimary = Color.White,
                    surface = Color.White,
                    onSurface = Color(0xFF0F172A),
                    background = Color(0xFFF8FAFC),
                    onBackground = Color(0xFF0F172A),
                    outline = Color(0xFFE2E8F0)
                )
            } else {
                darkColorScheme(
                    primary = Color(0xFFDC2626),
                    onPrimary = Color.White,
                    surface = Color(0xFF121826),
                    onSurface = Color.White,
                    background = Color(0xFF0A0F1D),
                    onBackground = Color.White,
                    outline = Color(0xFF263042)
                )
            }

            MaterialTheme(colorScheme = colorScheme) {
                val activeIntent by _intentFlow.collectAsState(initial = intent)
                AppNavigator(
                    intent = activeIntent,
                    currentTheme = currentTheme,
                    onThemeChange = { newTheme ->
                        prefs.edit().putString("theme_mode", newTheme).apply()
                        currentTheme = newTheme
                    }
                )
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 9001 && data != null) {
            val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
                val idToken = account?.idToken
                if (idToken != null) {
                    kotlinx.coroutines.MainScope().launch {
                        try {
                            val res = NetworkClient.api.googleLogin(com.letstrack.agent.network.GoogleLoginRequest(idToken))
                            NetworkClient.setAuth(res.token, res.user, res.tenant)
                            val prefs = getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                            val gson = com.google.gson.Gson()
                            prefs.edit()
                                .putString("auth_token", res.token)
                                .putString("user_profile", gson.toJson(res.user))
                                .putString("tenant_details", gson.toJson(res.tenant))
                                .apply()
                            recreate()
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
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
fun AppNavigator(
    intent: android.content.Intent?,
    currentTheme: String,
    onThemeChange: (String) -> Unit
) {
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
    var activeChannel by remember { mutableStateOf("livechat") }

    var initialDashboardTab by remember { mutableStateOf(2) } // Default to Unified Inbox
    var pendingVisitorIdNotification by remember { mutableStateOf("") }

    // Read intent parameters on startup or intent updates
    LaunchedEffect(intent) {
        intent?.let {
            val convId = it.getStringExtra("conversationId")
            val name = it.getStringExtra("visitorName")
            val visitorId = it.getStringExtra("visitorId")
            
            if (currentScreen == "dashboard" || currentScreen == "chat") {
                if (!convId.isNullOrEmpty()) {
                    activeConversationId = convId
                    activeVisitorName = name ?: "Visitor"
                    activeVisitorId = visitorId ?: ""
                    currentScreen = "chat"
                } else if (!visitorId.isNullOrEmpty()) {
                    pendingVisitorIdNotification = visitorId
                    currentScreen = "dashboard"
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (currentScreen) {
            "login" -> LoginView(
                currentTheme = currentTheme,
                onThemeToggle = { onThemeChange(if (currentTheme == "light") "dark" else "light") },
                onLoginSuccess = { currentScreen = "dashboard" }
            )
            
            "dashboard" -> DashboardScreen(
                initialTab = initialDashboardTab,
                currentTheme = currentTheme,
                onThemeChange = onThemeChange,
                pendingVisitorIdNotification = pendingVisitorIdNotification,
                onClearPendingVisitorNotification = { pendingVisitorIdNotification = "" },
                onNavigateToChat = { convId, name, visId, country, city, device, url, email, phone, ch ->
                    activeConversationId = convId
                    activeVisitorName = name
                    activeVisitorId = visId
                    activeVisitorCountry = country ?: "Unknown"
                    activeVisitorCity = city ?: "Unknown"
                    activeVisitorDevice = device ?: "Desktop"
                    activeVisitorUrl = url ?: "/"
                    activeVisitorEmail = email ?: ""
                    activeVisitorPhone = phone ?: ""
                    activeChannel = ch ?: "livechat"
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
                initialChannel = activeChannel,
                currentTheme = currentTheme,
                onNavigateBack = { currentScreen = "dashboard" }
            )
        }
    }
}

@Composable
fun LoginView(
    currentTheme: String,
    onThemeToggle: () -> Unit,
    onLoginSuccess: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    val isDark = currentTheme == "dark"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Top right theme toggle button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            OutlinedButton(
                onClick = onThemeToggle,
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.onSurface
                ),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    text = if (isDark) "☀️ Light" else "🌙 Dark",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // App Logo
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "LetsTrack Logo",
            modifier = Modifier
                .size(88.dp)
                .clip(RoundedCornerShape(22.dp))
                .border(2.dp, Color(0xFFDC2626).copy(alpha = 0.5f), RoundedCornerShape(22.dp)),
            contentScale = ContentScale.Crop
        )
        
        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "LetsTrack",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = "Omnichannel Customer Hub",
            fontSize = 13.sp,
            color = Color(0xFFDC2626),
            fontWeight = FontWeight.Bold
        )

        // Omnichannel Badges
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(top = 8.dp, bottom = 20.dp)
        ) {
            ChannelBadge(name = "WhatsApp", color = Color(0xFF25D366))
            ChannelBadge(name = "Instagram", color = Color(0xFFE1306C))
            ChannelBadge(name = "Facebook", color = Color(0xFF1877F2))
            ChannelBadge(name = "LiveChat", color = Color(0xFFDC2626))
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(20.dp))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Email field
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Work Email") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                        focusedBorderColor = Color(0xFFDC2626),
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        focusedLabelColor = Color(0xFFDC2626)
                    ),
                    singleLine = true
                )

                // Password field
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                        focusedBorderColor = Color(0xFFDC2626),
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        focusedLabelColor = Color(0xFFDC2626)
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
                                    
                                    NetworkClient.setAuth(res.token, res.user, res.tenant)
                                    
                                    val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                                    val gson = com.google.gson.Gson()
                                    prefs.edit()
                                        .putString("auth_token", res.token)
                                        .putString("user_profile", gson.toJson(res.user))
                                        .putString("tenant_details", gson.toJson(res.tenant))
                                        .apply()
                                    
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
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFDC2626),
                        contentColor = Color.White
                    ),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                    } else {
                        Text("Sign In to Workspace", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }

                // 1-Click Sandbox launcher
                OutlinedButton(
                    onClick = {
                        email = "admin@vrhere.in"
                        password = "password123"
                        isLoading = true
                        errorMessage = null
                        coroutineScope.launch {
                            try {
                                val req = LoginRequest(email.trim(), password.trim())
                                val res = NetworkClient.api.login(req)
                                NetworkClient.setAuth(res.token, res.user, res.tenant)
                                val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                                val gson = com.google.gson.Gson()
                                prefs.edit()
                                    .putString("auth_token", res.token)
                                    .putString("user_profile", gson.toJson(res.user))
                                    .putString("tenant_details", gson.toJson(res.tenant))
                                    .apply()
                                isLoading = false
                                onLoginSuccess()
                            } catch (e: Exception) {
                                errorMessage = "Demo login failed."
                                isLoading = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF59E0B)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.5f))
                ) {
                    Text("⚡ 1-Click Demo Sandbox", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }

                // Google Sign In Button
                OutlinedButton(
                    onClick = {
                        val gso = com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(
                            com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN
                        )
                            .requestIdToken("931640963201-op9i4jmb31lcm8f4v5ggc0ik1oe1vvjk.apps.googleusercontent.com")
                            .requestEmail()
                            .build()

                        val googleSignInClient = com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(context, gso)
                        val signInIntent = googleSignInClient.signInIntent
                        
                        val activity = context as? ComponentActivity
                        if (activity != null) {
                            activity.startActivityForResult(signInIntent, 9001)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.onSurface
                    ),
                    enabled = !isLoading
                ) {
                    Text("Continue with Google", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                }

                var showResetDialog by remember { mutableStateOf(false) }

                TextButton(
                    onClick = { showResetDialog = true },
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text("Forgot Password?", color = Color(0xFFDC2626), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }

                if (showResetDialog) {
                    ResetPasswordModal(
                        onDismiss = { showResetDialog = false }
                    )
                }
            }
        }
    }
}

@Composable
fun ChannelBadge(name: String, color: Color) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .background(color, CircleShape)
            )
            Text(
                text = name,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
fun ResetPasswordModal(onDismiss: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var resetEmail by remember { mutableStateOf("") }
    var resetPassword by remember { mutableStateOf("") }
    var resetLoading by remember { mutableStateOf(false) }
    var resetMessage by remember { mutableStateOf("") }
    var isResetSuccess by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!resetLoading) onDismiss() },
        title = {
            Text("Reset Password", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp)
        },
        containerColor = MaterialTheme.colorScheme.surface,
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Enter your registered email and new password.",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp
                )

                OutlinedTextField(
                    value = resetEmail,
                    onValueChange = { resetEmail = it },
                    label = { Text("Email Address") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = !resetLoading && !isResetSuccess
                )

                OutlinedTextField(
                    value = resetPassword,
                    onValueChange = { resetPassword = it },
                    label = { Text("New Password") },
                    modifier = Modifier.fillMaxWidth(),
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
                                    resetMessage = "Password reset failed."
                                    resetLoading = false
                                }
                            }
                        } else {
                            resetMessage = "Enter valid email and 6+ char password."
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                    enabled = !resetLoading
                ) {
                    Text("Reset Password")
                }
            } else {
                Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))) {
                    Text("Close")
                }
            }
        },
        dismissButton = {
            if (!resetLoading && !isResetSuccess) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = Color(0xFF94A3B8))
                }
            }
        }
    )
}
