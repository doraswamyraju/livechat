package com.letstrack.agent.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letstrack.agent.network.*
import kotlinx.coroutines.launch
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToChat: (String, String) -> Unit,
    onSignOut: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Metrics, 1: Visitors, 2: Inbox
    val coroutineScope = rememberCoroutineScope()

    // State holdings updated from WS and REST
    var analytics by remember { mutableStateOf<AnalyticsResponse?>(null) }
    var visitorsList by remember { mutableStateOf<List<VisitorDto>>(emptyList()) }
    var conversationsList by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var agentsList by remember { mutableStateOf<List<UserProfile>>(emptyList()) }
    var selfStatus by remember { mutableStateOf(NetworkClient.currentUser?.status ?: "Offline") }
    var showStatusDialog by remember { mutableStateOf(false) }

    // Connect real-time socket listeners
    DisposableEffect(Unit) {
        val socket = NetworkClient.getSocketInstance()

        // 1. Full database state sync on connection
        socket.on("dashboard-sync") { args ->
            val dataObj = args[0] as JSONObject
            
            // Extract visitors
            val visArray = dataObj.getJSONArray("visitors")
            val vList = mutableListOf<VisitorDto>()
            for (i in 0 until visArray.length()) {
                val obj = visArray.getJSONObject(i)
                vList.add(
                    VisitorDto(
                        _id = obj.getString("_id"),
                        name = obj.getString("name"),
                        email = if (obj.has("email")) obj.getString("email") else null,
                        country = obj.getString("country"),
                        city = obj.getString("city"),
                        deviceType = obj.getString("deviceType"),
                        currentUrl = if (obj.has("currentUrl")) obj.getString("currentUrl") else null,
                        isOnline = obj.getBoolean("isOnline")
                    )
                )
            }
            visitorsList = vList

            // Extract conversations
            val convArray = dataObj.getJSONArray("conversations")
            val cList = mutableListOf<ConversationDto>()
            for (i in 0 until convArray.length()) {
                val obj = convArray.getJSONObject(i)
                val assignedId = if (obj.has("assignedAgentId") && !obj.isNull("assignedAgentId")) {
                    val agentObj = obj.get("assignedAgentId")
                    if (agentObj is JSONObject) agentObj.getString("_id") else agentObj.toString()
                } else null

                cList.add(
                    ConversationDto(
                        _id = obj.getString("_id"),
                        visitorId = if (obj.get("visitorId") is JSONObject) obj.getJSONObject("visitorId").getString("_id") else obj.getString("visitorId"),
                        status = obj.getString("status"),
                        assignedAgentId = assignedId,
                        updatedAt = obj.getString("updatedAt")
                    )
                )
            }
            conversationsList = cList

            // Extract agents
            val agentArray = dataObj.getJSONArray("agents")
            val aList = mutableListOf<UserProfile>()
            for (i in 0 until agentArray.length()) {
                val obj = agentArray.getJSONObject(i)
                aList.add(
                    UserProfile(
                        id = obj.getString("_id"),
                        name = obj.getString("name"),
                        email = obj.getString("email"),
                        role = obj.getString("role"),
                        status = obj.getString("status")
                    )
                )
            }
            agentsList = aList

            // Self sync status
            aList.find { it.id == NetworkClient.currentUser?.id }?.let {
                selfStatus = it.status
            }
        }

        // 2. Real-time visitor connected
        socket.on("visitor-connected") { args ->
            val obj = args[0] as JSONObject
            val visitor = VisitorDto(
                _id = obj.getString("_id"),
                name = obj.getString("name"),
                email = if (obj.has("email")) obj.getString("email") else null,
                country = obj.getString("country"),
                city = obj.getString("city"),
                deviceType = obj.getString("deviceType"),
                currentUrl = if (obj.has("currentUrl")) obj.getString("currentUrl") else null,
                isOnline = obj.getBoolean("isOnline")
            )
            visitorsList = visitorsList.filter { it._id != visitor._id } + visitor
        }

        // 3. Visitor navigated paths
        socket.on("visitor-navigated") { args ->
            val data = args[0] as JSONObject
            val vId = data.getString("visitorId")
            val url = data.getString("currentUrl")
            visitorsList = visitorsList.map {
                if (it._id == vId) it.copy(currentUrl = url) else it
            }
        }

        // 4. Visitor goes offline
        socket.on("visitor-disconnected") { args ->
            val data = args[0] as JSONObject
            val vId = data.getString("visitorId")
            visitorsList = visitorsList.map {
                if (it._id == vId) it.copy(isOnline = false) else it
            }
        }

        // 5. Chat Assigned notification updates
        socket.on("chat-assigned-update") { args ->
            val data = args[0] as JSONObject
            val convObj = data.getJSONObject("conversation")
            val cId = convObj.getString("_id")
            val status = convObj.getString("status")
            val assignedId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) {
                convObj.getJSONObject("assignedAgentId").getString("_id")
            } else null

            conversationsList = conversationsList.map {
                if (it._id == cId) it.copy(status = status, assignedAgentId = assignedId) else it
            }
        }

        // 6. Sync staff status changes
        socket.on("agent-status-changed") { args ->
            val data = args[0] as JSONObject
            val aId = data.getString("agentId")
            val status = data.getString("status")
            agentsList = agentsList.map {
                if (it.id == aId) it.copy(status = status) else it
            }
            if (aId == NetworkClient.currentUser?.id) {
                selfStatus = status
            }
        }

        // Establish WS handshakes
        NetworkClient.connectSocket()

        onDispose {
            socket.off("dashboard-sync")
            socket.off("visitor-connected")
            socket.off("visitor-navigated")
            socket.off("visitor-disconnected")
            socket.off("chat-assigned-update")
            socket.off("agent-status-changed")
        }
    }

    // Proactive REST fetch for metrics
    LaunchedEffect(selectedTab) {
        if (selectedTab == 0) {
            coroutineScope.launch {
                try {
                    analytics = NetworkClient.api.getAnalytics(NetworkClient.getAuthHeader())
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = NetworkClient.currentTenant?.name ?: "LetsTrack console",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Admin Employee Panel",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    // Status badge button
                    Button(
                        onClick = { showStatusDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(getStatusColor(selfStatus))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(selfStatus, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Sign Out
                    IconButton(onClick = onSignOut) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Sign Out", tint = Color.Red)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Star, contentDescription = "Metrics") },
                    label = { Text("Metrics") },
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.LocationOn, contentDescription = "Traffic") },
                    label = { Text("Traffic") },
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Email, contentDescription = "Inbox") },
                    label = { Text("Inbox") },
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 }
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFF0F172A)) // Sleek slate dark background
        ) {
            when (selectedTab) {
                0 -> MetricsTab(analytics, agentsList)
                1 -> TrafficTab(visitorsList) { visitor ->
                    // Find existing conversation and navigate
                    val conv = conversationsList.find { it.visitorId == visitor._id }
                    if (conv != null) {
                        onNavigateToChat(conv._id, visitor.name)
                    }
                }
                2 -> InboxTab(conversationsList, visitorsList) { conv ->
                    val visitorName = visitorsList.find { it._id == conv.visitorId }?.name ?: "Visitor"
                    onNavigateToChat(conv._id, visitorName)
                }
            }
        }

        // Status Changer Dialog
        if (showStatusDialog) {
            AlertDialog(
                onDismissRequest = { showStatusDialog = false },
                title = { Text("Update Live Presence Status") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatusRow("Online", selfStatus) {
                            coroutineScope.launch {
                                NetworkClient.getSocketInstance().emit("agent-status-update", JSONObject().put("status", "Online"))
                            }
                            showStatusDialog = false
                        }
                        StatusRow("Away", selfStatus) {
                            coroutineScope.launch {
                                NetworkClient.getSocketInstance().emit("agent-status-update", JSONObject().put("status", "Away"))
                            }
                            showStatusDialog = false
                        }
                        StatusRow("Offline", selfStatus) {
                            coroutineScope.launch {
                                NetworkClient.getSocketInstance().emit("agent-status-update", JSONObject().put("status", "Offline"))
                            }
                            showStatusDialog = false
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showStatusDialog = false }) { Text("Dismiss") }
                }
            )
        }
    }
}

