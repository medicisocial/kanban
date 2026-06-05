/** Active file-picker sessions — used to pause background sync/refetch while open. */
let activePicks = 0;

export function beginEditorFilePick() {
  activePicks += 1;
}

export function endEditorFilePick() {
  activePicks = Math.max(0, activePicks - 1);
}

export function isEditorFilePickActive() {
  return activePicks > 0;
}
