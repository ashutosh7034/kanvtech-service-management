import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;

    switch (status.toUpperCase()) {
      case 'OPEN':
        bg = AppColors.infoBg;
        text = AppColors.info;
        break;
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        bg = const Color(0xFFEFF6FF);
        text = AppColors.brandSecondary;
        break;
      case 'ESCALATED':
        bg = AppColors.warningBg;
        text = AppColors.warning;
        break;
      case 'RESOLVED':
        bg = AppColors.successBg;
        text = AppColors.success;
        break;
      case 'CLOSED':
        bg = AppColors.bgSurfaceSubtle;
        text = AppColors.textMuted;
        break;
      default:
        bg = AppColors.bgSurfaceSubtle;
        text = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: text.withOpacity(0.2)),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          color: text,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
