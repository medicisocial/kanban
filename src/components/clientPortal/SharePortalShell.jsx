import ClientPortalSectionHeader from './ClientPortalSectionHeader';

export default function SharePortalShell({ title, client, clientColor, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="portal-ambient pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <ClientPortalSectionHeader title={title} eyebrow={client} compact />
        {children}
      </div>
    </div>
  );
}
