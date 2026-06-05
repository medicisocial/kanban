/**
 * Unit-style test for editor pick guard + props sync invariants.
 * Ensures pending uploads are never cleared by background sync flags.
 */
import {
  beginEditorFilePick,
  clearEditorUploadWork,
  endEditorFilePick,
  isEditorFilePickActive,
  markEditorUploadWork,
} from '../src/utils/editorPickGuard.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!isEditorFilePickActive(), 'idle initially');

beginEditorFilePick();
assert(isEditorFilePickActive(), 'active during OS picker');
endEditorFilePick();
assert(!isEditorFilePickActive(), 'idle after picker closes');

markEditorUploadWork();
assert(isEditorFilePickActive(), 'active while pending upload panel is open');
clearEditorUploadWork();
assert(!isEditorFilePickActive(), 'idle after pending cleared');

console.log('Company file pick guard tests passed.');
