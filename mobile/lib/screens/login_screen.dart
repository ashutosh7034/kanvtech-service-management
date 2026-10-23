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
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();

  bool _obscurePassword = true;
  bool _rememberMe = true;
  String? _localError;

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
      final isRemembered = rememberMePref != 'false';

      if (mounted) {
        setState(() {
          _rememberMe = isRemembered;
          if (isRemembered && rememberedEmail != null && rememberedEmail.isNotEmpty) {
            _emailController.text = rememberedEmail;
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  void _clearErrors() {
    if (_localError != null ||
        context.read<AuthProvider>().sessionTerminatedMessage != null) {
      setState(() {
        _localError = null;
      });
      context.read<AuthProvider>().clearSessionTerminatedMessage();
    }
  }

  Future<void> _handleLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isLoading) return;
    _clearErrors();

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _localError = 'Please enter both your work email and password.';
      });
      return;
    }

    final success = await auth.login(email, password, rememberMe: _rememberMe);
    if (!success && mounted) {
      setState(() {
        _localError = auth.errorMessage ?? 'Authentication failed. Please verify credentials.';
      });
    }
  }

  void _showServerConfigDialog() {
    final auth = context.read<AuthProvider>();
    final controller = TextEditingController(text: auth.serverUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.dns_rounded, size: 20, color: AppColors.brandPrimary),
            SizedBox(width: 8),
            Text('Server Configuration', style: TextStyle(fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Specify the backend API base endpoint URL (e.g. for office Wi-Fi or staging server):',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Base API URL',
                hintText: 'https://192.168.1.4:8444/api',
                prefixIcon: Icon(Icons.link_rounded, size: 18),
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
            child: const Text('Save Endpoint'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final displayError = _localError ?? auth.sessionTerminatedMessage;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      body: SafeArea(
        child: Column(
          children: [
            // Compact Header with Server Config Action
            _buildTopAppBar(context, auth),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                physics: const ClampingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),

                        // Official Brand Identity Section
                        _buildBrandHeader(),

                        const SizedBox(height: 20),

                        // Login Form Card
                        _buildLoginFormCard(context, auth, displayError),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopAppBar(BuildContext context, AuthProvider auth) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Subtle App Badge
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.asset(
                    'assets/images/kanvtech-app-icon.png',
                    width: 20,
                    height: 20,
                    fit: BoxFit.cover,
                    semanticLabel: 'KANVTECH app icon',
                  ),
                ),
                const SizedBox(width: 6),
                const Flexible(
                  child: Text(
                    'KANVTECH SM',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                      color: AppColors.brandPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Server Config Action Pill
          InkWell(
            onTap: _showServerConfigDialog,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.borderSubtle),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.dns_outlined, size: 13, color: AppColors.brandPrimary),
                  SizedBox(width: 4),
                  Text(
                    'Server Config',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Column(
      children: [
        // Official Horizontal Logo in Crisp Elevated Card
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderSubtle),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Image.asset(
            'assets/images/kanvtech-logo.jpeg',
            fit: BoxFit.contain,
            semanticLabel: 'KANVTECH official logo',
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'KANVTECH',
          style: TextStyle(
            color: AppColors.brandPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'Service Management Platform',
          style: TextStyle(
            color: AppColors.brandAccent,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Enterprise service desk, SLA tracking & ticket escalation',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 12,
            height: 1.3,
          ),
        ),
      ],
    );
  }

  Widget _buildLoginFormCard(BuildContext context, AuthProvider auth, String? displayError) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderSubtle),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0B3B60),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 18.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Heading Row
          const Row(
            children: [
              Icon(Icons.lock_person_outlined, size: 20, color: AppColors.brandPrimary),
              SizedBox(width: 8),
              Text(
                'Sign In',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Enter your corporate credentials to access the service portal',
            style: TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),

          // Inline Error Component (Does not obscure form controls)
          if (displayError != null) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.dangerBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.dangerBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.error_outline_rounded,
                      color: AppColors.danger,
                      size: 17,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      displayError,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.danger,
                        height: 1.35,
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  InkWell(
                    onTap: _clearErrors,
                    borderRadius: BorderRadius.circular(12),
                    child: const Padding(
                      padding: EdgeInsets.all(2.0),
                      child: Icon(Icons.close, size: 15, color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Email Input Field
          TextField(
            controller: _emailController,
            focusNode: _emailFocusNode,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            onChanged: (_) => _clearErrors(),
            decoration: const InputDecoration(
              labelText: 'Work Email',
              hintText: 'Enter corporate email (e.g. admin@kanvtech.com)',
              prefixIcon: Icon(Icons.alternate_email_rounded, size: 18),
            ),
          ),
          const SizedBox(height: 14),

          // Password Input Field
          TextField(
            controller: _passwordController,
            focusNode: _passwordFocusNode,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            onChanged: (_) => _clearErrors(),
            onSubmitted: (_) => _handleLogin(),
            decoration: InputDecoration(
              labelText: 'Password',
              hintText: 'Enter account password',
              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  size: 18,
                  color: AppColors.textMuted,
                ),
                tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Remember Me Checkbox Row
          Row(
            children: [
              SizedBox(
                height: 24,
                width: 24,
                child: Checkbox(
                  value: _rememberMe,
                  activeColor: AppColors.brandPrimary,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
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
              Expanded(
                child: GestureDetector(
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
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Primary Sign In Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _handleLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 0,
              ),
              child: auth.isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Sign In to Portal',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward_rounded, size: 15),
                        ],
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
