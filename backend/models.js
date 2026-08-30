import mongoose from 'mongoose';

// 1. Tenant Model
const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true, index: true },
  manacityBusinessGroupId: { type: String, default: undefined },
  // Plan & Subscription Billing State
  plan: { 
    type: String, 
    enum: ['free', 'growth', 'business', 'enterprise'], 
    default: 'free' 
  },
  planPrice: { type: Number, default: 0 },
  maxAgents: { type: Number, default: 1 }, // Free: 1, Growth: 3 (1 admin + 2 employees), Business: 6 (1 admin + 5 employees)
  isSuspended: { type: Boolean, default: false },
  features: {
    liveActivityTracking: { type: Boolean, default: false }, // Live visitor radar/clicks
    whitelabelBranding: { type: Boolean, default: false },   // Remove "Powered by LetsTrack"
    socialMetaDm: { type: Boolean, default: false }          // FB & Instagram Sync
  },
  subscription: {
    razorpaySubscriptionId: { type: String, default: '' },
    razorpayCustomerId: { type: String, default: '' },
    razorpayPlanId: { type: String, default: '' },
    status: { 
      type: String, 
      enum: ['free', 'active', 'pending', 'halted', 'cancelled'], 
      default: 'free' 
    },
    setupFeePaid: { type: Boolean, default: false },
    currentPeriodEnd: { type: Date, default: null },
    graceUntil: { type: Date, default: null },
    lastPaymentDate: { type: Date, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

// Single Authoritative Unique Sparse Index for Tenant
TenantSchema.index(
  { manacityBusinessGroupId: 1 },
  { unique: true, sparse: true }
);

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
  isBanned: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
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
}, { _id: false });

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
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// 6. Widget Settings Model
const WidgetSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  primaryColor: { type: String, default: '#7C3AED' },
  headingText: { type: String, default: 'Chat with Us!' },
  welcomeMessage: { type: String, default: 'Hi there! How can we help you today?' },
  preChatEnabled: { type: Boolean, default: false },
  position: { type: String, enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
  headerTextColor: { type: String, default: '#ffffff' },
  gradientColor: { type: String, default: '#312E81' },
  useGradient: { type: Boolean, default: true },
  statusText: { type: String, default: 'Typically replies instantly' },
  borderRadius: { type: Number, default: 16 },
  launcherText: { type: String, default: 'Chat' },
  hideBranding: { type: Boolean, default: false } // Only respected if tenant.features.whitelabelBranding === true
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
    pageId: { type: String, default: undefined },
    instagramAccountId: { type: String, default: undefined },
    pageAccessToken: { type: String, default: '' },
    verifyToken: { type: String, default: '' }
  }
});

// Authoritative Unique Sparse Indexes for Meta Assets
IntegrationSchema.index(
  { 'meta.pageId': 1 },
  { unique: true, sparse: true }
);

IntegrationSchema.index(
  { 'meta.instagramAccountId': 1 },
  { unique: true, sparse: true }
);

// 9. Payment Transaction Model
const PaymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySubscriptionId: { type: String, default: '' },
  razorpayInvoiceId: { type: String, default: '' },
  amount: { type: Number, required: true }, // in INR (e.g. 299, 399, 999)
  currency: { type: String, default: 'INR' },
  plan: { type: String, default: 'growth' },
  type: { 
    type: String, 
    enum: ['setup_fee', 'recurring_subscription', 'manual_adjustment'], 
    default: 'recurring_subscription' 
  },
  status: { 
    type: String, 
    enum: ['success', 'pending', 'failed', 'refunded'], 
    default: 'pending' 
  },
  paymentMethod: { type: String, default: 'upi_autopay' },
  failureReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// 10. Platform Audit Log Model
const AuditLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, default: 'system' },
  action: { type: String, required: true }, // e.g. 'PLAN_UPGRADE', 'MANDATE_FAIL', 'USER_ROLE_CHANGE'
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const Tenant = mongoose.model('Tenant', TenantSchema);
export const User = mongoose.model('User', UserSchema);
export const Visitor = mongoose.model('Visitor', VisitorSchema);
export const Conversation = mongoose.model('Conversation', ConversationSchema);
export const Message = mongoose.model('Message', MessageSchema);
export const WidgetSettings = mongoose.model('WidgetSettings', WidgetSettingsSchema);
export const QuickReply = mongoose.model('QuickReply', QuickReplySchema);
export const Integration = mongoose.model('Integration', IntegrationSchema);
export const Payment = mongoose.model('Payment', PaymentSchema);
export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
