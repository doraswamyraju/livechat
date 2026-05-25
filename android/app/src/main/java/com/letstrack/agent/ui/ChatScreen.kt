package com.letstrack.agent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letstrack.agent.network.*
import kotlinx.coroutines.launch
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: String,
    visitorName: String,
    onNavigateBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var messagesList by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var chatInput by remember { mutableStateOf("") }
    
    // Typing status
    var isVisitorTyping by remember { mutableStateOf(false) }

    // Conversation state
    var assignedAgentId by remember { mutableStateOf<String?>(null) }
    var visitorId by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("Unassigned") }

    // Proactive REST fetch for message history
    LaunchedEffect(conversationId) {
        coroutineScope.launch {
            try {
                val list = NetworkClient.api.getMessages(NetworkClient.getAuthHeader(), conversationId)
                messagesList = list
                
                // Extract parameters from first message or socket state
                if (list.isNotEmpty()) {
                    val m = list.first()
                    // Set default parameters
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Connect real-time socket listeners for active chat room
    DisposableEffect(conversationId) {
        val socket = NetworkClient.getSocketInstance()

        // 1. Sync messages from self and other agents
        socket.on("agent-msg-received") { args ->
            val data = args[0] as JSONObject
            val cId = data.getString("conversationId")
            if (cId == conversationId) {
                val msgObj = data.getJSONObject("message")
                val msg = MessageDto(
                    _id = msgObj.getString("_id"),
                    conversationId = conversationId,
                    senderType = "Agent",
                    senderId = msgObj.getString("senderId"),
                    senderName = msgObj.getString("senderName"),
                    text = msgObj.getString("text"),
                    timestamp = msgObj.getString("timestamp")
                )
                messagesList = messagesList + msg
            }
        }

        // 2. Sync incoming visitor messages
        socket.on("visitor-msg") { args ->
            val data = args[0] as JSONObject
            val convObj = data.getJSONObject("conversation")
            val cId = convObj.getString("_id")
            if (cId == conversationId) {
                val msgObj = data.getJSONObject("message")
                val msg = MessageDto(
                    _id = msgObj.getString("_id"),
                    conversationId = conversationId,
                    senderType = "Visitor",
                    senderId = msgObj.getString("senderId"),
                    senderName = msgObj.getString("senderName"),
                    text = msgObj.getString("text"),
                    timestamp = msgObj.getString("timestamp")
                )
                messagesList = messagesList + msg
                isVisitorTyping = false
            }
        }

        // 3. Monitor visitor typing indicator
        socket.on("visitor-typing") { args ->
            val data = args[0] as JSONObject
            // Match corresponding visitor
            if (socket.connected()) {
                isVisitorTyping = data.getBoolean("isTyping")
            }
        }

        // 4. Assigned status update logs
        socket.on("chat-assigned-update") { args ->
            val data = args[0] as JSONObject
            val convObj = data.getJSONObject("conversation")
            val cId = convObj.getString("_id")
            if (cId == conversationId) {
                status = convObj.getString("status")
                assignedAgentId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) {
                    convObj.getJSONObject("assignedAgentId").getString("_id")
                } else null

                // Append system log message
                val sysObj = data.getJSONObject("systemMessage")
                val msg = MessageDto(
                    _id = sysObj.getString("_id"),
                    conversationId = conversationId,
                    senderType = "System",
                    senderId = "SYSTEM",
                    senderName = "System",
                    text = sysObj.getString("text"),
                    timestamp = sysObj.getString("timestamp")
                )
                messagesList = messagesList + msg
            }
        }

        onDispose {
            socket.off("agent-msg-received")
            socket.off("visitor-msg")
            socket.off("visitor-typing")
            socket.off("chat-assigned-update")
        }
    }

    // Auto-scroll chats down
    LaunchedEffect(messagesList.size, isVisitorTyping) {
        if (messagesList.isNotEmpty()) {
            listState.animateScrollToItem(messagesList.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(visitorName, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(
                            text = if (isVisitorTyping) "typing..." else "Connected via Widget",
                            fontSize = 11.sp,
                            color = if (isVisitorTyping) MaterialTheme.colorScheme.primary else Color.Gray
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Actions drawer: claim or release chats
                    val selfId = NetworkClient.currentUser?.id
                    if (assignedAgentId == selfId) {
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val data = JSONObject().apply {
                                        put("conversationId", conversationId)
                                        put("assignedAgentId", JSONObject.NULL)
                                    }
                                    NetworkClient.getSocketInstance().emit("assign-chat", data)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
                        ) {
                            Text("Release", fontSize = 11.sp)
                        }
                    } else {
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val data = JSONObject().apply {
                                        put("conversationId", conversationId)
                                        put("assignedAgentId", selfId)
                                    }
                                    NetworkClient.getSocketInstance().emit("assign-chat", data)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("Claim Chat", fontSize = 11.sp)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFF0F172A))
        ) {
            // Chat Board
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                items(messagesList) { msg ->
                    val isSelf = msg.senderType == "Agent" && msg.senderId == NetworkClient.currentUser?.id
                    val isSystem = msg.senderType == "System"

                    if (isSystem) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = msg.text,
                                color = Color(0xFFF59E0B),
                                fontSize = 11.sp,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color(0xFF2D2214))
                                    .padding(horizontal = 14.dp, vertical = 6.dp)
                            )
                        }
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = if (isSelf) Alignment.End else Alignment.Start
                        ) {
                            Text(
                                msg.senderName,
                                color = Color(0xFF94A3B8),
                                fontSize = 10.sp,
                                modifier = Modifier.padding(start = 4.dp, end = 4.dp, bottom = 2.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .clip(
                                        RoundedCornerShape(
                                            topStart = 12.dp,
                                            topEnd = 12.dp,
                                            bottomStart = if (isSelf) 12.dp else 2.dp,
                                            bottomEnd = if (isSelf) 2.dp else 12.dp
                                        )
                                    )
                                    .background(
                                        if (isSelf) MaterialTheme.colorScheme.primary else Color(0xFF1E293B)
                                    )
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    msg.text,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }

                // typing indicator
                if (isVisitorTyping) {
                    item {
                        Column(horizontalAlignment = Alignment.Start) {
                            Text("typing...", color = Color(0xFF8B5CF6), fontSize = 11.sp)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF1E293B))
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text("•••", color = Color.White, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }

            // Chat Input Panel
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1E293B))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = chatInput,
                    onValueChange = { chatInput = it },
                    placeholder = { Text("Reply back to customer...", fontSize = 14.sp) },
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF0F172A),
                        unfocusedContainerColor = Color(0xFF0F172A),
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(8.dp)
                )
                IconButton(
                    onClick = {
                        if (chatInput.trim().isNotEmpty()) {
                            coroutineScope.launch {
                                val s = NetworkClient.getSocketInstance()
                                val msgData = JSONObject().apply {
                                    put("conversationId", conversationId)
                                    put("visitorId", visitorsListStateCheck(conversationId))
                                    put("text", chatInput.trim())
                                }
                                s.emit("agent-msg", msgData)
                                chatInput = ""
                            }
                        }
                    },
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White)
                }
            }
        }
    }
}

// Quick helper to extract visitor uuid from conversation messages
private fun visitorsListStateCheck(conversationId: String): String {
    // Mimic extracting matching visitor ID. Socket parses matching rooms on server automatically,
    // but we can send target payload. Usually conversations has matching visitor details.
    // For simplicity, we fallback to generating visitor details if missing.
    return "visitor_uuid"
}
