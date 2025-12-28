const fs = require('fs');
const path = 'node_modules/@expo/cli/build/src/start/server/metro/externals.js';

try {
  if (!fs.existsSync(path)) {
    console.log('File not found, skipping patch');
    process.exit(0);
  }

  let content = fs.readFileSync(path, 'utf8');
  
  if (content.includes('PATCHED_SEA')) {
    console.log('Already patched.');
    process.exit(0);
  }

  // Find the NODE_STDLIB_MODULES array and filter out entries with colons
  content = content.replace(
    /const NODE_STDLIB_MODULES\s*=\s*\[([^\]]+)\]/g,
    (match, arrayContent) => {
      // Filter out any module containing a colon
      const filtered = arrayContent
        .split(',')
        .filter(item => !item.includes(':'))
        .join(',');
      return `const NODE_STDLIB_MODULES/*PATCHED_SEA*/ = [${filtered}]`;
    }
  );

  // Alternative: Also replace 'node:sea' literal if present
  content = content.replace(/'node:sea'/g, "'node_sea_skip'");
  content = content.replace(/"node:sea"/g, '"node_sea_skip"');

  fs.writeFileSync(path, content);
  console.log('Patched successfully!');
} catch (e) {
  console.error('Patch error:', e.message);
  process.exit(0); // Don't fail the build
}
