import mongoose from 'mongoose';
import { Visitor, Conversation, Message, Integration, Tenant } from './models.js';
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
          const rawAssetId = entry.id;
          if (!rawAssetId || (typeof rawAssetId !== 'string' && typeof rawAssetId !== 'number')) {
            console.warn('[MetaWebhook] Resolution: FAILED Reason: INVALID_ASSET_ID');
            continue;
          }

          const entryIdStr = String(rawAssetId).trim();
          if (!entryIdStr || entryIdStr === 'undefined' || entryIdStr === 'null') {
            console.warn('[MetaWebhook] Resolution: FAILED Reason: INVALID_ASSET_ID');
            continue;
          }

          // Find canonical integration by pageId or instagramAccountId to resolve tenant ID
          const integration = await Integration.findOne({
            $or: [
              { 'meta.pageId': entryIdStr },
              { 'meta.instagramAccountId': entryIdStr }
            ],
            'meta.enabled': true
          });


          if (!integration || !integration.meta || !integration.tenantId) {
            console.warn(`[MetaWebhook] Asset ID: ${entryIdStr} Resolution: FAILED Reason: UNREGISTERED_ASSET`);
            continue;
          }

          const tenant = await Tenant.findById(integration.tenantId);
          if (!tenant) {
            console.warn(`[MetaWebhook] Asset ID: ${entryIdStr} Resolution: FAILED Reason: TENANT_NOT_FOUND`);
            continue;
          }

          const tenantId = integration.tenantId.toString();
          const pageAccessToken = integration.meta.pageAccessToken;
          console.log(`[MetaWebhook] Asset ID: ${entryIdStr} Tenant ID: ${tenantId} Resolution: SUCCESS`);




          // Extract messaging events from entry.messaging, entry.standby, or entry.changes
          const messagingItems = [];
          if (Array.isArray(entry.messaging)) {
            messagingItems.push(...entry.messaging);
          }
          if (Array.isArray(entry.standby)) {
            messagingItems.push(...entry.standby);
          }
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.value && (change.field === 'messages' || change.field === 'instagram_messages' || change.field === 'messages_instagram' || change.field === 'conversations')) {
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
            const isInstagram = body.object === 'instagram' || entryIdStr === integration?.meta?.instagramAccountId;
            const source = isInstagram ? 'instagram' : 'facebook';
            const visitorId = `${source}:${senderId}`;


            const objTenantId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

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
                tenantId: objTenantId,
                name,
                source,
                isOnline: true
              });
            } else {
              visitor.tenantId = objTenantId;
              visitor.name = name;
              visitor.isOnline = true;
            }
            await visitor.save();

            // Find or create active Conversation
            let conversation = await Conversation.findOne({
              tenantId: { $in: [objTenantId, tenantId] },
              visitorId,
              status: { $ne: 'Closed' }
            });


            if (!conversation) {
              conversation = new Conversation({
                tenantId: objTenantId,
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
              text: textContent,
              timestamp: new Date(messagingItem.timestamp || Date.now())
            });
            console.log(`[MetaWebhook] Saved message from ${name} (${visitorId}) text: "${textContent}" in conversation ${conversation._id} for tenant ${tenantId}`);

            // Broadcast message to agents dashboard
            if (dashboardNamespace) {
              const strTenantId = tenantId.toString();
              console.log(`[MetaWebhook] Emitting visitor-msg event to room tenant_${strTenantId}`);
              dashboardNamespace.to(`tenant_${strTenantId}`).emit('visitor-msg', {
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
