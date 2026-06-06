import { useState } from 'react';
import { canPreviewFile, downloadDataUrl } from '../../utils/filePreview';
import FilePreviewModal from './FilePreviewModal';

const actionBtnClass =
  'px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-200';

const primaryActionClass = `${actionBtnClass} text-violet-300 hover:bg-white/[0.05] hover:text-violet-200`;
const removeActionClass = `${actionBtnClass} text-white/45 hover:bg-rose-500/10 hover:text-rose-300`;

export default function FilePreviewActions({
  title,
  dataUrl,
  fileName,
  previewLabel = 'Preview',
  downloadLabel = 'Download',
  removeLabel = 'Remove',
  onRemove,
  className = '',
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const showPreview = canPreviewFile(dataUrl, fileName);

  return (
    <>
      <div
        className={`inline-flex shrink-0 flex-wrap items-stretch overflow-hidden rounded-sm border border-white/10 bg-white/[0.03] divide-x divide-white/10 ${className}`}
      >
        {showPreview && (
          <button type="button" onClick={() => setPreviewOpen(true)} className={primaryActionClass}>
            {previewLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadDataUrl(dataUrl, fileName || title)}
          className={primaryActionClass}
        >
          {downloadLabel}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className={removeActionClass}>
            {removeLabel}
          </button>
        )}
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
