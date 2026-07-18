/** Map patch_brand_profile JSON keys to client_records column names. */
export function patchToRecordColumns(patch = {}) {
  if (!patch || typeof patch !== 'object') return {};
  const columns = {};
  if (patch.displayName !== undefined) {
    columns.display_name = String(patch.displayName || '').trim();
  }
  if (patch.clientColor !== undefined) columns.client_color = patch.clientColor || '';
  if (patch.clientLogo !== undefined) columns.logo = patch.clientLogo || {};
  if (patch.contacts !== undefined) columns.contacts = patch.contacts || [];
  if (patch.socialLogins !== undefined) columns.social_logins = patch.socialLogins || {};
  if (patch.companyFiles !== undefined) columns.company_files = patch.companyFiles || [];
  if (patch.specialMenus !== undefined) columns.special_menus = patch.specialMenus || [];
  if (patch.photoGalleryLink !== undefined) {
    columns.photo_gallery_link = patch.photoGalleryLink || '';
  }
  if (patch.website !== undefined) {
    columns.website = patch.website || '';
  }
  if (patch.businessType !== undefined) columns.business_type = patch.businessType || '';
  if (patch.accountManager !== undefined) columns.account_manager = patch.accountManager || '';
  if (patch.videographer !== undefined) columns.videographer = patch.videographer || '';
  if (patch.photographer !== undefined) columns.photographer = patch.photographer || '';
  if (patch.deliverableTarget !== undefined) {
    columns.deliverable_target = Math.max(0, Math.round(Number(patch.deliverableTarget) || 0));
  }
  if (patch.reelPointsTarget !== undefined) {
    const n = Number(patch.reelPointsTarget);
    columns.reel_points_target = Number.isFinite(n) && n > 0 ? Math.round(n * 2) / 2 : 0;
  }
  if (patch.carouselTarget !== undefined) {
    columns.carousel_target = Math.max(0, Math.round(Number(patch.carouselTarget) || 0));
  }
  if (patch.staticTarget !== undefined) {
    columns.static_target = Math.max(0, Math.round(Number(patch.staticTarget) || 0));
  }
  if (patch.carouselTarget !== undefined && patch.staticTarget !== undefined) {
    const carousels = Math.max(0, Math.round(Number(patch.carouselTarget) || 0));
    const statics = Math.max(0, Math.round(Number(patch.staticTarget) || 0));
    columns.carousel_static_target = Math.round((carousels + statics * 0.5) * 2) / 2;
  } else if (patch.carouselStaticTarget !== undefined) {
    const n = Number(patch.carouselStaticTarget);
    columns.carousel_static_target = Number.isFinite(n) && n > 0 ? Math.round(n * 2) / 2 : 0;
  }
  if (patch.planId !== undefined) {
    columns.plan_id = String(patch.planId || '').trim().toLowerCase() || 'custom';
  }
  if (patch.shootDaysPerMonth !== undefined) {
    columns.shoot_days_per_month = Math.max(0, Math.round(Number(patch.shootDaysPerMonth) || 0));
  }
  if (patch.shootHoursPerDay !== undefined) {
    const n = Number(patch.shootHoursPerDay);
    columns.shoot_hours_per_day = Number.isFinite(n) && n >= 0 ? Math.round(n * 2) / 2 : 0;
  }
  if (patch.monthlyPackageAmount !== undefined) {
    const n = Number(patch.monthlyPackageAmount);
    columns.monthly_package_amount = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  }
  if (patch.deletedCompanyFileIds !== undefined) {
    columns.deleted_company_file_ids = patch.deletedCompanyFileIds || [];
  }
  return columns;
}

export function buildClientRecordUpsertRow(orgId, brandKey, patch = {}) {
  const key = String(brandKey || '').trim().toLowerCase();
  const columns = patchToRecordColumns(patch);
  return {
    org_id: orgId,
    brand_key: key,
    display_name: columns.display_name || patch.displayName?.trim() || key,
    data: {},
    ...columns,
    updated_at: new Date().toISOString(),
  };
}

export function patchNeedsBrandProfileRpc(patch = {}) {
  return Boolean(
    patch &&
      typeof patch === 'object' &&
      Array.isArray(patch.appendDeletedCompanyFileIds) &&
      patch.appendDeletedCompanyFileIds.length,
  );
}
