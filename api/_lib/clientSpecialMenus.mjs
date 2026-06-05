function defaultMenuLabel(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  return base || 'Menu';
}

function normalizeMenuPdf(value) {
  if (!value || typeof value !== 'object') return null;
  const pdfName = String(value.name || '').trim();
  // Either an inline PDF data URL or a Supabase Storage URL.
  const dataUrl = String(value.dataUrl || value.url || '').trim();
  const isData = dataUrl.startsWith('data:application/pdf');
  const isHttp = /^https?:\/\//i.test(dataUrl);
  if (!pdfName || (!isData && !isHttp)) return null;
  const storagePath = String(value.storagePath || '').trim();
  const label = String(value.label || '').trim() || defaultMenuLabel(pdfName);
  return {
    id: String(value.id || `smp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    label,
    name: pdfName,
    dataUrl,
    size: Number(value.size) || 0,
    ...(storagePath ? { storagePath } : {}),
  };
}

/** Accept the new array form or the legacy single-PDF field. */
function normalizeMenuPdfList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeMenuPdf(entry)).filter(Boolean);
  }
  const single = normalizeMenuPdf(value);
  return single ? [single] : [];
}

export function normalizeClientSpecialMenus(menus) {
  if (!Array.isArray(menus)) return [];

  return menus
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || '').trim();
      const startDate = String(entry.startDate || '').trim();
      const endDate = String(entry.endDate || '').trim();
      if (!name || !startDate || !endDate) return null;

      const drinkMenuPdfs = normalizeMenuPdfList(entry.drinkMenuPdfs ?? entry.drinkMenuPdf);
      const foodMenuPdfs = normalizeMenuPdfList(entry.foodMenuPdfs ?? entry.foodMenuPdf);
      const hasDrinkMenu = drinkMenuPdfs.length > 0;
      const hasFoodMenu = foodMenuPdfs.length > 0;

      if (!hasDrinkMenu && !hasFoodMenu) return null;

      return {
        id: String(entry.id || `sm-${Date.now()}`),
        name,
        startDate,
        endDate,
        hasDrinkMenu,
        drinkMenuPdfs,
        hasFoodMenu,
        foodMenuPdfs,
        createdAt: Number(entry.createdAt) || Date.now(),
        updatedAt: Number(entry.updatedAt) || Date.now(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
