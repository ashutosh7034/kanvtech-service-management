import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Package,
  Layers,
  Users,
  Building2,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  Database,
  FileJson,
  FileText,
  Ticket,
  Clock,
  Briefcase,
  Target,
  CheckSquare,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Info,
  Lock,
} from 'lucide-react';

interface ExportModuleItem {
  id: string;
  name: string;
  category: string;
  description: string;
  entities: string[];
  recordCount: number;
  isAuthorized: boolean;
  requiresAdmin?: boolean;
}

export const ImportPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const isAdmin = user?.role === 'ADMIN';

  // Navigation mode: 'import' | 'export' | 'recovery'
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'recovery'>('export');

  // ==========================================
  // 1. IMPORT STATE & HANDLERS (Preserved)
  // ==========================================
  const [importType, setImportType] = useState<string>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const importEntities = [
    { id: 'products', label: '1. Products & Hierarchy', icon: Package, templateName: 'Products' },
    { id: 'departments', label: '2. Departments & Specializations', icon: Layers, templateName: 'Departments' },
    { id: 'employees', label: '3. Employees & Roster', icon: Users, templateName: 'Employees' },
    { id: 'customers', label: '4. Customer Master', icon: Building2, templateName: 'Customers' },
    { id: 'branches', label: '5. Customer Branches', icon: GitBranch, templateName: 'Branches' },
    { id: 'prospects', label: '6. Enquiries & Prospects', icon: Target, templateName: 'Prospects' },
    { id: 'subscriptions', label: '7. AMC Agreements', icon: Clock, templateName: 'Subscriptions' },
    { id: 'implementations', label: '8. New Implementations', icon: Briefcase, templateName: 'Implementations' },
    { id: 'tickets', label: '9. Support Tickets', icon: Ticket, templateName: 'Tickets' },
    { id: 'tasks', label: '10. Employee Tasks', icon: CheckSquare, templateName: 'Tasks' },
  ];

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.downloadTemplate(importType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanvtech_${importType}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setPreview(null);
      setSummary(null);
    }
  };

  const handleValidateAndPreview = async () => {
    if (!file) return;
    setValidating(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.previewImport(importType, formData);
      setPreview(res.preview);
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    const rowsToCommit = preview?.validRows && preview.validRows.length > 0 ? preview.validRows : preview?.previewRows;
    if (!preview || !rowsToCommit || rowsToCommit.length === 0 || preview.validCount === 0) return;
    setCommitting(true);
    try {
      const res = await api.commitImport(importType, rowsToCommit);
      setSummary(res);
      setPreview(null);
      setFile(null);
      if (res.failedCount && res.failedCount > 0) {
        showToast(`Import completed with warnings: ${res.importedCount} committed, ${res.failedCount} failed.`, 'warning');
      } else {
        showToast(`Successfully imported ${res.importedCount} records into the database!`, 'success');
      }
      fetchModules(); // Refresh export counters
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setCommitting(false);
    }
  };

  const handleDevReset = async () => {
    setResetting(true);
    try {
      const res = await api.devReset();
      setShowResetModal(false);
      showToast(res.message || 'Demo data successfully reset.', 'success');
      fetchModules(); // Refresh export counters
    } catch (err: any) {
      showToast(err.message || 'Failed to reset demo data.', 'danger');
    } finally {
      setResetting(false);
    }
  };

  const currentEntity = importEntities.find((e) => e.id === importType) || importEntities[3];

  // ==========================================
  // 2. EXPORT STATE & HANDLERS (New Feature)
  // ==========================================
  const [exportModules, setExportModules] = useState<ExportModuleItem[]>([]);
  const [totalSystemRecords, setTotalSystemRecords] = useState<number>(0);
  const [loadingModules, setLoadingModules] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');
  const [lastExportSummary, setLastExportSummary] = useState<{
    module: string;
    format: string;
    records: number;
    time: string;
  } | null>(null);

  const fetchModules = async () => {
    setLoadingModules(true);
    try {
      const res = await api.getExportModules();
      if (res && res.modules) {
        setExportModules(res.modules);
        setTotalSystemRecords(res.totalSystemRecords || 0);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load export modules information.', 'danger');
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const handleExecuteExport = async (moduleKey: string) => {
    setExporting(true);
    const targetName = moduleKey === 'all' ? 'All Enterprise Data' : moduleKey;
    setExportProgressText(`Preparing ${targetName} (${exportFormat.toUpperCase()})...`);

    try {
      setExportProgressText(`Extracting database entities & sanitizing credentials...`);
      const blob = await api.downloadExport(moduleKey, exportFormat);

      setExportProgressText(`Packaging download file...`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `kanvtech_${moduleKey}_export_${timestamp}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const targetMod = exportModules.find((m) => m.id === moduleKey);
      const records = moduleKey === 'all' ? totalSystemRecords : targetMod?.recordCount || 0;

      setLastExportSummary({
        module: moduleKey === 'all' ? 'All Modules' : targetMod?.name || moduleKey,
        format: exportFormat.toUpperCase(),
        records,
        time: new Date().toLocaleTimeString(),
      });

      showToast(`Export complete! Downloaded ${exportFormat.toUpperCase()} package.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export generation failed. Please try again.', 'danger');
    } finally {
      setExporting(false);
      setExportProgressText('');
    }
  };

  // Module Icon Mapping
  const getModuleIcon = (id: string) => {
    switch (id) {
      case 'customers': return Building2;
      case 'products': return Package;
      case 'departments': return Layers;
      case 'employees': return Users;
      case 'tickets': return Ticket;
      case 'subscriptions': return Clock;
      case 'implementations': return Briefcase;
      case 'prospects': return Target;
      case 'tasks': return CheckSquare;
      case 'chat': return MessageSquare;
      case 'audit': return ShieldCheck;
      default: return Database;
    }
  };

  // ==========================================
  // 3. RECOVERY & RESTORE STATE (New Feature)
  // ==========================================
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupJsonText, setBackupJsonText] = useState<string>('');
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [validatingRestore, setValidatingRestore] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState<boolean>(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setBackupFile(selected);
      setRestorePreview(null);
      setRestoreSuccessMessage(null);
      setRestoreConfirmed(false);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          setBackupJsonText(text);
        } catch {
          showToast('Could not read JSON backup file.', 'danger');
        }
      };
      reader.readAsText(selected);
    }
  };

  const handleValidateBackup = async () => {
    if (!backupJsonText && !backupFile) {
      showToast('Please select a JSON backup file first.', 'warning');
      return;
    }

    setValidatingRestore(true);
    setRestoreSuccessMessage(null);
    try {
      let parsed = null;
      try {
        parsed = JSON.parse(backupJsonText);
      } catch {
        throw new Error('Invalid JSON format: the file cannot be parsed as JSON.');
      }

      const res = await api.previewBackupRestore(parsed);
      setRestorePreview(res.preview);
      showToast('Backup structure validated! Dry-run preview generated below.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Validation failed. Please verify backup format.', 'danger');
    } finally {
      setValidatingRestore(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview || !restoreConfirmed) {
      showToast('Please verify the dry-run results and check the confirmation box.', 'warning');
      return;
    }

    setRestoring(true);
    try {
      const parsed = JSON.parse(backupJsonText);
      const res = await api.commitBackupRestore({
        backupPayload: parsed,
        confirmed: true,
      });

      setRestoreSuccessMessage(res.message);
      setRestorePreview(null);
      setBackupFile(null);
      setBackupJsonText('');
      setRestoreConfirmed(false);
      showToast(res.message || 'System data restored successfully!', 'success');
      fetchModules(); // Refresh counts
    } catch (err: any) {
      showToast(err.message || 'Restore failed. All changes were safely rolled back.', 'danger');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Enterprise Data Center & Disaster Recovery</h2>
          <div className="page-subtitle">
            Bidirectional data exchange, multi-format exports, relational JSON snapshots, and transactional system restore
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && activeTab === 'import' && (
            <button
              className="btn btn-outline"
              style={{ borderColor: '#ef4444', color: '#b91c1c' }}
              onClick={() => setShowResetModal(true)}
            >
              <RotateCcw size={14} /> Dev Data Reset
            </button>
          )}

          {activeTab === 'export' && (
            <button
              className="btn btn-primary"
              onClick={() => handleExecuteExport('all')}
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={15} />
              {exporting ? 'Generating Package...' : 'Export All Data (.xlsx)'}
            </button>
          )}
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('export')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'export' ? '3px solid #0b3b60' : '3px solid transparent',
            color: activeTab === 'export' ? '#0b3b60' : '#64748b',
            fontWeight: activeTab === 'export' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Download size={16} /> Export Business Data
        </button>

        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'import' ? '3px solid #0b3b60' : '3px solid transparent',
            color: activeTab === 'import' ? '#0b3b60' : '#64748b',
            fontWeight: activeTab === 'import' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Upload size={16} /> Batch Excel / CSV Import
        </button>

        <button
          onClick={() => setActiveTab('recovery')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'recovery' ? '3px solid #0b3b60' : '3px solid transparent',
            color: activeTab === 'recovery' ? '#0b3b60' : '#64748b',
            fontWeight: activeTab === 'recovery' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Database size={16} /> Backup & Disaster Recovery
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DATA EXPORT SECTION                                               */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div>
          {/* Format Selection Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="card-title">1. Select Target Export Format</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Choose your preferred serialization format based on your operational need
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0b3b60', fontWeight: 600 }}>
                <ShieldCheck size={16} color="#16a34a" /> Credential Redaction Active (No hashes or secrets exported)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {/* XLSX Option */}
              <div
                onClick={() => setExportFormat('xlsx')}
                style={{
                  border: exportFormat === 'xlsx' ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  background: exportFormat === 'xlsx' ? '#f0f9ff' : '#ffffff',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileSpreadsheet size={22} color={exportFormat === 'xlsx' ? '#0b3b60' : '#64748b'} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Microsoft Excel (.xlsx)</div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Multi-worksheet workbook with auto-fitted columns, header styling, and separate sheets for related tables. Recommended for reporting.
                </div>
              </div>

              {/* CSV Option */}
              <div
                onClick={() => setExportFormat('csv')}
                style={{
                  border: exportFormat === 'csv' ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  background: exportFormat === 'csv' ? '#f0f9ff' : '#ffffff',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileText size={22} color={exportFormat === 'csv' ? '#0b3b60' : '#64748b'} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Delimited CSV (.csv)</div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Standard comma-separated format. Ideal for spreadsheet data manipulation, external database ETL pipelines, and lightweight exchange.
                </div>
              </div>

              {/* JSON Option */}
              <div
                onClick={() => setExportFormat('json')}
                style={{
                  border: exportFormat === 'json' ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  background: exportFormat === 'json' ? '#f0f9ff' : '#ffffff',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileJson size={22} color={exportFormat === 'json' ? '#0b3b60' : '#64748b'} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Structured JSON Backup (.json)</div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Versioned relational JSON snapshot. Preserves entity hierarchies, exact primary keys, and foreign keys. Required for system recovery.
                </div>
              </div>
            </div>
          </div>

          {/* Progress / Status Banner */}
          {exporting && (
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <RefreshCw size={22} color="#0284c7" className="spin-animation" />
              <div>
                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 14 }}>{exportProgressText}</div>
                <div style={{ fontSize: 12, color: '#0284c7' }}>
                  Streaming data records, stripping credentials, and building export container...
                </div>
              </div>
            </div>
          )}

          {/* Last Export Notification */}
          {lastExportSummary && !exporting && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '12px 18px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <span style={{ fontSize: 13, color: '#166534' }}>
                  Successfully exported <strong>{lastExportSummary.module}</strong> ({lastExportSummary.format}) with{' '}
                  <strong>{lastExportSummary.records.toLocaleString()} records</strong> at {lastExportSummary.time}.
                </span>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setLastExportSummary(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Master Export Card */}
          <div className="card" style={{ marginBottom: 20, background: '#0b3b60', color: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Database size={24} color="#38bdf8" />
                  <span style={{ fontSize: 18, fontWeight: 700 }}>Complete Business Suite Export</span>
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 6, maxWidth: 650 }}>
                  Comprehensive export bundling all enterprise tables: customers, products, departments, employees, tickets, SLA history, AMC subscriptions, implementations, prospects, and tasks.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8' }}>
                    {totalSystemRecords.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Total Live Records</div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ background: '#0284c7', borderColor: '#0284c7', padding: '10px 20px', fontWeight: 700 }}
                  onClick={() => handleExecuteExport('all')}
                  disabled={exporting}
                >
                  <Download size={16} /> Export All Data ({exportFormat.toUpperCase()})
                </button>
              </div>
            </div>
          </div>

          {/* Module-by-Module Selection Grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>2. Export by Specific Business Module</div>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={fetchModules} disabled={loadingModules}>
              <RefreshCw size={12} /> Refresh Counts
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {exportModules.map((mod) => {
              const Icon = getModuleIcon(mod.id);
              const isAllowed = mod.isAuthorized;

              return (
                <div
                  key={mod.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #e2e8f0',
                    opacity: isAllowed ? 1 : 0.6,
                    position: 'relative',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0b3b60',
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{mod.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{mod.category}</div>
                        </div>
                      </div>

                      <div
                        style={{
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {mod.recordCount.toLocaleString()} records
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, minHeight: 36 }}>
                      {mod.description}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                      {mod.entities.map((ent, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    {mod.requiresAdmin && !isAdmin ? (
                      <span style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={12} /> Admin Role Required
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#16a34a' }}>Authorized for Export</span>
                    )}

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => handleExecuteExport(mod.id)}
                      disabled={exporting || !isAllowed}
                    >
                      <Download size={13} /> Export {exportFormat.toUpperCase()}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BATCH IMPORT SECTION (Preserved Original Implementation)           */}
      {/* ========================================================================= */}
      {activeTab === 'import' && (
        <div>
          {/* Header Action & Template Download */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              Select target entity to download canonical Excel template or upload spreadsheet for validation.
            </div>

            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <Download size={14} /> Download {currentEntity.templateName} Template (.xlsx)
            </button>
          </div>

          {/* Selector Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {importEntities.map((ent) => {
              const Icon = ent.icon;
              const active = importType === ent.id;
              return (
                <button
                  key={ent.id}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setImportType(ent.id);
                    setFile(null);
                    setPreview(null);
                    setSummary(null);
                  }}
                >
                  <Icon size={15} /> {ent.label}
                </button>
              );
            })}
          </div>

          {/* Upload Box */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">1. Upload {currentEntity.templateName} Spreadsheet (.xlsx, .xls, .csv)</div>
            </div>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                background: '#f8fafc',
              }}
            >
              <Upload size={28} color="#0b3b60" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Select {currentEntity.templateName} File</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 14 }}>
                System performs schema checks, dependency ordering, foreign key lookups, and duplicate email/GSTN detection.
              </div>

              <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                Browse File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>

              {file && (
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#0b3b60' }}>
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
            </div>

            {file && !preview && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleValidateAndPreview} disabled={validating}>
                  {validating ? 'Validating Spreadsheet...' : 'Validate & Preview Rows'}
                </button>
              </div>
            )}
          </div>

          {/* Validation & Preview Summary */}
          {preview && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title">2. Validation Results & Preview</div>
                <button className="btn btn-success" onClick={handleCommit} disabled={committing || preview.validCount === 0}>
                  <CheckCircle2 size={14} /> {committing ? 'Importing...' : `Confirm & Import ${preview.validCount} Valid Records`}
                </button>
              </div>

              {/* Stat Counters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{preview.totalRows}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total Rows Read</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{preview.validCount}</div>
                  <div style={{ fontSize: 11, color: '#166534' }}>Ready to Import</div>
                </div>
                <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{preview.invalidCount}</div>
                  <div style={{ fontSize: 11, color: '#991b1b' }}>Invalid Rows</div>
                </div>
                <div style={{ background: '#fffbeb', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{preview.duplicateCount}</div>
                  <div style={{ fontSize: 11, color: '#92400e' }}>Duplicates Found</div>
                </div>
              </div>

              {/* Validation Errors Breakdown */}
              {preview.errors && preview.errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} /> Validation Issues (Row-level Breakdown)
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {preview.errors.map((err: any, idx: number) => (
                      <div key={idx} style={{ fontSize: 12, color: '#b91c1c' }}>
                        Row {err.rowNumber}: Field <strong>{err.field}</strong> - {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Valid Rows Preview Table */}
              {preview.previewRows && preview.previewRows.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCheck size={16} color="#16a34a" /> Sample Valid Rows Preview (First {preview.previewRows.length} Rows)
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflowX: 'auto', background: '#ffffff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          {Object.keys(preview.previewRows[0]).slice(0, 7).map((key, i) => (
                            <th key={i} style={{ padding: '8px 12px', color: '#475569', textTransform: 'capitalize' }}>
                              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.previewRows.slice(0, 5).map((row: any, rIdx: number) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {Object.keys(preview.previewRows[0]).slice(0, 7).map((key, cIdx) => (
                              <td key={cIdx} style={{ padding: '8px 12px', color: '#334155', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : String(row[key] ?? '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success / Warning Summary */}
          {summary && (
            <div
              className="card"
              style={{
                background: summary.failedCount && summary.failedCount > 0 ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${summary.failedCount && summary.failedCount > 0 ? '#fde68a' : '#bbf7d0'}`,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: summary.failedCount && summary.failedCount > 0 ? '#92400e' : '#166534',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {summary.failedCount && summary.failedCount > 0 ? (
                  <AlertTriangle size={20} color="#d97706" />
                ) : (
                  <CheckCircle2 size={20} color="#16a34a" />
                )}
                <span>
                  {summary.failedCount && summary.failedCount > 0
                    ? `Import Completed with Warnings: ${summary.importedCount} records committed, ${summary.failedCount} records failed.`
                    : `Import Succeeded! ${summary.importedCount} records committed to the live database.`}
                </span>
              </div>
              {summary.errors && summary.errors.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#b91c1c', marginBottom: 4 }}>
                    Failed Records Breakdown:
                  </div>
                  {summary.errors.map((e: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 12, color: '#991b1b', padding: '3px 0' }}>
                      Row {e.rowNumber || idx + 1}: {e.companyName ? <strong>[{e.companyName}] </strong> : ''}{e.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SYSTEM BACKUP & DISASTER RECOVERY (New Feature)                    */}
      {/* ========================================================================= */}
      {activeTab === 'recovery' && (
        <div>
          {/* Recovery Architecture Info */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              gap: 14,
            }}
          >
            <Info size={22} color="#0b3b60" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: '#334155' }}>
              <div style={{ fontWeight: 700, color: '#0b3b60', marginBottom: 6 }}>
                KANVTECH Enterprise Recovery Architecture & Safety Policy
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 8 }}>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 12, marginBottom: 4 }}>1. Application Snapshots (.json)</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Entity-level logical recovery with foreign key re-mapping and dry-run validation. Used for tenant migrations and data recovery.
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 12, marginBottom: 4 }}>2. Database-Native Backups (Physical)</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    PostgreSQL WAL archives & pg_dump binaries maintained at server infrastructure level for disaster recovery.
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: 12, marginBottom: 4 }}>3. Staging Reset Sandbox</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Development testing sandbox for purging demo records. Strictly isolated and locked in production.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Backup File Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">1. Select KANVTECH JSON Backup File</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Upload an encrypted or plaintext .json backup archive</div>
            </div>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                background: '#f8fafc',
              }}
            >
              <FileJson size={32} color="#0b3b60" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Upload .json Backup File</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 14 }}>
                Files generated via "Export All Data (JSON)" or individual module JSON backups are supported.
              </div>

              <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                Browse Backup JSON
                <input type="file" accept=".json,application/json" onChange={handleBackupFileChange} style={{ display: 'none' }} />
              </label>

              {backupFile && (
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#0b3b60' }}>
                  Loaded: {backupFile.name} ({Math.round(backupFile.size / 1024)} KB)
                </div>
              )}
            </div>

            {backupFile && !restorePreview && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleValidateBackup}
                  disabled={validatingRestore}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={14} className={validatingRestore ? 'spin-animation' : ''} />
                  {validatingRestore ? 'Analyzing Backup...' : 'Validate & Generate Dry-Run Preview'}
                </button>
              </div>
            )}
          </div>

          {/* Dry-Run Preview Results */}
          {restorePreview && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">2. Dry-Run Validation Analysis</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Backup Version: <strong>{restorePreview.backupVersion}</strong> | Exported by: {restorePreview.exportedBy}
                  </div>
                </div>

                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Schema Validated ✓
                </div>
              </div>

              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{restorePreview.summary.totalRecords}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Records in Backup</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{restorePreview.summary.wouldCreate}</div>
                  <div style={{ fontSize: 11, color: '#166534' }}>New Records (Insert)</div>
                </div>
                <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6, textAlign: 'center', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7' }}>{restorePreview.summary.wouldUpdate}</div>
                  <div style={{ fontSize: 11, color: '#0369a1' }}>Existing Records (Safe Upsert)</div>
                </div>
              </div>

              {/* Entities Table Breakdown */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Entity / Table Name</th>
                      <th style={{ padding: '8px 12px' }}>Total Records</th>
                      <th style={{ padding: '8px 12px' }}>Would Insert</th>
                      <th style={{ padding: '8px 12px' }}>Would Update</th>
                      <th style={{ padding: '8px 12px' }}>Sample IDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restorePreview.previewResults.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.tableName}</td>
                        <td style={{ padding: '8px 12px' }}>{item.totalRecords}</td>
                        <td style={{ padding: '8px 12px', color: '#16a34a' }}>+{item.wouldCreate}</td>
                        <td style={{ padding: '8px 12px', color: '#0284c7' }}>{item.wouldUpdate}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 11 }}>
                          {item.sampleIds ? item.sampleIds.join(', ') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirmation and Commit Box */}
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#92400e' }}>
                  <input
                    type="checkbox"
                    checked={restoreConfirmed}
                    onChange={(e) => setRestoreConfirmed(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#0b3b60', cursor: 'pointer' }}
                  />
                  <span>
                    I confirm that I have reviewed the dry-run validation preview and authorize the transactional recovery of these records.
                  </span>
                </label>

                <button
                  className="btn btn-primary"
                  style={{ background: '#b91c1c', borderColor: '#b91c1c', padding: '10px 18px' }}
                  onClick={handleExecuteRestore}
                  disabled={!restoreConfirmed || restoring}
                >
                  <Database size={15} />
                  {restoring ? 'Restoring System...' : 'Commit System Recovery'}
                </button>
              </div>
            </div>
          )}

          {/* Restore Success Banner */}
          {restoreSuccessMessage && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <CheckCircle2 size={24} color="#16a34a" />
              <div>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>Recovery Transaction Committed</div>
                <div style={{ fontSize: 13, color: '#15803d' }}>{restoreSuccessMessage}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dev Reset Confirmation Modal (Preserved) */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', margin: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#b91c1c', marginBottom: 12 }}>
              <ShieldAlert size={24} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Reset Staging / Demo Data?</div>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
              This will purge demo tickets, reset customer branches, and restore baseline rosters while keeping the system administrator account intact.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)} disabled={resetting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={handleDevReset}
                disabled={resetting}
              >
                {resetting ? 'Resetting Data...' : 'Yes, Reset Staging Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPage;
