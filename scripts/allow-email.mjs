// Adds an address to the allow list, which is the only way to be able to
// register an account.
//
//   npm run db:allow -- someone@example.com            # production database
//   npm run db:allow -- someone@example.com --local    # local development
//
// Removing someone:
//   npx wrangler d1 execute book-shelf-manager --remote \
//     --command "DELETE FROM allowed_emails WHERE email = 'someone@example.com'"
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const local = args.includes('--local');
const email = (args.find((argument) => !argument.startsWith('--')) ?? '').trim().toLowerCase();

if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) {
  console.error('用法：npm run db:allow -- someone@example.com [--local]');
  process.exit(1);
}

const sql = `INSERT INTO allowed_emails (email, note, created_at)
VALUES ('${email}', '', ${Date.now()})
ON CONFLICT (email) DO NOTHING;`;

const result = spawnSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'book-shelf-manager',
    local ? '--local' : '--remote',
    '--command',
    sql,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`\n已允許 ${email} 註冊${local ? '（本機資料庫）' : ''}。`);
