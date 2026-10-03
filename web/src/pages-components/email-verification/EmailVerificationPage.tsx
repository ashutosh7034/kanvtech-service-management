import React, { useState } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const EmailVerificationPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const checkStatus = async () => {
    if (!email) return;
    try {
      const res = await api.getVerificationStatus(email);
      setStatus(res);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.requestEmailVerification(email);
      showToast('Verification email sent! Please check your inbox.', 'success');
      checkStatus();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Mail size={48} color="#0284c7" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Email Verification</h1>
          <p style={{ color: '#64748b' }}>Verify your email address to access advanced features.</p>
        </div>

        {status?.verified ? (
          <div style={{ padding: 24, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, textAlign: 'center' }}>
            <CheckCircle size={32} color="#16a34a" style={{ marginBottom: 12 }} />
            <h3 style={{ color: '#166534', margin: 0 }}>Email Verified!</h3>
            <p style={{ color: '#15803d', marginTop: 8 }}>Your email address ({email}) has been successfully verified.</p>
          </div>
        ) : (
          <form onSubmit={handleRequest}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {status?.pendingToken && (
              <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={20} color="#d97706" />
                <span style={{ fontSize: 13, color: '#92400e' }}>A verification email has already been sent to this address. If you haven't received it, you can request a new one below.</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : status?.pendingToken ? 'Resend Verification Email' : 'Send Verification Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
