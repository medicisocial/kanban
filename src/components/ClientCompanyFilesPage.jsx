import { normalizeBusinessType } from '../utils/eventFormSchemas';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientCompanyFilesEditor from './clientPortal/ClientCompanyFilesEditor';
import ClientSpecialMenusEditor from './clientPortal/ClientSpecialMenusEditor';
import { surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientCompanyFilesPage({
  client,
  businessType = '',
  companyFiles = [],
  specialMenus = [],
  onSaveCompanyFiles,
  onSaveSpecialMenus,
  readOnly = false,
  embedded = false,
}) {
  const isHospitality = normalizeBusinessType(businessType) === 'Hospitality';

  const body = (
    <div className="max-w-3xl space-y-6">
      <section className={`${surfacePanelClass} overflow-hidden`}>
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold tracking-tight text-white">Brand assets</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/45">
            Branding kits, logos, and current menus — name each file and organize by folder.
          </p>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <ClientCompanyFilesEditor
            client={client}
            businessType={businessType}
            files={companyFiles}
            onSaveFiles={onSaveCompanyFiles}
            readOnly={readOnly}
          />
        </div>
      </section>

      {isHospitality && (
        <section className={`${surfacePanelClass} overflow-hidden`}>
          <div className="px-5 py-5 sm:px-6">
            <ClientSpecialMenusEditor
              client={client}
              specialMenus={specialMenus}
              onSaveSpecialMenus={onSaveSpecialMenus}
              readOnly={readOnly}
            />
          </div>
        </section>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section>
        {!readOnly && (
          <ClientPortalSectionHeader
            title="Brand assets"
            description="Upload branding assets, menus, and limited-time specials for your team."
          />
        )}
        {body}
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title={readOnly ? `${client} brand assets` : 'Brand assets'}
        description={
          isHospitality
            ? `Branding, current menus, and dated special menus for ${client}.`
            : `Branding kits, logos, and documents for ${client}.`
        }
      />
      {body}
    </section>
  );
}
