import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    Color border;
    String label = status.replaceAll('_', ' ');

    switch (status.toUpperCase()) {
      case 'OPEN':
        bg = AppColors.badgeOpenBg;
        text = AppColors.badgeOpenText;
        border = AppColors.badgeOpenBorder;
        label = 'Open';
        break;
      case 'IN_PROGRESS':
        bg = AppColors.badgeInProgressBg;
        text = AppColors.badgeInProgressText;
        border = AppColors.badgeInProgressBorder;
        label = 'In Progress';
        break;
      case 'PAUSED':
        bg = AppColors.warningBg;
        text = AppColors.warning;
        border = AppColors.warningBorder;
        label = 'Paused';
        break;
      case 'REOPENED':
        bg = AppColors.dangerBg;
        text = AppColors.danger;
        border = AppColors.dangerBorder;
        label = 'Reopened';
        break;
      case 'MANAGER_REVIEW':
        bg = AppColors.badgeManagerReviewBg;
        text = AppColors.badgeManagerReviewText;
        border = AppColors.badgeManagerReviewBorder;
        label = 'Manager Review';
        break;
      case 'CUSTOMER_FEEDBACK':
        bg = AppColors.badgeCustomerFeedbackBg;
        text = AppColors.badgeCustomerFeedbackText;
        border = AppColors.badgeCustomerFeedbackBorder;
        label = 'Feedback Required';
        break;
      case 'RESOLVED':
        bg = AppColors.badgeResolvedBg;
        text = AppColors.badgeResolvedText;
        border = AppColors.badgeResolvedBorder;
        label = 'Resolved';
        break;
      case 'CLOSED':
        bg = AppColors.badgeClosedBg;
        text = AppColors.badgeClosedText;
        border = AppColors.badgeClosedBorder;
        label = 'Closed';
        break;
      default:
        bg = AppColors.bgSurfaceSubtle;
        text = AppColors.textSecondary;
        border = AppColors.borderMedium;
    }

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
          // Circular status dot indicator matching web StatusBadge.tsx
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: text,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
