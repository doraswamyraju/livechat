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

import { Tenant, User, Visitor, Conversation, Message, WidgetSettings } from './models.js';
import { initializeSocket } from './socket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
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

    if (apiKey) {
      const tenant = await Tenant.findOne({ apiKey });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      settings = await WidgetSettings.findOne({ tenantId: tenant._id });
    } else if (tenantId) {
      settings = await WidgetSettings.findOne({ tenantId });
    } else {
      return res.status(400).json({ error: 'apiKey or tenantId required' });
    }

    if (!settings) return res.status(404).json({ error: 'Settings not found' });
    res.status(200).json(settings);

  } catch (err) {
    console.error('Error retrieving settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Update Widget Settings (Admin only)
app.put('/api/settings/widget', authenticateToken, async (req, res) => {
  const { primaryColor, headingText, welcomeMessage, preChatEnabled, position } = req.body;

  try {
    const settings = await WidgetSettings.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { primaryColor, headingText, welcomeMessage, preChatEnabled, position },
      { new: true, upsert: true }
    );
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
    const totalVisitors = await Visitor.countDocuments({ tenantId });
    const onlineVisitors = await Visitor.countDocuments({ tenantId, isOnline: true });
    const activeConversations = await Conversation.countDocuments({ tenantId, status: 'Active' });
    const unassignedConversations = await Conversation.countDocuments({ tenantId, status: 'Unassigned' });
    
    // Total historical chats
    const totalChats = await Conversation.countDocuments({ tenantId });

    // Agent counts
    const totalAgents = await User.countDocuments({ tenantId });
    const onlineAgents = await User.countDocuments({ tenantId, status: 'Online' });

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
    await User.findByIdAndUpdate(req.user.userId, { fcmToken });
    res.status(200).json({ message: 'FCM Token registered successfully' });
  } catch (err) {
    console.error('Error saving FCM Token:', err);
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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
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
