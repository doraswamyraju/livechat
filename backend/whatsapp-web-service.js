import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import { Visitor, Conversation, Message, Integration } from './models.js';
import { dashboardNamespace } from './socket.js';

// Map to store runtime WhatsApp Web client instances: tenantId -> ClientData
// ClientData: { client, status: 'DISCONNECTED'|'INITIALIZING'|'QR_READY'|'CONNECTED'|'AUTH_FAILURE', qr: null|string }
const whatsappClients = new Map();

/**
 * Initializes a WhatsApp Web client for a specific tenant
 */
export async function initializeWhatsAppClient(tenantId) {
  const tId = tenantId.toString();

  // If client already exists, return it
  if (whatsappClients.has(tId)) {
    const existing = whatsappClients.get(tId);
    if (existing.status !== 'DISCONNECTED' && existing.status !== 'AUTH_FAILURE') {
      return existing;
    }
    // Clean up if it was disconnected
    try {
      await existing.client.destroy();
    } catch (e) {}
    whatsappClients.delete(tId);
  }

  const clientData = {
    client: null,
    status: 'INITIALIZING',
    qr: null
  };

  whatsappClients.set(tId, clientData);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `tenant_${tId}`
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  clientData.client = client;

  client.on('qr', async (qr) => {
    try {
      const qrDataUri = await qrcode.toDataURL(qr);
      clientData.status = 'QR_READY';
      clientData.qr = qrDataUri;
      
      // Notify dashboard agents about the new QR code
      if (dashboardNamespace) {
        dashboardNamespace.to(`tenant_${tId}`).emit('whatsapp-web-status', {
          status: 'QR_READY',
          qr: qrDataUri
        });
      }
    } catch (err) {
      console.error(`Error generating QR data URL for tenant ${tId}:`, err);
    }
  });

  client.on('ready', () => {
    clientData.status = 'CONNECTED';
    clientData.qr = null;
    console.log(`WhatsApp Web client is ready for tenant ${tId}`);

    if (dashboardNamespace) {
      dashboardNamespace.to(`tenant_${tId}`).emit('whatsapp-web-status', {
        status: 'CONNECTED',
        qr: null
      });
    }
  });

  client.on('authenticated', () => {
    console.log(`WhatsApp Web client authenticated for tenant ${tId}`);
  });

  client.on('auth_failure', (msg) => {
    console.error(`WhatsApp Web auth failure for tenant ${tId}:`, msg);
    clientData.status = 'AUTH_FAILURE';
    clientData.qr = null;

    if (dashboardNamespace) {
      dashboardNamespace.to(`tenant_${tId}`).emit('whatsapp-web-status', {
        status: 'AUTH_FAILURE',
        qr: null,
        error: msg
      });
    }
  });

  client.on('disconnected', async (reason) => {
    console.log(`WhatsApp Web client disconnected for tenant ${tId} due to:`, reason);
    clientData.status = 'DISCONNECTED';
    clientData.qr = null;

    if (dashboardNamespace) {
      dashboardNamespace.to(`tenant_${tId}`).emit('whatsapp-web-status', {
        status: 'DISCONNECTED',
        qr: null
      });
    }

    try {
      await client.destroy();
    } catch (e) {}
    whatsappClients.delete(tId);
  });

  client.on('message', async (msg) => {
    // 1. Skip group chats
    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const fromJid = msg.from; // e.g. "1234567890@c.us"
    const phoneNo = fromJid.split('@')[0];
    const contactName = msg._data?.notifyName || chat.name || `WhatsApp Contact (+${phoneNo})`;

    try {
      // 2. Find or create Visitor
      const visitorId = `whatsapp-web:${fromJid}`;
      let visitor = await Visitor.findById(visitorId);
      if (!visitor) {
        visitor = new Visitor({
          _id: visitorId,
          tenantId: tId,
          name: contactName,
          phoneNumber: phoneNo,
          source: 'whatsapp-web',
          isOnline: true
        });
      } else {
        visitor.name = contactName;
        visitor.phoneNumber = phoneNo;
        visitor.isOnline = true;
      }
      await visitor.save();

      // 3. Find or create Conversation
      let conversation = await Conversation.findOne({
        tenantId: tId,
        visitorId: visitorId,
        status: { $ne: 'Closed' }
      });

      if (!conversation) {
        conversation = new Conversation({
          tenantId: tId,
          visitorId: visitorId,
          status: 'Unassigned',
          source: 'whatsapp-web',
          assignedAgentId: null
        });
        await conversation.save();
      }

      // 4. Save Message
      const message = new Message({
        conversationId: conversation._id,
        senderType: 'Visitor',
        senderId: visitorId,
        senderName: contactName,
        text: msg.body,
        timestamp: new Date()
      });
      await message.save();

      // 5. Update Conversation updatedAt
      conversation.updatedAt = new Date();
      await conversation.save();

      // 6. Broadcast to dashboard agents
      if (dashboardNamespace) {
        dashboardNamespace.to(`tenant_${tId}`).emit('visitor-msg', {
          conversation,
          message,
          visitor
        });
      }
    } catch (err) {
      console.error(`Error processing incoming WhatsApp Web message for tenant ${tId}:`, err);
    }
  });

  client.initialize().catch((err) => {
    console.error(`Failed to initialize WhatsApp Web client for tenant ${tId}:`, err);
    clientData.status = 'DISCONNECTED';
  });

  return clientData;
}

/**
 * Safely disconnects the WhatsApp client
 */
export async function disconnectWhatsAppClient(tenantId) {
  const tId = tenantId.toString();
  if (whatsappClients.has(tId)) {
    const { client } = whatsappClients.get(tId);
    try {
      await client.logout();
      await client.destroy();
    } catch (e) {}
    whatsappClients.delete(tId);
  }
}

/**
 * Retrieves the connection status and QR for a tenant
 */
export function getWhatsAppClientStatus(tenantId) {
  const tId = tenantId.toString();
  if (whatsappClients.has(tId)) {
    const { status, qr } = whatsappClients.get(tId);
    return { status, qr };
  }
  return { status: 'DISCONNECTED', qr: null };
}

/**
 * Send an outgoing message via WhatsApp Web (1-to-1 communication only)
 */
export async function sendWhatsAppWebMessage(tenantId, visitorId, text) {
  const tId = tenantId.toString();
  const clientData = whatsappClients.get(tId);
  
  if (!clientData || clientData.status !== 'CONNECTED') {
    throw new Error('WhatsApp Web integration is not connected');
  }

  // Extract JID from visitorId (format: "whatsapp-web:1234567890@c.us")
  const parts = visitorId.split(':');
  const jid = parts.length > 1 ? parts[1] : visitorId;

  if (!jid.endsWith('@c.us')) {
    throw new Error('Invalid WhatsApp JID format');
  }

  // Send message
  await clientData.client.sendMessage(jid, text);
}

/**
 * Startup hook to auto-connect WhatsApp clients for tenants who have it enabled
 */
export async function autoStartWhatsAppWebClients() {
  try {
    const integrations = await Integration.find({ 'whatsappWeb.enabled': true });
    for (const integration of integrations) {
      console.log(`Auto-starting WhatsApp Web client for tenant ${integration.tenantId}`);
      initializeWhatsAppClient(integration.tenantId).catch(() => {});
    }
  } catch (err) {
    console.error('Error during WhatsApp Web auto-start hook:', err);
  }
}
