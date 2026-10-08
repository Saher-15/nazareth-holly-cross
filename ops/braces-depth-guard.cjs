'use strict';
// Temporary mitigation for GHSA-vfj7-8cjw-p6xm (braces 3.0.3 has no patched upstream release).
// Preloaded before ESLint. Bound both pattern and supplied AST depth before recursive walkers run.
const path = require('node:path');
const { createRequire } = require('node:module');
const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
const MAX_DEPTH = 64;
function check(input) {
  if (typeof input === 'string') {
    const stack = [];
    for (let i = 0; i < input.length; i++) {
      if (input[i] === '\\') { i++; continue; }
      if ('{(['.includes(input[i])) {
        stack.push(input[i]);
        if (stack.length > MAX_DEPTH) throw new SyntaxError('Glob nesting exceeds the safe limit');
      }
      const close = '})]'.indexOf(input[i]);
      if (close !== -1 && stack.at(-1) === '{(['[close]) stack.pop();
    }
    return;
  }
  if (!input || typeof input !== 'object') return;
  // Ignore parent/prev references; only nodes/queue are traversed by the upstream recursive walkers.
  const stack = [{ value: input, depth: 0 }];
  const seen = new Set();
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (depth > MAX_DEPTH) throw new SyntaxError('Glob AST nesting exceeds the safe limit');
    if (seen.has(value)) throw new SyntaxError('Cyclic glob AST');
    seen.add(value);
    if (Array.isArray(value)) for (const child of value) stack.push({ value: child, depth });
    else for (const key of ['nodes', 'queue']) if (value[key]) stack.push({ value: value[key], depth: depth + 1 });
  }
}
let installed = false;
let protectedBraces;
try {
  const braces = projectRequire('braces');
  for (const name of ['parse', 'compile', 'expand', 'stringify', 'create']) {
    const original = braces[name];
    braces[name] = function bounded(input, ...args) { check(input); return original.call(this, input, ...args); };
  }
  installed = true;
  protectedBraces = braces;
} catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
module.exports = { check, installed, MAX_DEPTH, braces: protectedBraces };
