import { useState } from "react";
import { buildShootPrintPayload, downloadTimelineRows, printTimelineRows } from "../utils/shootDayPrint";

export default function ShootDayTimelinePrintButton({ client, dateKey, plan, cards, className = "" }) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || !cards.some((c) => c.shootTime);
  const btnClass =
    className ||
    "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#f9f6f2] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

  const payload = () => buildShootPrintPayload({ client, dateKey, plan, cards });

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadTimelineRows(payload());
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    printTimelineRows(payload());
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleDownload} disabled={disabled} className={btnClass}>
        {busy ? "Downloading…" : "Download PDF"}
      </button>
      <button type="button" onClick={handlePrint} disabled={disabled} className={btnClass}>
        Print
      </button>
    </div>
  );
}
