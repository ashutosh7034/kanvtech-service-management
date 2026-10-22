import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../../components/common/BrandLogo';

interface DemoRole {
  label: string;
  role: string;
  email: string;
  password: string;
}

const DEMO_ROLES: DemoRole[] = [
  { label: 'Customer', role: 'CUSTOMER', email: 'rajesh@acme.com', password: 'Password@123' },
  { label: 'L1 Specialist', role: 'L1_EMPLOYEE', email: 'l1.amit@kanvtech.com', password: 'Password@123' },
  { label: 'L2 Specialist', role: 'L2_EMPLOYEE', email: 'l2.vikram@kanvtech.com', password: 'Password@123' },
  { label: 'L3 Specialist', role: 'L3_EMPLOYEE', email: 'l3.priya@kanvtech.com', password: 'Password@123' },
  { label: 'Manager', role: 'MANAGER', email: 'manager@kanvtech.com', password: 'Password@123' },
  { label: 'Admin', role: 'ADMIN', email: 'admin@kanvtech.com', password: 'Password@123' },
];

export const LoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFastTrackRole, setActiveFastTrackRole] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // If already authenticated, redirect directly to dashboard
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  }, [user]);

  useEffect(() => {
    try {
      const sessionNotice = sessionStorage.getItem('kanvtech_session_notice');
      if (sessionNotice) {
        setError(sessionNotice);
        sessionStorage.removeItem('kanvtech_session_notice');
      }

      const isRemembered = localStorage.getItem('kanvtech_remember_me') === 'true';
      const savedEmail = localStorage.getItem('kanvtech_remembered_email');
      if (isRemembered && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access issues
    }

    // Check for browser autofill on email if not already set
    const checkAutofill = () => {
      if (emailInputRef.current && emailInputRef.current.value && !email) {
        setEmail(emailInputRef.current.value);
      }
    };
    const t1 = setTimeout(checkAutofill, 100);
    const t2 = setTimeout(checkAutofill, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleFastTrack = async (item: DemoRole) => {
    if (loading) return;
    setError(null);
    setActiveFastTrackRole(item.role);

    // 1. Populate the form fields so the user sees the account and inputs are synchronized
    setEmail(item.email);
    if (emailInputRef.current) {
      emailInputRef.current.value = item.email;
    }
    if (passwordInputRef.current) {
      passwordInputRef.current.value = item.password;
    }

    // 2. Perform authentication with current rememberMe setting
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('kanvtech_remember_me', 'true');
        localStorage.setItem('kanvtech_remembered_email', item.email);
      } else {
        localStorage.removeItem('kanvtech_remember_me');
        localStorage.removeItem('kanvtech_remembered_email');
      }

      await login(item.email, item.password, rememberMe);

      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg === 'Failed to fetch' || msg.includes('Network Error') || !window.navigator.onLine || msg === 'Server request failed') {
        setError('Unable to connect to the server. Please try again.');
      } else if (msg.includes('User does not exist') || msg.includes('contact admin')) {
        setError('User does not exist. Please contact admin.');
      } else if (msg.includes('Invalid email or password') || msg.includes('Incorrect password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(msg || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
      setActiveFastTrackRole(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Read form values directly from the DOM form elements to guarantee
    // browser autofilled values are captured even if synthetic input events were not dispatched.
    const form = e.currentTarget;
    const formElements = form.elements;
    const emailEl = formElements.namedItem('email') as HTMLInputElement | null;
    const passwordEl = formElements.namedItem('password') as HTMLInputElement | null;
    const rememberMeEl = formElements.namedItem('rememberMe') as HTMLInputElement | null;

    const emailTrimmed = ((emailEl ? emailEl.value : email) || '').trim();
    const passwordValue = passwordEl?.value || passwordInputRef.current?.value || '';
    const rememberMeValue = rememberMeEl ? rememberMeEl.checked : rememberMe;

    if (emailTrimmed && emailTrimmed !== email) {
      setEmail(emailTrimmed);
    }

    if (!emailTrimmed && !passwordValue) {
      setError('Please enter your email and password.');
      return;
    }
    if (!emailTrimmed) {
      setError('Please enter your email.');
      return;
    }
    if (!passwordValue) {
      setError('Please enter your password.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (rememberMeValue) {
        localStorage.setItem('kanvtech_remember_me', 'true');
        localStorage.setItem('kanvtech_remembered_email', emailTrimmed);
      } else {
        localStorage.removeItem('kanvtech_remember_me');
        localStorage.removeItem('kanvtech_remembered_email');
      }
      await login(emailTrimmed, passwordValue, rememberMeValue);

      // Support Chrome & Chromium native password manager via W3C Credential Management API
      if (typeof window !== 'undefined' && (window as any).PasswordCredential && navigator.credentials?.store) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: emailTrimmed,
            password: passwordValue,
            name: emailTrimmed,
          });
          await navigator.credentials.store(cred);
        } catch {
          // Fallback if browser restrictions apply
        }
      }

      // Perform real browser navigation to dashboard so Chrome's password manager
      // registers the successful login transition and presents the Save Password prompt
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg === 'Failed to fetch' || msg.includes('Network Error') || !window.navigator.onLine || msg === 'Server request failed') {
        setError('Unable to connect to the server. Please try again.');
      } else if (msg.includes('User does not exist') || msg.includes('contact admin')) {
        setError('User does not exist. Please contact admin.');
      } else if (msg.includes('Invalid email or password') || msg.includes('Incorrect password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(msg || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header with Official Logo */}
        <div style={{ background: '#0b3b60', color: 'white', padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <BrandLogo
              variant="horizontal"
              height={42}
              style={{
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#38bdf8' }}>
                SERVICE MANAGEMENT
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                ENTERPRISE DESK
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 12, lineHeight: 1.4 }}>
            Enterprise service desk, SLA tracking & ticket escalation
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <form
            id="login-form"
            name="login"
            method="post"
            action="/api/auth/login"
            onSubmit={handleSubmit}
            noValidate={false}
          >
            <div className="form-group">
              <label htmlFor="email" className="form-label">Corporate Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={emailInputRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                  placeholder="Enter corporate email"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-control"
                  placeholder="Enter password"
                  style={{ paddingRight: 38 }}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <label htmlFor="rememberMe" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ borderRadius: 4, cursor: 'pointer', accentColor: '#0284c7' }}
                />
                Remember me
              </label>
            </div>

            <button
              id="login-submit-button"
              type="submit"
              className="btn btn-primary"
              aria-busy={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: 10,
                marginTop: 4,
                pointerEvents: loading ? 'none' : 'auto',
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading && !activeFastTrackRole ? 'Authenticating...' : 'Sign In to Portal'}
              {(!loading || !!activeFastTrackRole) && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Fast-Track Quick-Role Login Section */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#64748b',
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              Fast-Track Quick-Role Login (One-Touch)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {DEMO_ROLES.map((item) => (
                <button
                  key={item.role}
                  id={`fast-track-${item.role.toLowerCase()}`}
                  type="button"
                  disabled={loading}
                  onClick={() => handleFastTrack(item)}
                  style={{
                    background: activeFastTrackRole === item.role ? '#e0f2fe' : '#f8fafc',
                    border: activeFastTrackRole === item.role ? '1px solid #0284c7' : '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '8px 4px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: activeFastTrackRole === item.role ? '#0369a1' : '#334155',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    opacity: loading && activeFastTrackRole !== item.role ? 0.6 : 1,
                  }}
                  title={`Sign in as ${item.label} (${item.email})`}
                >
                  <span>{item.label}</span>
                  <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>
                    {activeFastTrackRole === item.role ? 'Connecting...' : item.role.replace('_EMPLOYEE', '')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
