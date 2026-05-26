package com.letstrack.agent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letstrack.agent.network.*
import com.letstrack.agent.R
import kotlinx.coroutines.launch
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: String,
    visitorName: String,
    visitorId: String,
    initialCountry: String?,
    initialCity: String?,
    initialDevice: String?,
    initialUrl: String?,
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
    var status by remember { mutableStateOf("Unassigned") }

    // Dynamic visitor metadata tracking
    var visitorCountry by remember { mutableStateOf(initialCountry ?: "Unknown") }
    var visitorCity by remember { mutableStateOf(initialCity ?: "Unknown") }
    var visitorDevice by remember { mutableStateOf(initialDevice ?: "Desktop") }
    var visitorUrl by remember { mutableStateOf(initialUrl ?: "/") }
    var isDetailsExpanded by remember { mutableStateOf(false) }

    // Proactive REST fetch for message history
    LaunchedEffect(conversationId) {
        coroutineScope.launch {
            try {
                val list = NetworkClient.api.getMessages(NetworkClient.getAuthHeader(), conversationId)
                messagesList = list
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
            if (socket.connected()) {
                isVisitorTyping = data.getBoolean("isTyping")
            }
        }

        // 4. Live visitor navigation path updates
        socket.on("visitor-navigated") { args ->
            val data = args[0] as JSONObject
            val vId = data.getString("visitorId")
            if (vId == visitorId) {
                visitorUrl = data.getString("currentUrl")
            }
        }

        // 5. Assigned status update logs
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
            socket.off("visitor-navigated")
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Logo",
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .border(1.dp, Color(0xFFDC2626), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(visitorName, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(
                                text = if (isVisitorTyping) "typing..." else "Connected via Widget",
                                fontSize = 10.sp,
                                color = if (isVisitorTyping) Color(0xFFEF4444) else Color.Gray
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
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
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626), contentColor = Color.White)
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
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626), contentColor = Color.White)
                        ) {
                            Text("Claim Chat", fontSize = 11.sp)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF121212)
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.Black)
        ) {
            // Expandable details panel
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
                shape = RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isDetailsExpanded = !isDetailsExpanded }
                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Visitor Info & Navigation Options",
                            color = Color(0xFFEF4444),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (isDetailsExpanded) "Hide details ▲" else "Show details ▼",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                    }

                    if (isDetailsExpanded) {
                        Spacer(modifier = Modifier.height(8.dp))
                        HorizontalDivider(color = Color(0xFF262626), thickness = 1.dp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("LOCATION", color = Color(0xFF64748B), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text("🗺️ $visitorCity, $visitorCountry", color = Color.White, fontSize = 13.sp)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("DEVICE", color = Color(0xFF64748B), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text(
                                    text = when (visitorDevice.lowercase()) {
                                        "mobile" -> "📱 Mobile"
                                        "tablet" -> "📟 Tablet"
                                        else -> "💻 Desktop"
                                    },
                                    color = Color.White,
                                    fontSize = 13.sp
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Column {
                            Text("CURRENTLY VIEWING", color = Color(0xFF64748B), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            Text(
                                text = visitorUrl,
                                color = Color(0xFFEF4444),
                                fontSize = 12.sp,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                            )
                        }
                    }
                }
            }

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
                                color = Color(0xFFEF4444),
                                fontSize = 11.sp,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color(0xFF2B0707))
                                    .border(1.dp, Color(0xFF7F1D1D), RoundedCornerShape(20.dp))
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
                                        if (isSelf) Color(0xFFDC2626) else Color(0xFF1E1E1E)
                                    )
                                    .border(
                                        1.dp,
                                        if (isSelf) Color(0xFF7F1D1D) else Color(0xFF262626),
                                        RoundedCornerShape(
                                            topStart = 12.dp,
                                            topEnd = 12.dp,
                                            bottomStart = if (isSelf) 12.dp else 2.dp,
                                            bottomEnd = if (isSelf) 2.dp else 12.dp
                                        )
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
                            Text("typing...", color = Color(0xFFEF4444), fontSize = 11.sp)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF1E1E1E))
                                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text("•••", color = Color.White, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }

            // Quick replies scrollable row
            androidx.compose.foundation.lazy.LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF121212))
                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(0.dp))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val replies = listOf(
                    "Hello! How can I help you today?",
                    "Could you please share your email/domain details?",
                    "One moment please, I am verifying that for you.",
                    "Thank you for contacting VR HERE! Have a great day!"
                )
                items(replies) { reply ->
                    SuggestionChip(
                        onClick = { chatInput = reply },
                        label = { Text(reply, fontSize = 11.sp, color = Color.White) },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            containerColor = Color(0xFF1E1E1E)
                        ),
                        border = BorderStroke(1.dp, Color(0xFF262626))
                    )
                }
            }

            // Chat Input Panel
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF121212))
                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(0.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = chatInput,
                    onValueChange = { chatInput = it },
                    placeholder = { Text("Reply back to customer...", fontSize = 14.sp, color = Color.Gray) },
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Black,
                        unfocusedContainerColor = Color.Black,
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
                                    put("visitorId", visitorId)
                                    put("text", chatInput.trim())
                                }
                                s.emit("agent-msg", msgData)
                                chatInput = ""
                            }
                        }
                    },
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color(0xFFDC2626))
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White)
                }
            }
        }
    }
}
