import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { unauthorized, unavailable } from './_lib/apiResponse.mjs';

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!isStaffSessionValid(session)) {
    return unauthorized(res, 'Unauthorized');
  }

  // The Redis/Upstash workspace path has been removed.
  // All workspace data is now served through /api/staff-sync which reads from Supabase.
  return unavailable(res, 'Cloud sync is not configured. Add Supabase to your Vercel project, then redeploy.');
}
