const MAX_STACK = 30;

let getSnapshot = null;
let applySnapshot = null;
let onStackChange = null;
let stack = [];
let suppressUndo = false;
let batchDepth = 0;
let batchCaptured = false;

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
  notifyStackChange();
}

function notifyStackChange() {
  onStackChange?.();
}

function capture() {
  if (suppressUndo || !getSnapshot) return;
  const snap = getSnapshot();
  stack = [...stack.slice(-(MAX_STACK - 1)), snap];
  notifyStackChange();
}

export function notifyMutation() {
  if (suppressUndo) return;
  if (batchDepth > 0) {
    if (!batchCaptured) {
      capture();
      batchCaptured = true;
    }
    return;
  }
  capture();
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
