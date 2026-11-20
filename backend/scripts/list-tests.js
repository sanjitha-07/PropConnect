import fs from 'fs';

const content = fs.readFileSync('backend/test-e2e-all-workflows.js', 'utf8');
const lines = content.split('\n');

const list = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('record(') && !lines[i].includes('function record')) {
    const c = lines[i+1]?.trim().replace(/^["']|["'],?$/g, '');
    const n = lines[i+2]?.trim().replace(/^["']|["'],?$/g, '');
    list.push({ cat: c, name: n, line: i + 1 });
  }
}

console.log(`Extracted ${list.length} test cases from test-e2e-all-workflows.js:\n`);
let currentCat = '';
let catCount = 0;
list.forEach((t, idx) => {
  if (t.cat !== currentCat) {
    currentCat = t.cat;
    catCount++;
    console.log(`\n=== Category ${catCount}: ${currentCat} ===`);
  }
  console.log(`  ${idx + 1}. ${t.name} (line ${t.line})`);
});
