const MAX_STACK = 30;
const DEFAULT_CAPTURE_DEBOUNCE_MS = 450;

let getSnapshot = null;
let applySnapshot = null;
let onStackChange = null;
let stack = [];
let suppressUndo = false;
let batchDepth = 0;
let batchCaptured = false;
let captureTimer = null;

export function registerUndo({ getSnapshot: get, applySnapshot: apply, onStackChange: onChange }) {
  getSnapshot = get;
  applySnapshot = apply;
  onStackChange = onChange;
}

export function unregisterUndo() {
  getSnapshot = null;
  applySnapshot = null;
  onStackChange = null;
  stack = [];
  clearTimeout(captureTimer);
  captureTimer = null;
  notifyStackChange();
}

function notifyStackChange() {
  onStackChange?.();
}

function captureNow() {
  if (suppressUndo || !getSnapshot) return;
  const snap = getSnapshot();
  stack = [...stack.slice(-(MAX_STACK - 1)), snap];
  notifyStackChange();
}

function scheduleCapture(debounceMs) {
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => {
    captureTimer = null;
    if (batchDepth > 0) {
      if (!batchCaptured) {
        captureNow();
        batchCaptured = true;
      }
      return;
    }
    captureNow();
  }, debounceMs);
}

/**
 * @param {{ recordUndo?: boolean, debounceMs?: number }} [options]
 */
export function notifyMutation(options = {}) {
  const recordUndo = options.recordUndo !== false;
  if (!recordUndo) return;

  const debounceMs =
    typeof options.debounceMs === 'number' ? options.debounceMs : DEFAULT_CAPTURE_DEBOUNCE_MS;

  if (suppressUndo || !getSnapshot) return;

  if (debounceMs <= 0) {
    if (batchDepth > 0) {
      if (!batchCaptured) {
        captureNow();
        batchCaptured = true;
      }
      return;
    }
    captureNow();
    return;
  }

  scheduleCapture(debounceMs);
}

export function beginBatch() {
  batchDepth += 1;
  if (batchDepth === 1) batchCaptured = false;
}

export function endBatch() {
  batchDepth = Math.max(0, batchDepth - 1);
  if (batchDepth === 0) batchCaptured = false;
}

export function runWithoutUndoCapture(fn) {
  suppressUndo = true;
  try {
    return fn();
  } finally {
    suppressUndo = false;
  }
}

export function undo() {
  if (!stack.length || !applySnapshot) return false;
  const snap = stack.pop();
  suppressUndo = true;
  try {
    applySnapshot(snap);
  } finally {
    suppressUndo = false;
  }
  notifyStackChange();
  return true;
}

export function canUndo() {
  return stack.length > 0;
}

export function clearUndoStack() {
  stack = [];
  clearTimeout(captureTimer);
  captureTimer = null;
  notifyStackChange();
}
