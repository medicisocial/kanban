import { useEffect } from 'react';
import { btnSecondaryClass } from './clientPortal/clientPortalUi';
import { getPreviewWindowId } from '../utils/filePreviewWindow';

export default function FilePreviewWindowApp() {
  const previewId = getPreviewWindowId();

  useEffect(() => {
    window.location.replace('/');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <div>
        <p className="text-sm text-white/55">
          {previewId
            ? 'This preview link has expired. Returning you to the portal…'
            : 'Returning you to the portal…'}
        </p>
        <a href="/" className={`${btnSecondaryClass} mt-4 inline-flex`}>
          Go to portal now
        </a>
      </div>
    </div>
  );
}
