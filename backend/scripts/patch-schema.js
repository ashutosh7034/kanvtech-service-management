const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// List of models and where to add tenant fields
const modelsToUpdate = [
  'Company',
  'Department',
  'Employee',
  'Ticket',
  'Product',
  'Subscription',
  'Implementation',
  'SlaConfiguration',
  'AuditLog',
  'Notification',
  'EmployeeTask',
  'ChatConversation',
  'Prospect',
  'SystemSetting',
  'InboundEmailLog'
];

for (const modelName of modelsToUpdate) {
  const modelRegex = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = schema.match(modelRegex);
  if (!match) {
    console.error(`Could not find model ${modelName}`);
    continue;
  }
  let body = match[1];
  if (!body.includes('tenantId')) {
    // Add tenantId field and relation before @@map or end
    const tenantField = `\n  tenantId                String   @default("KANVTECH") @map("tenant_id") @db.VarChar(50)\n  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)\n`;
    
    // Add index if not exists
    let indexStr = '';
    if (!body.includes(`idx_${modelName.toLowerCase()}_tenant`)) {
      indexStr = `  @@index([tenantId], name: "idx_${modelName.toLowerCase()}_tenant")\n`;
    }

    if (body.includes('@@map(')) {
      body = body.replace(/(\n\s*@@map\()/, `${tenantField}\n${indexStr}$1`);
    } else {
      body = body + tenantField + indexStr;
    }

    schema = schema.replace(modelRegex, `model ${modelName} {${body}\n}`);
    console.log(`Updated model ${modelName} with tenant relation`);
  }
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema patched successfully.');
