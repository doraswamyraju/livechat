import { Visitor, Conversation, Message, Integration } from './models.js';
import { dashboardNamespace } from './socket.js';

/**
 * Sends a message via the official WhatsApp Cloud API
 */
export async function sendWhatsAppApiMessage(integration, toPhoneNumber, text) {
  const { phoneNumberId, accessToken } = integration.whatsappApi;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Official WhatsApp Cloud API is not fully configured (missing Phone Number ID or Access Token)');
  }

  const url = `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhoneNumber,
    type: 'text',
    text: {
      body: text
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('WhatsApp API sending failed:', errorText);
    throw new Error(`WhatsApp API sending failed: ${errorText}`);
  }

  return await response.json();
}

/**
 * Webhook handler for the Official WhatsApp API
 */
export async function handleWhatsAppApiWebhook(req, res) {
  // 1. GET Webhook verification (Meta Setup)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      // Find any integration matching this verify token to authorize
      const integration = await Integration.findOne({ 'whatsappApi.verifyToken': token });
      if (integration) {
        console.log('WhatsApp Webhook verified successfully');
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // 2. POST Webhook event ingestion
  if (req.method === 'POST') {
    const { body } = req;

    if (body.object === 'whatsapp_business_account') {
      try {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const metadata = value?.metadata;
        const messages = value?.messages;
        const contacts = value?.contacts;

        if (messages && messages.length > 0 && metadata) {
          const phoneNumberId = metadata.phone_number_id;
          
          // Find integration by phone number ID to resolve tenant ID
          const integration = await Integration.findOne({ 
            'whatsappApi.phoneNumberId': phoneNumberId,
            'whatsappApi.enabled': true
          });

          if (!integration) {
            console.warn(`Received WhatsApp webhook for unregistered/disabled phone number ID: ${phoneNumberId}`);
            return res.sendStatus(200);
          }

          const tenantId = integration.tenantId.toString();

          for (const msg of messages) {
            // We only support text messages for now
            if (msg.type !== 'text') continue;

            const fromPhone = msg.from; // Sender phone number
            const contact = contacts?.find(c => c.wa_id === fromPhone);
            const senderName = contact?.profile?.name || `WhatsApp User (+${fromPhone})`;
            const textContent = msg.text?.body;

            const visitorId = `whatsapp-api:${fromPhone}`;

            // Create or update Visitor
            let visitor = await Visitor.findById(visitorId);
            if (!visitor) {
              visitor = new Visitor({
                _id: visitorId,
                tenantId,
                name: senderName,
                phoneNumber: fromPhone,
                source: 'whatsapp-api',
                isOnline: true
              });
            } else {
              visitor.name = senderName;
              visitor.phoneNumber = fromPhone;
              visitor.isOnline = true;
            }
            await visitor.save();

            // Find or create active Conversation
            let conversation = await Conversation.findOne({
              tenantId,
              visitorId,
              status: { $ne: 'Closed' }
            });

            if (!conversation) {
              conversation = new Conversation({
                tenantId,
                visitorId,
                status: 'Unassigned',
                source: 'whatsapp-api',
                assignedAgentId: null
              });
              await conversation.save();
            }

            // Save Message
            const message = new Message({
              conversationId: conversation._id,
              senderType: 'Visitor',
              senderId: visitorId,
              senderName,
              text: textContent,
              timestamp: new Date(parseInt(msg.timestamp) * 1000)
            });
            await message.save();

            // Update Conversation updatedAt
            conversation.updatedAt = new Date();
            await conversation.save();

            // Broadcast message to agents dashboard
            if (dashboardNamespace) {
              dashboardNamespace.to(`tenant_${tenantId}`).emit('visitor-msg', {
                conversation,
                message,
                visitor
              });
            }
          }
        }
      } catch (err) {
        console.error('Error handling WhatsApp Cloud API webhook:', err);
      }
    }

    return res.sendStatus(200);
  }

  return res.sendStatus(405);
}
