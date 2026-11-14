import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Eye,
  X,
  User,
  Calendar,
  CheckCircle2,
  Layers,
  FileText,
  Building,
  Download,
} from 'lucide-react';
import { formatDateTime } from '../../utils/date';
import {
  formatAuditEvent,
  formatAuditRole,
  formatAuditEntity,
} from '../../utils/audit-labels';

interface AuditLogItem {
  id: number | string;
  created_at: string;
  action: string;
  action_code?: string;
  module: string;
  description: string;
  status?: string;
  actor_name: string;
  actor_role: string;
  actor_email: string;
  entity_type: string;
  entity_name: string;
  business_reference: string;
  attributes?: Array<{
    label: string;
    value?: string;
    oldValue?: string;
    newValue?: string;
  }>;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      const list = Array.isArray(res) ? res : res?.logs || res?.data || [];

      // Normalize each item to ensure clean human-readable representation
      const normalized: AuditLogItem[] = list.map((item: any) => {
        const eventMeta = formatAuditEvent(item.action_code || item.action);
        const roleLabel = formatAuditRole(item.actor_role);
        const entityLabel = formatAuditEntity(item.entity_type);

        return {
          id: item.id,
          created_at: item.created_at || item.createdAt,
          action: item.action && !item.action.includes('_') ? item.action : eventMeta.label,
          action_code: item.action_code || item.action,
          module: item.module || eventMeta.module,
          description: item.description || `${eventMeta.label} recorded.`,
          status: item.status || 'Completed',
          actor_name: item.actor_name || (item.actor_email ? item.actor_email.split('@')[0] : 'System User'),
          actor_role: roleLabel,
          actor_email: item.actor_email || '—',
          entity_type: entityLabel,
          entity_name: item.entity_name && item.entity_name !== '—' ? item.entity_name : '',
          business_reference: item.business_reference && item.business_reference !== '—' ? item.business_reference : '',
          attributes: item.attributes || [],
        };
      });

      setLogs(normalized);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (entityFilter && log.entity_type !== entityFilter) return false;
    if (moduleFilter && log.module !== moduleFilter) return false;

