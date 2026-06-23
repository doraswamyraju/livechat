package com.letstrack.agent.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
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
    initialTab: Int = 0,
    currentTheme: String,
    onThemeChange: (String) -> Unit,
    pendingVisitorIdNotification: String = "",
    onClearPendingVisitorNotification: () -> Unit = {},
    onNavigateToChat: (String, String, String, String?, String?, String?, String?, String?, String?) -> Unit,
    onSignOut: () -> Unit
) {
    val isAdmin = NetworkClient.currentUser?.role == "Admin"
    val settingsTabIndex = if (isAdmin) 4 else 3
    val teamTabIndex = if (isAdmin) 3 else -1

    var selectedTab by remember { mutableStateOf(initialTab) } // 0: Metrics, 1: Visitors, 2: Inbox, 3: Team (Admin), 4: Settings
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
                                isMuted = if (obj.has("isMuted")) obj.getBoolean("isMuted") else false
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

                // Self sync status
                aList.find { it.id == NetworkClient.currentUser?.id }?.let {
                    selfStatus = it.status
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 2. Real-time visitor connected
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
                isMuted = if (obj.has("isMuted")) obj.getBoolean("isMuted") else false
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
            NetworkClient.cachedAgents = agentsList
            if (aId == NetworkClient.currentUser?.id) {
                selfStatus = status
            }
        }

        // 7. Sync new visitor messages and queue updates
        socket.on("visitor-msg") { args ->
            try {
                val data = args[0] as JSONObject
                val convObj = data.getJSONObject("conversation")
                val visitorObj = data.getJSONObject("visitor")

                val visitor = VisitorDto(
                    _id = visitorObj.getString("_id"),
                    name = visitorObj.getString("name"),
                    email = if (visitorObj.has("email") && !visitorObj.isNull("email")) visitorObj.getString("email") else null,
                    phoneNumber = if (visitorObj.has("phoneNumber") && !visitorObj.isNull("phoneNumber")) visitorObj.getString("phoneNumber") else null,
                    country = visitorObj.getString("country"),
                    city = visitorObj.getString("city"),
                    deviceType = visitorObj.getString("deviceType"),
                    currentUrl = if (visitorObj.has("currentUrl") && !visitorObj.isNull("currentUrl")) visitorObj.getString("currentUrl") else null,
                    isOnline = visitorObj.getBoolean("isOnline")
                )

                val assignedId = if (convObj.has("assignedAgentId") && !convObj.isNull("assignedAgentId")) {
                    val agentObj = convObj.get("assignedAgentId")
                    if (agentObj is JSONObject) agentObj.getString("_id") else agentObj.toString()
                } else null

                val conversation = ConversationDto(
                    _id = convObj.getString("_id"),
                    visitorId = visitor._id,
                    status = convObj.getString("status"),
                    assignedAgentId = assignedId,
                    updatedAt = convObj.getString("updatedAt")
                )

                visitorsList = visitorsList.filter { it._id != visitor._id } + visitor
                conversationsList = conversationsList.filter { it._id != conversation._id } + conversation
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 8. Dynamic proactive conversation creation listener
        socket.on("conversation-created") { args ->
            try {
                val obj = args[0] as JSONObject
                val assignedId = if (obj.has("assignedAgentId") && !obj.isNull("assignedAgentId")) {
                    val agentObj = obj.get("assignedAgentId")
                    if (agentObj is JSONObject) agentObj.getString("_id") else agentObj.toString()
                } else null

                val newConv = ConversationDto(
                    _id = obj.getString("_id"),
                    visitorId = if (obj.get("visitorId") is JSONObject) obj.getJSONObject("visitorId").getString("_id") else obj.getString("visitorId"),
                    status = obj.getString("status"),
                    assignedAgentId = assignedId,
                    updatedAt = obj.getString("updatedAt")
                )
                conversationsList = conversationsList.filter { it._id != newConv._id } + newConv
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 9. Navigation to proactively initiated conversation on success
        socket.on("start-conversation-success") { args ->
            try {
                val dataObj = args[0] as JSONObject
                val obj = dataObj.getJSONObject("conversation")
                val assignedId = if (obj.has("assignedAgentId") && !obj.isNull("assignedAgentId")) {
                    val agentObj = obj.get("assignedAgentId")
                    if (agentObj is JSONObject) agentObj.getString("_id") else agentObj.toString()
                } else null

                val newConv = ConversationDto(
                    _id = obj.getString("_id"),
                    visitorId = if (obj.get("visitorId") is JSONObject) obj.getJSONObject("visitorId").getString("_id") else obj.getString("visitorId"),
                    status = obj.getString("status"),
                    assignedAgentId = assignedId,
                    updatedAt = obj.getString("updatedAt")
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
                        visitor.phoneNumber
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
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
            socket.off("visitor-msg")
            socket.off("conversation-created")
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
                    visitor?.phoneNumber
                )
                onClearPendingVisitorNotification()
            } else {
                if (visitorsList.isNotEmpty()) {
                    val data = JSONObject().put("visitorId", pendingVisitorIdNotification)
                    NetworkClient.getSocketInstance().emit("start-conversation", data)
                    onClearPendingVisitorNotification()
                }
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Logo",
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .border(1.dp, Color(0xFFDC2626), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = NetworkClient.currentTenant?.name ?: "LetsTrack console",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = if (isAdmin) "Administrator Workspace" else "Agent Workstation Console",
                                fontSize = 10.sp,
                                color = Color(0xFFEF4444) // Accent Red
                            )
                        }
                    }
                },
                actions = {
                    // Status badge button
                    Button(
                        onClick = { showStatusDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF1E1E1E),
                            contentColor = Color.White
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .border(1.dp, Color(0xFF262626), RoundedCornerShape(20.dp))
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
                        Icon(Icons.Default.ExitToApp, contentDescription = "Sign Out", tint = Color(0xFFDC2626))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF121212)
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF121212),
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Star, contentDescription = "Metrics") },
                    label = { Text("Metrics") },
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color(0xFFEF4444),
                        unselectedIconColor = Color.Gray,
                        unselectedTextColor = Color.Gray,
                        indicatorColor = Color(0xFFDC2626)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.LocationOn, contentDescription = "Traffic") },
                    label = { Text("Traffic") },
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color(0xFFEF4444),
                        unselectedIconColor = Color.Gray,
                        unselectedTextColor = Color.Gray,
                        indicatorColor = Color(0xFFDC2626)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Email, contentDescription = "Inbox") },
                    label = { Text("Inbox") },
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color(0xFFEF4444),
                        unselectedIconColor = Color.Gray,
                        unselectedTextColor = Color.Gray,
                        indicatorColor = Color(0xFFDC2626)
                    )
                )
                if (isAdmin) {
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Person, contentDescription = "Team") },
                        label = { Text("Team") },
                        selected = selectedTab == 3,
                        onClick = { selectedTab = 3 },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.White,
                            selectedTextColor = Color(0xFFEF4444),
                            unselectedIconColor = Color.Gray,
                            unselectedTextColor = Color.Gray,
                            indicatorColor = Color(0xFFDC2626)
                        )
                    )
                }
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") },
                    selected = selectedTab == settingsTabIndex,
                    onClick = { selectedTab = settingsTabIndex },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color(0xFFEF4444),
                        unselectedIconColor = Color.Gray,
                        unselectedTextColor = Color.Gray,
                        indicatorColor = Color(0xFFDC2626)
                    )
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.Black) // Premium solid black background
        ) {
            when (selectedTab) {
                0 -> MetricsTab(
                    onlineVisitorsCount = visitorsList.filter { it.isOnline }.size,
                    activeChatsCount = conversationsList.filter { it.status == "Active" }.size,
                    queueSizeCount = conversationsList.filter { it.status == "Unassigned" }.size,
                    agents = agentsList
                ) { tabIndex ->
                    selectedTab = tabIndex
                }
                1 -> TrafficTab(visitorsList) { visitor ->
                    val conv = conversationsList.find { it.visitorId == visitor._id }
                    if (conv != null) {
                        onNavigateToChat(
                            conv._id,
                            visitor.name,
                            visitor._id,
                            visitor.country,
                            visitor.city,
                            visitor.deviceType,
                            visitor.currentUrl,
                            visitor.email,
                            visitor.phoneNumber
                        )
                    } else {
                        // Proactively start conversation for this visitor
                        val data = JSONObject().put("visitorId", visitor._id)
                        NetworkClient.getSocketInstance().emit("start-conversation", data)
                    }
                }
                2 -> InboxTab(conversationsList, visitorsList) { conv ->
                    val visitor = visitorsList.find { it._id == conv.visitorId }
                    val visitorName = visitor?.name ?: "Visitor"
                    val visitorId = visitor?._id ?: conv.visitorId
                    onNavigateToChat(
                        conv._id,
                        visitorName,
                        visitorId,
                        visitor?.country,
                        visitor?.city,
                        visitor?.deviceType,
                        visitor?.currentUrl,
                        visitor?.email,
                        visitor?.phoneNumber
                    )
                }
                3 -> {
                    if (isAdmin) {
                        TeamTab(
                            agents = agentsList,
                            onAgentAdded = { newAgent ->
                                agentsList = agentsList + newAgent
                                NetworkClient.cachedAgents = agentsList
                            }
                        )
                    } else {
                        SettingsTab(
                            currentTheme = currentTheme,
                            onThemeChange = onThemeChange
                        )
                    }
                }
                4 -> {
                    if (isAdmin) {
                        SettingsTab(
                            currentTheme = currentTheme,
                            onThemeChange = onThemeChange
                        )
                    }
                }
            }
        }

        // Status Changer Dialog
        if (showStatusDialog) {
            AlertDialog(
                onDismissRequest = { showStatusDialog = false },
                title = { Text("Update Live Presence Status", color = Color.White) },
                containerColor = Color(0xFF121212),
                modifier = Modifier.border(1.dp, Color(0xFF262626), RoundedCornerShape(28.dp)),
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
                    TextButton(onClick = { showStatusDialog = false }) { Text("Dismiss", color = Color(0xFFDC2626)) }
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
            color = if (status == current) Color(0xFFDC2626) else Color.White
        )
        if (status == current) {
            Spacer(modifier = Modifier.weight(1f))
            Icon(Icons.Default.Check, contentDescription = "Selected", tint = Color(0xFFDC2626))
        }
    }
}

