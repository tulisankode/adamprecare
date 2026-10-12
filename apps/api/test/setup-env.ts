/** Environment e2e: database terpisah (`precare_test`), prefix antrean `apc-test`, timer dispatch dipersingkat. */
import { existsSync } from 'fs';
import { join } from 'path';

const envFile = join(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = new URL(process.env.DATABASE_URL!);
url.pathname = '/precare_test';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url.toString(),
  UPLOAD_DIR: join(__dirname, '..', 'uploads-test'),
  DISPATCH_OFFER_TIMEOUT_SECONDS: '5',
  DISPATCH_ESCALATE_AFTER_SECONDS: '8',
  DISPATCH_UNSERVED_AFTER_SECONDS: '12',
});
