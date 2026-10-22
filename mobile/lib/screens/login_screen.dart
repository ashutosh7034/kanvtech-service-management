import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;
  String? _activeDemoRole;

  @override
  void initState() {
    super.initState();
    _loadRememberedState();
  }

  Future<void> _loadRememberedState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rememberedEmail = prefs.getString('kanvtech_remembered_email');
      final rememberMePref = prefs.getString('kanvtech_mobile_remember_me');
      if (mounted) {
        setState(() {
          if (rememberedEmail != null && rememberedEmail.isNotEmpty) {
            _emailController.text = rememberedEmail;
          }
          if (rememberMePref != null) {
            _rememberMe = rememberMePref != 'false';
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isLoading) return;
    auth.clearSessionTerminatedMessage();
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter both email and password.')),
      );
      return;
    }

    final success = await auth.login(email, password, rememberMe: _rememberMe);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Authentication failed'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  void _showServerConfigDialog() {
    final auth = context.read<AuthProvider>();
    final controller = TextEditingController(text: auth.serverUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Backend API Server'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter the backend API base endpoint URL (e.g. https://192.168.1.4:8444/api for office Wi-Fi):',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Base API URL',
                hintText: 'https://192.168.1.4:8444/api',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              auth.setServerUrl(null);
              Navigator.pop(ctx);
            },
            child: const Text('Reset Default'),
          ),
          ElevatedButton(
            onPressed: () {
              auth.setServerUrl(controller.text.trim());
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.bgSurfaceSubtle,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0, top: 8.0),
            child: TextButton.icon(
              icon: const Icon(Icons.dns_outlined,
                  size: 15, color: AppColors.brandPrimary),
              label: const Text(
                'Server Config',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.brandPrimary,
                ),
              ),
              style: TextButton.styleFrom(
                backgroundColor: AppColors.brandPrimaryLight,
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: _showServerConfigDialog,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (auth.sessionTerminatedMessage != null) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.dangerBorder),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.security_update_warning_outlined,
                          color: AppColors.danger,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            auth.sessionTerminatedMessage!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.danger,
                              height: 1.4,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => auth.clearSessionTerminatedMessage(),
                          child: const Icon(
                            Icons.close,
                            size: 16,
                            color: AppColors.danger,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Card container matching Web LoginPage.tsx
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.borderSubtle),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(15),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Corporate Navy Header matching Web LoginPage.tsx
                      Container(
                        color: AppColors.brandPrimary,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Colors.black12,
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Image.asset(
                                'assets/images/kanvtech-logo.jpeg',
                                height: 38,
                                fit: BoxFit.contain,
                                semanticLabel: 'KANVTECH official logo',
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'KANVTECH',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const Text(
                              'Service Management Platform',
                              style: TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Enterprise service desk, SLA tracking & ticket escalation',
                              style: TextStyle(
                                color: Color(0xFFCBD5E1),
                                fontSize: 12,
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Card Body
                      Padding(
                        padding: const EdgeInsets.all(20.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Sign In',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                labelText: 'Work Email',
                                hintText: 'Enter corporate email',
                                prefixIcon:
                                    Icon(Icons.email_outlined, size: 18),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                hintText: 'Enter password',
                                prefixIcon:
                                    const Icon(Icons.lock_outline, size: 18),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 18,
                                  ),
                                  onPressed: () => setState(() =>
                                      _obscurePassword = !_obscurePassword),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                SizedBox(
                                  height: 24,
                                  width: 24,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    activeColor: AppColors.brandPrimary,
                                    onChanged: auth.isLoading
                                        ? null
                                        : (val) {
                                            setState(() {
                                              _rememberMe = val ?? false;
                                            });
                                          },
                                  ),
                                ),
                                const SizedBox(width: 8),
                                GestureDetector(
                                  onTap: auth.isLoading
                                      ? null
                                      : () {
                                          setState(() {
                                            _rememberMe = !_rememberMe;
                                          });
                                        },
                                  child: const Text(
                                    'Remember Me (30-day session)',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: auth.isLoading ? null : _handleLogin,
                              child: auth.isLoading && _activeDemoRole == null
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                          color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text('Sign In to Portal'),
                                        SizedBox(width: 8),
                                        Icon(Icons.arrow_forward, size: 15),
                                      ],
                                    ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
                // Demo accounts quick switch
                const Text(
                  'DEMO ACCOUNTS (ONE-TOUCH FAST-TRACK)',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    _demoChip(context, 'Customer', 'CUSTOMER'),
                    _demoChip(context, 'L1 Specialist', 'L1_EMPLOYEE'),
                    _demoChip(context, 'L2 Specialist', 'L2_EMPLOYEE'),
                    _demoChip(context, 'L3 Specialist', 'L3_EMPLOYEE'),
                    _demoChip(context, 'Manager', 'MANAGER'),
                    _demoChip(context, 'Admin', 'ADMIN'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _demoChip(BuildContext context, String label, String role) {
    final auth = context.watch<AuthProvider>();
    final isThisActive = _activeDemoRole == role && auth.isLoading;

    return ActionChip(
      backgroundColor: isThisActive
          ? AppColors.brandPrimaryLight
          : AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: BorderSide(
          color: isThisActive
              ? AppColors.brandPrimary
              : AppColors.borderMedium,
        ),
      ),
      avatar: isThisActive
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.brandPrimary,
              ),
            )
          : null,
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: isThisActive ? FontWeight.w600 : FontWeight.w500,
          color: isThisActive
              ? AppColors.brandPrimary
              : AppColors.textPrimary,
        ),
      ),
      onPressed: auth.isLoading
          ? null
          : () async {
              if (auth.isLoading) return;
              auth.clearSessionTerminatedMessage();

              // Synchronize fields so user sees credentials and can review
              final creds = auth.getDemoCredentials(role);
              if (creds != null) {
                _emailController.text = creds['email'] ?? '';
                _passwordController.text = creds['password'] ?? '';
              }

              setState(() {
                _activeDemoRole = role;
              });

              try {
                final success = await auth.switchDemoRole(
                  role,
                  rememberMe: _rememberMe,
                );
                if (!success && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(auth.errorMessage ??
                          'Login failed. Check server connectivity.'),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                }
              } finally {
                if (mounted) {
                  setState(() {
                    _activeDemoRole = null;
                  });
                }
              }
            },
    );
  }
}
