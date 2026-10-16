import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { link, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

let mode = '--check';
let bundle;
let selectedMode = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--bundle') {
    assert.equal(bundle, undefined, 'Specify --bundle only once');
    bundle = process.argv[++index];
    assert.ok(bundle && !bundle.startsWith('--'), '--bundle requires a file path');
  } else {
    assert.ok(['--check', '--apply', '--restore'].includes(argument) && !selectedMode, 'Use one of --check, --apply or --restore, with optional --bundle <path>');
    mode = argument;
    selectedMode = true;
  }
}
if (bundle === undefined) {
  assert.equal(process.platform, 'win32', 'The default bundle path is Windows-only; provide --bundle <path>');
  assert.ok(process.env.LOCALAPPDATA?.trim(), 'LOCALAPPDATA is missing; provide --bundle <path>');
  bundle = join(process.env.LOCALAPPDATA, 'RStudio', 'pai', 'bin', 'dist', 'server', 'main.js');
}
const target = resolve(bundle);
const backup = `${target}.before-windows-hook-fix`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function writeAtomic(file, bytes, permissions, exclusive = false) {
  const temporary = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: permissions });
    // A hard link publishes a complete backup atomically without replacing an existing one.
    if (exclusive) await link(temporary, file);
    else await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

// ponytail: Patch only the known 1.8.0 adapter; stop on changed upstream code instead of guessing.
const replacements = [
  ['function Hlo(t){return`hooks.state={${JSON.stringify(I4c)}={trusted_hash=${JSON.stringify(t)}}}`}',
   'function Hlo(t){return`hooks.state={${JSON.stringify(t.key)}={trusted_hash=${JSON.stringify(t.hash)}}}`}'],
  ['if(i>0||l.hash===o)throw new Z4("Posit Assistant cannot start this engine session: Codex did not trust',
   'if(i>0)throw new Z4("Posit Assistant cannot start this engine session: Codex did not trust'],
  ['e.hookTrust.hash=l.hash,Ce.debug("[codex-agent] Learned the policy hook',
   'e.hookTrust.hash=l,Ce.debug("[codex-agent] Learned the policy hook'],
  ['return s.trustStatus==="trusted"?{kind:"trusted"}:{kind:"untrusted",hash:s.currentHash}',
   'return s.trustStatus==="trusted"?{kind:"trusted"}:{kind:"untrusted",hash:s.currentHash,key:s.key}'],
];

function patch(source) {
  for (const [before, after] of replacements) {
    assert.equal(source.split(before).length - 1, 1, 'Assistant bundle differs from the reviewed 1.8.0 adapter; no file changed');
    source = source.replace(before, after);
  }
  return source;
}

const bytes = await readFile(target);
const permissions = (await stat(target)).mode;
const current = bytes.toString('utf8');
const patched = replacements.every(([, after]) => current.includes(after));
if (mode === '--restore') {
  const original = await readFile(backup);
  assert.equal(digest(Buffer.from(patch(original.toString('utf8')))), digest(bytes), 'Current bundle changed after patch; refusing to overwrite it');
  await writeAtomic(target, original, permissions);
  console.log(`Restored original adapter. SHA256 ${digest(original)}`);
} else if (patched) {
  console.log(`Patch already installed. SHA256 ${digest(bytes)}`);
} else {
  const next = patch(current);
  console.log(`Reviewed adapter found. SHA256 ${digest(bytes)}`);
  if (mode === '--apply') {
    try { await writeAtomic(backup, bytes, permissions, true); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      assert.equal(digest(await readFile(backup)), digest(bytes), 'Existing backup differs; refusing to overwrite it');
    }
    await writeAtomic(target, Buffer.from(next), permissions);
    assert.equal(digest(await readFile(target)), digest(Buffer.from(next)));
    console.log(`Applied dynamic hook key fix. SHA256 ${digest(Buffer.from(next))}`);
    console.log(`Backup: ${backup}`);
    console.log('Reload Posit Assistant to use the updated adapter.');
  } else console.log('Compatible. Run with --apply to install.');
}
