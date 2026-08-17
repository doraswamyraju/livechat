import { Visitor, Conversation, Message, Integration } from './models.js';
import { dashboardNamespace } from './socket.js';

/**
 * Sends a message via Facebook Messenger or Instagram Direct using Meta Send API
 */
export async function sendMetaMessage(integration, recipientId, text) {
  const { pageAccessToken } = integration.meta;

  if (!pageAccessToken) {
    throw new Error('Meta Integration is not fully configured (missing Page Access Token)');
  }

  const url = `https://graph.facebook.com/v26.0/me/messages?access_token=${pageAccessToken}`;
  const body = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Meta API sending failed:', errorText);
    throw new Error(`Meta API sending failed: ${errorText}`);
  }

  return await response.json();
}

/**
 * Fetch sender profile details from Meta Graph API
 */
async function fetchMetaUserProfile(userId, pageAccessToken, isInstagram = false) {
  try {
    let url;
    if (isInstagram) {
      url = `https://graph.facebook.com/v26.0/${userId}?fields=name,username&access_token=${pageAccessToken}`;
    } else {
      url = `https://graph.facebook.com/v26.0/${userId}?fields=first_name,last_name&access_token=${pageAccessToken}`;
    }


    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (isInstagram) {
        return data.name || data.username || `Instagram User`;
      } else {
        if (data.first_name || data.last_name) {
          return `${data.first_name || ''} ${data.last_name || ''}`.trim();
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch Meta user profile details:', err);
  }
  return isInstagram ? 'Instagram User' : 'Messenger User';
}

/**
 * Webhook handler for Facebook & Instagram Direct
 */
export async function handleMetaWebhook(req, res) {
  // 1. GET Webhook verification (Meta Setup)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      // Find any integration matching this verify token to authorize
      const integration = await Integration.findOne({ 'meta.verifyToken': token });
      if (integration) {
        console.log('Meta Webhook verified successfully');
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // 2. POST Webhook event ingestion
  if (req.method === 'POST') {
    const { body } = req;

    if (body.object === 'page' || body.object === 'instagram') {
      try {
        for (const entry of body.entry || []) {
          const entryId = entry.id; // Page ID or Instagram Account ID
          
          // Find integration by pageId or instagramAccountId to resolve tenant ID
          const integration = await Integration.findOne({
            $or: [
              { 'meta.pageId': entryId },
              { 'meta.instagramAccountId': entryId }
            ],
            'meta.enabled': true
          });

          let tenantId;
          let pageAccessToken = integration?.meta?.pageAccessToken;

          if (integration) {
            tenantId = integration.tenantId.toString();
          } else {
            console.warn(`Received Meta webhook for unregistered Entry ID: ${entryId}. Falling back to primary tenant.`);
            const firstTenant = await Tenant.findOne();
            if (firstTenant) {
              tenantId = firstTenant._id.toString();
            } else {
              continue;
            }
          }


          // Extract messaging events from entry.messaging or entry.changes
          const messagingItems = [];
          if (Array.isArray(entry.messaging)) {
            messagingItems.push(...entry.messaging);
          }
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if ((change.field === 'messages' || change.field === 'instagram_messages') && change.value) {
                messagingItems.push(change.value);
              }
            }
          }

          // Process messages
          for (const messagingItem of messagingItems) {
            const senderId = messagingItem.sender?.id || messagingItem.from?.id || messagingItem.from;
            const msg = messagingItem.message || messagingItem.text || messagingItem;
            const textContent = typeof msg === 'string' ? msg : (msg?.text || msg?.body);

            // Only process text messages (skip echo messages)
            if (!senderId || !textContent || msg?.is_echo) continue;


            // Check if source is Instagram or Facebook Page
            const isInstagram = entryId === integration.meta.instagramAccountId || body.object === 'instagram';
            const source = isInstagram ? 'instagram' : 'facebook';
            const visitorId = `${source}:${senderId}`;

            // Fetch user profile details or use cached/existing Visitor
            let visitor = await Visitor.findById(visitorId);
            let name = visitor ? visitor.name : null;

            if (!name) {
              name = await fetchMetaUserProfile(senderId, pageAccessToken, isInstagram);
            }

            // Create or update Visitor
            if (!visitor) {
              visitor = new Visitor({
                _id: visitorId,
                tenantId,
                name,
                source,
                isOnline: true
              });
            } else {
              visitor.name = name;
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
                source,
                assignedAgentId: null
              });
              await conversation.save();
            }

            // Save Message
            const message = new Message({
              conversationId: conversation._id,
              senderType: 'Visitor',
              senderId: visitorId,
              senderName: name,
              text: msg.text,
              timestamp: new Date(messagingItem.timestamp || Date.now())
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
        console.error('Error handling Meta webhook:', err);
      }
    }

    return res.sendStatus(200);
  }

  return res.sendStatus(405);
}
