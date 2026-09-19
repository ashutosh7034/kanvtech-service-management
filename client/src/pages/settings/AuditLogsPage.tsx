import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ShieldAlert, RefreshCw, Search } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      setLogs(res.logs || []);
    } catch (err) {
      console.error(err);
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
          <option value="SLA_CONFIG">SLA Configurations</option>
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
              <th>Timestamp</th>
              <th>Actor User</th>
              <th>Action Type</th>
              <th>Entity</th>
              <th>Entity Identifier</th>
              <th>Details & Mutation Snapshot</th>
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
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.actor_email || 'System'}</div>
                    {log.actor_role && <div style={{ fontSize: 11, color: '#64748b' }}>{log.actor_role}</div>}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: '#f1f5f9',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#334155',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <strong>{log.entity_type}</strong>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0b3b60' }}>
                    {log.entity_id}
                  </td>
                  <td style={{ maxWidth: 350, fontSize: 12, color: '#475569' }}>
                    {log.new_values_json ? (
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={log.new_values_json}
                      >
                        {log.new_values_json}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
