import { useEffect, useState } from 'react';
import { loadSuperAdminSession, impersonateOrg } from '../utils/superAdminAuth';

export default function SuperAdminConsole({ onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ organizations: [], stats: { totalOrgs: 0, mrr: 0, totalClients: 0, activePaid: 0, activeTrial: 0 } });
  const [activeTab, setActiveTab] = useState('organizations');
  
  // Action Modals State
  const [editingPlanOrg, setEditingPlanOrg] = useState(null); // org object
  const [newPlanType, setNewPlanType] = useState('agency');
  const [resetPasswordUser, setResetPasswordUser] = useState(null); // { userId, email, orgName }
  const [newPassword, setNewPassword] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(null); // org object
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const adminSession = loadSuperAdminSession();

  const fetchAdminData = async () => {
    if (!adminSession) {
      setError('No admin session found.');
      setLoading(false);
      return;
    }

    try {
      const token = btoa(JSON.stringify(adminSession));
      const res = await fetch('/api/admin', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Request failed with status ${res.status}`);
      }

      const payload = await res.json();
      setData(payload);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load system admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleActionSubmit = async (event, actionType, payload) => {
    event.preventDefault();
    if (!adminSession) return;

    setSubmitting(true);
    setActionSuccess('');
    setError('');

    try {
      const token = btoa(JSON.stringify(adminSession));
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: actionType,
          ...payload,
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Action failed.');
      }

      setActionSuccess('Action completed successfully!');
      // Reset modal state
      setEditingPlanOrg(null);
      setResetPasswordUser(null);
      setNewPassword('');
      setDeletingOrg(null);

      // Refresh data
      await fetchAdminData();
    } catch (err) {
      setError(err?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImpersonate = (org) => {
    if (!org.ownerEmail || org.ownerEmail === 'Unknown') {
      alert('Cannot impersonate an organization with an unknown owner.');
      return;
    }
    
    // Set mock session on frontend
    impersonateOrg(org, org.ownerEmail, adminSession);
    
    // Hard reload the page to clear states and load StaffConsole in impersonation mode
    window.location.href = window.location.pathname;
  };

  const filteredOrgs = data.organizations.filter((org) => {
    const query = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(query) ||
      org.slug.toLowerCase().includes(query) ||
      org.ownerEmail.toLowerCase().includes(query) ||
      org.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-600 selection:text-white">
      {/* Top Header */}
      <header className="z-10 shrink-0 px-6 py-4 md:px-10 md:py-5 border-b border-white/[0.08] flex items-center justify-between bg-black/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <img
            src="/medici-social-logo-nav.png"
            alt="Medici Social"
            className="h-5 w-auto object-contain opacity-90"
          />
          <span className="h-4 w-px bg-white/20" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] bg-red-950 border border-red-700/50 text-red-400 px-2 py-0.5 rounded">
            SUPER ADMIN
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="text-xs text-white/55 hover:text-white transition-colors flex items-center gap-1.5"
        >
          Sign Out
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-10">
        {error && (
          <div className="mb-6 p-4 rounded bg-red-950/60 border border-red-700/50 text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white text-xs ml-4">Dismiss</button>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-200 text-sm flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-white text-xs ml-4">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            <p className="mt-4 text-sm text-white/40 uppercase tracking-[0.2em]">Loading platform metrics...</p>
          </div>
        ) : (
          <>
            {/* Stats Dashboard Grid */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded p-5">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 block">Estimated MRR</span>
                <span className="text-3xl font-semibold mt-2 block">${data.stats.mrr}</span>
                <span className="text-[10px] text-white/30 block mt-1">Based on active plan pricing</span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded p-5">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 block">Organizations</span>
                <span className="text-3xl font-semibold mt-2 block">{data.stats.totalOrgs}</span>
                <span className="text-[10px] text-white/30 block mt-1">Total Creator & Agency accounts</span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded p-5">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 block">Client Brands</span>
                <span className="text-3xl font-semibold mt-2 block">{data.stats.totalClients}</span>
                <span className="text-[10px] text-white/30 block mt-1">Active customer portals</span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded p-5">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 block">Database Status</span>
                <span className="text-lg font-semibold mt-3 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Connected
                </span>
                <span className="text-[10px] text-white/30 block mt-1">Supabase service-role active</span>
              </div>
            </section>

            {/* Navigation Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-4 mb-6 gap-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('organizations')}
                  className={`text-xs uppercase tracking-[0.2em] pb-1 font-semibold transition-all ${
                    activeTab === 'organizations'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/45 hover:text-white/80'
                  }`}
                >
                  Organizations
                </button>
                <button
                  onClick={() => setActiveTab('portals')}
                  className={`text-xs uppercase tracking-[0.2em] pb-1 font-semibold transition-all ${
                    activeTab === 'portals'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/45 hover:text-white/80'
                  }`}
                >
                  Client Portals
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search directory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/[0.05] border border-white/10 rounded px-4 py-2 text-sm outline-none w-full md:w-64 focus:border-white/30 transition-all placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Organizations View */}
            {activeTab === 'organizations' && (
              <div className="overflow-x-auto border border-white/[0.08] rounded bg-white/[0.01]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Workspace Name</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Owner Email</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Plan Type</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Clients</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Signup Date</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-white/40">
                          No organizations found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((org) => (
                        <tr key={org.id} className="border-b border-white/[0.05] hover:bg-white/[0.01] transition-colors">
                          <td className="p-4">
                            <span className="font-medium text-white block">{org.name}</span>
                            <span className="text-[10px] text-white/30 font-mono block mt-0.5">{org.id}</span>
                          </td>
                          <td className="p-4 text-white/70 font-mono text-xs">{org.ownerEmail}</td>
                          <td className="p-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.1em] ${
                              org.planType === 'agency' || org.planType === 'agency_pro' || org.planType === 'agency_scale'
                                ? 'bg-purple-950 border border-purple-800 text-purple-300'
                                : 'bg-blue-950 border border-blue-800 text-blue-300'
                            }`}>
                              {org.planType}
                            </span>
                          </td>
                          <td className="p-4 text-white/80">{org.clientsCount}</td>
                          <td className="p-4 text-white/50 text-xs">{new Date(org.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleImpersonate(org)}
                              className="text-xs bg-white text-black px-2.5 py-1 rounded font-medium hover:bg-white/85 transition"
                            >
                              Impersonate
                            </button>
                            <button
                              onClick={() => {
                                setEditingPlanOrg(org);
                                setNewPlanType(org.planType === 'creator' ? 'creator' : 'agency');
                              }}
                              className="text-xs border border-white/10 hover:border-white/30 px-2.5 py-1 rounded text-white/80 hover:text-white transition"
                            >
                              Change Plan
                            </button>
                            {org.ownerUserId && (
                              <button
                                onClick={() => setResetPasswordUser({ userId: org.ownerUserId, email: org.ownerEmail, orgName: org.name })}
                                className="text-xs border border-white/10 hover:border-white/30 px-2.5 py-1 rounded text-white/80 hover:text-white transition"
                              >
                                PW Reset
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingOrg(org)}
                              className="text-xs bg-red-950 hover:bg-red-900 border border-red-800/40 hover:border-red-700 text-red-300 px-2.5 py-1 rounded transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Client Portals View */}
            {activeTab === 'portals' && (
              <div className="overflow-x-auto border border-white/[0.08] rounded bg-white/[0.01]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Brand Key</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Display Name</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Workspace Name (Org ID)</th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.organizations.flatMap((o) => (o.brands || []).map((b) => ({ ...b, orgName: o.name, orgId: o.id }))).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-white/40">
                          No client portals configured.
                        </td>
                      </tr>
                    ) : (
                      data.organizations
                        .flatMap((o) => (o.brands || []).map((b) => ({ ...b, orgName: o.name, orgId: o.id })))
                        .filter((brand) => brand.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || brand.brandKey.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((brand) => (
                          <tr key={`${brand.orgId}-${brand.brandKey}`} className="border-b border-white/[0.05] hover:bg-white/[0.01] transition-colors">
                            <td className="p-4 font-mono text-xs text-white/80">{brand.brandKey}</td>
                            <td className="p-4 text-white font-medium">{brand.displayName}</td>
                            <td className="p-4 text-white/60">
                              <span>{brand.orgName}</span>
                              <span className="text-[10px] font-mono block text-white/30">{brand.orgId}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-xs text-white/35">Manage portal credentials from Impersonation view</span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODALS */}
      {/* 1. Edit Plan Modal */}
      {editingPlanOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={(e) => handleActionSubmit(e, 'changePlan', { orgId: editingPlanOrg.id, planType: newPlanType })}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold uppercase tracking-wider text-white">Change Plan Limit</h3>
            <p className="text-xs text-white/50">
              Update the subscription tier for workspace <strong>{editingPlanOrg.name}</strong>.
            </p>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                Plan Tier
              </label>
              <select
                value={newPlanType}
                onChange={(e) => setNewPlanType(e.target.value)}
                className="w-full bg-black border border-white/10 text-white rounded p-2.5 text-sm focus:border-white/30 outline-none"
              >
                <option value="creator">Creator (starter)</option>
                <option value="agency">Agency (pro/scale)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setEditingPlanOrg(null)}
                className="text-xs px-4 py-2 border border-white/10 hover:border-white/20 rounded text-white/70 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs bg-white text-black font-semibold px-4 py-2 rounded hover:bg-white/80 transition disabled:opacity-40"
              >
                {submitting ? 'Updating...' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={(e) => handleActionSubmit(e, 'resetPassword', { userId: resetPasswordUser.userId, newPassword })}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold uppercase tracking-wider text-white">Reset Owner Password</h3>
            <p className="text-xs text-white/50">
              Directly set a new password for owner <strong>{resetPasswordUser.email}</strong> of organization <strong>{resetPasswordUser.orgName}</strong>.
            </p>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-black border border-white/10 text-white rounded p-2.5 text-sm focus:border-white/30 outline-none placeholder:text-white/20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword('');
                }}
                className="text-xs px-4 py-2 border border-white/10 hover:border-white/20 rounded text-white/70 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs bg-white text-black font-semibold px-4 py-2 rounded hover:bg-white/80 transition disabled:opacity-40"
              >
                {submitting ? 'Resetting...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Delete Org Modal */}
      {deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={(e) => handleActionSubmit(e, 'deleteOrg', { orgId: deletingOrg.id })}
            className="w-full max-w-md bg-zinc-900 border border-red-800/40 rounded p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold uppercase tracking-wider text-red-400">Delete Workspace</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Are you sure you want to delete the organization <strong>{deletingOrg.name}</strong>?
            </p>
            <div className="p-3 bg-red-950/40 border border-red-700/30 text-red-200 text-xs rounded">
              <strong>Warning:</strong> This will delete all user memberships, client records, boards, cards, and associated files. This action is permanent and cannot be undone.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDeletingOrg(null)}
                className="text-xs px-4 py-2 border border-white/10 hover:border-white/20 rounded text-white/70 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs bg-red-600 text-white font-semibold px-4 py-2 rounded hover:bg-red-500 transition disabled:opacity-40"
              >
                {submitting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
