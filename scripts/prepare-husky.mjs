import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.git')) {
  console.log('Skipping Husky install because this workspace is not a git repository.');
  process.exit(0);
}

execSync('npx husky', { stdio: 'inherit' });
