const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');

function run(cmd) {
  return execSync(`"${adb}" ${cmd}`, { encoding: 'utf8' });
}

function screencap(destRelative) {
  const dest = path.join(__dirname, '..', destRelative);
  const buf = execSync(`"${adb}" exec-out screencap -p`);
  fs.writeFileSync(dest, buf);
  console.log(`Saved screenshot to ${destRelative}`);
}

function tap(x, y) {
  console.log(`Tapping at (${x}, ${y})`);
  run(`shell input tap ${x} ${y}`);
}

function back() {
  console.log('Sending BACK key');
  run('shell input keyevent 4');
}

function sleep(ms) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds ${ms}"`);
}

module.exports = { run, screencap, tap, back, sleep };

if (require.main === module) {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'tap') {
    tap(args[0], args[1]);
  } else if (action === 'back') {
    back();
  } else if (action === 'screencap') {
    screencap(args[0]);
  } else {
    screencap('mobile_current.png');
  }
}
