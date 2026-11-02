import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Package,
  Layers,
  Users,
  Building2,
  GitBranch,
  Ticket,
  Clock,
  Briefcase,
  Target,
  ArrowRight,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  History,
  Sliders,
  Edit3,
} from 'lucide-react';

interface ModuleFieldDef {
  key: string;
  label: string;
  type: string;
  enumValues?: string[];
  isRequired?: boolean;
  description: string;
  exampleValue: string;
}

interface ModuleConfig {
  id: string;
  label: string;
  modelName: string;
  templateName: string;
  recordIdentifierField: string;
  recordIdentifierLabel: string;
  alternateIdentifiers?: string[];
  displayNameField: string;
  fields: ModuleFieldDef[];
}

export const MassUpdateSection: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // 1. Modules state
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('employees');
  const [loadingModules, setLoadingModules] = useState<boolean>(true);

  // 2. File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<{
    columns: string[];
    sampleRows: any[];
    totalRows: number;
    rawRows: any[];
  } | null>(null);

  // 3. Matching & Mapping state
  const [identifierColumn, setIdentifierColumn] = useState<string>('');
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  // 4. Update Mode state
  const [updateMode, setUpdateMode] = useState<'fill_missing' | 'selective_overwrite'>('fill_missing');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [allowClearValues, setAllowClearValues] = useState<boolean>(false);

  // 5. Preview state
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ready' | 'matched' | 'unmatched' | 'invalid' | 'no_change'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 6. Execution state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  // 7. History state
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Load modules on mount
  useEffect(() => {
    loadModules();
    loadHistory();
  }, []);

  const loadModules = async () => {
    setLoadingModules(true);
    try {
      const res = await api.getMassUpdateModules();
      if (res && res.modules) {
        setModules(res.modules);
        if (res.modules.length > 0 && !res.modules.some((m: any) => m.id === selectedModuleId)) {
          setSelectedModuleId(res.modules[0].id);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load supported modules.', 'danger');
    } finally {
      setLoadingModules(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getMassUpdateHistory();
      if (res && res.history) {
        setHistoryItems(res.history);
      }
    } catch {
      // Non-critical, ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const currentModule = modules.find((m) => m.id === selectedModuleId) || modules[0];

  // Helper icon mapper
  const getModuleIcon = (id: string) => {
    switch (id) {
      case 'employees': return Users;
      case 'customers': return Building2;
      case 'products': return Package;
      case 'departments': return Layers;
      case 'tickets': return Ticket;
      case 'branches': return GitBranch;
      case 'prospects': return Target;
      case 'subscriptions': return Clock;
      case 'implementations': return Briefcase;
      default: return FileSpreadsheet;
    }
  };

  // Download template for currently selected module
  const handleDownloadTemplate = async () => {
    if (!currentModule) return;
    try {
      const blob = await api.downloadMassUpdateTemplate(currentModule.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanvtech_${currentModule.id}_mass_update_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded update template for ${currentModule.label}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download template', 'danger');
    }
  };

  // Handle file selection and parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setParsedData(null);
      setPreviewResult(null);
      setExecutionResult(null);

      // Parse file on server
      setIsParsing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await api.parseMassUpdateFile(formData);
        setParsedData(res);

        // Auto-detect identifier column
        const cols: string[] = res.columns || [];
        const idCol =
          cols.find((c) =>
            currentModule?.recordIdentifierLabel.toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes(currentModule?.recordIdentifierField.toLowerCase()) ||
            c.toLowerCase() === 'id' ||
            c.toLowerCase() === 'code' ||
            c.toLowerCase() === 'employee id' ||
            c.toLowerCase() === 'customer id',
          ) || cols[0] || '';
        setIdentifierColumn(idCol);

        // Auto-guess initial field mappings
        const initialMappings: Record<string, string> = {};
        cols.forEach((col) => {
          if (col === idCol) {
            initialMappings[col] = '__IDENTIFIER__';
          } else {
            const matchedField = currentModule?.fields.find(
              (f) =>
                f.label.toLowerCase() === col.toLowerCase() ||
                f.key.toLowerCase() === col.toLowerCase() ||
                col.toLowerCase().includes(f.key.toLowerCase()),
            );
            initialMappings[col] = matchedField ? matchedField.key : '__SKIP__';
          }
        });
        setFieldMappings(initialMappings);

        // Default selective fields to all mapped fields
        const mappedKeys = Object.values(initialMappings).filter(
          (k) => k !== '__SKIP__' && k !== '__IDENTIFIER__',
        );
        setSelectedFields(mappedKeys);

        showToast(`Document parsed: ${res.totalRows} data rows and ${cols.length} columns detected.`, 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to parse file.', 'danger');
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    }
  };

  // Switch module
  const handleSelectModule = (modId: string) => {
    setSelectedModuleId(modId);
    setFile(null);
    setParsedData(null);
    setPreviewResult(null);
    setExecutionResult(null);
  };

  // Change identifier column mapping
  const handleIdentifierColChange = (col: string) => {
    setIdentifierColumn(col);
    setFieldMappings((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === '__IDENTIFIER__') next[k] = '__SKIP__';
      });
      next[col] = '__IDENTIFIER__';
      return next;
    });
  };

  // Toggle field selection for Selective Overwrite mode
  const handleToggleFieldSelection = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey],
    );
  };

  // Run preview
  const handlePreview = async () => {
    if (!parsedData || !currentModule || !identifierColumn) return;

    // Validate that identifier is selected
    if (!identifierColumn) {
      showToast('Please specify which column represents the Unique Record Identifier.', 'danger');
      return;
    }

    // Check if at least one field is mapped
    const activeMappings = Object.entries(fieldMappings).filter(
      ([col, key]) => col !== identifierColumn && key !== '__SKIP__' && key !== '__IDENTIFIER__',
    );
    if (activeMappings.length === 0) {
      showToast('Please map at least one column to an application field.', 'danger');
      return;
    }

    // For selective overwrite, ensure at least one field is checked
    if (updateMode === 'selective_overwrite' && selectedFields.length === 0) {
      showToast('Please select at least one field to overwrite in Selective Overwrite mode.', 'danger');
      return;
    }

    setIsPreviewing(true);
    setPreviewResult(null);

    try {
      const payload = {
        rows: parsedData.rawRows,
        identifierColumn,
        fieldMappings,
        updateMode,
        selectedFields,
        allowClearValues,
      };

      const res = await api.previewMassUpdate(currentModule.id, payload);
      setPreviewResult(res.preview);

      const summary = res.preview?.summary;
      if (summary) {
        showToast(
          `Analysis complete: ${summary.matchedCount} records matched, ${summary.readyCount} ready for update.`,
          summary.readyCount > 0 ? 'success' : 'warning',
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Validation and preview failed.', 'danger');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Execute Mass Update Commit
  const handleCommit = async () => {
    if (!previewResult || !parsedData || !currentModule) return;

    setIsCommitting(true);
    setShowConfirmModal(false);

    try {
      const payload = {
        rows: parsedData.rawRows,
        identifierColumn,
        fieldMappings,
        updateMode,
        selectedFields,
        allowClearValues,
        fileName: file?.name || 'mass_update.xlsx',
      };

      const res = await api.commitMassUpdate(currentModule.id, payload);
      setExecutionResult(res);
      setPreviewResult(null);
      setFile(null);
      setParsedData(null);

      showToast(
        `Mass update executed! ${res.updatedCount} records successfully updated in the database.`,
        res.failedCount > 0 ? 'warning' : 'success',
      );
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Failed to commit updates to database.', 'danger');
    } finally {
      setIsCommitting(false);
    }
  };

  // Download Execution Result Report
  const handleDownloadReport = async (opId: string) => {
    try {
      const blob = await api.downloadMassUpdateReport(opId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanvtech_mass_update_result_${opId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Downloaded official result report (.xlsx)', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download result report.', 'danger');
    }
  };

  // Filter preview rows
  const getFilteredRows = () => {
    if (!previewResult?.rows) return [];
    return previewResult.rows.filter((row: any) => {
      // Filter by category
      if (previewFilter === 'ready' && !(row.matchStatus === 'MATCHED' && row.validationStatus === 'VALID' && row.willUpdateCount > 0)) {
        return false;
      }
      if (previewFilter === 'matched' && row.matchStatus !== 'MATCHED') return false;
      if (previewFilter === 'unmatched' && row.matchStatus !== 'UNMATCHED') return false;
      if (previewFilter === 'invalid' && row.validationStatus !== 'INVALID') return false;
      if (previewFilter === 'no_change' && !(row.matchStatus === 'MATCHED' && row.willUpdateCount === 0)) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = String(row.identifier || '').toLowerCase().includes(query);
        const matchesName = String(row.recordName || '').toLowerCase().includes(query);
        return matchesId || matchesName;
      }

      return true;
    });
  };

  if (loadingModules) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
        <div>Loading Mass Update configurations...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Informational Banner */}
      <div
        style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0369a1' }}>
              Mass Update & Missing Data Completion
            </div>
            <div style={{ fontSize: 12, color: '#0c4a6e', marginTop: 2 }}>
              Update missing fields or selectively overwrite existing records without creating duplicates. Strictly matches on verified unique identifiers.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={14} /> {showHistory ? 'Hide History' : 'View Update History'} ({historyItems.length})
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleDownloadTemplate}
          >
            <Download size={14} /> Download {currentModule?.templateName} Update Template (.xlsx)
          </button>
        </div>
      </div>

      {/* Update History Section */}
      {showHistory && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #cbd5e1' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} color="#0b3b60" /> Recent Mass Update Operations Audit Log
            </div>
            <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={loadHistory} disabled={loadingHistory}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {historyItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No mass update operations have been executed yet in this tenant.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Operation ID</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>File Name</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Module</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Mode</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>User</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Records (Updated / Skipped / Total)</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Status</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Timestamp</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => (
                    <tr key={item.operationId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0b3b60' }}>{item.operationId}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{item.fileName}</td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize', fontWeight: 600 }}>{item.module}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            background: item.updateMode === 'fill_missing' ? '#e0f2fe' : '#fef3c7',
                            color: item.updateMode === 'fill_missing' ? '#0369a1' : '#92400e',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {item.updateMode === 'fill_missing' ? 'Missing Only' : 'Selective Overwrite'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.actorEmail || `User #${item.actorUserId || '1'}`}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <strong style={{ color: '#16a34a' }}>{item.updatedCount}</strong> updated /{' '}
                        <span style={{ color: '#64748b' }}>{item.skippedCount}</span> skipped /{' '}
                        <strong>{item.totalRows}</strong> total
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            background: item.status === 'SUCCESS' ? '#dcfce7' : item.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                            color: item.status === 'SUCCESS' ? '#166534' : item.status === 'PARTIAL' ? '#92400e' : '#991b1b',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{new Date(item.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleDownloadReport(item.operationId)}
                        >
                          <Download size={12} /> Result Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Select Target Business Module */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">1. Select Target Business Module to Update</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Choose the business record type you wish to complement with supplementary information
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {modules.map((mod) => {
            const Icon = getModuleIcon(mod.id);
            const active = selectedModuleId === mod.id;
            return (
              <div
                key={mod.id}
                onClick={() => handleSelectModule(mod.id)}
                style={{
                  border: active ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: active ? '#f0f9ff' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 1px 3px rgba(11, 59, 96, 0.15)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: active ? '#0b3b60' : '#f1f5f9',
                    color: active ? '#ffffff' : '#0b3b60',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: '#0f172a' }}>{mod.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Key: {mod.recordIdentifierLabel}</div>
                </div>
                {active && <Check size={16} color="#0b3b60" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Document Upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title">2. Upload Supplementary Spreadsheet (.xlsx, .xls, .csv)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Upload your Excel or CSV file containing updated or missing fields. Every row must reference an existing {currentModule?.recordIdentifierLabel}.
            </div>
          </div>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleDownloadTemplate}>
            <Download size={13} /> Sample Template
          </button>
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
          <Upload size={32} color="#0b3b60" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {file ? file.name : `Select or Drag & Drop ${currentModule?.label} File`}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 14 }}>
            Accepts Microsoft Excel (.xlsx, .xls) and Delimited CSV (.csv). Max file size 25MB.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} /> Browse Document
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
            {file && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFile(null);
                  setParsedData(null);
                  setPreviewResult(null);
                  setExecutionResult(null);
                }}
              >
                <X size={14} /> Remove File
              </button>
            )}
          </div>

          {isParsing && (
            <div style={{ marginTop: 14, color: '#0284c7', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RefreshCw size={14} className="animate-spin" /> Parsing columns and rows from spreadsheet...
            </div>
          )}

          {parsedData && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
                color: '#166534',
              }}
            >
              <CheckCircle2 size={16} color="#16a34a" />
              <span>
                <strong>{file?.name}</strong> successfully parsed ({parsedData.totalRows} data rows, {parsedData.columns.length} columns detected).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step 3 & 4: Matching Identifier, Field Mapping & Update Mode Selection */}
      {parsedData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">3. Record Matching & Field Mapping Configuration</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Select which column uniquely identifies existing records, map columns to target fields, and configure the update mode.
            </div>
          </div>

          {/* Identifier Column Selection */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ShieldCheck size={18} color="#0b3b60" />
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                Required Unique Record Matching Identifier
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              Choose the column in your uploaded document that holds the unique record key (e.g. {currentModule?.recordIdentifierLabel}). The system matches records strictly on this identifier and will NEVER create new records.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 500 }}>
              <select
                className="form-control"
                value={identifierColumn}
                onChange={(e) => handleIdentifierColChange(e.target.value)}
                style={{ fontWeight: 600, color: '#0b3b60', borderColor: '#0284c7' }}
              >
                {parsedData.columns.map((col) => (
                  <option key={col} value={col}>
                    {col} {col.toLowerCase().includes('id') || col.toLowerCase().includes('code') ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                Matches {currentModule?.label}
              </span>
            </div>
          </div>

          {/* Step 4: Update Mode Selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={16} color="#0b3b60" /> Select Mass Update Mode
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Mode A: Fill Missing Fields Only */}
              <div
                onClick={() => setUpdateMode('fill_missing')}
                style={{
                  border: updateMode === 'fill_missing' ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  background: updateMode === 'fill_missing' ? '#f0f9ff' : '#ffffff',
                  boxShadow: updateMode === 'fill_missing' ? '0 1px 3px rgba(11, 59, 96, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0b3b60' }}>
                    MODE A: Fill Missing Fields Only
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    Safe & Non-Destructive
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Populates <strong>only database fields that are currently blank or missing</strong>. Any field that already has an existing value in the database is strictly preserved and will <strong>never be overwritten</strong>.
                </div>
              </div>

              {/* Mode B: Selective Overwrite */}
              <div
                onClick={() => setUpdateMode('selective_overwrite')}
                style={{
                  border: updateMode === 'selective_overwrite' ? '2px solid #0b3b60' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  background: updateMode === 'selective_overwrite' ? '#f0f9ff' : '#ffffff',
                  boxShadow: updateMode === 'selective_overwrite' ? '0 1px 3px rgba(11, 59, 96, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0b3b60' }}>
                    MODE B: Update Selected Fields
                  </div>
                  <span
                    style={{
                      background: '#fef3c7',
                      color: '#92400e',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    Selective Overwrite
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Allows you to <strong>explicitly select which fields to update</strong> with the uploaded values. Any field you do not select remains untouched in the database.
                </div>
              </div>
            </div>

            {/* Mode B Options (Checkboxes & Clear Values) */}
            {updateMode === 'selective_overwrite' && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                  Check the fields you want to overwrite from this upload:
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  {currentModule?.fields.map((f) => {
                    const isChecked = selectedFields.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          background: isChecked ? '#fef3c7' : '#ffffff',
                          border: isChecked ? '1px solid #d97706' : '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFieldSelection(f.key)}
                        />
                        <span style={{ fontWeight: isChecked ? 600 : 400 }}>{f.label}</span>
                      </label>
                    );
                  })}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#b45309', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowClearValues}
                    onChange={(e) => setAllowClearValues(e.target.checked)}
                  />
                  <span>
                    <strong>Allow Clearing Existing Values:</strong> When enabled, blank uploaded cells will set existing database values to empty. Leave unchecked to ignore blank cells.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Interactive Column Mapping Table */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={16} color="#0b3b60" /> Uploaded Columns to Application Fields Mapping
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Uploaded Document Column</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Sample Value (Row 1)</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Target Application Field</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Mapping Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.columns.map((col) => {
                    const sampleVal = parsedData.sampleRows[0]?.[col] ?? '-';
                    const currentMapping = fieldMappings[col] || '__SKIP__';
                    const isIdentifier = col === identifierColumn;

                    return (
                      <tr key={col} style={{ borderBottom: '1px solid #f1f5f9', background: isIdentifier ? '#f0f9ff' : '#ffffff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{col}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {String(sampleVal)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {isIdentifier ? (
                            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: 12 }}>
                              ★ {currentModule?.recordIdentifierLabel} (Unique Matching Identifier)
                            </span>
                          ) : (
                            <select
                              className="form-control"
                              style={{ fontSize: 12, padding: '4px 8px', maxWidth: 300 }}
                              value={currentMapping}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldMappings((prev) => ({ ...prev, [col]: val }));
                              }}
                            >
                              <option value="__SKIP__">— Skip Column (Do Not Map) —</option>
                              {currentModule?.fields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} ({f.type})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {isIdentifier ? (
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                              IDENTIFIER
                            </span>
                          ) : currentMapping !== '__SKIP__' ? (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              MAPPED
                            </span>
                          ) : (
                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>
                              SKIPPED
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handlePreview}
                disabled={isPreviewing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {isPreviewing ? <RefreshCw size={14} className="animate-spin" /> : <FileCheck size={14} />}
                {isPreviewing ? 'Validating & Matching Records...' : 'Analyze & Preview Proposed Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Validation Results & Before / After Preview */}
      {previewResult && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="card-title">4. Validation Analysis & Detailed Preview</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Review before-and-after values for matched records. Confirm below to commit safe updates to the database.
              </div>
            </div>

            <button
              className="btn btn-success"
              onClick={() => setShowConfirmModal(true)}
              disabled={isCommitting || previewResult.summary.readyCount === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle2 size={15} /> Confirm & Apply {previewResult.summary.readyCount} Updates
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{previewResult.summary.totalRows}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Rows</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{previewResult.summary.matchedCount}</div>
              <div style={{ fontSize: 11, color: '#166534' }}>Matched Records</div>
            </div>
            <div style={{ background: '#eff6ff', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{previewResult.summary.readyCount}</div>
              <div style={{ fontSize: 11, color: '#1e40af' }}>Ready for Update</div>
            </div>
            <div style={{ background: '#fef2f2', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{previewResult.summary.unmatchedCount}</div>
              <div style={{ fontSize: 11, color: '#991b1b' }}>Unmatched (Skipped)</div>
            </div>
            <div style={{ background: '#fffbeb', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{previewResult.summary.duplicateCount}</div>
              <div style={{ fontSize: 11, color: '#92400e' }}>File Duplicates</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#64748b' }}>{previewResult.summary.noChangeCount}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>No Changes Needed</div>
            </div>
          </div>

          {/* Validation Errors Breakdown */}
          {previewResult.validationErrors && previewResult.validationErrors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Validation Alerts ({previewResult.validationErrors.length})
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {previewResult.validationErrors.map((err: any, idx: number) => (
                  <div key={idx} style={{ fontSize: 11, color: '#b91c1c' }}>
                    Row {err.rowNumber} [{err.identifier}]: Field <strong>{err.field}</strong> — {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Filters & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                className={`btn ${previewFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setPreviewFilter('all')}
              >
                All Rows ({previewResult.rows.length})
              </button>
              <button
                className={`btn ${previewFilter === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setPreviewFilter('ready')}
              >
                Ready for Update ({previewResult.summary.readyCount})
              </button>
              <button
                className={`btn ${previewFilter === 'unmatched' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setPreviewFilter('unmatched')}
              >
                Unmatched ({previewResult.summary.unmatchedCount})
              </button>
              <button
                className={`btn ${previewFilter === 'invalid' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setPreviewFilter('invalid')}
              >
                Invalid ({previewResult.summary.invalidCount})
              </button>
              <button
                className={`btn ${previewFilter === 'no_change' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setPreviewFilter('no_change')}
              >
                No Changes ({previewResult.summary.noChangeCount})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by ID or Name..."
              className="form-control"
              style={{ maxWidth: 220, fontSize: 12, padding: '4px 8px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Row-by-Row Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflowX: 'auto', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '8px 10px', color: '#475569', width: 50 }}>Row</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Identifier</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Record Name</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Match Status</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Proposed Field Changes</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Action Status</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredRows().map((row: any) => {
                  const isReady = row.matchStatus === 'MATCHED' && row.validationStatus === 'VALID' && row.willUpdateCount > 0;
                  return (
                    <tr key={row.rowNumber} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{row.rowNumber}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0b3b60' }}>{row.identifier}</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{row.recordName}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            background:
                              row.matchStatus === 'MATCHED'
                                ? '#dcfce7'
                                : row.matchStatus === 'UNMATCHED'
                                ? '#fee2e2'
                                : '#fef3c7',
                            color:
                              row.matchStatus === 'MATCHED'
                                ? '#166534'
                                : row.matchStatus === 'UNMATCHED'
                                ? '#991b1b'
                                : '#92400e',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {row.matchStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {row.changes && row.changes.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {row.changes.map((c: any, cIdx: number) => {
                              const willUpdate = c.status === 'WILL_UPDATE';
                              return (
                                <div
                                  key={cIdx}
                                  style={{
                                    fontSize: 11,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: willUpdate ? '#f0fdf4' : '#f8fafc',
                                    border: willUpdate ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <strong style={{ color: willUpdate ? '#166534' : '#64748b' }}>{c.fieldLabel}:</strong>
                                  <span style={{ color: '#94a3b8', textDecoration: willUpdate && c.oldValue ? 'line-through' : 'none' }}>
                                    {c.oldValue ? String(c.oldValue) : '(empty)'}
                                  </span>
                                  {willUpdate && (
                                    <>
                                      <ArrowRight size={10} color="#16a34a" />
                                      <span style={{ color: '#166534', fontWeight: 700 }}>
                                        {c.proposedValue !== null ? String(c.proposedValue) : '(clear to empty)'}
                                      </span>
                                    </>
                                  )}
                                  {!willUpdate && (
                                    <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginLeft: 4 }}>
                                      [{c.status === 'SKIPPED_EXISTING' ? 'Preserved (has data)' : c.status === 'SKIPPED_NOT_SELECTED' ? 'Not Selected' : 'Blank'}]
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            {row.errors.join(', ') || 'No fields eligible'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {isReady ? (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> {row.willUpdateCount} field(s) will update
                          </span>
                        ) : row.matchStatus === 'UNMATCHED' ? (
                          <span style={{ color: '#dc2626', fontSize: 11 }}>Skipped (Record not found)</span>
                        ) : row.matchStatus === 'DUPLICATE' ? (
                          <span style={{ color: '#d97706', fontSize: 11 }}>Skipped (Duplicate row in file)</span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: 11 }}>No change</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Results Summary Banner */}
      {executionResult && (
        <div
          className="card"
          style={{
            background: executionResult.failedCount > 0 ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${executionResult.failedCount > 0 ? '#fde68a' : '#bbf7d0'}`,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: executionResult.failedCount > 0 ? '#f59e0b' : '#16a34a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: executionResult.failedCount > 0 ? '#92400e' : '#166534' }}>
                  {executionResult.message}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  Operation ID: <strong>{executionResult.operationId}</strong> • Audited & Recorded permanently in database log.
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => handleDownloadReport(executionResult.operationId)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={15} /> Download Official Result Report (.xlsx)
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 520,
              width: '100%',
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={24} color="#d97706" />
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                Confirm Mass Update Execution
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
              You are about to update <strong>{previewResult?.summary.readyCount} existing records</strong> in the <strong>{currentModule?.label}</strong> table.
              <br />
              <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                <div>• Mode: <strong>{updateMode === 'fill_missing' ? 'Fill Missing Fields Only' : 'Selective Overwrite'}</strong></div>
                <div>• Verified Tenant Isolation: <strong>Active ({user?.tenantId || 'KANVTECH'})</strong></div>
                <div>• Database Safety: <strong>Zero new records will be created</strong></div>
                <div>• Audit Logging: <strong>All field diffs will be permanently recorded</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={isCommitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCommit}
                disabled={isCommitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {isCommitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isCommitting ? 'Executing Mass Update...' : 'Yes, Confirm & Update Records'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

