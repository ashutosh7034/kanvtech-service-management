import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/operations_provider.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OperationsProvider>().fetchConversations();
    });
  }

  void _openConversation(ChatConversationModel conv) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ConversationDetailScreen(conversation: conv),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ops = context.watch<OperationsProvider>();

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Internal Messaging'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ops.fetchConversations(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ops.fetchConversations(),
        child: ops.isLoading
            ? const Center(child: CircularProgressIndicator())
            : ops.conversations.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.chat_bubble_outline,
                              size: 48, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text('No active conversations',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary)),
                          SizedBox(height: 4),
                          Text(
                              'Direct messages with colleagues will appear here.',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: ops.conversations.length,
                    itemBuilder: (ctx, i) {
                      final c = ops.conversations[i];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.brandPrimaryLight,
                            child: Text(
                              c.participantNames.isNotEmpty
                                  ? c.participantNames.first
                                      .substring(0, 1)
                                      .toUpperCase()
                                  : 'M',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.brandPrimary),
                            ),
                          ),
                          title: Text(
                            c.subject ?? c.participantNames.join(', '),
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          subtitle: Text(
                            c.lastMessage ?? 'No messages yet',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textSecondary),
                          ),
                          trailing: const Icon(Icons.chevron_right, size: 20),
                          onTap: () => _openConversation(c),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}

class ConversationDetailScreen extends StatefulWidget {
  final ChatConversationModel conversation;

  const ConversationDetailScreen({super.key, required this.conversation});

  @override
  State<ConversationDetailScreen> createState() =>
      _ConversationDetailScreenState();
}

class _ConversationDetailScreenState extends State<ConversationDetailScreen> {
  final _messageController = TextEditingController();
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OperationsProvider>().fetchMessages(widget.conversation.id);
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _handleSend() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSending = true);
    try {
      await context
          .read<OperationsProvider>()
          .sendMessage(widget.conversation.id, text);
      _messageController.clear();
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ops = context.watch<OperationsProvider>();

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: Text(widget.conversation.subject ?? 'Internal Chat'),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: ops.currentMessages.length,
              itemBuilder: (ctx, i) {
                final m = ops.currentMessages[i];
                return Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.bgSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.senderName,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                              color: AppColors.brandPrimary),
                        ),
                        const SizedBox(height: 4),
                        Text(m.message,
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.textPrimary)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            color: AppColors.bgSurface,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration:
                        const InputDecoration(hintText: 'Type your message...'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  icon: _isSending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.send),
                  onPressed: _isSending ? null : _handleSend,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