// ------------------------------------------
// METRICS TAB
// ------------------------------------------
@Composable
fun MetricsTab(
    onlineVisitorsCount: Int,
    activeChatsCount: Int,
    queueSizeCount: Int,
    agents: List<UserProfile>,
    onTabSelect: (Int) -> Unit
) {
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
                    value = onlineVisitorsCount.toString(),
                    color1 = Color(0xFFDC2626),
                    color2 = Color(0xFF450A0A),
                    onClick = { onTabSelect(1) }
                )
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Active Chats",
                    value = activeChatsCount.toString(),
                    color1 = Color(0xFFDC2626),
                    color2 = Color(0xFF450A0A),
                    onClick = { onTabSelect(2) }
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
                    value = queueSizeCount.toString(),
                    color1 = Color(0xFFDC2626),
                    color2 = Color(0xFF450A0A),
                    onClick = { onTabSelect(2) }
                )
                MetricItemCard(
                    modifier = Modifier.weight(1f),
                    title = "Total Staff",
                    value = agents.size.toString(),
                    color1 = Color(0xFFDC2626),
                    color2 = Color(0xFF450A0A),
                    onClick = {}
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text("Active Employees Status", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        items(agents) { agent ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.border(1.dp, Color(0xFF262626), RoundedCornerShape(10.dp))
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
                            .background(Color(0xFF262626)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(agent.name[0].toString(), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(agent.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(agent.role, color = Color(0xFFEF4444), fontSize = 11.sp)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.Black)
                            .border(1.dp, Color(0xFF262626), RoundedCornerShape(6.dp))
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
    color2: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
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
    val onlineVisitors = visitors.filter { it.isOnline }
    val offlineVisitors = visitors.filter { !it.isOnline }

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

        if (onlineVisitors.isNotEmpty()) {
            item {
                Text(
                    text = "Active Online Visitors (${onlineVisitors.size})",
                    color = Color(0xFF10B981),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                )
            }
            items(onlineVisitors) { visitor ->
                VisitorCard(visitor, onOpenChat)
            }
        }

        if (offlineVisitors.isNotEmpty()) {
            item {
                Text(
                    text = "Offline / Inactive Sessions (${offlineVisitors.size})",
                    color = Color(0xFF94A3B8),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                )
            }
            items(offlineVisitors) { visitor ->
                VisitorCard(visitor, onOpenChat)
            }
        }
    }
}

@Composable
fun VisitorCard(visitor: VisitorDto, onOpenChat: (VisitorDto) -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .clickable { onOpenChat(visitor) }
            .border(1.dp, Color(0xFF262626), RoundedCornerShape(12.dp))
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
                    color = Color(0xFFEF4444),
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            IconButton(onClick = { onOpenChat(visitor) }) {
                Icon(Icons.Default.Send, contentDescription = "Open Chat", tint = Color(0xFFDC2626))
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
    // Sort conversations descending by updatedAt to ensure latest chat/visitor shows on top
    val sortedConversations = conversations.sortedByDescending { it.updatedAt }
    
    val unassignedChats = sortedConversations.filter { it.status == "Unassigned" }
    val activeChats = sortedConversations.filter { it.status == "Active" }

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

        if (activeChats.isNotEmpty()) {
            item {
                Text(
                    text = "Active Chats In Progress (${activeChats.size})",
                    color = Color(0xFF10B981),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                )
            }
            items(activeChats) { conv ->
                ConversationCard(conv, visitors, onSelectChat)
            }
        }

        if (unassignedChats.isNotEmpty()) {
            item {
                Text(
                    text = "Pending Unassigned Queue (${unassignedChats.size})",
                    color = Color(0xFFEF4444),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                )
            }
            items(unassignedChats) { conv ->
                ConversationCard(conv, visitors, onSelectChat)
            }
        }
    }
}

@Composable
fun ConversationCard(
    conv: ConversationDto,
    visitors: List<VisitorDto>,
    onSelectChat: (ConversationDto) -> Unit
) {
    val visitor = visitors.find { it._id == conv.visitorId }
    val visitorName = visitor?.name ?: "VisitorSession"
    val isUnassigned = conv.status == "Unassigned"

    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isUnassigned) Color(0xFF2B0707) else Color(0xFF121212)
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .clickable { onSelectChat(conv) }
            .border(1.dp, if (isUnassigned) Color(0xFF7F1D1D) else Color(0xFF262626), RoundedCornerShape(12.dp))
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
                    .background(if (isUnassigned) Color(0xFFDC2626) else Color(0xFF262626)),
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
                    color = if (isUnassigned) Color(0xFFEF4444) else Color(0xFF94A3B8),
                    fontSize = 11.sp
                )
            }
            Icon(
                Icons.Default.PlayArrow,
                contentDescription = "Arrow",
                tint = if (isUnassigned) Color(0xFFEF4444) else Color.Gray
            )
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

// ------------------------------------------
// TEAM TAB
// ------------------------------------------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeamTab(
    agents: List<UserProfile>,
    onAgentAdded: (UserProfile) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var showAddDialog by remember { mutableStateOf(false) }

    var newName by remember { mutableStateOf("") }
    var newEmail by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("") }
    var isSuccess by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
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
                        Text("Operational Staff Team", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("Real-time organization registry", color = Color.Gray, fontSize = 12.sp)
                    }
                    Button(
                        onClick = {
                            newName = ""
                            newEmail = ""
                            newPassword = ""
                            statusMessage = ""
                            isSuccess = false
                            showAddDialog = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("+ Add Agent", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }

            if (agents.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                        Text("No team members registered yet.", color = Color(0xFF94A3B8), fontSize = 14.sp)
                    }
                }
            }

            items(agents) { agent ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.border(1.dp, Color(0xFF262626), RoundedCornerShape(10.dp))
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
                                .background(Color(0xFF262626)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(agent.name.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(agent.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(agent.email, color = Color.Gray, fontSize = 11.sp)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = agent.role,
                                color = if (agent.role == "Admin") Color(0xFFEF4444) else Color(0xFF64748B),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color.Black)
                                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(6.dp))
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

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { if (!isLoading) showAddDialog = false },
                title = { Text("Register New Organization Agent", color = Color.White, fontWeight = FontWeight.Bold) },
                containerColor = Color(0xFF121212),
                modifier = Modifier.border(1.dp, Color(0xFF262626), RoundedCornerShape(28.dp)),
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Provide account details to generate a new live chat employee console profile.",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )

                        OutlinedTextField(
                            value = newName,
                            onValueChange = { newName = it },
                            label = { Text("Agent Display Name") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF262626),
                                focusedLabelColor = Color(0xFFDC2626)
                            ),
                            singleLine = true,
                            enabled = !isLoading && !isSuccess
                        )

                        OutlinedTextField(
                            value = newEmail,
                            onValueChange = { newEmail = it },
                            label = { Text("Email Address") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF262626),
                                focusedLabelColor = Color(0xFFDC2626)
                            ),
                            singleLine = true,
                            enabled = !isLoading && !isSuccess
                        )

                        OutlinedTextField(
                            value = newPassword,
                            onValueChange = { newPassword = it },
                            label = { Text("Password credential") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF262626),
                                focusedLabelColor = Color(0xFFDC2626)
                            ),
                            singleLine = true,
                            enabled = !isLoading && !isSuccess
                        )

                        if (statusMessage.isNotEmpty()) {
                            Text(
                                text = statusMessage,
                                color = if (isSuccess) Color(0xFF10B981) else Color(0xFFEF4444),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                },
                confirmButton = {
                    if (isSuccess) {
                        Button(
                            onClick = { showAddDialog = false },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                        ) {
                            Text("Done")
                        }
                    } else {
                        Button(
                            onClick = {
                                if (newName.trim().isEmpty() || newEmail.trim().isEmpty() || newPassword.trim().isEmpty()) {
                                    statusMessage = "All fields are required."
                                    return@Button
                                }
                                isLoading = true
                                statusMessage = ""
                                coroutineScope.launch {
                                    try {
                                        val req = RegisterAgentRequest(newName.trim(), newEmail.trim(), newPassword.trim())
                                        val res = NetworkClient.api.registerAgent(NetworkClient.getAuthHeader(), req)
                                        isSuccess = true
                                        statusMessage = "Agent successfully registered!"
                                        onAgentAdded(res.agent)
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        statusMessage = "Registration failed. Email might already exist."
                                    } finally {
                                        isLoading = false
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            enabled = !isLoading
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                            } else {
                                Text("Register")
                            }
                        }
                    }
                },
                dismissButton = {
                    if (!isSuccess) {
                        TextButton(
                            onClick = { showAddDialog = false },
                            enabled = !isLoading
                        ) {
                            Text("Cancel", color = Color.Gray)
                        }
                    }
                }
            )
        }
    }
}

