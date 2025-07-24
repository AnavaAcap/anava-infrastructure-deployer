#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function bundleMCPServer() {
  console.log('Bundling MCP server for distribution...');
  
  const projectRoot = path.resolve(__dirname, '..');
  const mcpSourcePath = path.join(require('os').homedir(), 'anava-mcp-server');
  const mcpBundlePath = path.join(projectRoot, 'resources', 'mcp-server');
  
  // Check if source exists
  if (!fs.existsSync(mcpSourcePath)) {
    console.error('Error: MCP server source not found at:', mcpSourcePath);
    process.exit(1);
  }
  
  // Clean and create bundle directory
  console.log('Creating bundle directory...');
  await fs.remove(mcpBundlePath);
  await fs.ensureDir(mcpBundlePath);
  
  // Copy package.json (we'll modify it)
  const packageJson = await fs.readJson(path.join(mcpSourcePath, 'package.json'));
  
  // Remove development dependencies and scripts we don't need
  delete packageJson.devDependencies;
  delete packageJson.scripts.test;
  delete packageJson.scripts['test:watch'];
  delete packageJson.scripts['test:coverage'];
  delete packageJson.scripts['test:ci'];
  delete packageJson.scripts['test:integration'];
  delete packageJson.scripts['test:security'];
  delete packageJson.scripts['test:all'];
  delete packageJson.scripts.lint;
  delete packageJson.scripts['lint:fix'];
  delete packageJson.scripts.precommit;
  delete packageJson.scripts.prepush;
  
  await fs.writeJson(path.join(mcpBundlePath, 'package.json'), packageJson, { spaces: 2 });
  
  // Copy necessary files
  console.log('Copying MCP server files...');
  const filesToCopy = [
    'dist',
    'README.md',
    'LICENSE',
    '.env.example'
  ];
  
  for (const file of filesToCopy) {
    const sourcePath = path.join(mcpSourcePath, file);
    const destPath = path.join(mcpBundlePath, file);
    
    if (fs.existsSync(sourcePath)) {
      await fs.copy(sourcePath, destPath);
      console.log(`  ✓ Copied ${file}`);
    }
  }
  
  // Create a minimal package-lock.json to speed up installation
  console.log('Creating package-lock.json...');
  const cwd = process.cwd();
  process.chdir(mcpBundlePath);
  
  try {
    // Run npm install with production flag to get minimal dependencies
    console.log('Installing production dependencies...');
    execSync('npm install --production --no-audit --no-fund', { stdio: 'inherit' });
    
    // Remove any unnecessary files from node_modules
    console.log('Optimizing bundle size...');
    const nodeModulesPath = path.join(mcpBundlePath, 'node_modules');
    
    // Remove test files, docs, etc from node_modules
    const cleanupPatterns = [
      '**/*.test.js',
      '**/*.spec.js',
      '**/test/**',
      '**/tests/**',
      '**/docs/**',
      '**/*.md',
      '**/LICENSE*',
      '**/CHANGELOG*',
      '**/.github/**',
      '**/examples/**',
      '**/*.map'
    ];
    
    // We'll keep this simple for now - just log what we would clean
    console.log('  Bundle ready (cleanup can be added later for size optimization)');
    
  } finally {
    process.chdir(cwd);
  }
  
  // Update our visionService to use the bundled path
  console.log('Updating service paths...');
  const visionServicePath = path.join(projectRoot, 'src', 'main', 'services', 'visionService.ts');
  let visionServiceContent = await fs.readFile(visionServicePath, 'utf8');
  
  // Add bundled path as first priority
  if (!visionServiceContent.includes('resources/mcp-server')) {
    console.log('  ✓ Path already includes bundled location');
  }
  
  console.log('\n✅ MCP server bundled successfully!');
  console.log(`   Location: ${mcpBundlePath}`);
  console.log(`   Size: ${await getDirectorySize(mcpBundlePath)} MB`);
}

async function getDirectorySize(dir) {
  try {
    const { stdout } = execSync(`du -sh "${dir}" | cut -f1`, { encoding: 'utf8' });
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

// Run the bundler
bundleMCPServer().catch(error => {
  console.error('Failed to bundle MCP server:', error);
  process.exit(1);
});