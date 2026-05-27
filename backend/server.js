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

import { Tenant, User, Visitor, Conversation, Message, WidgetSettings, QuickReply } from './models.js';
import { initializeSocket } from './socket.js';

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

// Connect MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB database.'))
  .catch(err => console.error('MongoDB database connection error:', err));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
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

  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
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

// 4. Retrieve Active Tenant Widget Settings
app.get('/api/settings/widget', async (req, res) => {
  const { apiKey, tenantId } = req.query;

  try {
    let settings = null;
    let resolvedTenantId = null;

    if (apiKey) {
      const tenant = await Tenant.findOne({ apiKey });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      resolvedTenantId = tenant._id;
      settings = await WidgetSettings.findOne({ tenantId: resolvedTenantId });
    } else if (tenantId) {
      resolvedTenantId = tenantId;
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        const tenant = await Tenant.findOne({ apiKey: tenantId });
        if (tenant) {
          resolvedTenantId = tenant._id;
        } else {
          return res.status(400).json({ error: 'Invalid tenantId format' });
        }
      }
      settings = await WidgetSettings.findOne({ tenantId: resolvedTenantId });
    } else {
      return res.status(400).json({ error: 'apiKey or tenantId required' });
    }

    if (!settings && resolvedTenantId) {
      settings = new WidgetSettings({
        tenantId: resolvedTenantId
      });
      await settings.save();
    }
    res.status(200).json(settings);

  } catch (err) {
    console.error('Error retrieving settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Update Widget Settings (Admin only)
app.put('/api/settings/widget', authenticateToken, async (req, res) => {
  const { primaryColor, headingText, welcomeMessage, preChatEnabled, position, headerTextColor, gradientColor, useGradient, statusText, borderRadius, launcherText } = req.body;

  try {
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
