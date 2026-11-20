import fs from 'fs';

const content = fs.readFileSync('backend/server.js', 'utf8');
const lines = content.split('\n');

const routes = [];
lines.forEach((line, idx) => {
  const m = line.match(/app\.(get|post|put|delete|patch)\((['"][^'"]+['"])/);
  if (m) {
    routes.push({ line: idx + 1, method: m[1].toUpperCase(), path: m[2].replace(/['"]/g, '') });
  }
});

console.log(`Found ${routes.length} API routes in server.js:`);
routes.filter(r => r.path.startsWith('/api/')).forEach(r => {
  console.log(`${r.method.padEnd(6)} ${r.path} (line ${r.line})`);
});
