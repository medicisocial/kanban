import { patchPortalPasswordVaultViaApi } from './portalPasswordVaultApi';

/** Fire-and-forget normalized vault patch — never blocks the save UI. */
export function patchPortalPasswordVaultInBackground(brand, brandVault) {
  if (!brand) return;
  const vault = brandVault && typeof brandVault === 'object' ? brandVault : {};
  if (!Object.keys(vault).length) return;

  void patchPortalPasswordVaultViaApi(brand, vault).then((result) => {
    if (result?.ok === false) {
      console.warn('[portal-credentials] background vault patch failed:', result.error);
    }
  });
}
