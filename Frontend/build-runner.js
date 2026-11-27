const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = __dirname;
const buildDir = path.join(frontendDir, 'build');
const stagingDir = path.join(frontendDir, 'build_staging');
const updateHtmlSrc = path.join(frontendDir, 'public', 'update.html');
const htaccessSrc = path.join(frontendDir, 'public', '.htaccess');

console.log('\n========================================================');
console.log('🚀 Bhoomi HRMS - Zero-Downtime Safe Build Process');
console.log('========================================================\n');

// 1. Ensure live build directory exists and displays update message during build
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy update.html and .htaccess to live build folder immediately
if (fs.existsSync(updateHtmlSrc)) {
  fs.copyFileSync(updateHtmlSrc, path.join(buildDir, 'update.html'));
  fs.copyFileSync(updateHtmlSrc, path.join(buildDir, 'index.html'));
  console.log('📌 Deployed maintenance screen to build/index.html');
}

if (fs.existsSync(htaccessSrc)) {
  fs.copyFileSync(htaccessSrc, path.join(buildDir, '.htaccess'));
  console.log('🔒 Applied Options -Indexes protection (.htaccess)');
}

// 2. Set environment to build into staging directory so live build/ is never wiped
const env = {
  ...process.env,
  BUILD_PATH: 'build_staging'
};

console.log('⏳ Compiling React application bundles into staging...\n');

// Run react-scripts build
const isWin = process.platform === 'win32';
const buildCmd = isWin ? 'npx.cmd' : 'npx';
const child = spawn(buildCmd, ['react-scripts', 'build'], {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Build failed with exit code ${code}. Live site left intact.`);
    process.exit(code);
  }

  console.log('\n📦 Compilation successful. Deploying bundles atomically to build/ ...');

  try {
    // If build_staging was created, sync files to build
    if (fs.existsSync(stagingDir)) {
      copyDirRecursive(stagingDir, buildDir);
      // Clean up staging
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }

    // Ensure .htaccess is always in build directory
    if (fs.existsSync(htaccessSrc)) {
      fs.copyFileSync(htaccessSrc, path.join(buildDir, '.htaccess'));
    }

    // Ensure update.html is also available as fallback
    if (fs.existsSync(updateHtmlSrc)) {
      fs.copyFileSync(updateHtmlSrc, path.join(buildDir, 'update.html'));
    }

    console.log('\n========================================================');
    console.log('✅ Bhoomi HRMS Build Complete and Live!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('Error during atomic deploy:', err);
    process.exit(1);
  }
});

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
