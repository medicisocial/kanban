/** Active OS file-picker sessions. */
let activePicks = 0;

/**
 * While the user has files waiting to confirm (name + Add), block background
 * sync/refetch so props cannot reset the editor mid-upload.
 */
let uploadWorkUntil = 0;
const UPLOAD_WORK_MS = 30 * 60 * 1000;

export function beginEditorFilePick() {
  activePicks += 1;
}

export function endEditorFilePick() {
  activePicks = Math.max(0, activePicks - 1);
}

/** Call when the user has pending uploads awaiting confirm. */
export function markEditorUploadWork() {
  uploadWorkUntil = Date.now() + UPLOAD_WORK_MS;
}

export function clearEditorUploadWork() {
  uploadWorkUntil = 0;
}

export function isEditorFilePickActive() {
  return activePicks > 0 || Date.now() < uploadWorkUntil;
}
