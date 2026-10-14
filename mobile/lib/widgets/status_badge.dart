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
      case 'IN_PROGRESS':
        bg = const Color(0xFFEFF6FF);
        text = AppColors.brandSecondary;
        break;
      case 'PAUSED':
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFFB45309);
        break;
      case 'REOPENED':
        bg = const Color(0xFFFEE2E2);
        text = const Color(0xFFB91C1C);
        break;
      case 'MANAGER_REVIEW':
        bg = const Color(0xFFF3E8FF);
        text = const Color(0xFF6B21A8);
        break;
      case 'CUSTOMER_FEEDBACK':
        bg = const Color(0xFFE0E7FF);
        text = const Color(0xFF3730A3);
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
        border: Border.all(color: text.withAlpha(50)),
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
