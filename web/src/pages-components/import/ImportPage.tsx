import React, { useState } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { FileSpreadsheet, Download, Upload, AlertTriangle, CheckCircle2, FileCheck } from 'lucide-react';

export const ImportPage: React.FC = () => {
  const { showToast } = useNotifications();
  const [importType, setImportType] = useState<'companies' | 'employees'>('companies');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);

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
    if (!preview || !preview.previewRows || preview.validCount === 0) return;
    setCommitting(true);
    try {
      const res = await api.commitImport(importType, preview.previewRows);
      setSummary(res);
      setPreview(null);
      setFile(null);
      showToast(`Successfully imported ${res.importedCount} records into the database!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Enterprise Excel & CSV Import Engine</h2>
          <div className="page-subtitle">Batch import company masters and specialist employee rosters with strict validation</div>
        </div>
        <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
          <Download size={14} /> Download {importType === 'companies' ? 'Company' : 'Employee'} Template (.xlsx)
        </button>
      </div>

      {/* Selector Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className={`btn ${importType === 'companies' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setImportType('companies');
            setFile(null);
            setPreview(null);
            setSummary(null);
          }}
        >
          <FileSpreadsheet size={15} /> Company Master Import
        </button>
        <button
          className={`btn ${importType === 'employees' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setImportType('employees');
            setFile(null);
            setPreview(null);
            setSummary(null);
          }}
        >
          <FileSpreadsheet size={15} /> Employee Roster Import
        </button>
      </div>

      {/* Upload Box */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">1. Upload Spreadsheet File (.xlsx, .xls, .csv)</div>
        </div>

        <div
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: 8,
            padding: '20px 24px',
            textAlign: 'center',
            background: '#f8fafc',
          }}
        >
          <Upload size={24} color="#0b3b60" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Select Excel or CSV Spreadsheet</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 12 }}>
            Validates GSTN format, corporate emails, required columns, and checks for existing duplicates in the database.
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
                    • <strong>Row {err.rowNumber}</strong> ({err.field}): {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {preview.previewRows && preview.previewRows.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                Sample Preview of Validated Records (First {preview.previewRows.length} rows):
              </div>
              <div className="table-container" style={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(preview.previewRows[0]).map((key) => (
                        <th key={key}>{key.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row: any, idx: number) => (
                      <tr key={idx}>
                        {Object.values(row).map((val: any, vIdx: number) => (
                          <td key={vIdx}>{val || '—'}</td>
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

      {/* Completion Summary */}
      {summary && (
        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a', fontWeight: 700, fontSize: 16 }}>
            <FileCheck size={22} />
            <span>Batch Import Completed Successfully</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#166534' }}>
            {summary.importedCount} new {importType} records were committed directly to the database. All unique constraint verifications and audit logs were recorded.
          </div>
        </div>
      )}
    </div>
  );
};
