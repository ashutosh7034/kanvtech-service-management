import * as XLSX from 'xlsx';

/**
 * Generates the unified 3-worksheet customer workbook:
 *  1. CUSTOMERS - Customer creation template (13 columns, preserved functionality)
 *  2. UPDATE CUSTOMERS - Customer & Entitlement editing template (23 columns in exact order)
 *  3. INSTRUCTIONS - Comprehensive guide covering both creation and update workflows
 */
export function generateUnifiedCustomerWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  // =========================================================================
  // 1. SHEET 1: CUSTOMERS (Creation Template - 13 columns preserved)
  // =========================================================================
  const customerCreationHeaders = [
    'Company Name',
    'Address',
    'GSTN',
    'Primary Email',
    'Contact Person',
    'Contact Phone',
    'Entitlement Type',
    'Product Codes',
    'Product Modules',
    'Product Submodules',
    'Alternate Contact',
    'Alternate Contact Phone',
    'Alternate Contact Email',
  ];

  const customerCreationSamples = [
    [
      'Apex Cloud Solutions Pvt Ltd',
      'Plot 45, Phase 1, Industrial Area, Mumbai 400068',
      '27AAACA9988G1Z1',
      'contact@apexcloud.com',
      'Suresh Kulkarni',
      '+91 98220 12345',
      'SELECTED_MODULES',
      'TALLY, SPINE',
      'TALLY:Accounting|Inventory;SPINE:Payroll|Attendance',
      'TALLY:Accounting=Ledger|Voucher;SPINE:Payroll=Salary|Payslip;SPINE:Attendance=Device Setup',
      'Ramesh Deshmukh',
      '+91 98220 54321',
      'ramesh@apexcloud.com',
    ],
    [
      'Zenith Global Technologies',
      'Tower B, BKC Complex, Mumbai 400051',
      '27ZZZAA1122B1Z9',
      'info@zenithtech.com',
      'Anita Desai',
      '+91 98330 99887',
      'COMPLETE',
      'BIOS360',
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  const wsCustomers = XLSX.utils.aoa_to_sheet([customerCreationHeaders, ...customerCreationSamples]);
  wsCustomers['!cols'] = [
    { wch: 32 }, // Company Name
    { wch: 48 }, // Address
    { wch: 18 }, // GSTN
    { wch: 28 }, // Primary Email
    { wch: 22 }, // Contact Person
    { wch: 18 }, // Contact Phone
    { wch: 20 }, // Entitlement Type
    { wch: 20 }, // Product Codes
    { wch: 45 }, // Product Modules
    { wch: 55 }, // Product Submodules
    { wch: 22 }, // Alternate Contact
    { wch: 20 }, // Alternate Contact Phone
    { wch: 26 }, // Alternate Contact Email
  ];
  wsCustomers['!autofilter'] = { ref: `A1:M${customerCreationSamples.length + 1}` };
  wsCustomers['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  XLSX.utils.book_append_sheet(wb, wsCustomers, 'CUSTOMERS');

  // =========================================================================
  // 2. SHEET 2: UPDATE CUSTOMERS (Update Template - exactly 23 columns)
  // =========================================================================
  const updateCustomerHeaders = [
    'Customer ID',
    'Company Name',
    'Address',
    'GSTN',
    'Primary Email',
    'Alternate Emails',
    'Contact Person',
    'Contact Phone',
    'Contact Location',
    'Contact Status',
    'Alternate Contact',
    'Alternate Contact Phone',
    'Alternate Contact Email',
    'Alternate Contact Location / Address',
    'Entitlement Type',
    'Branch ID',
    'Branch Name',
    'Product Codes',
    'Product Modules',
    'Product Submodules',
    'Entitlement Action',
    'Entitlement Status',
    'Is Active',
  ];

  const updateCustomerSamples = [
    [
      'CMP-0001',
      'Apex Cloud Solutions Pvt Ltd',
      'Plot 45, Phase 1, Industrial Area, Mumbai 400068',
      '27AAACA9988G1Z1',
      'contact@apexcloud.com',
      'accounts@apexcloud.com, ops@apexcloud.com',
      'Suresh Kulkarni',
      '+91 98220 12345',
      'Headquarters - Mumbai',
      'VERIFIED',
      'Ramesh Deshmukh',
      '+91 98220 54321',
      'ramesh@apexcloud.com',
      'Branch Office - Pune',
      'SELECTED_MODULES',
      'BR-0001',
      'Mumbai Central Branch',
      'TALLY, SPINE',
      'TALLY:Accounting|Inventory;SPINE:Payroll|Attendance',
      'TALLY:Accounting=Ledger|Voucher;SPINE:Payroll=Salary|Payslip',
      'UPDATE',
      'ACTIVE',
      'true',
    ],
    [
      'CMP-0002',
      'Zenith Global Technologies',
      'Tower B, BKC Complex, Mumbai 400051',
      '27ZZZAA1122B1Z9',
      'info@zenithtech.com',
      'billing@zenithtech.com',
      'Anita Desai',
      '+91 98330 99887',
      'Corporate Office',
      'ACTIVE',
      'Sunil Mehta',
      '+91 98330 11223',
      'sunil@zenithtech.com',
      'BKC Operations Desk',
      'COMPLETE',
      '',
      '',
      'BIOS360',
      '',
      '',
      'ADD',
      'ACTIVE',
      'true',
    ],
    [
      'CMP-0003',
      'Omkar Logistics LLP',
      'MIDC Turbhe, Navi Mumbai 400705',
      '27ABCDE1234F1Z5',
      'admin@omkarlogistics.com',
      '',
      'Rajesh Patil',
      '+91 98110 55443',
      'Logistics Hub',
      'PENDING',
      '',
      '',
      '',
      '',
      'SELECTED_MODULES',
      '',
      '',
      'TALLY',
      'TALLY:Accounting',
      'TALLY:Accounting=Ledger',
      'ENABLE',
      'ACTIVE',
      'true',
    ],
  ];

  const wsUpdate = XLSX.utils.aoa_to_sheet([updateCustomerHeaders, ...updateCustomerSamples]);
  wsUpdate['!cols'] = [
    { wch: 16 }, // Customer ID
    { wch: 32 }, // Company Name
    { wch: 45 }, // Address
    { wch: 18 }, // GSTN
    { wch: 28 }, // Primary Email
    { wch: 36 }, // Alternate Emails
    { wch: 22 }, // Contact Person
    { wch: 18 }, // Contact Phone
    { wch: 24 }, // Contact Location
    { wch: 16 }, // Contact Status
    { wch: 22 }, // Alternate Contact
    { wch: 22 }, // Alternate Contact Phone
    { wch: 28 }, // Alternate Contact Email
    { wch: 36 }, // Alternate Contact Location / Address
    { wch: 20 }, // Entitlement Type
    { wch: 16 }, // Branch ID
    { wch: 24 }, // Branch Name
    { wch: 20 }, // Product Codes
    { wch: 45 }, // Product Modules
    { wch: 55 }, // Product Submodules
    { wch: 18 }, // Entitlement Action
    { wch: 18 }, // Entitlement Status
    { wch: 14 }, // Is Active
  ];
  wsUpdate['!autofilter'] = { ref: `A1:W${updateCustomerSamples.length + 1}` };
  wsUpdate['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  XLSX.utils.book_append_sheet(wb, wsUpdate, 'UPDATE CUSTOMERS');

  // =========================================================================
  // 3. SHEET 3: INSTRUCTIONS (Creation & Update Workflows)
  // =========================================================================
  const instructionsData = [
    ['KANVTECH CUSTOMER MASTER & ENTITLEMENTS SPREADSHEET GUIDE', '', '', ''],
    ['Workbook Version: 3.0 | Compatible with Customer Creation and Mass Update workflows', '', '', ''],
    ['', '', '', ''],
    ['SECTION 1: WORKSHEET SELECTION', '', '', ''],
    ['Worksheet Name', 'Purpose', 'Record Identifier', 'Usage Notes'],
    [
      'CUSTOMERS',
      'Create New Customers',
      'Auto-generated by system',
      'Use this sheet to onboard brand new customer companies with initial product entitlements.',
    ],
    [
      'UPDATE CUSTOMERS',
      'Update Existing Customers & Entitlements',
      'Customer ID (Required)',
      'Use this sheet to modify existing customer profile fields, addresses, contacts, and product/module entitlements.',
    ],
    ['', '', '', ''],
    ['SECTION 2: UPDATE CUSTOMERS COLUMN SPECIFICATIONS', '', '', ''],
    ['Column Name', 'Required', 'Allowed Values / Format', 'Description & Rules'],
    [
      'Customer ID',
      'YES (MANDATORY)',
      'e.g. CMP-0001, CMP-0002',
      'Unique existing customer identifier. Never changed. Unmatched IDs are rejected.',
    ],
    [
      'Company Name',
      'OPTIONAL',
      'e.g. Apex Cloud Solutions Pvt Ltd',
      'Legal company name. Leave blank to preserve existing value.',
    ],
    [
      'Address',
      'OPTIONAL',
      'Full postal/registered office address',
      'Leave blank to preserve existing address.',
    ],
    [
      'GSTN',
      'OPTIONAL',
      '15-character alphanumeric (e.g. 27AAACA9988G1Z1)',
      'GST identification number. Validated if provided.',
    ],
    [
      'Primary Email',
      'OPTIONAL',
      'Valid corporate email format',
      'Primary customer login/contact email.',
    ],
    [
      'Alternate Emails',
      'OPTIONAL',
      'Comma-separated emails (e.g. ops@acme.com, accounts@acme.com)',
      'Secondary notification and billing contacts.',
    ],
    [
      'Contact Person',
      'OPTIONAL',
      'Full contact person name',
      'Primary administrative contact person.',
    ],
    [
      'Contact Phone',
      'OPTIONAL',
      'Phone / mobile number with optional +91',
      'Direct telephone number.',
    ],
    [
      'Contact Location',
      'OPTIONAL',
      'e.g. Headquarters - Mumbai, Floor 3',
      'Physical office or desk location of primary contact.',
    ],
    [
      'Contact Status',
      'OPTIONAL',
      'ACTIVE, VERIFIED, PENDING, INACTIVE',
      'Contact verification status.',
    ],
    [
      'Alternate Contact',
      'OPTIONAL',
      'Secondary contact person name',
      'Backup administrative contact.',
    ],
    [
      'Alternate Contact Phone',
      'OPTIONAL',
      'Secondary phone number',
      'Backup contact telephone number.',
    ],
    [
      'Alternate Contact Email',
      'OPTIONAL',
      'Secondary email address',
      'Backup contact email address.',
    ],
    [
      'Alternate Contact Location / Address',
      'OPTIONAL',
      'Branch or facility location',
      'Location of alternate contact.',
    ],
    [
      'Entitlement Type',
      'OPTIONAL',
      'SELECTED_MODULES, COMPLETE',
      'COMPLETE grants all modules & submodules. SELECTED_MODULES restricts to specified modules.',
    ],
    [
      'Branch ID',
      'OPTIONAL',
      'e.g. BR-0001, BR-0002, or blank for Company-level',
      'Leave blank to update Company-level (Head Office) entitlements. Specify Branch ID for branch assignments.',
    ],
    [
      'Branch Name',
      'OPTIONAL',
      'Descriptive branch name',
      'Reference label for branch.',
    ],
    [
      'Product Codes',
      'OPTIONAL',
      'Comma-separated codes (e.g. TALLY, SPINE, BIOS360)',
      'Product codes registered in Product Master.',
    ],
    [
      'Product Modules',
      'OPTIONAL',
      'PRODUCT:Mod1|Mod2;PRODUCT2:ModA',
      'Format: PRODUCT_CODE:Module1|Module2;PRODUCT_CODE2:ModuleA',
    ],
    [
      'Product Submodules',
      'OPTIONAL',
      'PRODUCT:Mod=Sub1|Sub2;PRODUCT2:ModA=SubX',
      'Format: PRODUCT_CODE:Module=Sub1|Sub2',
    ],
    [
      'Entitlement Action',
      'OPTIONAL',
      'ADD, UPDATE, REMOVE, REPLACE, ENABLE, DISABLE',
      'Default: UPDATE. ADD creates new assignment; REMOVE de-allocates; REPLACE overwrites scope; ENABLE/DISABLE toggles status.',
    ],
    [
      'Entitlement Status',
      'OPTIONAL',
      'ACTIVE, INACTIVE',
      'Status of the entitlement assignment.',
    ],
    [
      'Is Active',
      'OPTIONAL',
      'true, false',
      'Customer master company status.',
    ],
    ['', '', '', ''],
    ['SECTION 3: SYNTAX RULES & BEST PRACTICES', '', '', ''],
    [
      'Blank Field Preservation',
      'Non-destructive',
      'Blank cells in UPDATE CUSTOMERS preserve existing values unless "Clear Values" mode is explicitly selected.',
      'Prevents accidental erasure of valuable company profile data.',
    ],
    [
      'Tenant Isolation',
      'Strict Enforced',
      'Every operation is automatically scoped to your authenticated tenant workspace.',
      'Records belonging to other tenants cannot be accessed or modified.',
    ],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 45 },
    { wch: 65 },
  ];
  wsInstructions['!views'] = [{ state: 'frozen', ySplit: 4, xSplit: 0 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCTIONS');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

