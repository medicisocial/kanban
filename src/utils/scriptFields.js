export function hasStructuredScript(value) {
  return Boolean(
    String(value?.shootScriptHook || value?.scriptHook || '').trim() ||
      String(value?.shootScriptBody || value?.scriptBody || '').trim() ||
      String(value?.shootTextOverlays || value?.scriptOverlays || '').trim() ||
      String(value?.shootScript || value?.script || '').trim(),
  );
}

export function getStructuredScript(value) {
  const hook = String(value?.shootScriptHook || value?.scriptHook || '').trim();
  const structuredBody = String(value?.shootScriptBody || value?.scriptBody || '').trim();
  const legacyBody = String(value?.shootScript || value?.script || '').trim();
  const overlays = String(value?.shootTextOverlays || value?.scriptOverlays || '').trim();
  return {
    hook,
    body: structuredBody || legacyBody,
    overlays,
  };
}
