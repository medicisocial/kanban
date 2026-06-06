import { supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';

/** Fire-and-forget cloud vault patch — never blocks the save UI. */
export function patchPortalPasswordVaultInBackground(brand, brandVault) {
  if (!supabase || !brand) return;
  const vault = brandVault && typeof brandVault === 'object' ? brandVault : {};
  if (!Object.keys(vault).length) return;

  const orgId = getOrgId();
  void supabase
    .rpc('patch_clients_portal_password_vault', {
      p_org_id: orgId,
      p_brand: brand,
      p_brand_vault: vault,
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[portal-credentials] background vault patch failed:', error.message || error);
      }
    });
}
