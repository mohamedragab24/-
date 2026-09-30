import 'package:flutter/material.dart';
import 'package0cloud_firestore/cloud_firestore.dart';

class NotificationsScreen extends StatelessWidget {
  final String userId;

  const NotificationsScreen({Key? key, required this.userId}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('مركز الإشعارات'),
        centerTitle: true,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('notifications')
            .where('userId', isEqualTo: userId)
            .orderBy('createdAt', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(child: Text('لا توجد إشعارات'));
          }

          final docs = snapshot.data!.docs;

          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: docs.length,
            itemBuilder: (context, index) {
              final notif = docs[index].data() as Map<String, dynamic>;
              final bool isDelivered = notif['status'] == 'delivered';
              final String notifType = notif['type'] ?? 'in_app';

              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: Icon(
                    notifType == 'push'
                        ? Icons.mobile_screen_share
                        : Icons.mark_chat_unread,
                    color: isDelivered ? Colors.green : Colors.orange,
                  ),
                  title: Text(
                    notif['title'] ?? '',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text(notif['body'] ?? ''),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Chip(
                            label: Text(
                              isDelivered ? 'تم التسليم' : 'قيد الإرسال / لم تصل',
                              style: const TextStyle(fontSize: 10, color: Colors.white),
                            ),
                            backgroundColor:
                                isDelivered ? Colors.green : Colors.orange,
                            visualDensity: VisualDensity.compact,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            notifType == 'push' ? 'خارج التطبيق (Push)' : 'داخل التطبيق',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
