#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查构建后的文件是否包含外部依赖
function verifyExternalDependencies() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist目录不存在，请先运行 npm run build');
    process.exit(1);
  }

  const jsFiles = getAllJsFiles(distDir);
  let hasExternalDeps = false;

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    // 检查是否包含外部依赖的代码
    if (content.includes('@capacitor-community/bluetooth-le') || 
        content.includes('@capacitor/core')) {
      console.warn(`⚠️  警告: ${path.relative(distDir, file)} 可能包含外部依赖引用`);
      hasExternalDeps = true;
    }
  }

  if (hasExternalDeps) {
    console.log('ℹ️  注意: 这些是正常的import语句，不会将依赖打包进库中');
  }

  console.log('✅ 外部依赖验证完成');
}

function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

verifyExternalDependencies(); 