const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodePtyDir = path.join(__dirname, '..', 'node_modules', 'node-pty');

// Patch 1: winpty.gyp - fix Windows batch file execution
// Windows requires ".\" prefix to run .bat files from current directory
const winptyGypPath = path.join(nodePtyDir, 'deps', 'winpty', 'src', 'winpty.gyp');
if (fs.existsSync(winptyGypPath)) {
  let content = fs.readFileSync(winptyGypPath, 'utf8');
  const original = content;
  content = content.replace(/&& GetCommitHash\.bat/g, '&& .\\\\GetCommitHash.bat');
  content = content.replace(/&& UpdateGenVersion\.bat/g, '&& .\\\\UpdateGenVersion.bat');
  if (content !== original) {
    fs.writeFileSync(winptyGypPath, content, 'utf8');
    console.log('Patched winpty.gyp: fixed batch file paths');
  }
}

// Patch 2: Remove Spectre mitigation from all gyp files (requires extra VS libraries)
const gypFiles = [
  path.join(nodePtyDir, 'binding.gyp'),
  path.join(nodePtyDir, 'deps', 'winpty', 'src', 'winpty.gyp'),
];
for (const gypFile of gypFiles) {
  if (fs.existsSync(gypFile)) {
    let content = fs.readFileSync(gypFile, 'utf8');
    const original = content;
    content = content.replace(
      /\s*'msvs_configuration_attributes':\s*\{[^}]*\},?\n?/g,
      ''
    );
    if (content !== original) {
      fs.writeFileSync(gypFile, content, 'utf8');
      console.log(`Patched ${path.basename(gypFile)}: removed Spectre mitigation`);
    }
  }
}

// Run electron-rebuild
execSync('electron-rebuild -f -w node-pty', { stdio: 'inherit' });
