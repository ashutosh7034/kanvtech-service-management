import 'package:flutter/material.dart';

/// Centralized Design Tokens for KANVTECH Mobile Application.
/// Strictly aligned with web design tokens in `web/src/styles/design-tokens.css`
/// and component styles in `web/src/styles/app.css`.
class AppColors {
  // Brand Palette (Kanvtech Corporate Navy & Slate)
  static const Color brandPrimary = Color(0xFF0B3B60);
  static const Color brandPrimaryHover = Color(0xFF082D49);
  static const Color brandPrimaryLight = Color(0xFFE6F0F8);
  static const Color brandSecondary = Color(0xFF2563EB);
  static const Color brandAccent = Color(0xFF0284C7);

  // Legacy aliases
  static const Color accent = brandAccent;
  static const Color accentLight = Color(0xFFF0F9FF);

  // Neutrals / Surfaces
  static const Color bgApp = Color(0xFFF8FAFC);
  static const Color bgSurface = Color(0xFFFFFFFF);
  static const Color bgSurfaceSubtle = Color(0xFFF1F5F9);
  static const Color bgSurfaceHover = Color(0xFFF8FAFC);

  // Text
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textPlaceholder = Color(0xFF94A3B8);
  static const Color textInverse = Color(0xFFFFFFFF);

  // Borders & Dividers
  static const Color borderSubtle = Color(0xFFE2E8F0);
  static const Color borderMedium = Color(0xFFCBD5E1);
  static const Color borderStrong = Color(0xFF94A3B8);
  static const Color borderLight = borderSubtle;

  // Semantic State Colors
  static const Color success = Color(0xFF16A34A);
  static const Color successBg = Color(0xFFF0FDF4);
  static const Color successBorder = Color(0xFFBBF7D0);

  static const Color warning = Color(0xFFD97706);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color warningBorder = Color(0xFFFDE68A);

  static const Color danger = Color(0xFFDC2626);
  static const Color dangerBg = Color(0xFFFEF2F2);
  static const Color dangerBorder = Color(0xFFFECACA);

  static const Color info = Color(0xFF0284C7);
  static const Color infoBg = Color(0xFFF0F9FF);
  static const Color infoBorder = Color(0xFFBAE6FD);

  // Priority Colors
  static const Color priorityHigh = Color(0xFFDC2626);
  static const Color priorityHighBg = Color(0xFFFEF2F2);
  static const Color priorityMedium = Color(0xFFD97706);
  static const Color priorityMediumBg = Color(0xFFFFFBEB);
  static const Color priorityLow = Color(0xFF16A34A);
  static const Color priorityLowBg = Color(0xFFF0FDF4);

  // Status Badge Colors (Web-matched triplets)
  static const Color badgeOpenBg = Color(0xFFEFF6FF);
  static const Color badgeOpenText = Color(0xFF1D4ED8);
  static const Color badgeOpenBorder = Color(0xFFBFDBFE);

  static const Color badgeInProgressBg = Color(0xFFFEF3C7);
  static const Color badgeInProgressText = Color(0xFFB45309);
  static const Color badgeInProgressBorder = Color(0xFFFDE68A);

  static const Color badgeResolvedBg = Color(0xFFF0FDF4);
  static const Color badgeResolvedText = Color(0xFF15803D);
  static const Color badgeResolvedBorder = Color(0xFFBBF7D0);

  static const Color badgeManagerReviewBg = Color(0xFFFDF4FF);
  static const Color badgeManagerReviewText = Color(0xFFA21CAF);
  static const Color badgeManagerReviewBorder = Color(0xFFF5D0FE);

  static const Color badgeCustomerFeedbackBg = Color(0xFFFFF7ED);
  static const Color badgeCustomerFeedbackText = Color(0xFFC2410C);
  static const Color badgeCustomerFeedbackBorder = Color(0xFFFFEDD5);

  static const Color badgeClosedBg = Color(0xFFF1F5F9);
  static const Color badgeClosedText = Color(0xFF475569);
  static const Color badgeClosedBorder = Color(0xFFCBD5E1);

  // SLA Indicators (Web-matched triplets)
  static const Color slaOnTrackBg = Color(0xFFF0FDF4);
  static const Color slaOnTrackText = Color(0xFF16A34A);
  static const Color slaOnTrackBorder = Color(0xFFBBF7D0);

  static const Color slaWarningBg = Color(0xFFFFFBEB);
  static const Color slaWarningText = Color(0xFFB45309);
  static const Color slaWarningBorder = Color(0xFFFDE68A);

  static const Color slaBreachedBg = Color(0xFFFEF2F2);
  static const Color slaBreachedText = Color(0xFFDC2626);
  static const Color slaBreachedBorder = Color(0xFFFECACA);

  static const Color slaMetBg = Color(0xFFECFDF5);
  static const Color slaMetText = Color(0xFF047857);
  static const Color slaMetBorder = Color(0xFFA7F3D0);
}
