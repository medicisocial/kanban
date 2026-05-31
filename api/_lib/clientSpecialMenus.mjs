export function normalizeClientSpecialMenus(menus) {
  if (!Array.isArray(menus)) return [];

  return menus
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || '').trim();
      const startDate = String(entry.startDate || '').trim();
      const endDate = String(entry.endDate || '').trim();
      if (!name || !startDate || !endDate) return null;

      const normalizePdf = (value) => {
        if (!value || typeof value !== 'object') return null;
        const pdfName = String(value.name || '').trim();
        const dataUrl = String(value.dataUrl || '').trim();
        if (!pdfName || !dataUrl.startsWith('data:application/pdf')) return null;
        return {
          name: pdfName,
          dataUrl,
          size: Number(value.size) || 0,
        };
      };

      const hasDrinkMenu = Boolean(entry.hasDrinkMenu);
      const hasFoodMenu = Boolean(entry.hasFoodMenu);
      const drinkMenuPdf = hasDrinkMenu ? normalizePdf(entry.drinkMenuPdf) : null;
      const foodMenuPdf = hasFoodMenu ? normalizePdf(entry.foodMenuPdf) : null;

      if (hasDrinkMenu && !drinkMenuPdf) return null;
      if (hasFoodMenu && !foodMenuPdf) return null;

      return {
        id: String(entry.id || `sm-${Date.now()}`),
        name,
        startDate,
        endDate,
        hasDrinkMenu,
        drinkMenuPdf,
        hasFoodMenu,
        foodMenuPdf,
        createdAt: Number(entry.createdAt) || Date.now(),
        updatedAt: Number(entry.updatedAt) || Date.now(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
