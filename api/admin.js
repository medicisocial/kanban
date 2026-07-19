import { getSupabaseUrl, resolveServerKey } from './_lib/supabase.mjs';
import { isSuperAdminSessionValid } from './_lib/superAdminAuth.mjs';
import { getSessionFromRequest } from './_lib/staffAuth.mjs';
import {
  badRequest,
  forbidden,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

const PLAN_PRICES = {
  starter: 12,
  creator: 12,
  agency_essential: 29,
  agency_pro: 69,
  agency: 69, // fallback
  agency_scale: 99,
};

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!isSuperAdminSessionValid(session)) {
    return unauthorized(res, 'Unauthorized super admin session.');
  }

  const url = getSupabaseUrl();
  let serviceKey;
  try {
    serviceKey = resolveServerKey();
  } catch (error) {
    return unavailable(res, error.message || 'Supabase service role key is not configured.');
  }

  if (!url || !serviceKey) {
    return unavailable(res, 'Supabase is not configured.');
  }

  // ── GET: Return Dashboard Data ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      // 1. Fetch all organizations
      const orgsRes = await fetch(`${url}/rest/v1/organizations?select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!orgsRes.ok) {
        throw new Error(`Orgs fetch failed: ${orgsRes.status} ${await orgsRes.text()}`);
      }
      const orgs = await orgsRes.json();

      // 2. Fetch all memberships
      const membersRes = await fetch(`${url}/rest/v1/organization_members?select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!membersRes.ok) {
        throw new Error(`Members fetch failed: ${membersRes.status} ${await membersRes.text()}`);
      }
      const memberships = await membersRes.json();

      // 3. Fetch all users from Supabase Auth admin endpoint
      const usersRes = await fetch(`${url}/auth/v1/admin/users`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      let users = [];
      if (usersRes.ok) {
        const payload = await usersRes.json();
        users = payload.users || [];
      } else {
        console.warn('[admin-api] Auth users fetch failed:', usersRes.status, await usersRes.text());
      }

      // 4. Fetch all brands (clients)
      const brandsRes = await fetch(`${url}/rest/v1/brands?select=id,org_id,brand_key,display_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const brands = brandsRes.ok ? await brandsRes.json() : [];

      // Map users for fast lookup
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Resolve organizations list
      const resolvedOrgs = orgs.map((org) => {
        // Find owner or members
        const orgMembers = memberships.filter((m) => m.org_id === org.id);
        const ownerMember = orgMembers.find((m) => m.role === 'owner') || orgMembers[0];
        const ownerUser = ownerMember ? userMap.get(ownerMember.user_id) : null;

        const orgBrands = brands.filter((b) => b.org_id === org.id);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          planType: org.plan_type,
          createdAt: org.created_at,
          ownerEmail: ownerUser ? ownerUser.email : 'Unknown',
          ownerUserId: ownerUser ? ownerUser.id : null,
          clientsCount: orgBrands.length,
          brands: orgBrands.map((b) => ({ brandKey: b.brand_key, displayName: b.display_name })),
        };
      });

      // Calculate MRR
      let totalMrr = 0;
      let activePaid = 0;
      let activeTrial = 0;
      for (const org of resolvedOrgs) {
        const price = PLAN_PRICES[org.planType] || 0;
        totalMrr += price;
        // In this basic version, we count all active orgs as paid for MRR calculations
        activePaid++;
      }

      return ok(res, {
        organizations: resolvedOrgs,
        stats: {
          totalOrgs: resolvedOrgs.length,
          mrr: totalMrr,
          totalClients: brands.length,
          activePaid,
          activeTrial,
        },
      });
    } catch (error) {
      console.error('[admin-api] fetch failed:', error?.message || error);
      return serverError(res, 'Could not retrieve admin dashboard data.');
    }
  }

  // ── POST: Actions ──────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, orgId, userId, planType, newPassword } = req.body || {};

    if (!action) {
      return badRequest(res, 'Missing action parameter.');
    }

    // A. Update Plan Type
    if (action === 'changePlan') {
      if (!orgId || !planType) {
        return badRequest(res, 'Missing orgId or planType.');
      }
      if (planType !== 'agency' && planType !== 'creator') {
        return badRequest(res, 'Invalid planType. Must be agency or creator.');
      }

      try {
        const response = await fetch(`${url}/rest/v1/organizations?id=eq.${encodeURIComponent(orgId)}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ plan_type: planType }),
        });

        if (!response.ok) {
          throw new Error(`Failed to patch organization: ${response.status}`);
        }
        return ok(res, { success: true });
      } catch (error) {
        console.error('[admin-api] changePlan failed:', error);
        return serverError(res, 'Failed to update plan.');
      }
    }

    // B. Reset User Password
    if (action === 'resetPassword') {
      if (!userId || !newPassword) {
        return badRequest(res, 'Missing userId or newPassword.');
      }
      if (String(newPassword).length < 6) {
        return badRequest(res, 'Password must be at least 6 characters.');
      }

      try {
        const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: newPassword }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`GoTrue admin API password reset failed: ${response.status} ${detail}`);
        }

        return ok(res, { success: true });
      } catch (error) {
        console.error('[admin-api] resetPassword failed:', error);
        return serverError(res, 'Failed to reset password.');
      }
    }

    // C. Delete Organization
    if (action === 'deleteOrg') {
      if (!orgId) {
        return badRequest(res, 'Missing orgId.');
      }

      try {
        const response = await fetch(`${url}/rest/v1/organizations?id=eq.${encodeURIComponent(orgId)}`, {
          method: 'DELETE',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete organization: ${response.status}`);
        }
        return ok(res, { success: true });
      } catch (error) {
        console.error('[admin-api] deleteOrg failed:', error);
        return serverError(res, 'Failed to delete organization.');
      }
    }

    return badRequest(res, 'Unknown action.');
  }

  return methodNotAllowed(res, 'GET, POST');
}
