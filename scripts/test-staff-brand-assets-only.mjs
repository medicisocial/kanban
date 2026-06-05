import { createHash } from 'crypto';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const BASE = process.argv[2] || 'http://localhost:5173';
const user = (env.VITE_STAFF_USERNAME || 'info@medicisocial.com').trim();
const exp = Date.now() + 7 * 86400000;
const sig = createHash('sha256')
  .update(`${user}:${exp}:${env.VITE_STAFF_PASSWORD_HASH}`)
  .digest('hex');
const auth = `Bearer ${Buffer.from(JSON.stringify({ username: user, expires: exp, signature: sig })).toString('base64')}`;

const t0 = Date.now();
const res = await fetch(`${BASE}/api/staff-brand-assets`, {
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand: 'Plume',
    orgId: 'medici',
    companyFiles: [
      {
        id: 't1',
        name: 'test',
        folder: 'drink-menu',
        fileName: 't.pdf',
        mimeType: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0x',
        size: 10,
        updatedAt: Date.now(),
      },
    ],
  }),
});
console.log(res.status, `${Date.now() - t0}ms`, await res.text());
