const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/src/pages-components/import/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes('MassUpdateSection')) {
  content = content.replace(
    "import { useNotifications } from '../../context/NotificationContext';",
    "import { useNotifications } from '../../context/NotificationContext';\r\nimport { MassUpdateSection } from './MassUpdateSection';"
  );
}

// 2. Add operationMode state
if (!content.includes('operationMode')) {
  content = content.replace(
    "const [importType, setImportType] = useState<string>('customers');",
    "const [operationMode, setOperationMode] = useState<'create' | 'update'>('create');\r\n  const [importType, setImportType] = useState<string>('customers');"
  );
}

// 3. Add Operation selector inside activeTab === 'import'
const targetStart = "      {activeTab === 'import' && (\r\n        <div>";
const replacementStart = `      {activeTab === 'import' && (
        <div>
          {/* Operation Mode Selector: Create New Records vs Update Existing Records */}
          <div
            className="card"
            style={{
              marginBottom: 20,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileSpreadsheet size={18} /> Bulk Data Operations & Synchronization
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Choose the operation you want to perform: onboard fresh records or update missing/existing data in current records.
                </div>
              </div>

              <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setOperationMode('create')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: operationMode === 'create' ? 700 : 500,
                    background: operationMode === 'create' ? '#0b3b60' : 'transparent',
                    color: operationMode === 'create' ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: operationMode === 'create' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Upload size={14} /> Create New Records
                </button>

                <button
                  type="button"
                  onClick={() => setOperationMode('update')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: operationMode === 'update' ? 700 : 500,
                    background: operationMode === 'update' ? '#0b3b60' : 'transparent',
                    color: operationMode === 'update' ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: operationMode === 'update' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RefreshCw size={14} /> Update Existing Records
                </button>
              </div>
            </div>
          </div>

          {operationMode === 'update' ? (
            <MassUpdateSection />
          ) : (
            <>`;

// Replace start
if (content.includes(targetStart)) {
  content = content.replace(targetStart, replacementStart);
} else {
  // LF fallback
  content = content.replace(
    "      {activeTab === 'import' && (\n        <div>",
    replacementStart.replace(/\r\n/g, '\n')
  );
}

// Close the fragment at the end of create mode before the closing of activeTab === 'import'
const targetEnd = `      {/* ========================================================================= */}
      {/* TAB 3: SYSTEM BACKUP & DISASTER RECOVERY (New Feature)                    */}`;

const replacementEnd = `            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SYSTEM BACKUP & DISASTER RECOVERY (New Feature)                    */}`;

if (content.includes(targetEnd)) {
  content = content.replace(targetEnd, replacementEnd);
} else {
  content = content.replace(
    targetEnd.replace(/\r\n/g, '\n'),
    replacementEnd.replace(/\r\n/g, '\n')
  );
}

// Remove the extra </div>\r\n      )} right before TAB 3 if present
const doubleCloseCRLF = `            </div>
          )}
        </div>
      )}
            </>
          )}
        </div>
      )}`;

// Let's write file and check
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ImportPage.tsx');

