import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = join(process.cwd(), 'src');

const replacements = [
  ['from-violet-500 to-fuchsia-500', 'from-[#810100] to-[#a00000]'],
  ['shadow-violet-500/20', 'shadow-[#810100]/20'],
  ['bg-violet-600', 'bg-[#810100]'],
  ['hover:bg-violet-500', 'hover:bg-[#a00000]'],
  ['bg-violet-500', 'bg-[#a00000]'],
  ['text-violet-600', 'text-[#810100]'],
  ['text-violet-400', 'text-[#dc2626]'],
  ['text-violet-300', 'text-[#fca5a5]'],
  ['text-violet-200', 'text-[#fecaca]'],
  ['border-violet-500/50', 'border-[#810100]/50'],
  ['border-violet-500/30', 'border-[#810100]/30'],
  ['border-violet-500/20', 'border-[#810100]/20'],
  ['ring-violet-500/50', 'ring-[#810100]/50'],
  ['ring-violet-500/30', 'ring-[#810100]/30'],
  ['focus:border-violet-500/50', 'focus:border-[#810100]/50'],
  ['focus:ring-violet-500/30', 'focus:ring-[#810100]/30'],
  ['bg-violet-500/15', 'bg-[#810100]/15'],
  ['bg-violet-500/10', 'bg-[#810100]/10'],
  ['bg-violet-500/5', 'bg-[#810100]/5'],
  ['hover:text-violet-300', 'hover:text-[#fca5a5]'],
  ['hover:text-violet-400', 'hover:text-[#dc2626]'],
  ['bg-[#0f1117]', 'bg-black'],
  ['bg-[#1a1d2e]', 'bg-[#111111]'],
  ['bg-[#1e2130]', 'bg-[#1a1a1a]'],
  ['bg-[#1c2030]', 'bg-[#121212]'],
  ['bg-[#1f2336]', 'bg-[#141414]'],
  ['bg-[#21253a]', 'bg-[#161616]'],
  ['bg-[#23273d]', 'bg-[#181818]'],
  ['bg-[#2a1f24]', 'bg-[#1a1212]'],
  ['text-gray-200', 'text-[#f9f6f2]'],
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules') walk(path, files);
    } else if (['.jsx', '.js', '.css'].includes(extname(path))) {
      files.push(path);
    }
  }
  return files;
}

for (const file of walk(root)) {
  let content = readFileSync(file, 'utf8');
  let next = content;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  if (next !== content) {
    writeFileSync(file, next, 'utf8');
    console.log('updated', file);
  }
}

console.log('done');
