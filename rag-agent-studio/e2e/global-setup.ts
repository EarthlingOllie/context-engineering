import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gives every run a brand-new database and an empty storage/e2e folder (log,
// uploads), so journeys never see leftovers from a previous run and never
// touch the files of the app configured by .env.
export default function globalSetup(): void {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const database = path.join(root, 'database', 'e2e.sqlite');
    const storage = path.join(root, 'storage', 'e2e');

    fs.mkdirSync(path.dirname(database), { recursive: true });
    fs.writeFileSync(database, '');
    fs.rmSync(storage, { recursive: true, force: true });
    fs.mkdirSync(path.join(storage, 'files'), { recursive: true });
    fs.writeFileSync(path.join(storage, 'laravel.log'), '');

    execFileSync('php', ['artisan', 'migrate:fresh', '--env=e2e', '--force', '--no-interaction', '--quiet'], {
        cwd: root,
        stdio: 'inherit',
    });
}
