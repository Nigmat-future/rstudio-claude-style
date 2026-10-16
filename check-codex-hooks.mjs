import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

// ponytail: Exercise only initialize and hooks/list; no login, model turn, or MCP tool runs.
const legacyKey = '/<session-flags>/config.toml:pre_tool_use:0:0';
const hookConfig = 'hooks.PreToolUse=[{hooks=[{type="mcp_tool",server="pa",tool="pa_policy_hook",timeout=604800,input={name="${tool_name}",input="${tool_input}",id="${tool_use_id}",turn="${turn_id}"}}]}]';
const options = process.argv.slice(2);
let executable = process.env.CODEX_BIN ?? join(process.env.USERPROFILE ?? '', '.posit', 'assistant', 'engines', 'bin', 'codex-agent', '0.154.0', 'win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
let workspace;
let bundlePath;
let mode = 'compare';
for (let i = 0; i < options.length; i++) {
  const option = options[i];
  if (option === '--codex' || option === '--cwd' || option === '--bundle') {
    assert.ok(options[i + 1] && !options[i + 1].startsWith('--'), `${option} requires a path`);
    if (option === '--codex') executable = options[++i];
    else if (option === '--bundle') bundlePath = resolve(options[++i]);
    else workspace = resolve(options[++i]);
  } else if (option === '--legacy' || option === '--corrected') {
    assert.equal(mode, 'compare', 'Select only one of --legacy and --corrected');
    mode = option.slice(2);
  } else throw new Error(`Unknown argument: ${option}`);
}

let bundleFormatter;
if (bundlePath) {
  const metadata = await stat(bundlePath);
  assert.ok(metadata.isFile() && metadata.size < 64 * 1024 * 1024, '--bundle requires a bundle file smaller than 64 MiB');
  const source = await readFile(bundlePath, 'utf8');
  const expectedFormatter = 'function Hlo(t){return`hooks.state={${JSON.stringify(t.key)}={trusted_hash=${JSON.stringify(t.hash)}}}`}';
  assert.equal(source.split(expectedFormatter).length - 1, 1, 'Bundle does not contain the reviewed dynamic hook trust formatter');
  const offset = source.indexOf(expectedFormatter);
  const formatter = source.slice(offset, offset + expectedFormatter.length);
  assert.ok(source.includes('return s.trustStatus==="trusted"?{kind:"trusted"}:{kind:"untrusted",hash:s.currentHash,key:s.key}'), 'Bundle checkHooks does not return the observed hook key');
  assert.ok(source.includes('e.hookTrust.hash=l,Ce.debug("[codex-agent] Learned the policy hook'), 'Bundle does not retain the key and hash together');
  assert.ok(source.includes('if(i>0)throw new Z4("Posit Assistant cannot start this engine session: Codex did not trust'), 'Bundle retry guard differs from the reviewed fix');
  // Execute only the exact reviewed pure formatter, never the rest of the application bundle.
  bundleFormatter = trust => runInNewContext(`${formatter};Hlo(trust)`, { trust }, {
    timeout: 1000, contextCodeGeneration: { strings: false, wasm: false },
  });
  console.log(JSON.stringify({ phase: 'bundle', path: bundlePath, adapter: 'dynamic-key' }));
}

const temporaryHome = await mkdtemp(join(tmpdir(), 'posit-hook-check-'));
workspace ??= join(temporaryHome, 'workspace');

async function inspectHook(trust, formatTrust) {
  const settings = [
    'features.hooks=true', 'cli_auth_credentials_store="ephemeral"',
    'check_for_update_on_startup=false', 'history.persistence="none"', hookConfig,
  ];
  if (trust) settings.push(formatTrust ? formatTrust(trust) : `hooks.state={${JSON.stringify(trust.key)}={trusted_hash=${JSON.stringify(trust.hash)}}}`);
  const environment = { ...process.env, CODEX_HOME: temporaryHome };
  delete environment.OPENAI_API_KEY;
  delete environment.CODEX_API_KEY;
  const child = spawn(executable, ['app-server', ...settings.flatMap(value => ['-c', value])], {
    cwd: workspace, env: environment, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const pending = new Map();
  let nextId = 1;
  let processError;
  const fail = error => {
    processError = error;
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  const exited = new Promise(complete => {
    child.once('error', error => { fail(error); complete(); });
    child.once('exit', (code, signal) => {
      fail(new Error(`Codex app-server exited (code ${code}, signal ${signal ?? 'none'}); stderr omitted.`));
      complete();
    });
  });
  // Drain diagnostics without exposing account details from inherited process state.
  child.stderr.resume();
  child.stdin.on('error', fail);
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); }
    catch { fail(new Error('Codex app-server returned invalid JSON; output omitted.')); return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`JSON-RPC error ${message.error.code}; server text omitted.`));
    else request.resolve(message.result);
  });
  async function request(method, params) {
    if (processError) throw processError;
    const id = nextId++;
    let timer;
    try {
      return await new Promise((resolveRequest, reject) => {
        timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }, 15000);
        pending.set(id, { resolve: resolveRequest, reject });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    } finally { clearTimeout(timer); }
  }
  try {
    await request('initialize', {
      clientInfo: { name: 'posit-hook-regression-check', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized' })}\n`);
    const result = await request('hooks/list', { cwds: [workspace] });
    const hooks = result.data.flatMap(entry => entry.hooks);
    const matches = hooks.filter(hook => hook.eventName === 'preToolUse' && hook.handlerType === 'mcpTool' && hook.server === 'pa' && hook.tool === 'pa_policy_hook');
    assert.equal(matches.length, 1, 'Expected exactly one Posit Assistant policy hook');
    const hook = matches[0];
    assert.equal(hook.enabled, true, 'Posit Assistant policy hook must be enabled');
    assert.equal(typeof hook.key, 'string');
    assert.equal(typeof hook.currentHash, 'string');
    return { key: hook.key, hash: hook.currentHash, trustStatus: hook.trustStatus };
  } finally {
    lines.close();
    child.stdin.end();
    await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([exited, delay(3000)]);
      assert.ok(child.exitCode !== null || child.signalCode !== null || processError?.code, 'Codex app-server did not stop');
    }
  }
}

try {
  await mkdir(workspace, { recursive: true });
  const discovered = await inspectHook();
  console.log(JSON.stringify({ phase: 'discovered', ...discovered }));
  assert.notEqual(discovered.trustStatus, 'trusted', 'Fresh isolated CODEX_HOME unexpectedly trusts the hook');
  if (mode !== 'corrected') {
    const legacy = await inspectHook({ key: legacyKey, hash: discovered.hash });
    console.log(JSON.stringify({ phase: 'legacy', configuredKey: legacyKey, ...legacy }));
    assert.equal(legacy.hash, discovered.hash, 'Hook hash changed between identical configurations');
    if (mode === 'legacy') assert.equal(legacy.trustStatus, 'trusted', 'Posit Assistant hard-coded hook key does not establish trust');
    else assert.notEqual(legacy.trustStatus, 'trusted', 'Legacy key now works; this compatibility issue may be fixed upstream');
  }
  if (mode !== 'legacy') {
    const corrected = await inspectHook({ key: discovered.key, hash: discovered.hash }, bundleFormatter);
    console.log(JSON.stringify({ phase: 'corrected', ...corrected }));
    assert.equal(corrected.hash, discovered.hash, 'Hook hash changed between identical configurations');
    assert.equal(corrected.trustStatus, 'trusted', 'Using the returned hook key must establish trust');
  }
} finally {
  assert.equal(dirname(temporaryHome), resolve(tmpdir()), 'Refusing to remove a directory outside the temporary root');
  assert.ok(basename(temporaryHome).startsWith('posit-hook-check-'), 'Refusing to remove an unexpected temporary directory');
  await rm(temporaryHome, { recursive: true, force: true });
}
