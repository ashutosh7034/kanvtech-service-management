const { spawn } = require('child_process');
const path = require('path');

const emu = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'emulator', 'emulator.exe');
console.log('Spawning emulator:', emu);

const p = spawn(emu, ['-avd', 'Pixel_8a', '-no-boot-anim'], {
  stdio: 'inherit'
});

p.on('error', (err) => {
  console.error('Emulator process error:', err);
});

p.on('exit', (code, signal) => {
  console.log(`Emulator exited with code ${code}, signal ${signal}`);
});
