import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Tenant } from './models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/letstrack';
const emailArg = process.argv[2];
const newPasswordArg = process.argv[3];

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB database:', mongoose.connection.name);

    if (!emailArg) {
      console.log('\n--- All Database Collections ---');
      const collections = await mongoose.connection.db.listCollections().toArray();
      collections.forEach(c => console.log(` - ${c.name}`));

      console.log('\n--- All Registered Tenants ---');
      const tenants = await Tenant.find({});
      tenants.forEach(t => console.log(`Tenant Name: ${t.name} | Domain: ${t.domain} | API Key: ${t.apiKey}`));

      console.log('\n--- All Registered Users ---');
      const users = await User.find({}).populate('tenantId');
      if (users.length === 0) {
        console.log('No users found in database.');
      } else {
        users.forEach(u => {
          console.log(`Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | Tenant: ${u.tenantId ? u.tenantId.name : 'N/A'}`);
        });
      }
      console.log('\nTo reset password, run:');
      console.log('node reset-admin-password.js <email> <newPassword>\n');
      process.exit(0);
    }

    if (!newPasswordArg) {
      console.error('Please provide a new password. Usage: node reset-admin-password.js <email> <newPassword>');
      process.exit(1);
    }

    const user = await User.findOne({ email: emailArg.toLowerCase().trim() });
    if (!user) {
      console.error(`User with email "${emailArg}" not found.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(newPasswordArg, 10);
    user.passwordHash = passwordHash;
    await user.save();

    console.log(`Successfully reset password for user: ${user.email}`);
    process.exit(0);
  } catch (err) {
    console.error('Error resetting password:', err);
    process.exit(1);
  }
}

main();
