import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanvtech_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('Kanvtech mobile app renders login screen by default',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    // Allow secure storage timeouts (100ms each) and SharedPreferences to settle
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    // Verify title and brand elements are present on LoginScreen
    expect(find.text('KANVTECH'), findsOneWidget);
    expect(find.text('Service Management Platform'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Work Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);

    // Verify Remember Me checkbox and label are present
    expect(find.text('Remember Me (30-day session)'), findsOneWidget);
    expect(find.byType(Checkbox), findsOneWidget);

    // Verify demo chips and fast-track sections do NOT exist
    expect(find.text('Customer'), findsNothing);
    expect(find.text('L1 Specialist'), findsNothing);
    expect(find.text('L2 Specialist'), findsNothing);
    expect(find.text('L3 Specialist'), findsNothing);
    expect(find.text('Manager'), findsNothing);
    expect(find.text('Admin'), findsNothing);
  });

  testWidgets('Renders cleanly on small Android screen (360x640) without overflow',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Sign In to Portal'), findsOneWidget);
  });

  testWidgets('Empty email or password submission displays inline validation error',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    // Tap Sign In without entering credentials
    await tester.tap(find.text('Sign In to Portal'));
    await tester.pumpAndSettle();

    expect(
      find.text('Please enter both your work email and password.'),
      findsOneWidget,
    );
  });

  testWidgets('Tapping Server Config pill opens backend configuration dialog',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    // Tap Server Config
    await tester.tap(find.text('Server Config'));
    await tester.pumpAndSettle();

    expect(find.text('Server Configuration'), findsOneWidget);
    expect(find.text('Reset Default'), findsOneWidget);
    expect(find.text('Save Endpoint'), findsOneWidget);
  });

  testWidgets('Verified that Quick Role and demo login controls are completely absent',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.byType(ActionChip), findsNothing);
    expect(find.text('FAST-TRACK', findRichText: true), findsNothing);
    expect(find.text('DEMO', findRichText: true), findsNothing);
  });

  testWidgets('Remember Me restored state populates email and preserves obscured password',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({
      'kanvtech_remembered_email': 'support@kanvtech.com',
      'kanvtech_mobile_remember_me': 'true',
    });

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    // Verify email field is restored
    expect(find.text('support@kanvtech.com'), findsOneWidget);

    // Verify checkbox is checked
    final checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
    expect(checkbox.value, isTrue);

    // Verify password field is obscured
    final passwordFieldFinder = find.widgetWithText(TextField, 'Password');
    expect(passwordFieldFinder, findsOneWidget);
    final passwordField = tester.widget<TextField>(passwordFieldFinder);
    expect(passwordField.obscureText, isTrue);

    // Test password show/hide toggle
    final toggleButton = find.byTooltip('Show password');
    expect(toggleButton, findsOneWidget);
    await tester.tap(toggleButton);
    await tester.pumpAndSettle();

    final toggledPasswordField = tester.widget<TextField>(passwordFieldFinder);
    expect(toggledPasswordField.obscureText, isFalse);
    expect(find.byTooltip('Hide password'), findsOneWidget);
  });

  testWidgets('Toggling Remember Me updates checkbox state correctly',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    // Initially true
    Checkbox checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
    expect(checkbox.value, isTrue);

    // Tap checkbox to uncheck
    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();

    checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
    expect(checkbox.value, isFalse);

    // Tap label to re-check
    await tester.tap(find.text('Remember Me (30-day session)'));
    await tester.pumpAndSettle();

    checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
    expect(checkbox.value, isTrue);
  });
}
