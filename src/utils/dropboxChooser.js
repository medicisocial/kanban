const DROPINS_SRC = 'https://www.dropbox.com/static/api/2/dropins.js';
const SCRIPT_ID = 'dropboxjs';

export function getDropboxAppKey() {
  return String(import.meta.env.VITE_DROPBOX_APP_KEY || '').trim();
}

export function isDropboxChooserConfigured() {
  return Boolean(getDropboxAppKey());
}

function loadDropinsScript(appKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Dropbox Chooser is only available in the browser.'));
  }

  if (window.Dropbox?.choose) {
    return Promise.resolve(window.Dropbox);
  }

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (window.Dropbox?.choose) {
          resolve(window.Dropbox);
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Dropbox Chooser script timed out.'));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = DROPINS_SRC;
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.appKey = appKey;
    script.onload = () => {
      if (window.Dropbox?.choose) resolve(window.Dropbox);
      else reject(new Error('Dropbox Chooser failed to initialize.'));
    };
    script.onerror = () => reject(new Error('Failed to load Dropbox Chooser.'));
    document.head.appendChild(script);
  });
}

/**
 * Opens the Dropbox Chooser and resolves with a preview share link.
 * Must be called from a user gesture (click) so the popup is not blocked.
 */
export function chooseDropboxFile({
  linkType = 'preview',
  extensions = ['video'],
  folderselect = false,
  multiselect = false,
} = {}) {
  const appKey = getDropboxAppKey();
  if (!appKey) {
    return Promise.reject(new Error('Dropbox is not configured (missing VITE_DROPBOX_APP_KEY).'));
  }

  return loadDropinsScript(appKey).then(
    (Dropbox) =>
      new Promise((resolve, reject) => {
        try {
          Dropbox.choose({
            success: (files) => {
              const link = files?.[0]?.link;
              if (!link) {
                reject(new Error('No file selected.'));
                return;
              }
              resolve(String(link));
            },
            cancel: () => reject(new Error('cancelled')),
            linkType,
            multiselect,
            folderselect,
            extensions,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }),
  );
}
