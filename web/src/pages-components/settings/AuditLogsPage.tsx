import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ShieldAlert, RefreshCw, Search, Eye, X, Copy, Check } from 'lucide-react';
import { formatDateTime } from '../../utils/date';

function formatKeyName(key: string): string {
  const map: Record<string, string> = {
    companyId: 'Company ID',
    productId: 'Product ID',
    productCode: 'Product Code',
    productName: 'Product Name',
    departmentId: 'Dept ID',
    department: 'Department',
    level: 'Tier Level',
    role: 'Role',
    name: 'Name',
    code: 'Code',
    status: 'Status',
    priority: 'Priority',
    phone: 'Phone',
    email: 'Email',
    category: 'Category',
    designation: 'Designation',
    reason: 'Reason',
    assignedTo: 'Assigned To',
    assignedEmployeeId: 'Assigned Specialist',
    convertedToCompanyId: 'Converted Company',
    description: 'Description',
  };
  if (map[key]) return map[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function parseAuditJson(raw: any): { isObject: boolean; data: any } {
  if (!raw) return { isObject: false, data: null };
  if (typeof raw === 'object') return { isObject: true, data: raw };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { isObject: true, data: parsed };
      }
    } catch {
      // plain text
    }
  }
  return { isObject: false, data: raw };
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      const list = Array.isArray(res)
        ? res
        : (res?.logs || res?.data || []);
      setLogs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (entityFilter && log.entity_type !== entityFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchId = String(log.entity_id || '').toLowerCase().includes(s);
      const matchActor = String(log.actor_email || '').toLowerCase().includes(s);
      const matchAction = String(log.action || '').toLowerCase().includes(s);
      if (!matchId && !matchActor && !matchAction) return false;
    }
    return true;
  });

  const handleCopyJson = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderDetailsCell = (log: any) => {
    const parsed = parseAuditJson(log.new_values_json || log.details);
    if (!parsed.data) {
      return <span style={{ color: '#94a3b8' }}>—</span>;
    }

    if (!parsed.isObject) {
      return (
        <span style={{ fontSize: 12, color: '#334155' }}>
          {String(parsed.data)}
        </span>
      );
    }

    const entries = Object.entries(parsed.data).filter(
      ([k, v]) => v !== undefined && v !== null && k !== 'passwordHash' && k !== 'password'
    );

    if (entries.length === 0) {
      return <span style={{ color: '#94a3b8' }}>No attributes</span>;
    }

    const previewEntries = entries.slice(0, 3);
    const hasMore = entries.length > 3;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {previewEntries.map(([k, v]) => {
            const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return (
              <span
                key={k}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: '1.4',
                }}
              >
                <span style={{ color: '#64748b', fontWeight: 500 }}>{formatKeyName(k)}:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{valStr}</span>
              </span>
            );
          })}
          {hasMore && (
            <span
              style={{
                fontSize: 10,
                color: '#64748b',
                background: '#e2e8f0',
                padding: '2px 5px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              +{entries.length - 3} more
            </span>
          )}
        </div>
        <button
          onClick={() => setSelectedLog(log)}
          title="View Full Details"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 4px',
            color: '#0284c7',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 'auto',
          }}
        >
          <Eye size={12} /> View
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations & Security Audit Trail</h2>
          <div className="page-subtitle">Immutable chronological log of all entity mutations, status changes, and access events</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search entity ID, user email, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="">All Entity Types</option>
          <option value="TICKET">Tickets</option>
          <option value="COMPANY">Companies</option>
          <option value="EMPLOYEE">Employees</option>
          <option value="DEPARTMENT">Departments</option>
          <option value="PRODUCT">Products</option>
          <option value="SLA_CONFIG">SLA Configurations</option>
          <option value="USER">Users</option>
        </select>

        {(search || entityFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setEntityFilter(''); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Timestamp</th>
              <th style={{ width: '18%' }}>Actor User</th>
              <th style={{ width: '16%' }}>Action Type</th>
              <th style={{ width: '11%' }}>Entity</th>
              <th style={{ width: '12%' }}>Entity Identifier</th>
              <th style={{ width: '28%' }}>Mutation Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No audit entries matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.actor_email || 'System'}</div>
                    {log.actor_role && <div style={{ fontSize: 11, color: '#64748b' }}>{log.actor_role}</div>}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        background: '#f1f5f9',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 12, color: '#1e293b' }}>{log.entity_type}</strong>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0b3b60', fontSize: 12 }}>
                    {log.entity_id}
                  </td>
                  <td>
                    {renderDetailsCell(log)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Audit Record Details
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {formatDateTime(selectedLog.created_at)} · {selectedLog.action}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Meta Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 16,
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Entity Type</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{selectedLog.entity_type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Entity ID</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                    {selectedLog.entity_id || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Actor User</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    {selectedLog.actor_email || 'System'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Actor Role</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>
                    {selectedLog.actor_role || 'SYSTEM'}
                  </div>
                </div>
              </div>

              {/* Formatted Attributes */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Snapshot Attributes
                </h4>
                {(() => {
                  const parsed = parseAuditJson(selectedLog.new_values_json || selectedLog.details);
                  if (!parsed.data) {
                    return <div style={{ fontSize: 12, color: '#94a3b8' }}>No additional attributes recorded.</div>;
                  }
                  if (!parsed.isObject) {
                    return (
                      <div style={{ fontSize: 12, color: '#334155', padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                        {String(parsed.data)}
                      </div>
                    );
                  }
                  const entries = Object.entries(parsed.data);
                  return (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <tbody>
                        {entries.map(([k, v]) => (
                          <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 8px', color: '#64748b', fontWeight: 600, width: '40%' }}>
                              {formatKeyName(k)}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#0f172a', fontWeight: 500 }}>
                              {typeof v === 'object' && v !== null ? (
                                <pre style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', background: '#f1f5f9', padding: '4px 6px', borderRadius: 4 }}>
                                  {JSON.stringify(v, null, 2)}
                                </pre>
                              ) : (
                                String(v ?? '—')
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Raw JSON View Option */}
              {selectedLog.new_values_json && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Raw JSON Payload</span>
                    <button
                      onClick={() => handleCopyJson(selectedLog.new_values_json)}
                      style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: copied ? '#16a34a' : '#64748b',
                      }}
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: '#0f172a',
                      color: '#e2e8f0',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                      maxHeight: 180,
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.new_values_json), null, 2);
                      } catch {
                        return selectedLog.new_values_json;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
                borderRadius: '0 0 12px 12px',
              }}
            >
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

