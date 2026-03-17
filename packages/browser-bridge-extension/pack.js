/**
 * 将 browser-bridge-extension 打包为 zip
 * 用法: node pack.js
 * 输出: browser-bridge-extension.zip (在项目根目录 dist/ 下)
 */
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');

const extDir = __dirname;
const outDir = path.resolve(extDir, '..', '..', 'dist');
const outFile = path.join(outDir, 'browser-bridge-extension.zip');

// 要打包的文件
const includeFiles = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

async function pack() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 如果没有 archiver，用内置 zip 方式
  try {
    require.resolve('archiver');
  } catch {
    // 无 archiver 时使用简单的 tar/zip 方式
    console.log('archiver 未安装，使用简单复制方式...');
    const simpleOutDir = path.join(outDir, 'browser-bridge-extension');
    if (fs.existsSync(simpleOutDir)) {
      fs.rmSync(simpleOutDir, { recursive: true });
    }
    fs.mkdirSync(simpleOutDir, { recursive: true });
    fs.mkdirSync(path.join(simpleOutDir, 'icons'), { recursive: true });
    for (const file of includeFiles) {
      const src = path.join(extDir, file);
      const dst = path.join(simpleOutDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }
    console.log(`已复制到: ${simpleOutDir}`);
    console.log('请手动压缩该目录为 zip 文件，或安装 archiver: npm i archiver');
    return;
  }

  const output = createWriteStream(outFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`打包完成: ${outFile} (${archive.pointer()} bytes)`);
  });

  archive.on('error', (err) => { throw err; });
  archive.pipe(output);

  for (const file of includeFiles) {
    const filePath = path.join(extDir, file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file });
    } else {
      console.warn(`警告: 文件不存在: ${file}`);
    }
  }

  await archive.finalize();
}

pack().catch((err) => {
  console.error('打包失败:', err);
  process.exit(1);
});
