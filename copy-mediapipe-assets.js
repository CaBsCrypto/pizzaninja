import fs from 'fs';
import path from 'path';

const srcDirHands = path.resolve('node_modules/@mediapipe/hands');
const srcDirCamera = path.resolve('node_modules/@mediapipe/camera_utils');
const destDir = path.resolve('public/mediapipe');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy files
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory not found: ${src}`);
    return;
  }
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    const stat = fs.statSync(srcFile);
    if (stat.isFile()) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied: ${file}`);
      
      // Force disable SIMD check inside hands.js for mobile Safari WebAssembly stability
      if (file === 'hands.js') {
        try {
          let content = fs.readFileSync(destFile, 'utf8');
          let modified = false;
          
          const searchEd = 'function ed(){return E(function(a){switch(a.h){case 1:return a.s=2,D(a,WebAssembly.instantiate(ad),4);case 4:a.h=3;a.s=0;break;case 2:return a.s=0,a.l=null,a.return(!1);case 3:return a.return(!0)}})}';
          if (content.includes(searchEd)) {
            content = content.replace(
              searchEd,
              'function ed(){return E(function(a){return a.return(!1)})}'
            );
            modified = true;
            console.log(`Patched ${file} to force WebAssembly SIMD detection to false for Safari/mobile compatibility.`);
          }
          
          if (modified) {
            fs.writeFileSync(destFile, content, 'utf8');
          }
        } catch (patchErr) {
          console.error(`Failed to patch ${file}:`, patchErr);
        }
      }

      // Post-copy patch step for safety against MediaPipe's known dataFileDownloads loader bug
      if (file === 'hands_solution_packed_assets_loader.js') {
        try {
          let content = fs.readFileSync(destFile, 'utf8');
          let modified = false;
          
          if (content.includes('if (!xhr.addedTotal) {')) {
            content = content.replace(
              'if (!xhr.addedTotal) {',
              'if (!xhr.addedTotal || !Module.dataFileDownloads || !Module.dataFileDownloads[url]) {'
            );
            modified = true;
            console.log(`Patched ${file} with safety guards against undefined dataFileDownloads.`);
          }
          
          // Browser environment Node detection bypass - force false to prevent reading undefined buffers in browser/worker
          const nodeDetectionStr = "if (typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string')";
          if (content.includes(nodeDetectionStr)) {
            content = content.replace(
              nodeDetectionStr,
              "if (false /* forced false to avoid browser process object confusion */)"
            );
            modified = true;
            console.log(`Patched ${file} with absolute safety guard forcing browser/worker loading.`);
          }

          if (content.includes("Module['FS_createPath']")) {
            content = content.replaceAll(
              "Module['FS_createPath']",
              "(Module['FS_createPath']||window.FS_createPath)"
            );
            modified = true;
            console.log(`Patched ${file} FS_createPath to look up global window fallback.`);
          }

          if (content.includes("Module['FS_createPreloadedFile']")) {
            content = content.replaceAll(
              "Module['FS_createPreloadedFile']",
              "(Module['FS_createPreloadedFile']||window.FS_createPreloadedFile)"
            );
            modified = true;
            console.log(`Patched ${file} FS_createPreloadedFile to look up global window fallback.`);
          }
          
          if (modified) {
            fs.writeFileSync(destFile, content, 'utf8');
          }
        } catch (patchErr) {
          console.error(`Failed to patch ${file}:`, patchErr);
        }
      }

      // Emscripten environment resolution patch
      if (file.startsWith('hands_solution_') && file.endsWith('_bin.js')) {
        try {
          let content = fs.readFileSync(destFile, 'utf8');
          let modified = false;

          const searchNode = 'ENVIRONMENT_IS_NODE=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"';
          if (content.includes(searchNode)) {
            content = content.replace(
              searchNode,
              'ENVIRONMENT_IS_NODE=false /* forced false in browser/worker context */'
            );
            modified = true;
            console.log(`Patched ${file} to force ENVIRONMENT_IS_NODE=false.`);
          }

          // Safe-guard stream.node.contents from being undefined to prevent TypeError: Cannot read properties of undefined (reading 'buffer')
          const searchContents = 'var contents=stream.node.contents;';
          if (content.includes(searchContents)) {
            content = content.replaceAll(
              searchContents,
              'var contents=stream.node.contents||new Uint8Array(0);'
            );
            modified = true;
            console.log(`Patched ${file} to secure stream.node.contents assignments against undefined.`);
          }

          // Safe-guard buffer.buffer === HEAP8.buffer which throws when HEAP8 is undefined during pre-run virtual filesystem operations
          const searchHeapBuffer = 'buffer.buffer===HEAP8.buffer';
          if (content.includes(searchHeapBuffer)) {
            content = content.replaceAll(
              searchHeapBuffer,
              'buffer.buffer===(typeof HEAP8 !== "undefined" && HEAP8 ? HEAP8.buffer : null)'
            );
            modified = true;
            console.log(`Patched ${file} to guard buffer.buffer === HEAP8.buffer against undefined HEAP8.`);
          }

          // Expose FS functions globally for the packed assets loader to access
          const searchFS = 'Module["FS_createPreloadedFile"]=FS.createPreloadedFile;';
          if (content.includes(searchFS)) {
            content = content.replaceAll(
              searchFS,
              'Module["FS_createPreloadedFile"]=FS.createPreloadedFile;window.FS_createPreloadedFile=FS.createPreloadedFile;window.FS_createPath=FS.createPath;'
            );
            modified = true;
            console.log(`Patched ${file} to export FS_createPreloadedFile and FS_createPath globally on window.`);
          }

          if (modified) {
            fs.writeFileSync(destFile, content, 'utf8');
          }
        } catch (patchErr) {
          console.error(`Failed to patch ${file}:`, patchErr);
        }
      }
    }
  }
}

console.log("Copying MediaPipe Hands assets...");
copyDir(srcDirHands, destDir);

console.log("Copying MediaPipe Camera Utils assets...");
copyDir(srcDirCamera, destDir);

console.log("MediaPipe assets copies completed successfully.");