@Composable
fun StatusRow(status: String, current: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(getStatusColor(status))
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = status,
            fontSize = 15.sp,
            fontWeight = if (status == current) FontWeight.Bold else FontWeight.Normal,
            color = if (status == current) MaterialTheme.colorScheme.primary else Color.Unspecified
        )
        if (status == current) {
            Spacer(modifier = Modifier.weight(1f))
            Icon(Icons.Default.Check, contentDescription = "Selected", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

// ------------------------------------------
// METRICS TAB
// ------------------------------------------
@Composable
fun MetricsTab(analytics: AnalyticsResponse?, agents: List<UserProfile>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Operational Health Overview", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Online Guests",
                    value = (analytics?.onlineVisitors ?: 0).toString(),
                    color1 = Color(0xFF6366F1),
                    color2 = Color(0xFF4F46E5)
                )
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Active Chats",
                    value = (analytics?.activeConversations ?: 0).toString(),
                    color1 = Color(0xFF10B981),
                    color2 = Color(0xFF059669)
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Queue Size",
                    value = (analytics?.unassignedConversations ?: 0).toString(),
                    color1 = Color(0xFFF59E0B),
                    color2 = Color(0xFFD97706)
                )
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Total Staff",
                    value = (analytics?.totalAgents ?: 0).toString(),
                    color1 = Color(0xFF8B5CF6),
                    color2 = Color(0xFF7C3AED)
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text("Active Employees Status", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        items(agents) { agent ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF475569)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(agent.name[0].toString(), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(agent.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(agent.role, color = Color(0xFF94A3B8), fontSize = 11.sp)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF0F172A))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(getStatusColor(agent.status))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(agent.status, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun MetricItemCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    color1: Color,
    color2: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp)
    ) {
        Box(
            modifier = Modifier
                .background(Brush.horizontalGradient(listOf(color1, color2)))
                .padding(16.dp)
                .fillMaxWidth()
        ) {
            Column {
                Text(title, color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text(value, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

// ------------------------------------------
// TRAFFIC TAB
// ------------------------------------------
@Composable
fun TrafficTab(visitors: List<VisitorDto>, onOpenChat: (VisitorDto) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Live Site Traffic Logs", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        if (visitors.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                    Text("No visitors currently active.", color = Color(0xFF94A3B8), fontSize = 14.sp)
                }
            }
        }

        items(visitors) { visitor ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.clickable { onOpenChat(visitor) }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(if (visitor.isOnline) Color(0xFF10B981) else Color(0xFF64748B))
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(visitor.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            text = "📍 ${visitor.city}, ${visitor.country}",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Url: ${visitor.currentUrl ?: "/"}",
                            color = Color(0xFF8B5CF6),
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    IconButton(onClick = { onOpenChat(visitor) }) {
                        Icon(Icons.Default.Send, contentDescription = "Open Chat", tint = Color(0xFF8B5CF6))
                    }
                }
            }
        }
    }
}

// ------------------------------------------
// INBOX TAB
// ------------------------------------------
@Composable
fun InboxTab(
    conversations: List<ConversationDto>,
    visitors: List<VisitorDto>,
    onSelectChat: (ConversationDto) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Inbox Conversations Queue", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        if (conversations.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                    Text("No chats in queue.", color = Color(0xFF94A3B8), fontSize = 14.sp)
                }
            }
        }

        items(conversations) { conv ->
            val visitor = visitors.find { it._id == conv.visitorId }
            val visitorName = visitor?.name ?: "VisitorSession"
            val isUnassigned = conv.status == "Unassigned"

            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isUnassigned) Color(0xFF2D2214) else Color(0xFF1E293B) // highlight unassigned
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.clickable { onSelectChat(conv) }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(if (isUnassigned) Color(0xFFD97706) else Color(0xFF4F46E5)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isUnassigned) "❓" else "💬",
                            fontSize = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(visitorName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            text = if (isUnassigned) "Queued • Unassigned" else "In Progress • Active",
                            color = if (isUnassigned) Color(0xFFF59E0B) else Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                    }
                    Icon(
                        Icons.Default.PlayArrow,
                        contentDescription = "Arrow",
                        tint = if (isUnassigned) Color(0xFFF59E0B) else Color(0xFF94A3B8)
                    )
                }
            }
        }
    }
}

// ------------------------------------------
// UTILITY
// ------------------------------------------
fun getStatusColor(status: String): Color {
    return when (status) {
        "Online" -> Color(0xFF10B981)
        "Away" -> Color(0xFFF59E0B)
        else -> Color(0xFF64748B) // Offline
    }
}