// ------------------------------------------
// SETTINGS TAB
// ------------------------------------------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsTab(
    currentTheme: String,
    onThemeChange: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var nameInput by remember { mutableStateOf(NetworkClient.currentUser?.name ?: "") }
    var passwordInput by remember { mutableStateOf("") }
    var emailReadonly by remember { mutableStateOf(NetworkClient.currentUser?.email ?: "") }

    var isLoading by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("") }
    var isSuccess by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Console Workspace Settings", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Customize preferences and manage your employee profile", color = Color.Gray, fontSize = 12.sp)
        }

        // 1. Theme Configuration Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Workspace Theme Selection", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Toggle dynamic palette presets for the mobile interface", color = Color.Gray, fontSize = 11.sp)
                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { onThemeChange("dark") },
                            modifier = Modifier
                                .weight(1f)
                                .border(
                                    1.dp,
                                    if (currentTheme == "dark") Color(0xFFDC2626) else Color.Transparent,
                                    RoundedCornerShape(8.dp)
                                ),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (currentTheme == "dark") Color(0xFF2B0707) else Color(0xFF1E1E1E),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("🎬 Dark Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { onThemeChange("light") },
                            modifier = Modifier
                                .weight(1f)
                                .border(
                                    1.dp,
                                    if (currentTheme == "light") Color(0xFFDC2626) else Color.Transparent,
                                    RoundedCornerShape(8.dp)
                                ),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (currentTheme == "light") Color(0xFFE2E8F0) else Color(0xFF1E1E1E),
                                contentColor = if (currentTheme == "light") Color.Black else Color.White
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("☀️ Light Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // 2. Profile Details Form
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF121212)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF262626), RoundedCornerShape(12.dp))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Employee Profile Configuration", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text("Update login credentials and console details.", color = Color.Gray, fontSize = 11.sp)
                    HorizontalDivider(color = Color(0xFF262626), thickness = 1.dp)

                    // Email (Disabled)
                    OutlinedTextField(
                        value = emailReadonly,
                        onValueChange = {},
                        label = { Text("Registered Email (Read-only)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.Gray,
                            unfocusedTextColor = Color.Gray,
                            disabledBorderColor = Color(0xFF262626),
                            disabledLabelColor = Color.Gray
                        ),
                        singleLine = true,
                        enabled = false
                    )

                    // Full Name
                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it },
                        label = { Text("Display Name") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFDC2626),
                            unfocusedBorderColor = Color(0xFF262626),
                            focusedLabelColor = Color(0xFFDC2626)
                        ),
                        singleLine = true,
                        enabled = !isLoading
                    )

                    // Password update (optional)
                    OutlinedTextField(
                        value = passwordInput,
                        onValueChange = { passwordInput = it },
                        label = { Text("Change Password (Leave blank to keep current)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFDC2626),
                            unfocusedBorderColor = Color(0xFF262626),
                            focusedLabelColor = Color(0xFFDC2626)
                        ),
                        singleLine = true,
                        enabled = !isLoading
                    )

                    if (statusMessage.isNotEmpty()) {
                        Text(
                            text = statusMessage,
                            color = if (isSuccess) Color(0xFF10B981) else Color(0xFFEF4444),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }

                    // Save Button
                    Button(
                        onClick = {
                            if (nameInput.trim().isEmpty()) {
                                statusMessage = "Name cannot be empty."
                                isSuccess = false
                                return@Button
                            }
                            isLoading = true
                            statusMessage = ""
                            isSuccess = false

                            coroutineScope.launch {
                                try {
                                    val req = UpdateProfileRequest(
                                        name = nameInput.trim(),
                                        avatarUrl = null,
                                        password = if (passwordInput.isNotEmpty()) passwordInput.trim() else null
                                    )
                                    val updatedUser = NetworkClient.api.updateProfile(NetworkClient.getAuthHeader(), req)
                                    NetworkClient.currentUser = updatedUser

                                    // Save changes locally in persistent SharedPreferences
                                    val prefs = context.getSharedPreferences("letstrack_prefs", android.content.Context.MODE_PRIVATE)
                                    val gson = com.google.gson.Gson()
                                    prefs.edit()
                                        .putString("user_profile", gson.toJson(updatedUser))
                                        .apply()

                                    isSuccess = true
                                    statusMessage = "Profile updated successfully!"
                                    passwordInput = ""
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                    statusMessage = "Profile update failed. Try again."
                                    isSuccess = false
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        enabled = !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                        } else {
                            Text("Save Configurations", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
