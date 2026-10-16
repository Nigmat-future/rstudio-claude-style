import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../fix-codex-hook.mjs', import.meta.url));
const original = Buffer.from([
  '// Fixture only: never reads or changes a real Assistant installation.\r\n',
  'function Hlo(t){return`hooks.state={${JSON.stringify(I4c)}={trusted_hash=${JSON.stringify(t)}}}`}\r\n',
  'if(i>0||l.hash===o)throw new Z4("Posit Assistant cannot start this engine session: Codex did not trust\r\n',
  'e.hookTrust.hash=l.hash,Ce.debug("[codex-agent] Learned the policy hook\r\n',
  'return s.trustStatus==="trusted"?{kind:"trusted"}:{kind:"untrusted",hash:s.currentHash}\r\n',
  '// Non-ASCII bytes: 中文.\r\n',
].join(''));

function run(bundle, mode = '--check') {
  return spawnSync(process.execPath, [script, '--bundle', bundle, mode], { encoding: 'utf8' });
}

test('apply and restore preserve bytes; incompatible and conflicting files stay untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rstudio-hook-test-'));
  const bundle = join(directory, 'main.js');
  const backup = `${bundle}.before-windows-hook-fix`;
  try {
    await writeFile(bundle, original);
    assert.equal(run(bundle).status, 0);
    assert.deepEqual(await readFile(bundle), original);
    assert.deepEqual(await readdir(directory), ['main.js']);

    let result = run(bundle, '--apply');
    assert.equal(result.status, 0, result.stderr);
    const patched = await readFile(bundle);
    assert.notDeepEqual(patched, original);
    assert.deepEqual(await readFile(backup), original);
    result = run(bundle, '--apply');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile(bundle), patched);
    assert.deepEqual(await readFile(backup), original);

    result = run(bundle, '--restore');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile(bundle), original);
    assert.deepEqual(await readFile(backup), original);

    const unknown = Buffer.from('unreviewed upstream bundle');
    await writeFile(bundle, unknown);
    assert.notEqual(run(bundle, '--apply').status, 0);
    assert.deepEqual(await readFile(bundle), unknown);
    assert.deepEqual(await readFile(backup), original);

    await writeFile(bundle, original);
    const conflict = Buffer.from('backup belongs to a different bundle');
    await writeFile(backup, conflict);
    assert.notEqual(run(bundle, '--apply').status, 0);
    assert.deepEqual(await readFile(bundle), original);
    assert.deepEqual(await readFile(backup), conflict);

    await writeFile(backup, original);
    result = run(bundle, '--apply');
    assert.equal(result.status, 0, result.stderr);
    const upstreamChange = Buffer.concat([await readFile(bundle), Buffer.from('// upstream change\n')]);
    await writeFile(bundle, upstreamChange);
    assert.notEqual(run(bundle, '--restore').status, 0);
    assert.deepEqual(await readFile(bundle), upstreamChange);
    assert.deepEqual(await readFile(backup), original);
    assert.deepEqual((await readdir(directory)).sort(), ['main.js', 'main.js.before-windows-hook-fix']);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing bundle values and missing default environment fail before reading a file', () => {
  let result = spawnSync(process.execPath, [script, '--bundle'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--bundle requires a file path/);
  const environment = { ...process.env };
  delete environment.LOCALAPPDATA;
  result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: environment });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LOCALAPPDATA is missing|default bundle path is Windows-only/);
});
