#!/usr/bin/env node
/**
 * Starts the API and the web client together with one command.
 * Keeps both attached so Ctrl-C stops the pair cleanly.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];

function run(name, cwd, colour) {
  const child = spawn(npm, ['run', 'dev'], { cwd: path.join(root, cwd), shell: process.platform === 'win32' });
  children.push(child);

  const prefix = `\x1b[${colour}m[${name}]\x1b[0m `;
  const pipe = (stream, target) => {
    stream.on('data', (buf) => {
      const lines = buf.toString().split('\n').filter((l) => l.trim());
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${prefix}exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\n  Digital Identity Intelligence — starting API and web client\n');
run('api', 'server', '35');
run('web', 'client', '36');
