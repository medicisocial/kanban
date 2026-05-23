import { writeFileSync } from 'node:fs';

const content = `# Logs
logs
*.log
npm-debug.log*

# Dependencies
node_modules

# Environment (staff credentials)
.env
.env.local
.env.*.local

# Build
dist
dist-ssr
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea

# OS
.DS_Store
Thumbs.db
`;

writeFileSync('.gitignore', content, 'utf8');
