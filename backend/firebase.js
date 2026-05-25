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

  const message = {
    notification: { title, body },
    data: data,
    token: fcmToken
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('FCM Push Notification sent successfully. Response:', response);
    return response;
  } catch (err) {
    console.error('Error sending FCM Push Notification:', err);
  }
};
