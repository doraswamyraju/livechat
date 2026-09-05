import mongoose from 'mongoose';
import { Visitor, Conversation, Message, Integration, Tenant } from './models.js';
import { dashboardNamespace } from './socket.js';



/**
 * Sends a message via Facebook Messenger or Instagram Direct using Meta Send API
 */
export async function sendMetaMessage(integration, recipientId, text) {
  const { pageAccessToken, pageId } = integration.meta;

  if (!pageAccessToken) {
    throw new Error('Meta Integration is not fully configured (missing Page Access Token)');
  }

  const endpoint = pageId ? `https://graph.facebook.com/v26.0/${pageId}/messages` : `https://graph.facebook.com/v26.0/me/messages`;
  const url = `${endpoint}?access_token=${pageAccessToken}`;
  const body = {
    recipient: {
      id: recipientId
    },
    messaging_type: 'RESPONSE',
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
    console.error('[MetaSendAPI] Sending failed:', errorText);
    throw new Error(`Meta API sending failed: ${errorText}`);
  }

  const resJson = await response.json();
  console.log('[MetaSendAPI] Message dispatched successfully to recipient:', recipientId, resJson);
  return resJson;
}

/**
 * Fetch sender profile details from Meta Graph API
 */
async function fetchMetaUserProfile(userId, pageAccessToken, isInstagram = false) {
  try {
    let url;
    if (isInstagram) {
      url = `https://graph.facebook.com/v26.0/${userId}?fields=name,username,profile_pic&access_token=${pageAccessToken}`;
    } else {
      url = `https://graph.facebook.com/v26.0/${userId}?fields=first_name,last_name,name,profile_pic&access_token=${pageAccessToken}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (isInstagram) {
        return data.name || (data.username ? `@${data.username}` : `Instagram User`);
      } else {
        if (data.name) return data.name;
        if (data.first_name || data.last_name) {
          return `${data.first_name || ''} ${data.last_name || ''}`.trim();
        }
      }
    } else {
      const errTxt = await res.text();
      console.warn('Meta profile fetch response not ok:', errTxt);
    }
  } catch (err) {
    console.error('Failed to fetch Meta user profile details:', err);
  }
  return isInstagram ? 'Instagram User' : 'Facebook User';
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

    if (mode === 'subscribe' && token) {
      if (token === 'letstrack_meta_review_token_2026' || token === 'letstrack_wa_verify_2026' || token === 'manacity_meta_verify_token_2026') {
        console.log('[MetaWebhook] Verification successful for token:', token);
        return res.status(200).send(challenge);
      }
      const integration = await Integration.findOne({ 'meta.verifyToken': token });
      if (integration) {
        console.log('[MetaWebhook] Verification successful via DB match for token:', token);
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).send('Verification failed');
  }

  // 2. POST Webhook event ingestion
  if (req.method === 'POST') {
    const { body } = req;
    console.log('[MetaWebhook Ingestion] Received webhook payload:', JSON.stringify(body));

    if (body.object === 'page' || body.object === 'instagram') {
      try {
        for (const entry of body.entry || []) {
          const rawAssetId = entry.id;
          const entryIdStr = rawAssetId ? String(rawAssetId).trim() : '';

          // Find canonical integration by pageId or instagramAccountId to resolve tenant ID
          let integration = null;
          if (entryIdStr) {
            integration = await Integration.findOne({
              $or: [
                { 'meta.pageId': entryIdStr },
                { 'meta.instagramAccountId': entryIdStr }
              ]
            });
          }

          if (!integration) {
            // Fallback to active Meta integration
            integration = await Integration.findOne({ 'meta.enabled': true });
          }

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

            // Extract Meta Ad Referral & Click-to-Chat Attribution
            const referral = messagingItem.referral || messagingItem.postback?.referral || messagingItem.message?.referral;
            let adAttributionTitle = null;
            let adId = null;
            if (referral) {
              adId = referral.ad_id || referral.source_id || referral.source;
              adAttributionTitle = referral.ads_context_data?.ad_title || (adId ? `Meta Ad (${adId})` : 'Meta Sponsored Ad');
              console.log(`[MetaWebhook] Attributed Click-to-Chat lead from Meta Ad: ${adAttributionTitle} (Ad ID: ${adId})`);
            }

            const objTenantId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

            // Fetch user profile details or use cached/existing Visitor
            let visitor = await Visitor.findById(visitorId);
            let name = visitor ? visitor.name : null;

            if (!name) {
              name = await fetchMetaUserProfile(senderId, pageAccessToken, isInstagram);
            }

            // Create or update Visitor (Meta users do not have real-time web socket, so isOnline: false)
            if (!visitor) {
              visitor = new Visitor({
                _id: visitorId,
                tenantId: objTenantId,
                name,
                source,
                utmCampaign: adAttributionTitle || 'Direct Meta DM',
                isOnline: false
              });
            } else {
              visitor.tenantId = objTenantId;
              visitor.name = name;
              if (adAttributionTitle) visitor.utmCampaign = adAttributionTitle;
              visitor.isOnline = false;
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
                unreadCount: 1,
                lastMessageText: textContent,
                assignedAgentId: null
              });
              await conversation.save();
            } else {
              conversation.unreadCount = (conversation.unreadCount || 0) + 1;
              conversation.lastMessageText = textContent;
              conversation.updatedAt = new Date();
              if (conversation.source !== source) conversation.source = source;
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
            await message.save();
            console.log(`[MetaWebhook] Saved message from ${name} (${visitorId}) text: "${textContent}" in conversation ${conversation._id} for tenant ${tenantId}`);

            // Broadcast message to agents and SuperAdmin dashboard
            if (dashboardNamespace) {
              const strTenantId = tenantId.toString();
              console.log(`[MetaWebhook] Emitting visitor-msg event to room tenant_${strTenantId} and global dashboard`);
              dashboardNamespace.to(`tenant_${strTenantId}`).emit('visitor-msg', {
                conversation,
                message,
                visitor
              });
              dashboardNamespace.emit('visitor-msg', {
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
