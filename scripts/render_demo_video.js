const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const screenshotDir = path.resolve('C:/Users/Ashutosh Pandey/.gemini/antigravity-ide/brain/2757c0b7-ffa6-4933-a2bc-e4249bd6a9d5/.system_generated/click_feedback');
const outputDir = path.resolve(__dirname, '../demo');
const outputMp4 = path.join(outputDir, 'KANVTECH_COMPLETE_PROTOTYPE_DEMO.mp4');

// Get all screenshot files created during the run (timestamp >= 1789971144000)
const files = fs.readdirSync(screenshotDir)
  .filter(f => f.startsWith('click_feedback_') && f.endsWith('.png'))
  .map(f => {
    const match = f.match(/click_feedback_(\d+)\.png/);
    const ts = match ? parseInt(match[1], 10) : 0;
    return { name: f, path: path.join(screenshotDir, f), ts };
  })
  .filter(f => f.ts >= 1789971180000)
  .sort((a, b) => a.ts - b.ts);

console.log(`Found ${files.length} chronological demo screenshot frames.`);

if (files.length === 0) {
  console.error('No screenshot frames found!');
  process.exit(1);
}

// Target duration is ~11.5 minutes (690 seconds)
// Distribute display time per slide (e.g. ~9.5s per frame, last frame 12s)
const durationPerFrame = 9.5;
const concatListPath = path.join(outputDir, 'concat_list.txt');
let concatContent = '';

files.forEach((f, idx) => {
  // Use forward slashes for ffmpeg path compatibility
  const escapedPath = f.path.replace(/\\/g, '/');
  concatContent += `file '${escapedPath}'\n`;
  const dur = idx === files.length - 1 ? 14.0 : durationPerFrame;
  concatContent += `duration ${dur}\n`;
});
// Repeat last file entry as per ffmpeg concat demuxer requirement
const lastPath = files[files.length - 1].path.replace(/\\/g, '/');
concatContent += `file '${lastPath}'\n`;

fs.writeFileSync(concatListPath, concatContent);
console.log(`Wrote concat list to ${concatListPath}`);

const totalSeconds = (files.length - 1) * durationPerFrame + 14.0;
const totalMinutes = (totalSeconds / 60).toFixed(2);
console.log(`Rendering ~${totalMinutes} minute 1920x1080 30FPS MP4 to ${outputMp4}...`);

// FFmpeg command to scale with aspect ratio, pad to 1920x1080, 30fps, libx264, yuv420p
const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath.replace(/\\/g, '/')}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,format=yuv420p" -r 30 -c:v libx264 -preset medium -crf 20 -movflags +faststart "${outputMp4.replace(/\\/g, '/')}"`;

console.log('Executing ffmpeg...');
execSync(ffmpegCmd, { stdio: 'inherit' });

console.log(`\nVideo rendering completed successfully: ${outputMp4}`);