    if (search) {
      const s = search.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(s);
      const matchActor = log.actor_name.toLowerCase().includes(s) || log.actor_email.toLowerCase().includes(s);
      const matchEntity = log.entity_type.toLowerCase().includes(s) || log.entity_name.toLowerCase().includes(s);
      const matchRef = log.business_reference.toLowerCase().includes(s);
      const matchModule = log.module.toLowerCase().includes(s);
      const matchDesc = log.description.toLowerCase().includes(s);

      if (!matchAction && !matchActor && !matchEntity && !matchRef && !matchModule && !matchDesc) {
        return false;
      }
    }
    return true;
  });

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Performed By', 'Role', 'Email', 'Activity', 'Module', 'Entity Type', 'Entity Name', 'Reference', 'Description'];
    const rows = filteredLogs.map((l) => [
      `"${formatDateTime(l.created_at)}"`,
      `"${l.actor_name}"`,
      `"${l.actor_role}"`,
      `"${l.actor_email}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.entity_type}"`,
      `"${l.entity_name}"`,
      `"${l.business_reference}"`,
      `"${l.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kanvtech_audit_activity_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Security & Activity Audit Trail
          </h2>
          <div className="page-subtitle" style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Chronological operational activity stream, administrative modifications, and governance records
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportCsv} disabled={filteredLogs.length === 0}>
            <Download size={14} style={{ marginRight: 6 }} /> Export Activity (CSV)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="search-input" style={{ flex: '1 1 280px', display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px' }}>
          <Search size={15} color="#94a3b8" style={{ marginRight: 8 }} />
          <input
            type="text"
            placeholder="Search activity, entity name, reference, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13 }}
          />
        </div>

        <select
          className="select-filter"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: 'white' }}
        >
          <option value="">All Entity Types</option>
          <option value="Product">Products</option>
          <option value="Customer Company">Customer Companies</option>
          <option value="Customer Licence Entitlement">Licences & Entitlements</option>
          <option value="Task Assignment">Tasks & Reminders</option>
          <option value="Employee">Employees</option>
          <option value="Support Ticket">Support Tickets</option>
          <option value="Department">Departments</option>
          <option value="AMC & Subscription Contract">AMC & Subscriptions</option>
          <option value="Customer Implementation">New Implementations</option>
          <option value="System Configuration">System Configuration</option>
        </select>

        <select
          className="select-filter"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: 'white' }}
        >
          <option value="">All Functional Modules</option>
          <option value="Product Master">Product Master</option>
          <option value="Customer Master">Customer Master</option>
          <option value="Licence & Entitlements">Licence & Entitlements</option>
          <option value="Tasks & Reminders">Tasks & Reminders</option>
          <option value="Employee Management">Employee Management</option>
          <option value="Support Tickets">Support Tickets</option>
          <option value="AMC & Subscriptions">AMC & Subscriptions</option>
          <option value="New Implementations">New Implementations</option>
          <option value="Departments">Departments</option>
          <option value="System Administration">System Administration</option>
        </select>

        {(search || entityFilter || moduleFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              setEntityFilter('');
              setModuleFilter('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
          <table className="table" style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                <th style={{ padding: '12px 16px', width: 160 }}>TIMESTAMP</th>
                <th style={{ padding: '12px 16px', width: 220 }}>PERFORMED BY</th>
                <th style={{ padding: '12px 16px', width: 220 }}>ACTIVITY</th>
                <th style={{ padding: '12px 16px', width: 160 }}>ENTITY TYPE</th>
                <th style={{ padding: '12px 16px', width: 200 }}>ENTITY / REFERENCE</th>
                <th style={{ padding: '12px 16px', minWidth: 240 }}>ACTIVITY SUMMARY</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: 100 }}>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                    Loading audit activities...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                    <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>No Audit Entries Found</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      No activity records matching your current filter criteria.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {formatDateTime(log.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.actor_name}</div>
                      <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 500, marginTop: 1 }}>{log.actor_role}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{log.action}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{log.module}</div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 600 }}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {log.entity_name ? (
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.entity_name}</div>
                      ) : null}
                      {log.business_reference ? (
                        <div style={{ fontSize: 11, color: '#0b3b60', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {log.business_reference}
                        </div>
                      ) : (
                        !log.entity_name && <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#475569',
                          maxWidth: 340,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={log.description}
                      >
                        {log.description}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => setSelectedLog(log)}
                        title="View Full Activity Details"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REDESIGNED AUDIT ACTIVITY DETAILS MODAL */}
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
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  Audit Activity Details
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  {formatDateTime(selectedLog.created_at)} · {selectedLog.action}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 1. Activity Summary Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Activity Summary
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {selectedLog.action}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      fontSize: 12,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {selectedLog.status || 'Completed'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  {selectedLog.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginTop: 10 }}>
                  <Calendar size={13} />
                  <span>Recorded on {formatDateTime(selectedLog.created_at)}</span>
                </div>
              </div>

              {/* 2. User Information Card */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  User Information
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Performed By</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {selectedLog.actor_name}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>User Role</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0284c7', marginTop: 2 }}>
                      {selectedLog.actor_role}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Email Address</div>
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                      {selectedLog.actor_email}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Activity & Entity Information */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Activity & Entity Information
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Functional Module</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                      {selectedLog.module}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Action Performed</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                      {selectedLog.action}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Business Entity</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                      {selectedLog.entity_name || selectedLog.entity_type}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Business Reference</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {selectedLog.business_reference || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Recorded Activity Attributes & Value Changes */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Recorded Activity Attributes
                </h4>
                {selectedLog.attributes && selectedLog.attributes.length > 0 ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                          <th style={{ padding: '8px 12px', width: '35%' }}>FIELD / ATTRIBUTE</th>
                          {selectedLog.attributes.some((a) => a.oldValue !== undefined) ? (
                            <>
                              <th style={{ padding: '8px 12px', width: '32%' }}>PREVIOUS VALUE</th>
                              <th style={{ padding: '8px 12px', width: '33%' }}>UPDATED VALUE</th>
                            </>
                          ) : (
                            <th style={{ padding: '8px 12px', width: '65%' }}>RECORDED VALUE</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLog.attributes.map((attr, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>
                              {attr.label}
                            </td>
                            {selectedLog.attributes?.some((a) => a.oldValue !== undefined) ? (
                              <>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>
                                  {attr.oldValue ?? '—'}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 600 }}>
                                  {attr.newValue ?? attr.value ?? '—'}
                                </td>
                              </>
                            ) : (
                              <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 500 }}>
                                {attr.value ?? '—'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                    No additional attribute modifications recorded for this activity.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
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
