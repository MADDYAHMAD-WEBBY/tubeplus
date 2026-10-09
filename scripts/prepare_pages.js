const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const deployDir = path.join(rootDir, 'public_deploy');

// Clean or create public_deploy
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

// Copy index.html
const indexHtml = path.join(rootDir, '.next', 'server', 'app', 'index.html');
if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, path.join(deployDir, 'index.html'));
}

// Copy 404.html
const notFoundHtml = path.join(rootDir, '.next', 'server', 'app', '_not-found.html');
if (fs.existsSync(notFoundHtml)) {
  fs.copyFileSync(notFoundHtml, path.join(deployDir, '404.html'));
}

// Copy icon.svg
const iconPath = path.join(rootDir, 'app', 'icon.svg');
if (fs.existsSync(iconPath)) {
  fs.copyFileSync(iconPath, path.join(deployDir, 'icon.svg'));
}

// Copy .next/static -> public_deploy/_next/static
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const staticDir = path.join(rootDir, '.next', 'static');
if (fs.existsSync(staticDir)) {
  copyDirSync(staticDir, path.join(deployDir, '_next', 'static'));
}

console.log('Public deploy directory prepared successfully!');
