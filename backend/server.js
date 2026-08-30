import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

import { Tenant, User, Visitor, Conversation, Message, WidgetSettings, QuickReply, Integration, Payment, AuditLog } from './models.js';
import { initializeSocket, dashboardNamespace } from './socket.js';
import { 
  initializeWhatsAppClient, 
  disconnectWhatsAppClient, 
  getWhatsAppClientStatus,
  autoStartWhatsAppWebClients,
  sendWhatsAppWebMessage
} from './whatsapp-web-service.js';
import { handleWhatsAppApiWebhook, sendWhatsAppApiMessage } from './whatsapp-api-service.js';
import { handleMetaWebhook, sendMetaMessage } from './meta-api-service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/letstrack';
const JWT_SECRET = process.env.JWT_SECRET || 'letstrack_super_secret_session_key';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Connect MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB database.');
  })
  .catch(err => console.error('MongoDB database connection error:', err));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;

    try {
      const dbUser = await User.findById(decoded.userId);
      if (dbUser && dbUser.isBanned) {
        return res.status(403).json({ error: 'User account is suspended. Please contact platform support.' });
      }
      if (dbUser) {
        dbUser.lastActive = new Date();
        await dbUser.save();
      }

      if (decoded.tenantId && decoded.role !== 'SuperAdmin') {
        const dbTenant = await Tenant.findById(decoded.tenantId);
        if (dbTenant && dbTenant.isSuspended) {
          return res.status(403).json({ error: 'Organization account is suspended. Please contact billing support.' });
        }
      }
    } catch (dbErr) {
      console.warn('Auth user lookup warning:', dbErr.message);
    }

    next();
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Forbidden: Platform SuperAdmin privilege required' });
  }
  next();
};

// ============================================
// REST API ENDPOINTS
// ============================================

