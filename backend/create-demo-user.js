import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Tenant, WidgetSettings } from './models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/letstrack';
const DEMO_EMAIL = 'demo@letstrack.manacity.in';
const DEMO_PASS = 'Demo@123';

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB database:', mongoose.connection.name);

    let tenant = await Tenant.findOne({ domain: 'letstrack.manacity.in' });
    if (!tenant) {
      tenant = await Tenant.findOne({});
    }

    if (!tenant) {
      tenant = new Tenant({
        name: 'LetsTrack Demo Store',
        domain: 'letstrack.manacity.in',
        apiKey: 'lt_demo_verification_key_2026',
        plan: 'free',
        maxAgents: 1,
        features: {
          liveActivityTracking: false,
          whitelabelBranding: false,
          socialMetaDm: false
        }
      });
      await tenant.save();
    }

    const passwordHash = await bcrypt.hash(DEMO_PASS, 10);

    let user = await User.findOne({ email: DEMO_EMAIL.toLowerCase().trim() });
    if (user) {
      user.passwordHash = passwordHash;
      user.role = 'Admin';
      user.tenantId = tenant._id;
      user.isBanned = false;
      await user.save();
      console.log(`Updated test user ${DEMO_EMAIL} with password ${DEMO_PASS}`);
    } else {
      user = new User({
        tenantId: tenant._id,
        name: 'Razorpay Verification Test Admin',
        email: DEMO_EMAIL.toLowerCase().trim(),
        passwordHash: passwordHash,
        role: 'Admin',
        status: 'Online'
      });
      await user.save();
      console.log(`Created test user: ${DEMO_EMAIL}`);
    }

    let widget = await WidgetSettings.findOne({ tenantId: tenant._id });
    if (!widget) {
      widget = new WidgetSettings({
        tenantId: tenant._id,
        primaryColor: '#dc2626',
        headingText: 'LetsTrack Support',
        statusText: 'Online',
        welcomeMessage: 'Welcome to LetsTrack! How can we assist you today?',
        hideBranding: false
      });
      await widget.save();
    }

    console.log('\n--- Verification Credentials Ready ---');
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASS}`);
    console.log(`Role:     Admin (Can view and test Billing & Subscription checkout)`);
    console.log(`Tenant:   ${tenant.name}\n`);

    process.exit(0);
  } catch (err) {
    console.error('Error creating demo verification user:', err);
    process.exit(1);
  }
}

main();
