const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'docs/ui-evidence/mobile_screen.png';
const adb = 'C:\\Android\\Sdk\\platform-tools\\adb.exe';

try {
  execSync(`"${adb}" -s emulator-5554 shell screencap -p /sdcard/screen.png`, { timeout: 10000 });
  execSync(`"${adb}" -s emulator-5554 pull /sdcard/screen.png "${target}"`, { timeout: 10000 });
  const stat = fs.statSync(target);
  console.log(`Saved screenshot to ${target} (${stat.size} bytes)`);
} catch (e) {
  console.error('Failed to capture mobile screenshot:', e.message);
  process.exit(1);
}
