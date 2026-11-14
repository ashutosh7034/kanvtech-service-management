const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
const backupDir = path.resolve(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const backupPath = path.join(backupDir, 'kanvtech_sm_dev_custom_user_id_predeploy_backup.dump');

console.log('Creating full PostgreSQL custom format backup...');
execSync(`"${pgDumpPath}" -h localhost -p 5432 -U postgres -d kanvtech_sm_dev -F c -b -v -f "${backupPath}"`, {
  env: { ...process.env, PGPASSWORD: 'root' },
  stdio: 'inherit',
});

const stat = fs.statSync(backupPath);
console.log(`\n✓ Backup created successfully at: ${backupPath}`);
console.log(`✓ Backup size: ${Math.round(stat.size / 1024)} KB (${stat.size} bytes)`);

