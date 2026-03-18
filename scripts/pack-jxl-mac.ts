import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = path.join(process.cwd(), 'bin/jxl-mac-arm64');
const LIBS_DIR = path.join(TARGET_DIR, 'libs');
const TEMP_DIR = path.join(process.cwd(), 'scripts/tmp_bottle_extract');

const PACKAGES = [
  'jpeg-xl', 'brotli', 'highway', 'imath', 'jpeg-turbo', 'libpng', 'little-cms2', 'openexr', 'giflib'
];

function run(cmd: string) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8' });
}

async function start() {
  if (fs.existsSync(TARGET_DIR)) fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(LIBS_DIR, { recursive: true });
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  console.log('Fetching bottles...');
  for (const pkg of PACKAGES) {
    console.log(`Fetching ${pkg} for arm64_sonoma...`);
    // Force fetch the bottle
    run(`brew fetch --force --bottle-tag=arm64_sonoma ${pkg}`);
    
    // Find the cached file
    const cachePath = run(`brew --cache --bottle-tag=arm64_sonoma ${pkg}`).trim();
    if (!fs.existsSync(cachePath)) {
      throw new Error(`Failed to locate cache for ${pkg} at ${cachePath}`);
    }

    // Extract
    console.log(`Extracting ${cachePath}...`);
    run(`tar -xzf "${cachePath}" -C "${TEMP_DIR}"`);
  }

  // Copy cjxl and djxl
  console.log('Copying binaries and libraries...');
  const jpegXlDir = fs.readdirSync(path.join(TEMP_DIR, 'jpeg-xl'))[0];
  fs.copyFileSync(path.join(TEMP_DIR, 'jpeg-xl', jpegXlDir, 'bin/cjxl'), path.join(TARGET_DIR, 'cjxl'));
  fs.copyFileSync(path.join(TEMP_DIR, 'jpeg-xl', jpegXlDir, 'bin/djxl'), path.join(TARGET_DIR, 'djxl'));
  run(`chmod +x "${path.join(TARGET_DIR, 'cjxl')}" "${path.join(TARGET_DIR, 'djxl')}"`);

  // Recursively copy all dylibs from all extracted packages
  const packagesExtracted = fs.readdirSync(TEMP_DIR);
  for (const pkg of packagesExtracted) {
    const verDir = fs.readdirSync(path.join(TEMP_DIR, pkg))[0];
    const libDir = path.join(TEMP_DIR, pkg, verDir, 'lib');
    if (fs.existsSync(libDir)) {
      const files = fs.readdirSync(libDir);
      for (const f of files) {
        if (f.endsWith('.dylib') && !fs.lstatSync(path.join(libDir, f)).isSymbolicLink()) {
          fs.copyFileSync(path.join(libDir, f), path.join(LIBS_DIR, f));
        }
      }
    }
  }

  console.log('Patching libraries...');
  
  // Gets dependencies that contain /opt/homebrew or /usr/local
  function patchBinary(binaryPath: string) {
    run(`chmod u+w "${binaryPath}"`);
    const otoolOut = run(`otool -L "${binaryPath}"`);
    const lines = otoolOut.split('\n').filter(l => l.includes('/opt/homebrew') || l.includes('@@HOMEBREW_PREFIX@@'));

    for (const line of lines) {
      const match = line.match(/\s+([^\s]+)\s+\(/);
      if (match) {
        const oldPath = match[1];
        const libName = path.basename(oldPath);
        
        // Change the ID of the dylib if it points to itself
        if (binaryPath.endsWith(libName)) {
            run(`install_name_tool -id "@executable_path/libs/${libName}" "${binaryPath}"`);
        } else {
            run(`install_name_tool -change "${oldPath}" "@executable_path/libs/${libName}" "${binaryPath}"`);
        }
      }
    }
  }

  patchBinary(path.join(TARGET_DIR, 'cjxl'));
  patchBinary(path.join(TARGET_DIR, 'djxl'));

  const dylibs = fs.readdirSync(LIBS_DIR);
  for (const dylib of dylibs) {
    patchBinary(path.join(LIBS_DIR, dylib));
  }

  console.log('Done! Native arm64 binaries packaged successfully.');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

start().catch(console.error);
