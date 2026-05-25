package com.letstrack.agent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF8B5CF6),
                    onPrimary = Color.White,
                    surface = Color(0xFF1E293B),
                    onSurface = Color.White,
                    background = Color(0xFF0F172A),
                    onBackground = Color.White
                )
            ) {
                AppNavigator()
            }
        }
    }
}

@Composable
fun AppNavigator() {
    var currentScreen by remember { mutableStateOf("login") } // login, dashboard, chat
    
    // Chat parameters
    var activeConversationId by remember { mutableStateOf("") }
    var activeVisitorName by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
    ) {
        when (currentScreen) {
            "login" -> LoginView(onLoginSuccess = { currentScreen = "dashboard" })
            
            "dashboard" -> DashboardScreen(
                onNavigateToChat = { convId, name ->
                    activeConversationId = convId
                    activeVisitorName = name
                    currentScreen = "chat"
                },
                onSignOut = {
                    NetworkClient.disconnectSocket()
                    currentScreen = "login"
                }
            )
            
            "chat" -> ChatScreen(
                conversationId = activeConversationId,
                visitorName = activeVisitorName,
                onNavigateBack = { currentScreen = "dashboard" }
            )
        }
    }
}

@Composable
fun LoginView(onLoginSuccess: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "LetsTrack Agent",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Real-time mobile tracking console",
            fontSize = 13.sp,
            color = Color(0xFF94A3B8),
            modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
        )

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
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
                        unfocusedTextColor = Color.White
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
                        unfocusedTextColor = Color.White
                    ),
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = Color.Red,
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
                                    
                                    // Save credentials
                                    NetworkClient.setAuth(res.token, res.user, res.tenant)
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
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text("Sign In to Account", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
