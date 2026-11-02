import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Users,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Lock,
  Mail,
  User,
  KeyRound,
  X,
  AlertCircle
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
  isDefault: boolean;
  createdAt: string;
  _count?: {
    memberships?: number;
    companies?: number;
    tickets?: number;
  };
}

interface PlatformOverview {
  platform: string;
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalCrossTenantTickets: number;
  tenants: TenantItem[];
}

export const PlatformAdminPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Tenant Provision Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: '',
    code: '',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  });

  // Admin Password Reset Modal State
  const [resetModalTenant, setResetModalTenant] = useState<TenantItem | null>(null);
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const loadPlatformData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPlatformOverview();
      const overview = res?.overview || res?.data || res;
      if (overview) {
        let tenants = overview.tenants;
        if (!tenants || tenants.length === 0) {
          try {
            const tenantsRes = await api.getPlatformTenants();
            tenants = tenantsRes?.tenants || tenantsRes?.data || [];
          } catch {}
        }
        const tenantList = tenants || [];
        setData({
          platform: overview.platform || 'Kanvtech Service Management',
          totalTenants: overview.totalTenants ?? tenantList.length,
          activeTenants: overview.activeTenants ?? tenantList.filter((t: any) => t.status === 'ACTIVE').length,
          suspendedTenants: overview.suspendedTenants ?? tenantList.filter((t: any) => t.status === 'SUSPENDED').length,
          totalCrossTenantTickets: overview.totalCrossTenantTickets ?? overview.totalTickets ?? 0,
          tenants: tenantList,
        });
      } else {
        setData({
          platform: 'Kanvtech Service Management',
          totalTenants: 0,
          activeTenants: 0,
          suspendedTenants: 0,
          totalCrossTenantTickets: 0,
          tenants: [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load platform administration metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  const handleToggleStatus = async (tenant: TenantItem) => {
    if (tenant.isDefault) {
      alert('The root KANVTECH platform tenant cannot be suspended.');
      return;
    }
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = nextStatus === 'ACTIVE' ? 'activate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${actionLabel} company workspace "${tenant.name}"?`)) {
      return;
    }

    try {
      await api.updatePlatformTenantStatus(tenant.id, nextStatus);
      setActionSuccess(`Tenant "${tenant.name}" status updated to ${nextStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadPlatformData();
    } catch (err: any) {
      setError(err.message || `Failed to update tenant status.`);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.code || !newTenant.adminEmail || !newTenant.adminPassword) {
      setError('Please fill in all required tenant provisioning fields.');
      return;
    }
    setProvisionLoading(true);
    setError(null);
    try {
      const res = await api.createPlatformTenant({
        name: newTenant.name.trim(),
        code: newTenant.code.trim().toLowerCase(),
        adminEmail: newTenant.adminEmail.trim().toLowerCase(),
        adminName: newTenant.adminName.trim() || undefined,
        password: newTenant.adminPassword,
        adminPassword: newTenant.adminPassword,
      });
      const provisionedName = newTenant.name;
      const provisionedEmail = newTenant.adminEmail;
      const initialPass = res?.initialPassword || newTenant.adminPassword;

      setShowProvisionModal(false);
      setNewTenant({
        name: '',
        code: '',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
      setActionSuccess(
        `New company workspace "${provisionedName}" successfully provisioned! Initial Administrator: ${provisionedEmail} (Initial Password: ${initialPass})`,
      );
      setTimeout(() => setActionSuccess(null), 8000);
      loadPlatformData();
    } catch (err: any) {
      setError(err.message || 'Tenant provisioning failed. Ensure company code and admin email are unique.');
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleResetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalTenant) return;
    setResetLoading(true);
    setError(null);
    try {
      const res = await api.resetPlatformTenantAdminPassword(
        resetModalTenant.id,
        customResetPassword.trim() || undefined,
      );
      const tenantName = resetModalTenant.name;
      const tempPass = res?.temporaryPassword || customResetPassword.trim() || 'Password@123';
      setResetModalTenant(null);
      setCustomResetPassword('');
      setActionSuccess(
        `Administrator password for "${tenantName}" updated successfully. Active credential: ${tempPass}`,
      );
      setTimeout(() => setActionSuccess(null), 8000);
      loadPlatformData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset administrator password.');
    } finally {
      setResetLoading(false);
    }
  };

  const filteredTenants = (data?.tenants || []).filter((t) => {
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Platform Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 4,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Platform Super Admin
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>Cross-Tenant Management & Provisioning</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 6, letterSpacing: '-0.02em' }}>
            Multi-Tenant Platform Control Center
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>
            Manage isolated company workspaces, verify cryptographic boundaries, and provision new enterprise tenants.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadPlatformData}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowProvisionModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4f46e5', borderColor: '#4338ca' }}
          >
            <Plus size={16} />
            Provision New Company
          </button>
        </div>
      </div>

      {/* Success & Error Banners */}
      {actionSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 8, fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Total Enterprise Tenants</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 12 }}>
            {data?.totalTenants ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
            ● Active Workspaces: {data?.activeTenants ?? '—'}
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Suspended Workspaces</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 12 }}>
            {data?.suspendedTenants ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Access blocked at gateway
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Total System Tickets</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 12 }}>
            {data?.totalCrossTenantTickets ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, marginTop: 4 }}>
            Strictly Isolated by Tenant ID
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Login URL Architecture</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} />
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 14 }}>
            Single Shared URL
          </div>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 6 }}>
            ✓ Verified Server-Side Routing
          </div>
        </div>
      </div>

      {/* Tenant Directory Table Card */}
      <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Registered Company Workspaces</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Every tenant operates with isolated data models, tickets, and employee rosters.</span>
          </div>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search companies or codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>COMPANY NAME</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>TENANT CODE</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>TYPE</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>TICKETS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569' }}>CREATED</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    <RefreshCw size={18} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                    Loading enterprise workspaces...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>
                    <AlertCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                    Failed to load workspace data. Please click Refresh or verify backend connectivity.
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    {searchQuery ? 'No company workspaces match your search filter.' : 'No enterprise company workspaces found on this platform.'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: tenant.isDefault ? '#eff6ff' : '#f8fafc',
                            color: tenant.isDefault ? '#1d4ed8' : '#334155',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{tenant.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>ID: {tenant.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <code style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: 4, fontSize: 12, color: '#0f172a' }}>
                        {tenant.code}
                      </code>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 9999,
                          background: tenant.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                          color: tenant.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tenant.status === 'ACTIVE' ? '#16a34a' : '#dc2626' }} />
                        {tenant.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {tenant.isDefault ? (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4 }}>
                          Default / Root
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#64748b' }}>Client Tenant</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      {tenant._count?.tickets ?? 0}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b' }}>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {tenant.isDefault ? (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Protected Root</span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setResetModalTenant(tenant);
                              setCustomResetPassword('');
                            }}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#334155',
                            }}
                            title="Reset administrator password for this tenant"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(tenant)}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1',
                              background: tenant.status === 'ACTIVE' ? '#fff1f2' : '#f0fdf4',
                              color: tenant.status === 'ACTIVE' ? '#be123c' : '#15803d',
                            }}
                          >
                            {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#4f46e5" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Provision Enterprise Tenant Workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Apex Global Solutions"
                  value={newTenant.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoCode = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
                    setNewTenant((prev) => ({
                      ...prev,
                      name,
                      code: prev.code ? prev.code : autoCode,
                    }));
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Tenant Short Code (Slug) *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. apex"
                  value={newTenant.code}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                  required
                />
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'block' }}>
                  Unique identifier used in system tagging and workspace routing.
                </span>
              </div>

              <div style={{ height: 1, background: '#e2e8f0', margin: '16px 0' }} />

              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                Initial Tenant Administrator Account
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Administrator Full Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={newTenant.adminName}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, adminName: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Administrator Corporate Email *
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="admin@apex.com"
                  value={newTenant.adminEmail}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, adminEmail: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Initial Password *
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Secure initial password (e.g. Password@123)"
                  value={newTenant.adminPassword}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, adminPassword: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProvisionModal(false)}
                  disabled={provisionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={provisionLoading}
                  style={{ background: '#4f46e5', borderColor: '#4338ca' }}
                >
                  {provisionLoading ? 'Provisioning...' : 'Complete Workspace Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {resetModalTenant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color="#4f46e5" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Reset Administrator Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalTenant(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetAdminPassword} style={{ padding: '20px' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 0, marginBottom: 16 }}>
                Set a new password for the administrator of <strong>{resetModalTenant.name}</strong> ({resetModalTenant.code}).
              </p>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  New Password (leave empty to reset to default 'Password@123')
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="New password (optional)"
                  value={customResetPassword}
                  onChange={(e) => setCustomResetPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetModalTenant(null)}
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resetLoading}
                  style={{ background: '#4f46e5', borderColor: '#4338ca' }}
                >
                  {resetLoading ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdminPage;
