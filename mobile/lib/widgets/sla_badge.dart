import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class SlaBadge extends StatelessWidget {
  final String status;
  final int? remainingSeconds;
  final bool showCountdown;

  const SlaBadge({
    super.key,
    required this.status,
    this.remainingSeconds,
    this.showCountdown = true,
  });

  String _formatRemaining(int? sec) {
    if (sec == null) return '';
    if (sec <= 0) return 'Overdue';
    final h = sec ~/ 3600;
    final m = (sec % 3600) ~/ 60;
    return '${h}h ${m}m remaining';
  }

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    Color border;
    IconData icon;
    String label;

    switch (status.toUpperCase()) {
      case 'BREACHED':
        bg = AppColors.slaBreachedBg;
        text = AppColors.slaBreachedText;
        border = AppColors.slaBreachedBorder;
        icon = Icons.cancel_outlined;
        label = 'SLA Breached';
        break;
      case 'WARNING':
        bg = AppColors.slaWarningBg;
        text = AppColors.slaWarningText;
        border = AppColors.slaWarningBorder;
        icon = Icons.warning_amber_rounded;
        label = 'SLA Risk (75%)';
        break;
      case 'MET':
        bg = AppColors.slaMetBg;
        text = AppColors.slaMetText;
        border = AppColors.slaMetBorder;
        icon = Icons.check_circle_outline;
        label = 'SLA Met';
        break;
      case 'ON_TRACK':
      default:
        bg = AppColors.slaOnTrackBg;
        text = AppColors.slaOnTrackText;
        border = AppColors.slaOnTrackBorder;
        icon = Icons.schedule;
        label = 'SLA On Track';
        break;
    }

    final hasCountdown = showCountdown &&
        remainingSeconds != null &&
        status.toUpperCase() != 'MET';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 13, color: text),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.2,
            ),
          ),
          if (hasCountdown) ...[
            const SizedBox(width: 3),
            Text(
              '• ${_formatRemaining(remainingSeconds)}',
              style: TextStyle(
                color: text.withAlpha(210),
                fontSize: 10,
                fontWeight: FontWeight.w500,
                height: 1.2,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
