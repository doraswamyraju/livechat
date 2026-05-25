package com.letstrack.agent.network

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.letstrack.agent.MainActivity

class LetsTrackMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Store FCM Token locally in SharedPreferences for seamless syncing on Login/Dashboard load
        val prefs = getSharedPreferences("letstrack_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
        
        // Proactively attempt to sync with backend if user is already authenticated
        // Under standard setups, MainActivity will read SharedPreferences and upload token to server.
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Extract title and body
        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "New Notification"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: "You received a new message."
        val conversationId = remoteMessage.data["conversationId"] ?: ""
        val visitorName = remoteMessage.data["visitorName"] ?: ""

        sendSystemNotification(title, body, conversationId, visitorName)
    }

    private fun sendSystemNotification(title: String, body: String, conversationId: String, visitorName: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("conversationId", conversationId)
            putExtra("visitorName", visitorName)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "letstrack_channel_id"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.sym_def_app_icon) // Built-in default app icon fallback
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Android Oreo (8.0+) requires explicit Notification Channels
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "LetsTrack Active Chats",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Real-time alerts for customer messages and unassigned chats"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}
