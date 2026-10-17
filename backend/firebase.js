import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseKeyPath = path.join(__dirname, 'firebase-key.json');
let isFirebaseInitialized = false;

if (fs.existsSync(firebaseKeyPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(firebaseKeyPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('Successfully initialized Firebase Admin SDK.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err);
  }
} else {
  console.warn('firebase-key.json not found in backend folder. Push alerts will execute in fallback debug logging mode.');
}

/**
 * Sends a high-priority FCM push notification to a registered device token.
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!isFirebaseInitialized || !fcmToken) {
    console.log(`[Push Notification Debug] Target: ${fcmToken || 'No Device Token'} | Title: ${title} | Body: ${body}`);
    return;
  }

  const safeData = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      safeData[k] = v !== null && v !== undefined ? String(v) : '';
    }
  }

  const message = {
    notification: { 
      title, 
      body
    },
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    data: safeData,
    token: fcmToken
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('FCM Push Notification sent successfully. Response:', response);
    return response;
  } catch (err) {
    const errCode = err?.errorInfo?.code || err?.code || '';
    const errMsg = err?.message || '';
    // If device uninstalled app or token expired, auto-prune from DB
    if (errCode === 'messaging/registration-token-not-registered' || 
        errMsg.includes('NotRegistered') || 
        errMsg.includes('APNs device token is disabled')) {
      try {
        const { User } = await import('./models.js');
        await User.updateMany(
          { $or: [{ fcmToken }, { fcmTokens: fcmToken }] },
          { $pull: { fcmTokens: fcmToken }, $set: { fcmToken: '' } }
        );
        console.log(`[FCM Cleanup] Pruned stale/unregistered device token: ${fcmToken.substring(0, 15)}...`);
      } catch (cleanupErr) {
        // ignore
      }
    } else {
      console.error('Error sending FCM Push Notification:', err);
    }
  }
};
