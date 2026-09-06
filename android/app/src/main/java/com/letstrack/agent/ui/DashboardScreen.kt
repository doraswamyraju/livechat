package com.letstrack.agent.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letstrack.agent.network.*
import com.letstrack.agent.R
import kotlinx.coroutines.launch
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    initialTab: Int = 2,
    currentTheme: String,
    onThemeChange: (String) -> Unit,
    pendingVisitorIdNotification: String = "",
    onClearPendingVisitorNotification: () -> Unit = {},
    onNavigateToChat: (String, String, String, String?, String?, String?, String?, String?, String?, String?) -> Unit,
    onSignOut: () -> Unit
) {
    val isAdmin = NetworkClient.currentUser?.isAdmin == true
    val isSuperAdmin = NetworkClient.currentUser?.isSuperAdmin == true
    var selectedTab by remember { mutableStateOf(initialTab) } // 0: Metrics, 1: Radar, 2: Inbox, 3: Leads, 4: Team, 5: Settings
    val coroutineScope = rememberCoroutineScope()
    val isDark = currentTheme == "dark"

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

        socket.on("dashboard-sync") { args ->
            try {
                val dataObj = args[0] as JSONObject
                
                // Extract visitors
                val visArray = dataObj.getJSONArray("visitors")
                val vList = mutableListOf<VisitorDto>()
                for (i in 0 until visArray.length()) {
                    try {
                        val obj = visArray.getJSONObject(i)
                        vList.add(
                            VisitorDto(
                                _id = obj.getString("_id"),
                                name = obj.getString("name"),
                                email = if (obj.has("email") && !obj.isNull("email")) obj.getString("email") else null,
                                phoneNumber = if (obj.has("phoneNumber") && !obj.isNull("phoneNumber")) obj.getString("phoneNumber") else null,
                                country = if (obj.has("country")) obj.getString("country") else "Unknown",
                                city = if (obj.has("city")) obj.getString("city") else "Unknown",
                                deviceType = if (obj.has("deviceType")) obj.getString("deviceType") else "Desktop",
                                currentUrl = if (obj.has("currentUrl") && !obj.isNull("currentUrl")) obj.getString("currentUrl") else null,
                                isOnline = if (obj.has("isOnline")) obj.getBoolean("isOnline") else false,
                                isMuted = if (obj.has("isMuted")) obj.getBoolean("isMuted") else false,
                                source = if (obj.has("source") && !obj.isNull("source")) obj.getString("source") else null,
                                channel = if (obj.has("channel") && !obj.isNull("channel")) obj.getString("channel") else null
                            )
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                visitorsList = vList

                // Extract conversations
                val convArray = dataObj.getJSONArray("conversations")
                val cList = mutableListOf<ConversationDto>()
                for (i in 0 until convArray.length()) {
                    try {
                        val obj = convArray.getJSONObject(i)
                        val assignedId = if (obj.has("assignedAgentId") && !obj.isNull("assignedAgentId")) {
                            val agentObj = obj.get("assignedAgentId")
                            if (agentObj is JSONObject) agentObj.getString("_id") else agentObj.toString()
                        } else null

                        val vId = if (obj.has("visitorId") && !obj.isNull("visitorId")) {
                            val visObj = obj.get("visitorId")
                            if (visObj is JSONObject) visObj.getString("_id") else visObj.toString()
                        } else ""

                        cList.add(
                            ConversationDto(
                                _id = obj.getString("_id"),
                                visitorId = vId,
                                status = if (obj.has("status")) obj.getString("status") else "Unassigned",
                                assignedAgentId = assignedId,
                                channel = if (obj.has("channel") && !obj.isNull("channel")) obj.getString("channel") else null,
                                updatedAt = if (obj.has("updatedAt")) obj.getString("updatedAt") else ""
                            )
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                conversationsList = cList

                // Extract agents
                val agentArray = dataObj.getJSONArray("agents")
                val aList = mutableListOf<UserProfile>()
                for (i in 0 until agentArray.length()) {
                    try {
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
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                agentsList = aList
                NetworkClient.cachedAgents = aList

                aList.find { it.id == NetworkClient.currentUser?.id }?.let {
                    selfStatus = it.status
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        socket.on("visitor-connected") { args ->
            val obj = args[0] as JSONObject
            val visitor = VisitorDto(
                _id = obj.getString("_id"),
                name = obj.getString("name"),
                email = if (obj.has("email") && !obj.isNull("email")) obj.getString("email") else null,
                phoneNumber = if (obj.has("phoneNumber") && !obj.isNull("phoneNumber")) obj.getString("phoneNumber") else null,
                country = obj.getString("country"),
                city = obj.getString("city"),
                deviceType = obj.getString("deviceType"),
                currentUrl = if (obj.has("currentUrl")) obj.getString("currentUrl") else null,
                isOnline = obj.getBoolean("isOnline"),
                isMuted = if (obj.has("isMuted")) obj.getBoolean("isMuted") else false,
                source = if (obj.has("source") && !obj.isNull("source")) obj.getString("source") else null,
                channel = if (obj.has("channel") && !obj.isNull("channel")) obj.getString("channel") else null
            )
            visitorsList = visitorsList.filter { it._id != visitor._id } + visitor
        }

        socket.on("visitor-navigated") { args ->
            val data = args[0] as JSONObject
            val vId = data.getString("visitorId")
            val url = data.getString("currentUrl")
            visitorsList = visitorsList.map {
                if (it._id == vId) it.copy(currentUrl = url) else it
            }
        }

        socket.on("visitor-disconnected") { args ->
            val data = args[0] as JSONObject
            val vId = data.getString("visitorId")
            visitorsList = visitorsList.map {
                if (it._id == vId) it.copy(isOnline = false) else it
            }
        }

        socket.on("chat-assigned-update") { args ->
            try {
                val data = args[0] as JSONObject
                val convObj = data.getJSONObject("conversation")
                val convId = convObj.getString("_id")
                val status = convObj.getString("status")
                val assignedId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) {
                    val aObj = convObj.get("assignedAgentId")
                    if (aObj is JSONObject) aObj.getString("_id") else aObj.toString()
                } else null

                conversationsList = conversationsList.map {
                    if (it._id == convId) it.copy(status = status, assignedAgentId = assignedId) else it
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        socket.on("agent-status-changed") { args ->
            try {
                val data = args[0] as JSONObject
                val aId = data.getString("agentId")
                val status = data.getString("status")
                agentsList = agentsList.map {
                    if (it.id == aId) it.copy(status = status) else it
                }
                NetworkClient.cachedAgents = agentsList
                if (aId == NetworkClient.currentUser?.id) {
                    selfStatus = status
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        socket.on("visitor-msg") { args ->
            try {
                val data = args[0] as JSONObject
                val convObj = data.getJSONObject("conversation")
                val visObj = data.getJSONObject("visitor")
                val msgObj = data.getJSONObject("message")

                val conv = ConversationDto(
                    _id = convObj.getString("_id"),
                    visitorId = visObj.getString("_id"),
                    status = convObj.getString("status"),
                    assignedAgentId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) convObj.getString("assignedAgentId") else null,
                    channel = if (convObj.has("channel") && !convObj.isNull("channel")) convObj.getString("channel") else null,
                    lastMessage = msgObj.getString("text"),
                    updatedAt = convObj.optString("updatedAt", "")
                )

                val vis = VisitorDto(
                    _id = visObj.getString("_id"),
                    name = visObj.getString("name"),
                    email = if (visObj.has("email") && !visObj.isNull("email")) visObj.getString("email") else null,
                    phoneNumber = if (visObj.has("phoneNumber") && !visObj.isNull("phoneNumber")) visObj.getString("phoneNumber") else null,
                    country = visObj.optString("country", "Unknown"),
                    city = visObj.optString("city", "Unknown"),
                    deviceType = visObj.optString("deviceType", "Desktop"),
                    currentUrl = visObj.optString("currentUrl", null),
                    isOnline = visObj.optBoolean("isOnline", true),
                    isMuted = visObj.optBoolean("isMuted", false),
                    source = visObj.optString("source", null),
                    channel = visObj.optString("channel", null)
                )

                visitorsList = visitorsList.filter { it._id != vis._id } + vis
                conversationsList = conversationsList.filter { it._id != conv._id } + conv
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        socket.on("start-conversation-success") { args ->
            try {
                val data = args[0] as JSONObject
                val convObj = data.getJSONObject("conversation")
                val newConv = ConversationDto(
                    _id = convObj.getString("_id"),
                    visitorId = convObj.getString("visitorId"),
                    status = convObj.getString("status"),
                    assignedAgentId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) convObj.getString("assignedAgentId") else null,
                    channel = if (convObj.has("channel") && !convObj.isNull("channel")) convObj.getString("channel") else null,
                    updatedAt = convObj.optString("updatedAt", "")
                )
                conversationsList = conversationsList.filter { it._id != newConv._id } + newConv

                val visitor = visitorsList.find { it._id == newConv.visitorId }
                if (visitor != null) {
                    onNavigateToChat(
                        newConv._id,
                        visitor.name,
                        visitor._id,
                        visitor.country,
                        visitor.city,
                        visitor.deviceType,
                        visitor.currentUrl,
                        visitor.email,
                        visitor.phoneNumber,
                        newConv.resolvedChannel
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        NetworkClient.connectSocket()

        onDispose {
            socket.off("dashboard-sync")
            socket.off("visitor-connected")
            socket.off("visitor-navigated")
            socket.off("visitor-disconnected")
            socket.off("chat-assigned-update")
            socket.off("agent-status-changed")
            socket.off("visitor-msg")
            socket.off("start-conversation-success")
        }
    }

    // Handle pending visitor deep link notification clicks
    LaunchedEffect(conversationsList, pendingVisitorIdNotification) {
        if (pendingVisitorIdNotification.isNotEmpty()) {
            val conv = conversationsList.find { it.visitorId == pendingVisitorIdNotification }
            if (conv != null) {
                val visitor = visitorsList.find { it._id == pendingVisitorIdNotification }
                onNavigateToChat(
                    conv._id,
                    visitor?.name ?: "Visitor",
                    pendingVisitorIdNotification,
                    visitor?.country,
                    visitor?.city,
                    visitor?.deviceType,
                    visitor?.currentUrl,
                    visitor?.email,
                    visitor?.phoneNumber,
                    conv.resolvedChannel
                )
                onClearPendingVisitorNotification()
            } else if (visitorsList.isNotEmpty()) {
                val data = JSONObject().put("visitorId", pendingVisitorIdNotification)
                NetworkClient.getSocketInstance().emit("start-conversation", data)
                onClearPendingVisitorNotification()
            }
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

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Modern Top Bar
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Logo",
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .border(1.dp, Color(0xFFDC2626).copy(alpha = 0.5f), RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = NetworkClient.currentTenant?.name ?: "LetsTrack",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                if (isSuperAdmin) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Surface(
                                        color = Color(0xFFA855F7).copy(alpha = 0.2f),
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            text = "SUPER",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color(0xFFA855F7),
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            Text(
                                text = if (isSuperAdmin) "SuperAdmin Console" else if (isAdmin) "Admin Console" else "Agent Workstation",
                                fontSize = 11.sp,
                                color = if (isSuperAdmin) Color(0xFFA855F7) else Color(0xFFDC2626),
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Theme Toggle
                        IconButton(
                            onClick = { onThemeChange(if (isDark) "light" else "dark") },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Text(if (isDark) "☀️" else "🌙", fontSize = 14.sp)
                        }

                        // Presence Status Button
                        Surface(
                            onClick = { showStatusDialog = true },
                            color = MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(getStatusColor(selfStatus), CircleShape)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = selfStatus,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        // Sign Out
                        IconButton(onClick = onSignOut, modifier = Modifier.size(32.dp)) {
                            Icon(
                                Icons.Default.ExitToApp,
                                contentDescription = "Sign Out",
                                tint = Color(0xFF94A3B8),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }

            // Tab Content
            Box(modifier = Modifier.weight(1f)) {
                when (selectedTab) {
                    0 -> OverviewTabContent(
                        analytics = analytics,
                        onNavigateToTab = { selectedTab = it }
                    )
                    1 -> RadarTabContent(
                        visitorsList = visitorsList,
                        onOpenChat = { vis ->
                            val conv = conversationsList.find { it.visitorId == vis._id }
                            if (conv != null) {
                                onNavigateToChat(
                                    conv._id, vis.name, vis._id, vis.country, vis.city,
                                    vis.deviceType, vis.currentUrl, vis.email, vis.phoneNumber, conv.resolvedChannel
                                )
                            } else {
                                val data = JSONObject().put("visitorId", vis._id)
                                NetworkClient.getSocketInstance().emit("start-conversation", data)
                            }
                        }
                    )
                    2 -> UnifiedInboxTabContent(
                        conversationsList = conversationsList,
                        visitorsList = visitorsList,
                        onSelectConversation = { conv, vis ->
                            onNavigateToChat(
                                conv._id, vis.name, vis._id, vis.country, vis.city,
                                vis.deviceType, vis.currentUrl, vis.email, vis.phoneNumber, conv.resolvedChannel
                            )
                        }
                    )
                    3 -> LeadsTabContent(
                        onOpenChat = { convId, name, visId ->
                            val vis = visitorsList.find { it._id == visId }
                            onNavigateToChat(
                                convId, name, visId, vis?.country, vis?.city,
                                vis?.deviceType, vis?.currentUrl, vis?.email, vis?.phoneNumber, "livechat"
                            )
                        }
                    )
                    4 -> if (isAdmin) TeamTabContent(agentsList = agentsList) else SettingsTabContent(isDark = isDark, onThemeChange = onThemeChange)
                    5 -> SettingsTabContent(isDark = isDark, onThemeChange = onThemeChange)
                }
            }

            // Bottom space to avoid overlapping with floating dock
            Spacer(modifier = Modifier.height(76.dp))
        }

        // Floating Glassmorphic Dock
        FloatingDock(
            selectedTab = selectedTab,
            isAdmin = isAdmin,
            isDark = isDark,
            unassignedCount = conversationsList.count { it.status == "Unassigned" },
            onSelectTab = { selectedTab = it },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp, start = 16.dp, end = 16.dp)
        )

        // Presence Changer Modal
        if (showStatusDialog) {
            PresenceDialog(
                currentStatus = selfStatus,
                onSelectStatus = { newStatus ->
                    val data = JSONObject().put("status", newStatus)
                    NetworkClient.getSocketInstance().emit("agent-status-update", data)
                    showStatusDialog = false
                },
                onDismiss = { showStatusDialog = false }
            )
        }
    }
}

// MARK: - Floating Glassmorphic Dock Component
@Composable
fun FloatingDock(
    selectedTab: Int,
    isAdmin: Boolean,
    isDark: Boolean,
    unassignedCount: Int,
    onSelectTab: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = 16.dp,
                shape = RoundedCornerShape(28.dp),
                ambientColor = Color.Black.copy(alpha = 0.2f),
                spotColor = Color.Black.copy(alpha = 0.3f)
            ),
        shape = RoundedCornerShape(28.dp),
        color = if (isDark) Color(0xFF141C2C).copy(alpha = 0.9f) else Color.White.copy(alpha = 0.92f),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Brush.linearGradient(
                colors = listOf(Color(0xFFDC2626).copy(alpha = 0.4f), if (isDark) Color(0xFF263042) else Color(0xFFE2E8F0))
            )
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            DockItem(icon = Icons.Default.Assessment, label = "Overview", index = 0, isSelected = selectedTab == 0, onClick = { onSelectTab(0) })
            DockItem(icon = Icons.Default.Sensors, label = "Radar", index = 1, isSelected = selectedTab == 1, onClick = { onSelectTab(1) })
            DockItem(
                icon = Icons.Default.ChatBubble,
                label = "Inbox",
                index = 2,
                isSelected = selectedTab == 2,
                badgeCount = unassignedCount,
                onClick = { onSelectTab(2) }
            )
            DockItem(icon = Icons.Default.AssignmentInd, label = "Leads", index = 3, isSelected = selectedTab == 3, onClick = { onSelectTab(3) })
            if (isAdmin) {
                DockItem(icon = Icons.Default.Group, label = "Team", index = 4, isSelected = selectedTab == 4, onClick = { onSelectTab(4) })
            }
            DockItem(icon = Icons.Default.Settings, label = "Settings", index = if (isAdmin) 5 else 4, isSelected = selectedTab == (if (isAdmin) 5 else 4), onClick = { onSelectTab(if (isAdmin) 5 else 4) })
        }
    }
}

@Composable
fun DockItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    index: Int,
    isSelected: Bool = false,
    badgeCount: Int = 0,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 2.dp)
    ) {
        Box(contentAlignment = Alignment.TopEnd) {
            Surface(
                color = if (isSelected) Color(0xFFDC2626) else Color.Transparent,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.size(width = 44.dp, height = 30.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (isSelected) Color.White else Color(0xFF94A3B8),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            if (badgeCount > 0) {
                Box(
                    modifier = Modifier
                        .offset(x = 4.dp, y = (-4).dp)
                        .background(Color.Red, CircleShape)
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = "$badgeCount",
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) Color(0xFFDC2626) else Color(0xFF94A3B8),
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}

// MARK: - UNIFIED INBOX TAB CONTENT (Exact match to reference screenshot)
@Composable
fun UnifiedInboxTabContent(
    conversationsList: List<ConversationDto>,
    visitorsList: List<VisitorDto>,
    onSelectConversation: (ConversationDto, VisitorDto) -> Unit
) {
    var selectedChannel by remember { mutableStateOf("all") }
    var searchText by remember { mutableStateOf("") }

    // Dynamic counts
    val channelCounts = remember(conversationsList, visitorsList) {
        val counts = mutableMapOf("all" to 0, "whatsapp" to 0, "instagram" to 0, "facebook" to 0, "livechat" to 0)
        for (conv in conversationsList) {
            val vis = visitorsList.find { it._id == conv.visitorId }
            val ch = (conv.channel ?: vis?.resolvedChannel ?: "livechat").lowercase()
            counts["all"] = (counts["all"] ?: 0) + 1
            if (ch.contains("whatsapp")) counts["whatsapp"] = (counts["whatsapp"] ?: 0) + 1
            else if (ch.contains("instagram") || ch.contains("ig")) counts["instagram"] = (counts["instagram"] ?: 0) + 1
            else if (ch.contains("facebook") || ch.contains("fb")) counts["facebook"] = (counts["facebook"] ?: 0) + 1
            else counts["livechat"] = (counts["livechat"] ?: 0) + 1
        }
        counts
    }

    val filteredList = remember(conversationsList, visitorsList, selectedChannel, searchText) {
        conversationsList.sortedByDescending { it.updatedAt }.filter { conv ->
            val vis = visitorsList.find { it._id == conv.visitorId }
            val ch = (conv.channel ?: vis?.resolvedChannel ?: "livechat").lowercase()
            val vName = vis?.name?.lowercase() ?: ""

            if (selectedChannel != "all") {
                if (selectedChannel == "whatsapp" && !ch.contains("whatsapp")) return@filter false
                if (selectedChannel == "instagram" && !(ch.contains("instagram") || ch.contains("ig"))) return@filter false
                if (selectedChannel == "facebook" && !(ch.contains("facebook") || ch.contains("fb"))) return@filter false
                if (selectedChannel == "livechat" && (ch.contains("whatsapp") || ch.contains("instagram") || ch.contains("facebook"))) return@filter false
            }

            if (searchText.isNotEmpty()) {
                val q = searchText.lowercase()
                val matchName = vName.contains(q)
                val matchMsg = (conv.lastMessage ?: "").lowercase().contains(q)
                if (!matchName && !matchMsg) return@filter false
            }

            true
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Unified Inbox",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "All conversations. One place.",
                        fontSize = 13.sp,
                        color = Color(0xFF94A3B8)
                    )
                }

                Surface(
                    color = Color(0xFFDC2626).copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "${filteredList.size} Active",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFDC2626),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }

        item {
            // Search field
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                placeholder = { Text("Search chats, visitors, messages...", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = Color(0xFF94A3B8)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    focusedBorderColor = Color(0xFFDC2626),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                ),
                singleLine = true
            )
        }

        item {
            // Channel Filter Pills with Live Counts
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    ChannelPillItem(id = "all", label = "All", color = Color(0xFFDC2626), count = channelCounts["all"] ?: 0, isSelected = selectedChannel == "all", onClick = { selectedChannel = "all" })
                }
                item {
                    ChannelPillItem(id = "whatsapp", label = "WhatsApp", color = Color(0xFF25D366), count = channelCounts["whatsapp"] ?: 0, isSelected = selectedChannel == "whatsapp", onClick = { selectedChannel = "whatsapp" })
                }
                item {
                    ChannelPillItem(id = "instagram", label = "Instagram", color = Color(0xFFE1306C), count = channelCounts["instagram"] ?: 0, isSelected = selectedChannel == "instagram", onClick = { selectedChannel = "instagram" })
                }
                item {
                    ChannelPillItem(id = "facebook", label = "Facebook", color = Color(0xFF1877F2), count = channelCounts["facebook"] ?: 0, isSelected = selectedChannel == "facebook", onClick = { selectedChannel = "facebook" })
                }
                item {
                    ChannelPillItem(id = "livechat", label = "LiveChat", color = Color(0xFF64748B), count = channelCounts["livechat"] ?: 0, isSelected = selectedChannel == "livechat", onClick = { selectedChannel = "livechat" })
                }
            }
        }

        if (filteredList.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Inbox, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(44.dp))
                    Text("No conversations found", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    Text("Incoming chats will appear here automatically.", fontSize = 12.sp, color = Color(0xFF94A3B8))
                }
            }
        } else {
            items(filteredList) { conv ->
                val vis = visitorsList.find { it._id == conv.visitorId } ?: VisitorDto(
                    _id = conv.visitorId,
                    name = "Customer",
                    email = null,
                    country = "Unknown",
                    city = "Unknown",
                    deviceType = "Desktop",
                    currentUrl = null,
                    isOnline = true
                )

                ConversationCard(conv = conv, visitor = vis, onClick = { onSelectConversation(conv, vis) })
            }
        }
    }
}

@Composable
fun ChannelPillItem(
    id: String,
    label: String,
    color: Color,
    count: Int,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = if (isSelected) Color(0xFFDC2626) else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Color.Transparent else MaterialTheme.colorScheme.outline)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(color, CircleShape)
            )
            Text(
                text = label,
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
            )
            Surface(
                color = if (isSelected) Color.Black.copy(alpha = 0.2f) else MaterialTheme.colorScheme.background,
                shape = CircleShape
            ) {
                Text(
                    text = "$count",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) Color.White else Color(0xFF94A3B8),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
fun ConversationCard(
    conv: ConversationDto,
    visitor: VisitorDto,
    onClick: () -> Unit
) {
    val ch = (conv.channel ?: visitor.resolvedChannel).lowercase()
    val chColor = getChannelBrandingColor(ch)
    val isUnassigned = conv.status == "Unassigned"

    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, if (isUnassigned) Color(0xFFDC2626).copy(alpha = 0.5f) else MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Avatar with bottom-right channel badge overlay
            Box(contentAlignment = Alignment.BottomEnd) {
                Surface(
                    color = Color(0xFFDC2626).copy(alpha = 0.15f),
                    shape = CircleShape,
                    modifier = Modifier.size(48.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = visitor.name.take(1).uppercase(),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFFDC2626)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .background(chColor, CircleShape)
                        .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                )
            }

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = visitor.name,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        if (isUnassigned) {
                            Surface(color = Color(0xFFDC2626), shape = RoundedCornerShape(6.dp)) {
                                Text(
                                    text = "NEW",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }

                    Text(
                        text = formatRelative(conv.updatedAt),
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "via ${ch.replaceFirstChar { it.uppercase() }}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = chColor
                    )
                    Text("•", fontSize = 10.sp, color = Color(0xFF94A3B8))
                    Text(
                        text = conv.lastMessage ?: (visitor.currentUrl?.let { "Browsing $it" } ?: "Active conversation"),
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
        }
    }
}

// MARK: - LEADS TAB CONTENT (Full LMS)
@Composable
fun LeadsTabContent(
    onOpenChat: (String, String, String) -> Unit
) {
    var leadsList by remember { mutableStateOf<List<LeadDto>>(emptyList()) }
    var leadStats by remember { mutableStateOf<LeadStatsDto?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var selectedStatus by remember { mutableStateOf("All") }
    var searchText by remember { mutableStateOf("") }
    var showCreateModal by remember { mutableStateOf(false) }
    var selectedLead by remember { mutableStateOf<LeadDto?>(null) }

    val coroutineScope = rememberCoroutineScope()
    val statuses = listOf("All", "New", "Contacted", "Qualified", "Proposal", "Won", "Lost")

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val fetched = NetworkClient.api.getLeads(NetworkClient.getAuthHeader())
            leadsList = fetched.leads
            leadStats = NetworkClient.api.getLeadStats(NetworkClient.getAuthHeader())
            isLoading = false
        } catch (e: Exception) {
            isLoading = false
        }
    }

    val filteredLeads = remember(leadsList, selectedStatus, searchText) {
        leadsList.filter { lead ->
            if (selectedStatus != "All" && lead.status != selectedStatus) return@filter false
            if (searchText.isNotEmpty()) {
                val q = searchText.lowercase()
                val matchName = lead.name.lowercase().contains(q)
                val matchCompany = (lead.company ?: "").lowercase().contains(q)
                if (!matchName && !matchCompany) return@filter false
            }
            true
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Lead Management",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Meta Ads, Chats & Inbound Opportunities",
                        fontSize = 13.sp,
                        color = Color(0xFF94A3B8)
                    )
                }

                Button(
                    onClick = { showCreateModal = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("New Lead", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Stat Carousel
        leadStats?.let { stats ->
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    item { LeadStatCard(title = "Total Leads", value = "${stats.totalLeads}", color = Color(0xFFDC2626)) }
                    item { LeadStatCard(title = "New Leads", value = "${stats.newLeads}", color = Color(0xFFF59E0B)) }
                    item { LeadStatCard(title = "Pipeline Value", value = "$${stats.totalPipelineValue.toInt()}", color = Color(0xFF10B981)) }
                    item { LeadStatCard(title = "Won Deals", value = "${stats.wonLeads}", color = Color(0xFF3B82F6)) }
                }
            }
        }

        // Search bar
        item {
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                placeholder = { Text("Search leads, companies...", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF94A3B8)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    focusedBorderColor = Color(0xFFDC2626),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                ),
                singleLine = true
            )
        }

        // Status Tabs
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(statuses) { st ->
                    Surface(
                        onClick = { selectedStatus = st },
                        color = if (selectedStatus == st) Color(0xFFDC2626) else MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (selectedStatus == st) Color.Transparent else MaterialTheme.colorScheme.outline)
                    ) {
                        Text(
                            text = st,
                            fontSize = 12.sp,
                            fontWeight = if (selectedStatus == st) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (selectedStatus == st) Color.White else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }

        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFFDC2626))
                }
            }
        } else if (filteredLeads.isEmpty()) {
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.PersonOutline, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(40.dp))
                    Text("No leads found", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        } else {
            items(filteredLeads) { lead ->
                LeadRowCard(lead = lead, onClick = { selectedLead = lead })
            }
        }
    }

    if (showCreateModal) {
        CreateLeadDialog(
            onDismiss = { showCreateModal = false },
            onCreated = { newLead ->
                leadsList = listOf(newLead) + leadsList
                showCreateModal = false
            }
        )
    }

    selectedLead?.let { lead ->
        LeadDetailDialog(
            lead = lead,
            onDismiss = { selectedLead = null },
            onUpdated = { updated ->
                leadsList = leadsList.map { if (it._id == updated._id) updated else it }
                selectedLead = updated
            }
        )
    }
}

@Composable
fun LeadStatCard(title: String, value: String, color: Color) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .width(130.dp)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF94A3B8))
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
fun LeadRowCard(lead: LeadDto, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(lead.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    if (!lead.company.isNullOrEmpty()) {
                        Text(lead.company, fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                }

                Surface(
                    color = getLeadStatusColor(lead.status).copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = lead.status,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = getLeadStatusColor(lead.status),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    color = getChannelBrandingColor(lead.source).copy(alpha = 0.1f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = lead.source.replaceFirstChar { it.uppercase() },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = getChannelBrandingColor(lead.source),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                lead.dealValue?.let { valAmt ->
                    if (valAmt > 0) {
                        Surface(
                            color = Color(0xFF10B981).copy(alpha = 0.1f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "$${valAmt.toInt()}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF10B981),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: - RADAR TAB CONTENT
@Composable
fun RadarTabContent(
    visitorsList: List<VisitorDto>,
    onOpenChat: (VisitorDto) -> Unit
) {
    val onlineVisitors = visitorsList.filter { it.isOnline }
    val offlineVisitors = visitorsList.filter { !it.isOnline }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column {
                Text("Live Visitor Radar", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)
                Text("Real-time browsing sessions & page tracking", fontSize = 13.sp, color = Color(0xFF94A3B8))
            }
        }

        if (visitorsList.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    Text("No active visitors online.", color = Color(0xFF94A3B8))
                }
            }
        } else {
            if (onlineVisitors.isNotEmpty()) {
                item {
                    Text("Active Online (${onlineVisitors.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                }
                items(onlineVisitors) { vis ->
                    VisitorCard(visitor = vis, onClick = { onOpenChat(vis) })
                }
            }

            if (offlineVisitors.isNotEmpty()) {
                item {
                    Text("Recent Sessions (${offlineVisitors.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8), modifier = Modifier.padding(top = 8.dp))
                }
                items(offlineVisitors) { vis ->
                    VisitorCard(visitor = vis, onClick = { onOpenChat(vis) })
                }
            }
        }
    }
}

@Composable
fun VisitorCard(visitor: VisitorDto, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(if (visitor.isOnline) Color(0xFF10B981) else Color(0xFF94A3B8), CircleShape)
            )

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(visitor.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text("📍 ${visitor.city}, ${visitor.country}", fontSize = 11.sp, color = Color(0xFF94A3B8))
                Text(visitor.currentUrl ?: "/", fontSize = 11.sp, color = Color(0xFFDC2626), maxLines = 1)
            }

            Icon(Icons.Default.Send, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(16.dp))
        }
    }
}

// MARK: - OVERVIEW TAB CONTENT
@Composable
fun OverviewTabContent(
    analytics: AnalyticsResponse?,
    onNavigateToTab: (Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column {
            Text("Workspace Overview", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)
            Text("Live traffic metrics and omni-channel activity", fontSize = 13.sp, color = Color(0xFF94A3B8))
        }

        analytics?.let { stats ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricBox(title = "Active Chats", value = "${stats.activeConversations}", color = Color(0xFFDC2626), modifier = Modifier.weight(1f))
                MetricBox(title = "Unassigned", value = "${stats.unassignedConversations}", color = Color(0xFFEF4444), modifier = Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricBox(title = "Live Visitors", value = "${stats.onlineVisitors}", color = Color(0xFF10B981), modifier = Modifier.weight(1f))
                MetricBox(title = "Total Chats", value = "${stats.totalChats}", color = Color(0xFF3B82F6), modifier = Modifier.weight(1f))
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = { onNavigateToTab(2) },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                modifier = Modifier.weight(1f).height(44.dp)
            ) {
                Text("Open Inbox", fontWeight = FontWeight.Bold)
            }

            OutlinedButton(
                onClick = { onNavigateToTab(3) },
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1f).height(44.dp)
            ) {
                Text("View Leads", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

@Composable
fun MetricBox(title: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF94A3B8))
            Text(value, fontSize = 24.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

// MARK: - TEAM TAB CONTENT
@Composable
fun TeamTabContent(agentsList: List<UserProfile>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Team & Agents", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)
        }
        items(agentsList) { agent ->
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(modifier = Modifier.size(10.dp).background(getStatusColor(agent.status), CircleShape))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(agent.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                        Text("${agent.email} • ${agent.role}", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                    Text(agent.status, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = getStatusColor(agent.status))
                }
            }
        }
    }
}

// MARK: - SETTINGS TAB CONTENT
@Composable
fun SettingsTabContent(
    isDark: Boolean,
    onThemeChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Workspace Settings", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface)

        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Theme Appearance", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = { onThemeChange("light") },
                        colors = ButtonDefaults.buttonColors(containerColor = if (!isDark) Color(0xFFDC2626) else MaterialTheme.colorScheme.background),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("☀️ Light Mode", color = if (!isDark) Color.White else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { onThemeChange("dark") },
                        colors = ButtonDefaults.buttonColors(containerColor = if (isDark) Color(0xFFDC2626) else MaterialTheme.colorScheme.background),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("🌙 Dark Mode", color = if (isDark) Color.White else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// MARK: - MODALS & DIALOGS
@Composable
fun PresenceDialog(
    currentStatus: String,
    onSelectStatus: (String) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Presence Status", fontWeight = FontWeight.Bold) },
        containerColor = MaterialTheme.colorScheme.surface,
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Online", "Away", "Offline").forEach { st ->
                    Surface(
                        onClick = { onSelectStatus(st) },
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.size(10.dp).background(getStatusColor(st), CircleShape))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(st, fontWeight = if (st == currentStatus) FontWeight.Bold else FontWeight.Normal, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))) {
                Text("Close")
            }
        }
    )
}

@Composable
fun CreateLeadDialog(
    onDismiss: () -> Unit,
    onCreated: (LeadDto) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var company by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("manual") }
    var status by remember { mutableStateOf("New") }
    var dealValue by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Lead Opportunity", fontWeight = FontWeight.Bold) },
        containerColor = MaterialTheme.colorScheme.surface,
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Customer Name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = company, onValueChange = { company = it }, label = { Text("Company") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = dealValue, onValueChange = { dealValue = it }, label = { Text("Deal Value ($)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.trim().isNotEmpty()) {
                        isLoading = true
                        coroutineScope.launch {
                            try {
                                val req = CreateLeadRequest(
                                    name = name.trim(),
                                    company = company.trim().takeIf { it.isNotEmpty() },
                                    email = email.trim().takeIf { it.isNotEmpty() },
                                    phone = phone.trim().takeIf { it.isNotEmpty() },
                                    source = source,
                                    status = status,
                                    dealValue = dealValue.toDoubleOrNull()
                                )
                                val res = NetworkClient.api.createLead(NetworkClient.getAuthHeader(), req)
                                onCreated(res)
                            } catch (e: Exception) {
                                isLoading = false
                            }
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                enabled = !isLoading
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Color(0xFF94A3B8)) }
        }
    )
}

@Composable
fun LeadDetailDialog(
    lead: LeadDto,
    onDismiss: () -> Unit,
    onUpdated: (LeadDto) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var currentStatus by remember { mutableStateOf(lead.status) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(lead.name, fontWeight = FontWeight.Bold) },
        containerColor = MaterialTheme.colorScheme.surface,
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!lead.company.isNullOrEmpty()) {
                    Text("Company: ${lead.company}", color = Color(0xFF94A3B8), fontSize = 13.sp)
                }
                Text("Source: ${lead.source}", fontSize = 13.sp)
                lead.dealValue?.let { Text("Deal Value: $$it", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981)) }
                
                Text("Pipeline Status:", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("New", "Qualified", "Won", "Lost").forEach { st ->
                        Surface(
                            onClick = {
                                currentStatus = st
                                coroutineScope.launch {
                                    try {
                                        val updated = NetworkClient.api.updateLead(
                                            NetworkClient.getAuthHeader(),
                                            lead._id,
                                            mapOf("status" to st)
                                        )
                                        onUpdated(updated)
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                }
                            },
                            color = if (currentStatus == st) Color(0xFFDC2626) else MaterialTheme.colorScheme.background,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(st, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (currentStatus == st) Color.White else MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))) {
                Text("Close")
            }
        }
    )
}

// Helpers
fun getStatusColor(status: String): Color {
    return when (status) {
        "Online" -> Color(0xFF10B981)
        "Away" -> Color(0xFFF59E0B)
        else -> Color(0xFF94A3B8)
    }
}

fun getLeadStatusColor(status: String): Color {
    return when (status) {
        "New" -> Color(0xFF3B82F6)
        "Contacted" -> Color(0xFFF59E0B)
        "Qualified" -> Color(0xFF8B5CF6)
        "Proposal" -> Color(0xFF6366F1)
        "Won" -> Color(0xFF10B981)
        "Lost" -> Color(0xFFEF4444)
        else -> Color(0xFFDC2626)
    }
}

fun getChannelBrandingColor(channel: String): Color {
    return when (channel.lowercase()) {
        "whatsapp" -> Color(0xFF25D366)
        "instagram" -> Color(0xFFE1306C)
        "facebook" -> Color(0xFF1877F2)
        "meta_ads", "meta ads" -> Color(0xFF0081FB)
        else -> Color(0xFFDC2626)
    }
}

fun formatRelative(iso: String): String {
    if (iso.isEmpty()) return ""
    return "now"
}
