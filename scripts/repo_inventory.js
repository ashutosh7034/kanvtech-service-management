const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get git tracked files set
let gitTracked = new Set();
try {
  const stdout = execSync('git ls-files', { cwd: ROOT_DIR, maxBuffer: 10 * 1024 * 1024 }).toString();
  stdout.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) gitTracked.add(path.normalize(trimmed).replace(/\\/g, '/'));
  });
} catch (e) {
  console.error('Error fetching git tracked files:', e.message);
}

const allFiles = [];
const dirSizes = {};

function scanDir(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return 0;
  }

  let totalSize = 0;
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    // Skip scanning .git contents to keep it fast, but measure its size
    if (entry.isDirectory() && entry.name === '.git') {
      const gitSize = getQuickDirSize(fullPath);
      dirSizes['.git'] = (dirSizes['.git'] || 0) + gitSize;
      totalSize += gitSize;
      continue;
    }

    if (entry.isDirectory()) {
      const subSize = scanDir(fullPath);
      totalSize += subSize;
      const topDir = relPath.split('/')[0];
      dirSizes[topDir] = (dirSizes[topDir] || 0) + subSize;
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
        allFiles.push({
          relPath,
          fullPath,
          size: stat.size,
          mtime: stat.mtime,
          isTracked: gitTracked.has(relPath),
        });
      } catch (err) {}
    }
  }
  return totalSize;
}

function getQuickDirSize(dir) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getQuickDirSize(full);
      } else if (entry.isFile()) {
        try {
          size += fs.statSync(full).size;
        } catch {}
      }
    }
  } catch {}
  return size;
}

console.log('Scanning repository starting from:', ROOT_DIR);
const totalRepoSize = scanDir(ROOT_DIR);

// Sort files by size descending
allFiles.sort((a, b) => b.size - a.size);

// Top 50 largest files
const top50 = allFiles.slice(0, 50);

// Classify directories & files
const topDirectories = {};
for (const f of allFiles) {
  const parts = f.relPath.split('/');
  const prefix = parts.length > 1 ? parts[0] + '/' + parts[1] : parts[0];
  topDirectories[prefix] = (topDirectories[prefix] || 0) + f.size;
}

const sortedTopDirs = Object.entries(topDirectories)
  .sort((a, b) => b[1] - a[1])
  .map(([dir, size]) => ({ dir, size: formatBytes(size), rawSize: size }));

// Identify cleanup candidates
const candidates = [];

for (const f of allFiles) {
  const p = f.relPath;

  // 1. Mobile build artifacts (app-release.apk, intermediates, flutter build)
  if (p.startsWith('mobile/build/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: p.endsWith('app-release.apk') ? 'REVIEW_REQUIRED' : 'SAFE_CANDIDATE',
      reason: p.endsWith('app-release.apk') ? 'Verified release APK artifact (keep until new build or archive)' : 'Flutter Gradle/C++ build cache and intermediate compiled objects (reproducible via flutter build)',
      reproducible: true,
      action: p.endsWith('app-release.apk') ? 'KEEP (Documented delivery artifact)' : 'CLEANUP_CANDIDATE',
    });
  }
  // 2. Mobile .dart_tool cache
  else if (p.startsWith('mobile/.dart_tool/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'SAFE_CANDIDATE',
      reason: 'Flutter pub package cache & analyzer build tool index (reproducible via flutter pub get)',
      reproducible: true,
      action: 'RETAIN_OR_CLEAN',
    });
  }
  // 3. Web .next build outputs
  else if (p.startsWith('web/.next/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'SAFE_CANDIDATE',
      reason: 'Next.js build cache and compiled server/client bundles (reproducible via npm run build in web/)',
      reproducible: true,
      action: 'RETAIN_OR_REBUILD',
    });
  }
  // 4. Backend dist build outputs
  else if (p.startsWith('backend/dist/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'REVIEW_REQUIRED',
      reason: 'Compiled NestJS JavaScript bundle (currently executed by start-backend.js, reproducible via npm run build)',
      reproducible: true,
      action: 'KEEP (Active running daemon dependency)',
    });
  }
  // 5. Backend .pgdata (Isolated PostgreSQL port 5433 cluster)
  else if (p.startsWith('backend/.pgdata/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'KEEP',
      reason: 'Staging PostgreSQL database cluster files for port 5433 (Required for isolated UAT testing)',
      reproducible: false,
      action: 'KEEP',
    });
  }
  // 6. Backend backups
  else if (p.startsWith('backend/backups/')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'REVIEW_REQUIRED',
      reason: 'Local database snapshot / backup',
      reproducible: false,
      action: 'REVIEW',
    });
  }
  // 7. Temporary test scripts in scripts/
  else if (p.startsWith('scripts/test_') || p.startsWith('scripts/check_') || p.startsWith('scripts/db_')) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'REVIEW_REQUIRED',
      reason: 'Ad-hoc inspection / fix script created during development',
      reproducible: true,
      action: 'CONSOLIDATE_OR_ARCHIVE',
    });
  }
  // 8. Root historical markdown reports
  else if (partsRootReport(p)) {
    candidates.push({
      path: p,
      size: f.size,
      formattedSize: formatBytes(f.size),
      isTracked: f.isTracked,
      classification: 'REVIEW_REQUIRED',
      reason: 'Historical phase QA / readiness markdown report located in root directory',
      reproducible: false,
      action: 'KEEP (Safety rule: Never delete documentation required to operate or track history)',
    });
  }
}

function partsRootReport(p) {
  if (p.includes('/')) return false;
  return p.endsWith('_REPORT.md') || p.endsWith('_QA.md') || p.endsWith('_TRACEABILITY.md');
}

const summaryOutput = {
  totalRepoSize: formatBytes(totalRepoSize),
  totalFiles: allFiles.length,
  gitTrackedFiles: gitTracked.size,
  topDirectories: sortedTopDirs.slice(0, 20),
  top50LargestFiles: top50.map(f => ({
    path: f.relPath,
    size: formatBytes(f.size),
    rawBytes: f.size,
    isTracked: f.isTracked,
  })),
  candidateCount: candidates.length,
  candidateTotalBytes: candidates.reduce((acc, c) => acc + c.size, 0),
  candidateTotalFormatted: formatBytes(candidates.reduce((acc, c) => acc + c.size, 0)),
};

console.log(JSON.stringify(summaryOutput, null, 2));

// Save inventory raw data for Phase A deliverable
const outputPath = path.join(ROOT_DIR, 'docs', 'inventory_scan_raw.json');
if (!fs.existsSync(path.join(ROOT_DIR, 'docs'))) {
  fs.mkdirSync(path.join(ROOT_DIR, 'docs'), { recursive: true });
}
fs.writeFileSync(outputPath, JSON.stringify({ summaryOutput, candidates }, null, 2));
console.log('Saved raw inventory to:', outputPath);
