import { Server } from 'socket.io';
import { Visitor, Conversation, Message, User, Tenant } from './models.js';
import { sendPushNotification } from './firebase.js';

// Simple mock Geo-IP lookup resolver for premium analytics
const mockGeoIP = (ip) => {
  const locations = [
    { country: 'United States', city: 'New York' },
    { country: 'Germany', city: 'Berlin' },
    { country: 'Japan', city: 'Tokyo' },
    { country: 'United Kingdom', city: 'London' },
    { country: 'India', city: 'Mumbai' },
    { country: 'France', city: 'Paris' },
    { country: 'Canada', city: 'Toronto' },
    { country: 'Australia', city: 'Sydney' }
  ];
  // Stable random selection based on IP characters
  let index = 0;
  if (ip && typeof ip === 'string') {
    let sum = 0;
    for (let i = 0; i < ip.length; i++) {
      sum += ip.charCodeAt(i);
    }
    index = sum % locations.length;
  } else {
    index = Math.floor(Math.random() * locations.length);
  }
  return locations[index];
};

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow connections from any host app
      methods: ['GET', 'POST']
    }
  });

  const visitorNamespace = io.of('/visitor');
  const dashboardNamespace = io.of('/dashboard');

  // Track active visitor socket connections to handle multi-tabbing or abrupt disconnect grace periods
  const activeVisitorSockets = new Map(); // visitorId -> socketId
  const disconnectTimers = new Map(); // visitorId -> Timeout ID

  // ============================================
  // VISITOR NAMESPACE (Widget Communication)
  // ============================================
  visitorNamespace.on('connection', (socket) => {
    let currentVisitorId = null;
    let currentTenantId = null;

    socket.on('visitor-init', async (data) => {
      const { apiKey, visitorId, currentUrl, referrer, name, email, phoneNumber, browser, os, deviceType } = data;
      
      try {
        // 1. Verify Tenant API Key
        const tenant = await Tenant.findOne({ apiKey });
        if (!tenant) {
          socket.emit('error-msg', { message: 'Invalid API Key' });
          return socket.disconnect();
        }

        currentVisitorId = visitorId;
        currentTenantId = tenant._id.toString();

        // Check if there is an active disconnect timer and clear it (seamless page transitions/refreshes)
        if (disconnectTimers.has(currentVisitorId)) {
          clearTimeout(disconnectTimers.get(currentVisitorId));
          disconnectTimers.delete(currentVisitorId);
        }

        // Put visitor in a dedicated socket room
        socket.join(`visitor_${currentVisitorId}`);
        activeVisitorSockets.set(currentVisitorId, socket.id);

        // Resolve location info using mockGeoIP
        let ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.headers['x-real-ip'] || socket.handshake.address || '127.0.0.1';
        if (ip && ip.includes(',')) {
          ip = ip.split(',')[0].trim();
        }
        const geo = mockGeoIP(ip);

        // 2. Find or Create Visitor
        let visitor = await Visitor.findById(currentVisitorId);
        const isNewVisitor = !visitor;
        const wasOffline = !visitor || !visitor.isOnline;
        const oldUrl = visitor ? visitor.currentUrl : '';
        if (!visitor) {
          visitor = new Visitor({
            _id: currentVisitorId,
            tenantId: currentTenantId,
            name: name || `Visitor #${Math.floor(1000 + Math.random() * 9000)}`,
            email: email || '',
            phoneNumber: phoneNumber || '',
            ipAddress: ip,
            country: geo.country,
            city: geo.city,
            deviceType: deviceType || 'Desktop',
            browser: browser || 'Chrome',
            os: os || 'Windows',
            currentUrl: currentUrl || '',
            referrer: referrer || 'Direct',
            isOnline: true,
            firstSeen: new Date(),
            lastSeen: new Date()
          });
        } else {
          visitor.isOnline = true;
          visitor.currentUrl = currentUrl || visitor.currentUrl;
          visitor.lastSeen = new Date();
          if (name) visitor.name = name;
          if (email) visitor.email = email;
          if (phoneNumber) visitor.phoneNumber = phoneNumber;
        }
        await visitor.save();

        // Send FCM push notification for visitor online to all agents
        if (wasOffline) {
          try {
            const staffList = await User.find({ tenantId: currentTenantId });
            for (const staff of staffList) {
              if (staff.fcmToken) {
                await sendPushNotification(
                  staff.fcmToken,
                  isNewVisitor ? "New Visitor Online!" : "Visitor Returned Online!",
                  `${visitor.name} has just landed on your website.`,
                  { type: "new-visitor", visitorId: currentVisitorId }
                );
              }
            }
          } catch (err) {
            console.error('Error dispatching visitor push notification:', err);
          }
        }

        // 3. Notify Agents on the Dashboard
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-connected', visitor);

        if (!wasOffline && oldUrl !== visitor.currentUrl) {
          dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-navigated', {
            visitorId: currentVisitorId,
            currentUrl: visitor.currentUrl
          });

          // Also save system message for navigation in active conversation
          const activeConv = await Conversation.findOne({
            tenantId: currentTenantId,
            visitorId: currentVisitorId,
            status: { $in: ['Unassigned', 'Active'] }
          });
          if (activeConv) {
            const systemMsg = new Message({
              conversationId: activeConv._id,
              senderType: 'System',
              senderId: 'SYSTEM',
              senderName: 'System',
              text: `Visitor navigated to ${visitor.currentUrl}`,
              timestamp: new Date()
            });
            await systemMsg.save();

            dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-msg-received', {
              conversationId: activeConv._id,
              message: systemMsg
            });
          }
        }

        // Send confirmation back to visitor
        socket.emit('visitor-init-success', { visitorId: currentVisitorId, name: visitor.name });

        // Retrieve message history if conversation already exists
        const conversation = await Conversation.findOne({
          tenantId: currentTenantId,
          visitorId: currentVisitorId
        });
        if (conversation) {
          const messages = await Message.find({
            conversationId: conversation._id,
            $or: [
              { senderType: { $ne: 'System' } },
              { text: { $not: /^Visitor navigated to/ } }
            ]
          }).sort({ timestamp: 1 });
          socket.emit('chat-history', {
            conversationId: conversation._id,
            status: conversation.status,
            assignedAgentId: conversation.assignedAgentId,
            messages
          });
        }

      } catch (err) {
        console.error('Error in visitor-init:', err);
      }
    });

    // Handle Visitor Page Navigation
    socket.on('page-view', async (data) => {
      const { currentUrl } = data;
      if (!currentVisitorId || !currentTenantId) return;

      try {
        const visitor = await Visitor.findById(currentVisitorId);
        if (visitor) {
          visitor.currentUrl = currentUrl;
          visitor.lastSeen = new Date();
          await visitor.save();
        }

        // Broadcast navigating event to Dashboard
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-navigated', {
          visitorId: currentVisitorId,
          currentUrl
        });

        // Also add system log message into the active conversation feed
        const conversation = await Conversation.findOne({
          tenantId: currentTenantId,
          visitorId: currentVisitorId,
          status: { $in: ['Unassigned', 'Active'] }
        });
        if (conversation) {
          const systemMsg = new Message({
            conversationId: conversation._id,
            senderType: 'System',
            senderId: 'SYSTEM',
            senderName: 'System',
            text: `Visitor navigated to ${currentUrl}`,
            timestamp: new Date()
          });
          await systemMsg.save();

          dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-msg-received', {
            conversationId: conversation._id,
            message: systemMsg
          });
        }
      } catch (err) {
        console.error('Error in page-view:', err);
      }
    });

    // Handle Visitor Message
    socket.on('visitor-msg', async (data) => {
      const { text } = data;
      if (!currentVisitorId || !currentTenantId) return;

      try {
        // 1. Get or Create active conversation
        let conversation = await Conversation.findOne({
          tenantId: currentTenantId,
          visitorId: currentVisitorId,
          status: { $in: ['Unassigned', 'Active'] }
        });

        if (!conversation) {
          conversation = new Conversation({
            tenantId: currentTenantId,
            visitorId: currentVisitorId,
            status: 'Unassigned',
            assignedAgentId: null
          });
          await conversation.save();
        }

        const visitor = await Visitor.findById(currentVisitorId);

        // 2. Save Message
        const message = new Message({
          conversationId: conversation._id,
          senderType: 'Visitor',
          senderId: currentVisitorId,
          senderName: visitor ? visitor.name : 'Visitor',
          text,
          timestamp: new Date()
        });
        await message.save();

        // 3. Update Conversation updatedAt
        conversation.updatedAt = new Date();
        await conversation.save();

        // 4. Emit to visitor room
        visitorNamespace.to(`visitor_${currentVisitorId}`).emit('msg-received', message);

        // 5. Emit to Dashboard agents room
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-msg', {
          conversation,
          message,
          visitor
        });

        // 6. Dispatch Real-Time Push Notifications via FCM
        try {
          const visitorName = visitor ? visitor.name : 'Visitor';
          if (conversation.assignedAgentId) {
            // Case A: Send private alert to the specific assigned agent
            const agent = await User.findById(conversation.assignedAgentId);
            if (agent && agent.fcmToken) {
              await sendPushNotification(
                agent.fcmToken,
                `Message from ${visitorName}`,
                text,
                { conversationId: conversation._id.toString(), visitorName }
              );
            }
          } else {
            // Case B: Send broadcast alert to all team members about unassigned queue
            const staffList = await User.find({ tenantId: currentTenantId });
            for (const staff of staffList) {
              if (staff.fcmToken) {
                await sendPushNotification(
                  staff.fcmToken,
                  `New Chat Request!`,
                  `${visitorName} started a live chat.`,
                  { conversationId: conversation._id.toString(), visitorName }
                );
              }
            }
          }
        } catch (err) {
          console.error('Error dispatching push notifications:', err);
        }

      } catch (err) {
        console.error('Error in visitor-msg:', err);
      }
    });

    // Handle Visitor Typing Indicator
    socket.on('visitor-typing', (data) => {
      const { isTyping } = data;
      if (!currentVisitorId || !currentTenantId) return;
      dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-typing', {
        visitorId: currentVisitorId,
        isTyping
      });
    });

    // Handle Visitor Disconnection with graceful page transition timer
    socket.on('disconnect', () => {
      if (!currentVisitorId || !currentTenantId) return;

      activeVisitorSockets.delete(currentVisitorId);

      // Start 5 second disconnect grace period
      const timer = setTimeout(async () => {
        try {
          // If the visitor hasn't reconnected during this period, mark offline
          if (!activeVisitorSockets.has(currentVisitorId)) {
            const visitor = await Visitor.findById(currentVisitorId);
            if (visitor) {
              visitor.isOnline = false;
              await visitor.save();
            }
            dashboardNamespace.to(`tenant_${currentTenantId}`).emit('visitor-disconnected', { visitorId: currentVisitorId });
          }
          disconnectTimers.delete(currentVisitorId);
        } catch (err) {
          console.error('Error handling visitor disconnect timer:', err);
        }
      }, 5000);

      disconnectTimers.set(currentVisitorId, timer);
    });
  });

  // ============================================
  // DASHBOARD NAMESPACE (Agent Communication)
  // ============================================
  dashboardNamespace.on('connection', (socket) => {
    let currentAgentId = null;
    let currentTenantId = null;

    socket.on('agent-init', async (data) => {
      const { tenantId, agentId } = data;
      currentAgentId = agentId;
      currentTenantId = tenantId;

      try {
        socket.join(`tenant_${currentTenantId}`);
        socket.join(`agent_${currentAgentId}`);

        // Update Agent status in database
        const agent = await User.findById(currentAgentId);
        if (agent) {
          agent.status = 'Online';
          await agent.save();
        }

        // Notify other agents that this employee is online
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-status-changed', {
          agentId: currentAgentId,
          status: 'Online'
        });

        // Send full active lists (visitors + conversations + agents) to this newly logged in agent
        const visitors = await Visitor.find({ tenantId: currentTenantId });
        const conversations = await Conversation.find({ tenantId: currentTenantId, status: { $ne: 'Closed' } }).populate('assignedAgentId', 'name email avatarUrl status');
        const agents = await User.find({ tenantId: currentTenantId }).select('-passwordHash');

        socket.emit('dashboard-sync', { visitors, conversations, agents });

      } catch (err) {
        console.error('Error in agent-init:', err);
      }
    });

    // Handle Agent Status Change (Away, Online, Offline)
    socket.on('agent-status-update', async (data) => {
      const { status } = data;
      if (!currentAgentId || !currentTenantId) return;

      try {
        const agent = await User.findById(currentAgentId);
        if (agent) {
          agent.status = status;
          await agent.save();
        }
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-status-changed', {
          agentId: currentAgentId,
          status
        });
      } catch (err) {
        console.error('Error in agent-status-update:', err);
      }
    });

    // Handle Agent Sending Message to Visitor
    socket.on('agent-msg', async (data) => {
      const { conversationId, text, visitorId } = data;
      if (!currentAgentId || !currentTenantId) return;

      try {
        const agent = await User.findById(currentAgentId);
        if (!agent) return;

        // Save Message
        const message = new Message({
          conversationId,
          senderType: 'Agent',
          senderId: currentAgentId,
          senderName: agent.name,
          text,
          timestamp: new Date()
        });
        await message.save();

        // Update Conversation
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          conv.status = 'Active';
          conv.updatedAt = new Date();
          await conv.save();
        }

        // Broadcast to visitor
        visitorNamespace.to(`visitor_${visitorId}`).emit('msg-received', message);

        // Broadcast to all dashboard agents in tenant
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-msg-received', {
          conversationId,
          message
        });

      } catch (err) {
        console.error('Error in agent-msg:', err);
      }
    });

    // Handle Agent Assigning/Reassigning Chat to Employee
    socket.on('assign-chat', async (data) => {
      const { conversationId, assignedAgentId } = data; // If assignedAgentId is null, it unassigns
      if (!currentAgentId || !currentTenantId) return;

      try {
        let agentName = 'Unassigned';
        if (assignedAgentId) {
          const targetAgent = await User.findById(assignedAgentId);
          if (targetAgent) {
            agentName = targetAgent.name;
          }
        }

        const prevConv = await Conversation.findById(conversationId);
        if (!prevConv) return;

        // Update DB
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          conv.assignedAgentId = assignedAgentId;
          conv.status = assignedAgentId ? 'Active' : 'Unassigned';
          conv.updatedAt = new Date();
          await conv.save();
        }
        const updatedConversation = await Conversation.findById(conversationId).populate('assignedAgentId', 'name email avatarUrl status');

        // Create System Message log
        const systemMessage = new Message({
          conversationId,
          senderType: 'System',
          senderId: 'SYSTEM',
          senderName: 'System',
          text: assignedAgentId 
            ? `Conversation assigned to ${agentName}` 
            : `Conversation returned to general unassigned queue`,
          timestamp: new Date()
        });
        await systemMessage.save();

        // Broadcast update to visitor's widget (so they see the system log)
        visitorNamespace.to(`visitor_${prevConv.visitorId}`).emit('msg-received', systemMessage);
        visitorNamespace.to(`visitor_${prevConv.visitorId}`).emit('chat-assigned', {
          conversationId,
          assignedAgentId,
          agentName
        });

        // Broadcast update to all dashboard agents
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('chat-assigned-update', {
          conversation: updatedConversation,
          systemMessage
        });

      } catch (err) {
        console.error('Error in assign-chat:', err);
      }
    });

     // Handle Agent Typing Indicator
     socket.on('agent-typing', (data) => {
       const { visitorId, isTyping } = data;
       if (!currentAgentId || !currentTenantId) return;
 
       visitorNamespace.to(`visitor_${visitorId}`).emit('agent-typing', { isTyping });
     });

     // Handle Agent Proactively Starting/Finding Conversations
     socket.on('start-conversation', async (data) => {
       const { visitorId } = data;
       if (!currentAgentId || !currentTenantId) return;

       try {
         let conversation = await Conversation.findOne({
           tenantId: currentTenantId,
           visitorId,
           status: { $in: ['Unassigned', 'Active'] }
         }).populate('assignedAgentId', 'name email avatarUrl status');

         if (!conversation) {
           conversation = new Conversation({
             tenantId: currentTenantId,
             visitorId,
             status: 'Unassigned',
             assignedAgentId: null
           });
           await conversation.save();

           conversation = await Conversation.findById(conversation._id).populate('assignedAgentId', 'name email avatarUrl status');

           // Broadcast newly created conversation to all agents
           dashboardNamespace.to(`tenant_${currentTenantId}`).emit('conversation-created', conversation);
         }

         socket.emit('start-conversation-success', { conversation });

       } catch (err) {
         console.error('Error in start-conversation:', err);
       }
     });

    socket.on('disconnect', async () => {
      if (!currentAgentId || !currentTenantId) return;

      try {
        // Optional: wait a moment or mark offline immediately. For simplicity we mark Offline.
        const agent = await User.findById(currentAgentId);
        if (agent) {
          agent.status = 'Offline';
          await agent.save();
        }
        dashboardNamespace.to(`tenant_${currentTenantId}`).emit('agent-status-changed', {
          agentId: currentAgentId,
          status: 'Offline'
        });
      } catch (err) {
        console.error('Error in agent disconnect:', err);
      }
    });
  });
};
