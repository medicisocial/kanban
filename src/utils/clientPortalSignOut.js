export const CLIENT_SIGNED_OUT_KEY = 'medici-client-signed-out';

export function markClientSignedOut() {
  try {
    sessionStorage.setItem(CLIENT_SIGNED_OUT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearClientSignedOut() {
  try {
    sessionStorage.removeItem(CLIENT_SIGNED_OUT_KEY);
  } catch {
    /* ignore */
  }
}

export function isClientSignedOut() {
  try {
    return sessionStorage.getItem(CLIENT_SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function shouldSuppressClientAutoRestore() {
  return isClientSignedOut();
}
