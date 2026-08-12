import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Tenant } from './models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/letstrack';
const SUPER_EMAIL = 'rajugariventures@gmail.com';
const SUPER_PASS = 'BOHPM6139n@';

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB database:', mongoose.connection.name);

    // Find first tenant or create platform tenant
    let tenant = await Tenant.findOne({});
    if (!tenant) {
      tenant = new Tenant({
        name: 'ManaCity Platform',
        domain: 'manacity.in',
        apiKey: 'lt_superadmin_master_key_2026'
      });
      await tenant.save();
    }

    const passwordHash = await bcrypt.hash(SUPER_PASS, 10);

    let user = await User.findOne({ email: SUPER_EMAIL.toLowerCase().trim() });
    if (user) {
      user.passwordHash = passwordHash;
      user.role = 'SuperAdmin';
      if (!user.tenantId) user.tenantId = tenant._id;
      await user.save();
      console.log(`Updated existing user ${SUPER_EMAIL} to SuperAdmin role with new password.`);
    } else {
      user = new User({
        tenantId: tenant._id,
        name: 'Platform Super Admin',
        email: SUPER_EMAIL.toLowerCase().trim(),
        passwordHash: passwordHash,
        role: 'SuperAdmin',
        status: 'Online'
      });
      await user.save();
      console.log(`Created new SuperAdmin user: ${SUPER_EMAIL}`);
    }

    console.log('\n--- SuperAdmin Credentials ---');
    console.log(`Email: ${SUPER_EMAIL}`);
    console.log(`Role: SuperAdmin`);
    console.log(`Tenant: ${tenant.name}`);
    console.log(`Password: ${SUPER_PASS}\n`);

    process.exit(0);
  } catch (err) {
    console.error('Error creating SuperAdmin:', err);
    process.exit(1);
  }
}

main();
