const fs = require('fs');
const path = require('path');

console.log('Node version:', process.version);
try {
  const ws = require('ws');
  console.log('ws is available');
} catch (e) {
  console.log('ws is NOT available in root');
}

// Check if puppeteer or playwright exists anywhere in node_modules
['.', 'web', 'backend'].forEach(dir => {
  const nm = path.join(dir, 'node_modules');
  if (fs.existsSync(nm)) {
    ['puppeteer', 'playwright', 'ws'].forEach(pkg => {
      if (fs.existsSync(path.join(nm, pkg))) {
        console.log(`Found ${pkg} in ${dir}/node_modules`);
      }
    });
  }
});
