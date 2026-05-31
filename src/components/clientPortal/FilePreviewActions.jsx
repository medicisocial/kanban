import { useState } from 'react';
import { canPreviewFile, downloadDataUrl } from '../../utils/filePreview';
import FilePreviewModal from './FilePreviewModal';

const actionClass =
  'text-[10px] font-medium uppercase tracking-wider text-violet-300 underline-offset-2 hover:underline';

export default function FilePreviewActions({
  title,
  dataUrl,
  fileName,
  previewLabel = 'Preview',
  downloadLabel = 'Download',
  className = '',
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const showPreview = canPreviewFile(dataUrl, fileName);

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {showPreview && (
          <button type="button" onClick={() => setPreviewOpen(true)} className={actionClass}>
            {previewLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadDataUrl(dataUrl, fileName || title)}
          className={actionClass}
        >
          {downloadLabel}
        </button>
      </div>
      {previewOpen && (
        <FilePreviewModal
          open={previewOpen}
          title={title}
          dataUrl={dataUrl}
          fileName={fileName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
