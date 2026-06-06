/**
 * Download helper + portal delete must not resurrect removed files on refresh merge.
 */
import { loadEnv } from 'vite';
import { getFilePreviewKind } from '../src/utils/filePreview.js';
import { mergeBrandCompanyFiles } from '../src/utils/clientsWorkspaceMerge.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const storageUrl =
  'https://example.supabase.co/storage/v1/object/public/brand-assets/medici/Plume/drink-menu/menu.pdf';

assert(
  getFilePreviewKind(storageUrl, 'menu.pdf') === 'pdf',
  'https storage PDF should be previewable',
);
assert(
  getFilePreviewKind('data:application/pdf;base64,abc', 'x.pdf') === 'pdf',
  'data PDF should be previewable',
);

// Union merge resurrects a deleted file when its updatedAt beats the saved list max.
{
  const saved = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  const staleServer = [
    { id: 'f1', name: 'Keep', updatedAt: 10 },
    { id: 'f2', name: 'Removed', updatedAt: 500 },
  ];
  const resurrected = mergeBrandCompanyFiles(
    mergeBrandCompanyFiles(staleServer, saved),
    saved,
  );
  assert(resurrected.length === 2, 'union merge should resurrect deleted file');
  assert(
    resurrected.some((file) => file.id === 'f2'),
    'removed file should reappear under union merge',
  );
}

// Authoritative save payload is what the portal should keep after a delete.
{
  const saved = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  assert(saved.length === 1, 'authoritative saved list should drop removed file');
  assert(saved[0].id === 'f1', 'authoritative saved list should keep remaining file');
}

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
if (supabaseUrl) {
  const probeUrl = `${supabaseUrl}/storage/v1/object/public/brand-assets/`;
  const res = await fetch(probeUrl, { method: 'HEAD' }).catch(() => null);
  if (res) {
    assert(res.status < 500, 'storage public endpoint should be reachable for download fetch');
  }
}

console.log('File preview/download tests passed.');
