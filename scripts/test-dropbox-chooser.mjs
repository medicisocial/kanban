import { readFileSync } from 'fs';

const source = readFileSync(new URL('../src/utils/dropboxChooser.js', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes('VITE_DROPBOX_APP_KEY'), 'dropboxChooser reads VITE_DROPBOX_APP_KEY');
assert(source.includes('Dropbox.choose'), 'dropboxChooser calls Dropbox.choose');
assert(source.includes("linkType = 'preview'"), 'default linkType is preview share link');
assert(source.includes("extensions = ['video']"), 'default filter is video');
assert(modal.includes('chooseDropboxFile'), 'CardModal imports chooseDropboxFile');
assert(modal.includes('Choose from Dropbox'), 'CardModal shows Choose from Dropbox button');
assert(modal.includes('isDropboxChooserConfigured'), 'CardModal gates button on config');

console.log('test-dropbox-chooser: ok');
