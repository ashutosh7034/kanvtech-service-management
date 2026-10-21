import 'package:flutter_test/flutter_test.dart';
import 'package:kanvtech_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('Kanvtech mobile app renders login screen by default',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KanvtechMobileApp());
    // Wait for asynchronous SharedPreferences session check to settle
    await tester.pumpAndSettle();

    // Verify title and brand elements are present on LoginScreen
    expect(find.text('KANVTECH'), findsOneWidget);
    expect(find.text('Service Management Platform'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Work Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);

    // Verify demo chips exist for all roles
    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('L1 Specialist'), findsOneWidget);
    expect(find.text('L2 Specialist'), findsOneWidget);
    expect(find.text('L3 Specialist'), findsOneWidget);
    expect(find.text('Manager'), findsOneWidget);
    expect(find.text('Admin'), findsOneWidget);
  });
}