// 1. Register Tenant (Website & Admin)
app.post('/api/auth/register-tenant', async (req, res) => {
  const { tenantName, domain, adminName, email, password } = req.body;

  if (!tenantName || !domain || !adminName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create Tenant
    const apiKey = 'lt_' + crypto.randomBytes(16).toString('hex');
    const tenant = new Tenant({
      name: tenantName,
      domain,
      apiKey
    });
    await tenant.save();

    // Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      tenantId: tenant._id,
      name: adminName,
      email,
      passwordHash,
      role: 'Admin',
      status: 'Offline'
    });
    await user.save();

    // Create default Widget Settings
    const settings = new WidgetSettings({
      tenantId: tenant._id
    });
    await settings.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, tenantId: tenant._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey
      }
    });

  } catch (err) {
    console.error('Error in tenant registration:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 1b. Internal Tenant Provisioning Endpoint (called automatically by ManaCity)
app.post('/api/internal/provision-tenant', async (req, res) => {
  const secretHeader = req.headers['x-provision-secret'];
  const expectedSecret = process.env.PROVISION_SECRET || 'letstrack_manacity_internal_secret_2026';

  if (secretHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized internal provision request' });
  }

  const { tenantName, domain, adminName, email, password } = req.body;

  if (!tenantName || !email) {
    return res.status(400).json({ error: 'tenantName and email are required' });
  }

  try {
    let existingUser = await User.findOne({ email }).populate('tenantId');
    if (existingUser) {
      const tenant = await Tenant.findById(existingUser.tenantId);
      const token = jwt.sign(
        { userId: existingUser._id, tenantId: tenant._id, role: existingUser.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.status(200).json({
        message: 'Tenant already provisioned',
        token,
        tenant: {
          id: tenant._id,
          name: tenant.name,
          domain: tenant.domain,
          apiKey: tenant.apiKey
        },
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role
        }
      });
    }

    const apiKey = 'lt_' + crypto.randomBytes(16).toString('hex');
    const tenant = new Tenant({
      name: tenantName,
      domain: domain || 'manacity-site.com',
      apiKey
    });
    await tenant.save();

    const pwdToHash = password || crypto.randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(pwdToHash, 10);
    const user = new User({
      tenantId: tenant._id,
      name: adminName || tenantName,
      email,
      passwordHash,
      role: 'Admin',
      status: 'Offline'
    });
    await user.save();

    const settings = new WidgetSettings({
      tenantId: tenant._id
    });
    await settings.save();

    const token = jwt.sign(
      { userId: user._id, tenantId: tenant._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Tenant provisioned successfully',
      token,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Error in internal tenant provisioning:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 1c. Google / Gmail Sign-In Endpoint
app.post('/api/auth/google-login', async (req, res) => {
  const { idToken, credential, email: directEmail } = req.body;
  const tokenToVerify = idToken || credential;

  try {
    let email = directEmail;
    let name = '';
    let picture = '';

    if (tokenToVerify) {
      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`);
        if (googleRes.ok) {
          const payload = await googleRes.json();
          email = payload.email;
          name = payload.name;
          picture = payload.picture;
        }
      } catch (err) {
        console.warn('Google tokeninfo fetch warning:', err.message);
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Email missing from Google authentication' });
    }

    let user = await User.findOne({ email }).populate('tenantId');
    if (!user) {
      return res.status(404).json({ error: 'No LetsTrack account found for this email. Please ensure your account is onboarded.' });
    }

    if (picture && !user.avatarUrl) {
      user.avatarUrl = picture;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl
      },
      tenant: {
        id: user.tenantId._id,
        name: user.tenantId.name,
        domain: user.tenantId.domain,
        apiKey: user.tenantId.apiKey
      }
    });

  } catch (err) {
    console.error('Error in Google login:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email }).populate('tenantId');
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      tenant: {
        id: user.tenantId._id,
        name: user.tenantId.name,
        domain: user.tenantId.domain,
        apiKey: user.tenantId.apiKey
      }
    });

  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2b. Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error in password reset:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Register New Agent (Admin only)
app.post('/api/auth/register-agent', authenticateToken, async (req, res) => {
  const { name, email, password } = req.body;

  if (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    const currentAgentsCount = await User.countDocuments({ tenantId: req.user.tenantId });
    const maxAllowedSeats = tenant?.maxAgents || 1;

    if (currentAgentsCount >= maxAllowedSeats && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ 
        error: `Team seat limit reached (${currentAgentsCount}/${maxAllowedSeats} used). Upgrade to Growth (₹299/mo for 3 seats) or Business (₹399/mo for 6 seats) to add more agents.` 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const agent = new User({
      tenantId: req.user.tenantId,
      name,
      email,
      passwordHash,
      role: 'Agent',
      status: 'Offline'
    });
    await agent.save();

    // Log action
    await AuditLog.create({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      actorEmail: req.user.email || 'Admin',
      action: 'AGENT_CREATED',
      details: { agentId: agent._id, agentEmail: agent.email }
    });

    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        status: agent.status
      }
    });

  } catch (err) {
    console.error('Error in register-agent:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3b. Get All Agents for Active Tenant
app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const agents = await User.find({ tenantId: req.user.tenantId }, '-passwordHash').sort({ createdAt: -1 });
    const tenant = await Tenant.findById(req.user.tenantId);
    res.status(200).json({
      agents,
      seatInfo: {
        used: agents.length,
        max: tenant?.maxAgents || 1,
        plan: tenant?.plan || 'free'
      }
    });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3c. Delete Agent (Admin only)
app.delete('/api/agents/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  try {
    const targetUser = await User.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!targetUser) return res.status(404).json({ error: 'Agent not found' });
    if (targetUser.role === 'Admin' || targetUser.role === 'SuperAdmin') {
      return res.status(400).json({ error: 'Cannot delete primary Admin account' });
    }

    await targetUser.deleteOne();
    res.status(200).json({ message: 'Agent removed successfully' });
  } catch (err) {
    console.error('Error deleting agent:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Retrieve Active Tenant Widget Settings
app.get('/api/settings/widget', async (req, res) => {
  const { apiKey, tenantId } = req.query;

  try {
    let settings = null;
    let resolvedTenant = null;

    if (apiKey) {
      resolvedTenant = await Tenant.findOne({ apiKey });
      if (!resolvedTenant) return res.status(404).json({ error: 'Tenant not found' });
      settings = await WidgetSettings.findOne({ tenantId: resolvedTenant._id });
    } else if (tenantId) {
      if (mongoose.Types.ObjectId.isValid(tenantId)) {
        resolvedTenant = await Tenant.findById(tenantId);
      }
      if (!resolvedTenant) {
        resolvedTenant = await Tenant.findOne({ apiKey: tenantId });
      }
      if (!resolvedTenant) return res.status(404).json({ error: 'Tenant not found' });
      settings = await WidgetSettings.findOne({ tenantId: resolvedTenant._id });
    } else {
      return res.status(400).json({ error: 'apiKey or tenantId required' });
    }

    if (!settings && resolvedTenant) {
      settings = new WidgetSettings({
        tenantId: resolvedTenant._id
      });
      await settings.save();
    }

    const responseData = settings.toObject();
    // Enforce Whitelabel Branding Rule:
    // If tenant is on 'free' plan and does not have whitelabel feature enabled, force hideBranding = false
    const whitelabelAllowed = resolvedTenant.features?.whitelabelBranding === true || ['growth', 'business', 'enterprise'].includes(resolvedTenant.plan);
    if (!whitelabelAllowed) {
      responseData.hideBranding = false;
    }

    res.status(200).json(responseData);

  } catch (err) {
    console.error('Error retrieving settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Update Widget Settings (Admin only)
app.put('/api/settings/widget', authenticateToken, async (req, res) => {
  const { primaryColor, headingText, welcomeMessage, preChatEnabled, position, headerTextColor, gradientColor, useGradient, statusText, borderRadius, launcherText, hideBranding } = req.body;

  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    let settings = await WidgetSettings.findOne({ tenantId: req.user.tenantId });
    if (!settings) {
      settings = new WidgetSettings({ tenantId: req.user.tenantId });
    }
    if (primaryColor !== undefined) settings.primaryColor = primaryColor;
    if (headingText !== undefined) settings.headingText = headingText;
    if (welcomeMessage !== undefined) settings.welcomeMessage = welcomeMessage;
    if (preChatEnabled !== undefined) settings.preChatEnabled = preChatEnabled;
    if (position !== undefined) settings.position = position;
    if (headerTextColor !== undefined) settings.headerTextColor = headerTextColor;
    if (gradientColor !== undefined) settings.gradientColor = gradientColor;
    if (useGradient !== undefined) settings.useGradient = useGradient;
    if (statusText !== undefined) settings.statusText = statusText;
    if (borderRadius !== undefined) settings.borderRadius = borderRadius;
    if (launcherText !== undefined) settings.launcherText = launcherText;

    // Check whitelabel permissions
    const whitelabelAllowed = tenant?.features?.whitelabelBranding === true || ['growth', 'business', 'enterprise'].includes(tenant?.plan);
    if (hideBranding !== undefined) {
      settings.hideBranding = whitelabelAllowed ? Boolean(hideBranding) : false;
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. Analytics Overview endpoint
app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
  const { tenantId } = req.user;

  try {
    let resolvedTenantId = tenantId;
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      const tenant = await Tenant.findOne({ apiKey: tenantId });
      if (tenant) {
        resolvedTenantId = tenant._id;
      } else {
        return res.status(400).json({ error: 'Invalid tenantId format' });
      }
    }

    const totalVisitors = await Visitor.countDocuments({ tenantId: resolvedTenantId });
    const onlineVisitors = await Visitor.countDocuments({ tenantId: resolvedTenantId, isOnline: true });
    const activeConversations = await Conversation.countDocuments({ tenantId: resolvedTenantId, status: 'Active' });
    const unassignedConversations = await Conversation.countDocuments({ tenantId: resolvedTenantId, status: 'Unassigned' });
    
    // Total historical chats
    const totalChats = await Conversation.countDocuments({ tenantId: resolvedTenantId });

    // Agent counts
    const totalAgents = await User.countDocuments({ tenantId: resolvedTenantId });
    const onlineAgents = await User.countDocuments({ tenantId: resolvedTenantId, status: 'Online' });

    res.status(200).json({
      totalVisitors,
      onlineVisitors,
      activeConversations,
      unassignedConversations,
      totalChats,
      totalAgents,
      onlineAgents
    });

  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. Get Conversation Messages
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error('Error retrieving conversation messages:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7b. Archive or Unarchive Conversation
app.put('/api/conversations/:conversationId/archive', authenticateToken, async (req, res) => {
  const { conversationId } = req.params;
  const { archive } = req.body; // true or false

  try {
    const conv = await Conversation.findOne({ _id: conversationId, tenantId: req.user.tenantId });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    conv.isArchived = archive !== undefined ? Boolean(archive) : true;
    conv.status = conv.isArchived ? 'Archived' : 'Active';
    conv.updatedAt = new Date();
    await conv.save();

    dashboardNamespace.to(`tenant_${req.user.tenantId}`).emit('conversation-updated', conv);

    res.status(200).json({ message: conv.isArchived ? 'Conversation archived' : 'Conversation unarchived', conversation: conv });
  } catch (err) {
    console.error('Error archiving conversation:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7c. Delete Conversation & Messages
app.delete('/api/conversations/:conversationId', authenticateToken, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const conv = await Conversation.findOne({ _id: conversationId, tenantId: req.user.tenantId });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    await Message.deleteMany({ conversationId });
    await conv.deleteOne();

    dashboardNamespace.to(`tenant_${req.user.tenantId}`).emit('conversation-deleted', { conversationId });

    res.status(200).json({ message: 'Conversation deleted successfully', conversationId });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. Register Agent FCM Token for push notifications
app.post('/api/auth/fcm-token', authenticateToken, async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.fcmToken = fcmToken;
      await user.save();
    }
    res.status(200).json({ message: 'FCM Token registered successfully' });
  } catch (err) {
    console.error('Error saving FCM Token:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. Update Visitor Details
app.put('/api/visitors/:visitorId', authenticateToken, async (req, res) => {
  const { visitorId } = req.params;
  const { name, email, phoneNumber, isMuted } = req.body;

  try {
    const visitor = await Visitor.findOne({ _id: visitorId, tenantId: req.user.tenantId });
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    if (name !== undefined) visitor.name = name;
    if (email !== undefined) visitor.email = email;
    if (phoneNumber !== undefined) visitor.phoneNumber = phoneNumber;
    if (isMuted !== undefined) visitor.isMuted = isMuted;
    await visitor.save();
    res.status(200).json(visitor);
  } catch (err) {
    console.error('Error updating visitor details:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9b. Get Single Visitor Details
app.get('/api/visitors/:visitorId', authenticateToken, async (req, res) => {
  const { visitorId } = req.params;
  try {
    const visitor = await Visitor.findOne({ _id: visitorId, tenantId: req.user.tenantId });
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    res.status(200).json(visitor);
  } catch (err) {
    console.error('Error fetching visitor details:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 10. Get Quick Replies
app.get('/api/quick-replies', authenticateToken, async (req, res) => {
  try {
    const quickReplies = await QuickReply.find({ tenantId: req.user.tenantId });
    res.status(200).json(quickReplies);
  } catch (err) {
    console.error('Error retrieving quick replies:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 11. Add Quick Reply
app.post('/api/quick-replies', authenticateToken, async (req, res) => {
  const { shortcut, text } = req.body;
  if (!shortcut || !text) return res.status(400).json({ error: 'Shortcut and text are required' });

  try {
    const quickReply = new QuickReply({
      tenantId: req.user.tenantId,
      shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
      text
    });
    await quickReply.save();
    res.status(201).json(quickReply);
  } catch (err) {
    console.error('Error saving quick reply:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 12. Delete Quick Reply
app.delete('/api/quick-replies/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await QuickReply.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Quick reply not found' });
    await deleted.deleteOne();
    res.status(200).json({ message: 'Quick reply deleted successfully' });
  } catch (err) {
    console.error('Error deleting quick reply:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 13. Update Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, avatarUrl, password } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (name) user.name = name;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();
    
    // Create clean user response without password hash
    const cleanUser = {
      _id: user._id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    };
    res.status(200).json(cleanUser);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================
// INTEGRATIONS & WEBHOOKS
// ============================================

// 1. Get Integration Configurations
app.get('/api/integrations', authenticateToken, async (req, res) => {
  try {
    let integration = await Integration.findOne({ tenantId: req.user.tenantId });
    if (!integration) {
      integration = new Integration({ tenantId: req.user.tenantId });
      await integration.save();
    }
    res.status(200).json(integration);
  } catch (err) {
    console.error('Error fetching integrations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 1.5. Internal Register / Auto-Provision Meta Integration (ManaCity Integration)
app.post('/api/internal/register-meta-integration', async (req, res) => {
  const secret = req.headers['x-provision-secret'];
  const PROVISION_SECRET = process.env.LETSTRACK_PROVISION_SECRET || 'letstrack_manacity_internal_secret_2026';
  if (secret !== PROVISION_SECRET) {
    return res.status(403).json({ error: 'Unauthorized secret' });
  }

  const {
    manacityBusinessGroupId,
    businessName,
    ownerEmail,
    ownerName,
    metaPageId,
    metaPageName,
    metaInstagramAccountId,
    pageAccessToken
  } = req.body;

  try {
    let tenant = null;

    // Step A: Find existing tenant by manacityBusinessGroupId
    if (manacityBusinessGroupId) {
      tenant = await Tenant.findOne({ manacityBusinessGroupId });
    }

    // Fallback: Check if a tenant already has this exact metaPageId or metaInstagramAccountId registered
    if (!tenant && (metaPageId || metaInstagramAccountId)) {
      const existingInteg = await Integration.findOne({
        $or: [
          ...(metaPageId ? [{ 'meta.pageId': metaPageId }] : []),
          ...(metaInstagramAccountId ? [{ 'meta.instagramAccountId': metaInstagramAccountId }] : [])
        ]
      });
      if (existingInteg) {
        tenant = await Tenant.findById(existingInteg.tenantId);
        if (tenant && manacityBusinessGroupId) {
          tenant.manacityBusinessGroupId = manacityBusinessGroupId;
          await tenant.save();
        }
      }
    }

    // Step B: Create tenant if it doesn't exist (Idempotent)
    if (!tenant) {
      const tenantDomain = (businessName || 'Business')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '') + '.manacity.in';
      const apiKey = `lt_${manacityBusinessGroupId || Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      tenant = new Tenant({
        name: businessName || 'ManaCity Business',
        domain: tenantDomain,
        apiKey,
        manacityBusinessGroupId: manacityBusinessGroupId || undefined
      });
      await tenant.save();
      console.log(`[MetaProvisioning] BusinessGroup: ${manacityBusinessGroupId} Meta Page: ${metaPageId} Let'sTrack Tenant: ${tenant._id} Action: CREATED Status: SUCCESS`);
    } else {
      console.log(`[MetaProvisioning] BusinessGroup: ${manacityBusinessGroupId} Meta Page: ${metaPageId} Let'sTrack Tenant: ${tenant._id} Action: EXISTING Status: SUCCESS`);
    }

    const tenantId = tenant._id;

    // Step C: Create or Link Tenant Admin User (Role: Admin)
    if (ownerEmail) {
      const passwordToSet = req.body.ownerPassword || 'BOHPM6139n@';
      const passwordHash = await bcrypt.hash(passwordToSet, 10);

      let adminUser = await User.findOne({ email: ownerEmail });
      if (!adminUser) {
        adminUser = new User({
          tenantId,
          name: ownerName || 'Business Owner',
          email: ownerEmail,
          passwordHash,
          role: 'Admin',
          status: 'Offline'
        });
        await adminUser.save();
      } else {
        adminUser.tenantId = tenantId;
        adminUser.passwordHash = passwordHash;
        if (adminUser.role !== 'Admin' && adminUser.role !== 'SuperAdmin') {
          adminUser.role = 'Admin';
        }
        await adminUser.save();
      }
    }


    // Step D: Register Meta Page & Instagram Asset against this Tenant
    let integration = await Integration.findOne({ tenantId });
    if (!integration) {
      integration = new Integration({ tenantId });
    }

    integration.meta = {
      enabled: true,
      pageId: metaPageId || integration.meta?.pageId || undefined,
      pageName: metaPageName || integration.meta?.pageName || '',
      instagramAccountId: metaInstagramAccountId || integration.meta?.instagramAccountId || undefined,
      pageAccessToken: pageAccessToken || integration.meta?.pageAccessToken || '',
      verifyToken: 'manacity_webhook_secret'
    };

    await integration.save();
    console.log(`[MetaProvisioning] BusinessGroup: ${manacityBusinessGroupId} Meta Page: ${metaPageId} Action: REGISTER_ASSET Status: SUCCESS`);

    return res.status(200).json({ success: true, tenantId, apiKey: tenant.apiKey, integration });
  } catch (err) {

    console.error(`[MetaProvisioning] BusinessGroup: ${manacityBusinessGroupId} Action: REGISTER_ASSET Status: FAILED Reason: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});




// 2. Update Integration Configurations
app.put('/api/integrations', authenticateToken, async (req, res) => {
  const { whatsappWeb, whatsappApi, meta } = req.body;
  try {
    let integration = await Integration.findOne({ tenantId: req.user.tenantId });
    if (!integration) {
      integration = new Integration({ tenantId: req.user.tenantId });
    }

    if (whatsappWeb !== undefined) integration.whatsappWeb = whatsappWeb;
    if (whatsappApi !== undefined) integration.whatsappApi = whatsappApi;
    if (meta !== undefined) integration.meta = meta;

    await integration.save();

    // If whatsapp web was toggled to disabled, shut down client
    if (whatsappWeb && whatsappWeb.enabled === false) {
      await disconnectWhatsAppClient(req.user.tenantId);
    }

    res.status(200).json(integration);
  } catch (err) {
    console.error('Error updating integrations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Connect/Initialize WhatsApp Web client (Temporarily Disabled)
app.post('/api/integrations/whatsapp-web/connect', authenticateToken, async (req, res) => {
  return res.status(400).json({ error: 'WhatsApp Web (QR scan) integration is temporarily disabled.' });
});

// 4. Disconnect/Logout WhatsApp Web client (Temporarily Disabled)
app.post('/api/integrations/whatsapp-web/disconnect', authenticateToken, async (req, res) => {
  return res.status(200).json({ message: 'WhatsApp Web integration is disabled.' });
});

// 5. Get WhatsApp Web client status (Temporarily Disabled)
app.get('/api/integrations/whatsapp-web/status', authenticateToken, async (req, res) => {
  return res.status(200).json({ status: 'DISABLED', qr: null });
});

// 6. Public Webhook - Official WhatsApp API
app.get('/api/webhooks/whatsapp-api', handleWhatsAppApiWebhook);
app.post('/api/webhooks/whatsapp-api', handleWhatsAppApiWebhook);

// 7. Public Webhook - Meta Messenger & Instagram
app.get('/api/webhooks/meta', handleMetaWebhook);
app.post('/api/webhooks/meta', handleMetaWebhook);

// 8. Proactively Start an External Chat (WhatsApp Web or WhatsApp API)
app.post('/api/conversations/start-external', authenticateToken, async (req, res) => {
  const { channel, phoneNumber, name, text } = req.body;
  const tenantId = req.user.tenantId;

  if (!channel || !phoneNumber || !text) {
    return res.status(400).json({ error: 'Channel, Phone Number, and initial message text are required' });
  }

  // Clean phone number (keep digits only)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

  try {
    let visitorId;
    if (channel === 'whatsapp-web') {
      visitorId = `whatsapp-web:${cleanPhone}@c.us`;
    } else if (channel === 'whatsapp-api') {
      visitorId = `whatsapp-api:${cleanPhone}`;
    } else {
      return res.status(400).json({ error: 'Invalid channel specified' });
    }

    // 1. Find or create Visitor
    let visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      visitor = new Visitor({
        _id: visitorId,
        tenantId,
        name: name || `WhatsApp Contact (+${cleanPhone})`,
        phoneNumber: cleanPhone,
        source: channel,
        isOnline: true
      });
      await visitor.save();
    }

    // 2. Find or create active Conversation
    let conversation = await Conversation.findOne({
      tenantId,
      visitorId,
      status: { $ne: 'Closed' }
    });

    if (!conversation) {
      conversation = new Conversation({
        tenantId,
        visitorId,
        status: 'Active',
        source: channel,
        assignedAgentId: req.user.userId
      });
      await conversation.save();
    }

    // 3. Send message via the proper channel
    if (channel === 'whatsapp-web') {
      await sendWhatsAppWebMessage(tenantId, visitorId, text);
    } else if (channel === 'whatsapp-api') {
      const integration = await Integration.findOne({ tenantId });
      if (integration && integration.whatsappApi?.enabled) {
        await sendWhatsAppApiMessage(integration, cleanPhone, text);
      } else {
        return res.status(400).json({ error: 'WhatsApp API integration is not enabled or configured' });
      }
    }

    // 4. Save Message in DB
    const agent = await User.findById(req.user.userId);
    const message = new Message({
      conversationId: conversation._id,
      senderType: 'Agent',
      senderId: req.user.userId,
      senderName: agent ? agent.name : 'Agent',
      text,
      timestamp: new Date()
    });
    await message.save();

    // 5. Update Conversation updatedAt
    conversation.updatedAt = new Date();
    await conversation.save();

    // 6. Broadcast to dashboard agents
    const populatedConv = await Conversation.findById(conversation._id).populate('assignedAgentId', 'name email avatarUrl status');
    if (dashboardNamespace) {
      dashboardNamespace.to(`tenant_${tenantId}`).emit('conversation-created', populatedConv);
      dashboardNamespace.to(`tenant_${tenantId}`).emit('agent-msg-received', {
        conversationId: conversation._id,
        message
      });
    }

    res.status(201).json({ conversation: populatedConv, message });
  } catch (err) {
    console.error('Error starting external conversation:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// 9. Debug Conversations & Database State
app.get('/api/conversations/debug', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    const conversations = await Conversation.find({ tenantId });
    const visitors = await Visitor.find({ tenantId });
    const messages = await Message.find({});
    
    const stats = {
      totalConversations: conversations.length,
      totalVisitors: visitors.length,
      totalMessages: messages.length,
      groupedBySource: conversations.reduce((acc, c) => {
        const src = c.source || 'webchat';
        acc[src] = (acc[src] || 0) + 1;
        return acc;
      }, {}),
      conversationsList: conversations.map(c => ({
        id: c._id,
        source: c.source || 'webchat',
        status: c.status,
        visitorId: c.visitorId,
        updatedAt: c.updatedAt
      }))
    };
    
    res.status(200).json(stats);
  } catch (err) {
    console.error('Debug endpoint failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Debug Server Logs (PM2 logs fallback to file tailing)
app.get('/api/debug/logs', authenticateToken, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  exec('pm2 logs livechat-backend --lines 150 --no-colors', { timeout: 10000 }, (error, stdout, stderr) => {
    if (error) {
      const logPaths = [
        path.join(process.env.HOME || '/root', '.pm2/logs/livechat-backend-out.log'),
        '/root/.pm2/logs/livechat-backend-out.log',
        '/root/.pm2/logs/livechat-backend-error.log'
      ];
      
      for (const logPath of logPaths) {
        if (fs.existsSync(logPath)) {
          const stats = fs.statSync(logPath);
          const size = stats.size;
          const fd = fs.openSync(logPath, 'r');
          const bufferSize = Math.min(size, 8192);
          const buffer = Buffer.alloc(bufferSize);
          fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, size - bufferSize));
          fs.closeSync(fd);
          combinedLogs += `\n--- LOG FILE: ${logPath} ---\n${buffer.toString()}\n`;
        }
      }
      return res.status(200).send(combinedLogs || 'No logs available.');
    }
    res.status(200).send(stdout || stderr || 'No PM2 output.');
  });
});

// ============================================
// BILLING & RAZORPAY SUBSCRIPTION ENDPOINTS
// ============================================

// 1. Get Current Tenant Billing State
app.get('/api/billing/current', authenticateToken, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const usedSeats = await User.countDocuments({ tenantId: req.user.tenantId });
    const payments = await Payment.find({ tenantId: req.user.tenantId }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      plan: tenant.plan || 'free',
      planPrice: tenant.planPrice || 0,
      maxAgents: tenant.maxAgents || 1,
      usedSeats,
      features: tenant.features || {
        liveActivityTracking: false,
        whitelabelBranding: false,
        socialMetaDm: false
      },
      subscription: tenant.subscription || {
        status: 'free',
        setupFeePaid: false
      },
      razorpayKeyId: RAZORPAY_KEY_ID || 'rzp_test_public_key',
      paymentHistory: payments
    });
  } catch (err) {
    console.error('Error fetching billing info:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Create Razorpay Subscription / Order
app.post('/api/billing/create-order', authenticateToken, async (req, res) => {
  const { plan } = req.body; // 'growth' (₹299) or 'business' (₹399)

  if (!['growth', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected. Choose growth or business.' });
  }

  const tenant = await Tenant.findById(req.user.tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const monthlyPrice = plan === 'growth' ? 299 : 399;
  const setupFee = tenant.subscription?.setupFeePaid ? 0 : 999;
  const totalPayableINR = monthlyPrice + setupFee;
  const totalPayablePaise = totalPayableINR * 100;

  try {
    let orderId = 'order_test_' + Date.now();
    
    // If Razorpay live keys are configured, call Razorpay API
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        },
        body: JSON.stringify({
          amount: totalPayablePaise,
          currency: 'INR',
          receipt: `rcpt_${tenant._id.toString().substring(0, 10)}_${Date.now()}`,
          notes: {
            tenantId: tenant._id.toString(),
            tenantName: tenant.name,
            plan,
            monthlyPrice,
            setupFee
          }
        })
      });

      if (rzpRes.ok) {
        const rzpData = await rzpRes.json();
        orderId = rzpData.id;
      } else {
        const errorData = await rzpRes.json();
        console.warn('Razorpay order creation warning:', errorData);
      }
    }

    res.status(200).json({
      orderId,
      amount: totalPayableINR,
      amountPaise: totalPayablePaise,
      currency: 'INR',
      plan,
      monthlyPrice,
      setupFee,
      keyId: RAZORPAY_KEY_ID || 'rzp_test_public_demo',
      tenantName: tenant.name,
      tenantDomain: tenant.domain,
      userEmail: req.user.email,
      userName: req.user.name
    });

  } catch (err) {
    console.error('Error creating billing order:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Verify Payment & Activate Plan Mandate
app.post('/api/billing/verify-payment', authenticateToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, paymentMethod } = req.body;

  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Validate Signature if keys are set
    if (RAZORPAY_KEY_SECRET && razorpay_signature && razorpay_order_id) {
      const generated_signature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      }
    }

    const selectedPlan = ['growth', 'business'].includes(plan) ? plan : 'growth';
    const planPrice = selectedPlan === 'growth' ? 299 : 399;
    const maxAgents = selectedPlan === 'growth' ? 3 : 6;

    // Update Tenant
    tenant.plan = selectedPlan;
    tenant.planPrice = planPrice;
    tenant.maxAgents = maxAgents;
    tenant.features = {
      liveActivityTracking: true,
      whitelabelBranding: true,
      socialMetaDm: selectedPlan === 'business'
    };
    tenant.subscription = {
      razorpaySubscriptionId: razorpay_payment_id || `sub_${Date.now()}`,
      status: 'active',
      setupFeePaid: true,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastPaymentDate: new Date()
    };
    await tenant.save();

    // Create Payment Record
    const payment = new Payment({
      tenantId: tenant._id,
      razorpayPaymentId: razorpay_payment_id || `pay_${Date.now()}`,
      razorpaySubscriptionId: tenant.subscription.razorpaySubscriptionId,
      amount: planPrice + (tenant.subscription.setupFeePaid ? 0 : 999),
      currency: 'INR',
      plan: selectedPlan,
      type: 'recurring_subscription',
      status: 'success',
      paymentMethod: paymentMethod || 'upi_autopay'
    });
    await payment.save();

    // Create Audit Log
    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user.userId,
      actorEmail: req.user.email || 'Admin',
      action: 'PLAN_UPGRADE_SUCCESS',
      details: {
        plan: selectedPlan,
        amount: payment.amount,
        paymentId: payment.razorpayPaymentId
      }
    });

    res.status(200).json({
      message: `Successfully upgraded to ${selectedPlan.toUpperCase()} plan!`,
      tenant: {
        id: tenant._id,
        plan: tenant.plan,
        planPrice: tenant.planPrice,
        maxAgents: tenant.maxAgents,
        features: tenant.features,
        subscription: tenant.subscription
      }
    });

  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Public Webhook - Razorpay Auto-Debit & Recurring Subscriptions
app.post('/api/billing/webhook', async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const eventPayload = req.body;

  try {
    // Verify Webhook Signature if configured
    if (RAZORPAY_WEBHOOK_SECRET && webhookSignature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(eventPayload))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = eventPayload.event;
    const paymentEntity = eventPayload.payload?.payment?.entity || eventPayload.payload?.subscription?.entity;
    const notes = paymentEntity?.notes || {};
    const tenantId = notes.tenantId;

    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      const tenant = await Tenant.findById(tenantId);
      if (tenant) {
        if (event === 'subscription.charged' || event === 'payment.captured') {
          tenant.subscription.status = 'active';
          tenant.subscription.lastPaymentDate = new Date();
          tenant.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await tenant.save();

          await Payment.create({
            tenantId: tenant._id,
            razorpayPaymentId: paymentEntity.id || `pay_${Date.now()}`,
            amount: (paymentEntity.amount || 29900) / 100,
            currency: 'INR',
            plan: tenant.plan,
            type: 'recurring_subscription',
            status: 'success',
            paymentMethod: paymentEntity.method || 'upi_autopay'
          });

          await AuditLog.create({
            tenantId: tenant._id,
            action: 'RECURRING_CHARGE_SUCCESS',
            details: { event, amount: (paymentEntity.amount || 29900) / 100 }
          });

        } else if (['subscription.halted', 'subscription.cancelled', 'payment.failed'].includes(event)) {
          // AUTO-DOWNGRADE TO FREE PLAN UPON FAILED MANDATE
          const previousPlan = tenant.plan;
          tenant.plan = 'free';
          tenant.planPrice = 0;
          tenant.maxAgents = 1;
          tenant.features = {
            liveActivityTracking: false,
            whitelabelBranding: false,
            socialMetaDm: false
          };
          tenant.subscription.status = 'halted';
          await tenant.save();

          await Payment.create({
            tenantId: tenant._id,
            razorpayPaymentId: paymentEntity.id || `fail_${Date.now()}`,
            amount: (paymentEntity.amount || 29900) / 100,
            currency: 'INR',
            plan: previousPlan,
            type: 'recurring_subscription',
            status: 'failed',
            failureReason: paymentEntity.error_description || 'Auto-debit mandate failed'
          });

          await AuditLog.create({
            tenantId: tenant._id,
            action: 'AUTO_DOWNGRADE_TO_FREE',
            details: { event, reason: 'Recurring payment failed or mandate cancelled' }
          });
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Error handling Razorpay webhook:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// ============================================
// SUPER ADMIN MANAGEMENT ENDPOINTS (Role: SuperAdmin)
// ============================================

// 1. SuperAdmin Platform Overview Statistics
app.get('/api/superadmin/overview', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments({});
    const totalUsers = await User.countDocuments({});
    const totalVisitors = await Visitor.countDocuments({});
    const activeMandates = await Tenant.countDocuments({ 'subscription.status': 'active' });
    
    // Revenue calculations
    const successPayments = await Payment.find({ status: 'success' });
    const totalRevenueINR = successPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Plan distributions
    const freeTenants = await Tenant.countDocuments({ plan: 'free' });
    const growthTenants = await Tenant.countDocuments({ plan: 'growth' });
    const businessTenants = await Tenant.countDocuments({ plan: 'business' });

    // Early Bird Offer Quota: Paid users counter out of first 1,000
    const earlyBirdClaimed = growthTenants + businessTenants;

    res.status(200).json({
      totalTenants,
      totalUsers,
      totalVisitors,
      activeMandates,
      totalRevenueINR,
      earlyBird: {
        claimed: earlyBirdClaimed,
        totalLimit: 1000,
        remaining: Math.max(0, 1000 - earlyBirdClaimed)
      },
      planBreakdown: {
        free: freeTenants,
        growth: growthTenants,
        business: businessTenants
      }
    });
  } catch (err) {
    console.error('Error fetching SuperAdmin overview:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. SuperAdmin - List All Tenants
app.get('/api/superadmin/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await Tenant.find({}).sort({ createdAt: -1 });
    
    const enrichedTenants = await Promise.all(
      tenants.map(async (t) => {
        const userCount = await User.countDocuments({ tenantId: t._id });
        const visitorCount = await Visitor.countDocuments({ tenantId: t._id });
        const adminUser = await User.findOne({ tenantId: t._id, role: 'Admin' }, 'name email status');
        return {
          id: t._id,
          name: t.name,
          domain: t.domain,
          apiKey: t.apiKey,
          plan: t.plan || 'free',
          planPrice: t.planPrice || 0,
          maxAgents: t.maxAgents || 1,
          isSuspended: !!t.isSuspended,
          features: t.features,
          subscription: t.subscription,
          userCount,
          visitorCount,
          adminEmail: adminUser?.email || 'N/A',
          adminName: adminUser?.name || 'N/A',
          createdAt: t.createdAt
        };
      })
    );

    res.status(200).json(enrichedTenants);
  } catch (err) {
    console.error('Error fetching tenants list:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. SuperAdmin - Update Tenant Plan / Quota / Status
app.put('/api/superadmin/tenants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { plan, planPrice, maxAgents, isSuspended, features } = req.body;

  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (plan !== undefined) tenant.plan = plan;
    if (planPrice !== undefined) tenant.planPrice = Number(planPrice);
    if (maxAgents !== undefined) tenant.maxAgents = Number(maxAgents);
    if (isSuspended !== undefined) tenant.isSuspended = Boolean(isSuspended);
    if (features !== undefined) {
      tenant.features = { ...tenant.features, ...features };
    }

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user.userId,
      actorEmail: req.user.email || 'SuperAdmin',
      action: 'TENANT_UPDATED_BY_SUPERADMIN',
      details: { plan: tenant.plan, maxAgents: tenant.maxAgents, isSuspended: tenant.isSuspended }
    });

    res.status(200).json({ message: 'Tenant updated successfully', tenant });
  } catch (err) {
    console.error('Error updating tenant:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. SuperAdmin - List All Users & Agents
app.get('/api/superadmin/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash').populate('tenantId', 'name domain plan').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching global users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. SuperAdmin - Update User Role / Ban Status
app.put('/api/superadmin/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { role, isBanned, name, email } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role && ['SuperAdmin', 'Admin', 'Agent'].includes(role)) {
      user.role = role;
    }
    if (isBanned !== undefined) user.isBanned = Boolean(isBanned);
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: req.user.userId,
      actorEmail: req.user.email || 'SuperAdmin',
      action: 'USER_UPDATED_BY_SUPERADMIN',
      details: { targetUserId: user._id, role: user.role, isBanned: user.isBanned }
    });

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. SuperAdmin - Force Reset User Password
app.post('/api/superadmin/users/:id/reset-password', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: req.user.userId,
      actorEmail: req.user.email || 'SuperAdmin',
      action: 'USER_PASSWORD_FORCED_RESET',
      details: { targetEmail: user.email }
    });

    res.status(200).json({ message: `Password reset successfully for ${user.email}` });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. SuperAdmin - Master Payment Transactions Ledger
app.get('/api/superadmin/payments', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const payments = await Payment.find({}).populate('tenantId', 'name domain').sort({ createdAt: -1 }).limit(100);
    res.status(200).json(payments);
  } catch (err) {
    console.error('Error fetching payments ledger:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. SuperAdmin - Record Manual / Offline Payment
app.post('/api/superadmin/payments', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { tenantId, amount, plan, paymentMethod, notes } = req.body;

  if (!tenantId || !amount) {
    return res.status(400).json({ error: 'Tenant and amount are required' });
  }

  try {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const payment = new Payment({
      tenantId: tenant._id,
      razorpayPaymentId: `manual_${Date.now()}`,
      amount: Number(amount),
      currency: 'INR',
      plan: plan || tenant.plan,
      type: 'manual_adjustment',
      status: 'success',
      paymentMethod: paymentMethod || 'bank_transfer',
      failureReason: notes || ''
    });
    await payment.save();

    // If upgrading plan manually
    if (plan && ['growth', 'business', 'enterprise'].includes(plan)) {
      tenant.plan = plan;
      tenant.planPrice = plan === 'growth' ? 299 : plan === 'business' ? 399 : 999;
      tenant.maxAgents = plan === 'growth' ? 3 : plan === 'business' ? 6 : 20;
      tenant.features = {
        liveActivityTracking: true,
        whitelabelBranding: true,
        socialMetaDm: plan === 'business' || plan === 'enterprise'
      };
      tenant.subscription.status = 'active';
      tenant.subscription.setupFeePaid = true;
      tenant.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tenant.save();
    }

    res.status(201).json({ message: 'Payment recorded successfully', payment });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. SuperAdmin - Master Audit & Security Stream
app.get('/api/superadmin/audit-logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find({}).populate('tenantId', 'name domain').sort({ createdAt: -1 }).limit(150);
    res.status(200).json(logs);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 10. SuperAdmin - One-Click Support Impersonation (Login as Tenant Admin)
app.post('/api/superadmin/impersonate/:tenantId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let adminUser = await User.findOne({ tenantId: tenant._id, role: 'Admin' });
    if (!adminUser) {
      adminUser = await User.findOne({ tenantId: tenant._id });
    }

    if (!adminUser) {
      return res.status(404).json({ error: 'No user found for this tenant to impersonate' });
    }

    const impersonationToken = jwt.sign(
      { userId: adminUser._id, tenantId: tenant._id, role: adminUser.role, isImpersonated: true },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    res.status(200).json({
      token: impersonationToken,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey,
        plan: tenant.plan
      }
    });

  } catch (err) {
    console.error('Error impersonating tenant:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================
// SERVE DEMO SITE STATICALLY (Allows correct HTTP Origin and PushState Routing)
// ============================================
app.use('/demo', express.static(path.join(__dirname, '../host-demo')));

// ============================================
// DYNAMIC CLIENT WIDGET BUNDLER
// ============================================
app.get('/widget.js', (req, res) => {
  const widgetFilePath = path.join(__dirname, '../widget/widget.js');

  try {
    if (!fs.existsSync(widgetFilePath)) {
      return res.status(404).send('console.error("LetsTrack: widget file not found.");');
    }

    let code = fs.readFileSync(widgetFilePath, 'utf8');

    // Dynamic backend URL injection based on requested protocol and host
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    if (req.get('host') === 'livechat.vrhere.in') {
      protocol = 'https';
    }
    const backendUrl = `${protocol}://${req.get('host')}`;
    code = code.replace(/__BACKEND_URL__/g, backendUrl);

    res.setHeader('Content-Type', 'application/javascript');
    res.status(200).send(code);

  } catch (err) {
    console.error('Error serving widget script:', err);
    res.status(500).send('console.error("LetsTrack: internal server serving error.");');
  }
});

// ============================================
// START SERVER
// ============================================
const httpServer = http.createServer(app);
initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` LetsTrack REST + WebSockets Engine Active!`);
  console.log(` Running on Port: ${PORT}`);
  console.log(` Server API Root: http://localhost:${PORT}`);
  console.log(` Socket Endpoint: ws://localhost:${PORT}`);
  console.log(` Widget Link:     http://localhost:${PORT}/widget.js`);
  console.log(`===============================================`);
});
