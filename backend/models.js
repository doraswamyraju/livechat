import mongoose from 'mongoose';

// 1. Tenant Model
const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// 2. User (Agent/Admin/SuperAdmin) Model
const UserSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['SuperAdmin', 'Admin', 'Agent'], default: 'Agent' },
  status: { type: String, enum: ['Online', 'Away', 'Offline'], default: 'Offline' },
  avatarUrl: { type: String, default: '' },
  fcmToken: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// 3. Visitor Model (Visitor UUID is used as _id to keep sessions persistent)
const VisitorSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom UUID string
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  country: { type: String, default: 'Unknown' },
  city: { type: String, default: 'Unknown' },
  deviceType: { type: String, enum: ['Desktop', 'Mobile', 'Tablet'], default: 'Desktop' },
  browser: { type: String, default: 'Unknown' },
  os: { type: String, default: 'Unknown' },
  currentUrl: { type: String, default: '' },
  referrer: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: false },
  source: { type: String, enum: ['webchat', 'whatsapp-web', 'whatsapp-api', 'instagram', 'facebook'], default: 'webchat' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false }); // Disable automatic _id creation since we supply visitor _id as a custom UUID String.

// 4. Conversation Model
const ConversationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  visitorId: { type: String, ref: 'Visitor', required: true },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['Unassigned', 'Active', 'Closed', 'Archived'], default: 'Unassigned' },
  isArchived: { type: Boolean, default: false },
  source: { type: String, enum: ['webchat', 'whatsapp-web', 'whatsapp-api', 'instagram', 'facebook'], default: 'webchat' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 5. Message Model
const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderType: { type: String, enum: ['Visitor', 'Agent', 'System'], required: true },
  senderId: { type: String, required: true }, // Can be Visitor UUID or User ID
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// 6. Widget Settings Model
const WidgetSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  primaryColor: { type: String, default: '#7C3AED' }, // Deep Purple
  headingText: { type: String, default: 'Chat with Us!' },
  welcomeMessage: { type: String, default: 'Hi there! How can we help you today?' },
  preChatEnabled: { type: Boolean, default: false },
  position: { type: String, enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
  headerTextColor: { type: String, default: '#ffffff' },
  gradientColor: { type: String, default: '#312E81' },
  useGradient: { type: Boolean, default: true },
  statusText: { type: String, default: 'Typically replies instantly' },
  borderRadius: { type: Number, default: 16 },
  launcherText: { type: String, default: 'Chat' }
});

// 7. Quick Reply Model
const QuickReplySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  shortcut: { type: String, required: true },
  text: { type: String, required: true }
});

// 8. Integration Model
const IntegrationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  whatsappWeb: {
    enabled: { type: Boolean, default: false }
  },
  whatsappApi: {
    enabled: { type: Boolean, default: false },
    phoneNumberId: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    verifyToken: { type: String, default: '' }
  },
  meta: {
    enabled: { type: Boolean, default: false },
    pageId: { type: String, default: '' },
    instagramAccountId: { type: String, default: '' },
    pageAccessToken: { type: String, default: '' },
    verifyToken: { type: String, default: '' }
  }
});

export const Tenant = mongoose.model('Tenant', TenantSchema);
export const User = mongoose.model('User', UserSchema);
export const Visitor = mongoose.model('Visitor', VisitorSchema);
export const Conversation = mongoose.model('Conversation', ConversationSchema);
export const Message = mongoose.model('Message', MessageSchema);
export const WidgetSettings = mongoose.model('WidgetSettings', WidgetSettingsSchema);
export const QuickReply = mongoose.model('QuickReply', QuickReplySchema);
export const Integration = mongoose.model('Integration', IntegrationSchema);
