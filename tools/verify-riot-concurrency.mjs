import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Always provision a disposable cluster. Deliberately accept no database URL,
// credentials, hostname or existing data directory from the caller/environment.
const argument = process.argv[2];
if (!argument?.startsWith('--postgres-bin-dir=')) {
  console.error('Usage: node tools/verify-riot-concurrency.mjs --postgres-bin-dir=/path/to/postgres/bin');
  process.exit(1);
}
const binaries = resolve(argument.slice('--postgres-bin-dir='.length));
const project = fileURLToPath(new URL('../', import.meta.url));
const root = await mkdtemp('/tmp/nxt5-riot-pg-');
const data = join(root, 'data');
const socket = join(root, 'socket');
await chmod(root, 0o700);
await mkdir(socket, { mode: 0o700 });
await writeFile(join(root, 'nxt5-test-only'), 'ephemeral-riot-concurrency\n', { mode: 0o600 });

async function run(executable, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { cwd: project, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`${executable} exited with ${code}`)));
  });
}

let started = false;
try {
  await run(join(binaries, 'initdb'), ['-D', data, '-U', 'nxt5_test', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--encoding=UTF8']);
  await run(join(binaries, 'pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', 'start', '-o',
    `-k ${socket} -c listen_addresses='' -c unix_socket_permissions=0700 -c fsync=off -c statement_timeout=15000`]);
  started = true;
  await run(process.execPath, [join(project, 'node_modules/vitest/vitest.mjs'), 'run', 'src/__tests__/riot-rso-postgres.test.ts', '--maxWorkers=1'], {
    env: { ...process.env, NXT5_RIOT_POSTGRES_SOCKET: socket },
  });
} finally {
  if (started) await run(join(binaries, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
  await rm(root, { recursive: true, force: true });
}
