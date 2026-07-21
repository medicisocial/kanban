import { useState } from 'react';
import { downloadScriptPdf } from '../utils/scriptPdf';

export default function ScriptPdfButton({ card, className = '' }) {
  const [busy, setBusy] = useState(false);
  const btnClass =
    className ||
    'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#f9f6f2] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

  const handleDownload = async () => {
    if (!card) return;
    setBusy(true);
    try {
      await downloadScriptPdf(card);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={handleDownload} disabled={busy || !card} className={btnClass}>
      {busy ? 'Downloading…' : 'Download PDF'}
    </button>
  );
}
