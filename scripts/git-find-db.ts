import { execSync } from 'child_process';

function run(cmd: string) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function main() {
  let output: string;
  try {
    output = run('git rev-list --objects --all');
  } catch (error) {
    console.error('[git-find-db] failed to enumerate git objects', error);
    process.exit(1);
    return;
  }

  const matches = output
    .split('\n')
    .map((line) => line.trim().split(' '))
    .filter((parts) => parts.length >= 2)
    .map(([sha, ...pathParts]) => ({ sha, path: pathParts.join(' ') }))
    .filter(({ path }) => /\.(db|sqlite|sqlite3)$/i.test(path));

  if (!matches.length) {
    console.log('No .db/.sqlite files found in git history.');
    return;
  }

  console.log('Found potential DB files in git history:\n');
  for (const { sha, path } of matches) {
    let size = '';
    try {
      size = run(`git cat-file -s ${sha}`);
      size = `${(Number(size) / 1024 / 1024).toFixed(2)} MB`;
    } catch {
      size = 'unknown size';
    }
    console.log(`${sha.slice(0, 8)} ${path} (${size})`);
  }

  console.log('\nExample extract:\n');
  console.log('  git show <sha>:<path> > /tmp/recovered.db && pnpm db:copy:sqlite -- --src /tmp/recovered.db');
}

main();
