package com.letstrack.agent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
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
    initialEmail: String? = null,
    initialPhone: String? = null,
    initialChannel: String? = "livechat",
    currentTheme: String = "light",
    onNavigateBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val isDark = currentTheme == "dark"

    var messagesList by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var chatInput by remember { mutableStateOf("") }
    var isVisitorTyping by remember { mutableStateOf(false) }

    var assignedAgentId by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("Unassigned") }
    var channel by remember { mutableStateOf(initialChannel ?: "livechat") }

    var visitorCountry by remember { mutableStateOf(initialCountry ?: "Unknown") }
    var visitorCity by remember { mutableStateOf(initialCity ?: "Unknown") }
    var visitorDevice by remember { mutableStateOf(initialDevice ?: "Desktop") }
    var visitorUrl by remember { mutableStateOf(initialUrl ?: "/") }
    var visitorEmail by remember { mutableStateOf(initialEmail ?: "") }
    var visitorPhone by remember { mutableStateOf(initialPhone ?: "") }
    var isDetailsExpanded by remember { mutableStateOf(false) }

    var quickRepliesList by remember { mutableStateOf<List<QuickReplyDto>>(emptyList()) }
    var mutableVisitorName by remember { mutableStateOf(visitorName) }
    var visitorMuted by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showAssignMenu by remember { mutableStateOf(false) }
    var showCreateLeadDialog by remember { mutableStateOf(false) }
    var leadCreatedToast by remember { mutableStateOf(false) }

    val selfId = NetworkClient.currentUser?.id ?: ""
    val isAdmin = NetworkClient.currentUser?.role == "Admin"
    val channelColor = getChannelBrandingColor(channel)

    LaunchedEffect(conversationId) {
        coroutineScope.launch {
            try {
                val list = NetworkClient.api.getMessages(NetworkClient.getAuthHeader(), conversationId)
                messagesList = list
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        coroutineScope.launch {
            try {
                val replies = NetworkClient.api.getQuickReplies(NetworkClient.getAuthHeader())
                quickRepliesList = replies
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        coroutineScope.launch {
            try {
                val visitor = NetworkClient.api.getVisitor(NetworkClient.getAuthHeader(), visitorId)
                mutableVisitorName = visitor.name
                visitorEmail = visitor.email ?: ""
                visitorPhone = visitor.phoneNumber ?: ""
                visitorCountry = visitor.country
                visitorCity = visitor.city
                visitorDevice = visitor.deviceType
                visitorMuted = visitor.isMuted ?: false
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    DisposableEffect(conversationId) {
        val socket = NetworkClient.getSocketInstance()

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

        socket.on("visitor-typing") { args ->
            val data = args[0] as JSONObject
            if (socket.connected()) {
                isVisitorTyping = data.getBoolean("isTyping")
            }
        }

        onDispose {
            socket.off("agent-msg-received")
            socket.off("visitor-msg")
            socket.off("visitor-typing")
        }
    }

    LaunchedEffect(messagesList.size, isVisitorTyping) {
        if (messagesList.isNotEmpty()) {
            listState.animateScrollToItem(messagesList.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { showEditDialog = true }
                    ) {
                        Box(contentAlignment = Alignment.BottomEnd) {
                            Surface(
                                color = Color(0xFFDC2626).copy(alpha = 0.15f),
                                shape = CircleShape,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = mutableVisitorName.take(1).uppercase(),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFFDC2626)
                                    )
                                }
                            }
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(channelColor, CircleShape)
                                    .border(1.5.dp, MaterialTheme.colorScheme.surface, CircleShape)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column {
                            Text(
                                text = if (visitorMuted) "$mutableVisitorName 🔇" else mutableVisitorName,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = if (isVisitorTyping) "typing..." else "via ${channel.replaceFirstChar { it.uppercase() }}",
                                fontSize = 11.sp,
                                color = if (isVisitorTyping) Color(0xFFEF4444) else Color(0xFF94A3B8)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                },
                actions = {
                    // Convert to Lead button
                    Button(
                        onClick = { showCreateLeadDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.padding(end = 6.dp)
                    ) {
                        Icon(Icons.Default.Bolt, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(2.dp))
                        Text("Lead", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }

                    // Claim / Release button
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
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Release", fontSize = 11.sp, fontWeight = FontWeight.Bold)
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
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Claim", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Expandable details panel
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isDetailsExpanded = !isDetailsExpanded }
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Visitor & Channel Insights",
                            color = Color(0xFFDC2626),
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
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("LOCATION", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text("🗺️ $visitorCity, $visitorCountry", color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("DEVICE", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text(if (visitorDevice.lowercase() == "mobile") "📱 Mobile" else "💻 Desktop", color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("EMAIL", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text(if (visitorEmail.isNotEmpty()) visitorEmail else "None", color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("PHONE", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Text(if (visitorPhone.isNotEmpty()) visitorPhone else "None", color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            // Lead Created Toast
            if (leadCreatedToast) {
                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.12f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "✓ Lead created and linked to this conversation!",
                        color = Color(0xFF10B981),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }

            // Chat Messages List
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(messagesList) { msg ->
                    val isSelf = msg.senderType == "Agent" && msg.senderId == selfId
                    val isSystem = msg.senderType == "System"

                    if (isSystem) {
                        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Surface(
                                color = Color(0xFFDC2626).copy(alpha = 0.1f),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFDC2626).copy(alpha = 0.2f))
                            ) {
                                Text(
                                    text = msg.text,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFDC2626),
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                )
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = if (isSelf) Arrangement.End else Arrangement.Start
                        ) {
                            Column(
                                horizontalAlignment = if (isSelf) Alignment.End else Alignment.Start,
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Text(
                                    text = "${msg.senderName} • ${msg.timestamp.takeLast(8)}",
                                    fontSize = 10.sp,
                                    color = Color(0xFF94A3B8)
                                )
                                Card(
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSelf) Color(0xFFDC2626) else MaterialTheme.colorScheme.surface
                                    ),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelf) Color.Transparent else MaterialTheme.colorScheme.outline)
                                ) {
                                    Text(
                                        text = msg.text,
                                        fontSize = 14.sp,
                                        color = if (isSelf) Color.White else MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                if (isVisitorTyping) {
                    item {
                        Surface(
                            color = MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                        ) {
                            Text("typing...", fontSize = 12.sp, color = Color(0xFFDC2626), modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                        }
                    }
                }
            }

            // Quick replies chips
            if (quickRepliesList.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(quickRepliesList) { qr ->
                        Surface(
                            onClick = { chatInput = qr.text },
                            color = MaterialTheme.colorScheme.background,
                            shape = RoundedCornerShape(14.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                        ) {
                            Text(
                                text = "${qr.shortcut}: ${qr.text}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // Input Bar
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 4.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = chatInput,
                        onValueChange = { chatInput = it },
                        placeholder = { Text("Reply back to customer...", fontSize = 13.sp) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MaterialTheme.colorScheme.onSurface,
                            unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                            focusedBorderColor = Color(0xFFDC2626),
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline
                        ),
                        singleLine = true
                    )

                    Button(
                        onClick = {
                            if (chatInput.trim().isNotEmpty()) {
                                val text = chatInput.trim()
                                val payload = JSONObject().apply {
                                    put("conversationId", conversationId)
                                    put("visitorId", visitorId)
                                    put("text", text)
                                }
                                NetworkClient.getSocketInstance().emit("agent-msg", payload)
                                chatInput = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        shape = CircleShape,
                        contentPadding = PaddingValues(10.dp),
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }

    if (showCreateLeadDialog) {
        CreateLeadDialog(
            onDismiss = { showCreateLeadDialog = false },
            onCreated = {
                showCreateLeadDialog = false
                leadCreatedToast = true
            }
        )
    }
}
