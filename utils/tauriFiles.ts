import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

let appDataRoot: string | null = null;

const folders = ['covers', 'images', 'page-assets', 'thumbnails'] as const;
type StoredFolder = (typeof folders)[number];
const safeRelativePath = (path: string) =>
  (() => {
    const parts = path.split('/');
    return parts.length === 2 &&
      folders.includes(parts[0] as StoredFolder) &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/.test(parts[1]);
  })();
export const isTauriDevelopmentRuntime = () => typeof window !== 'undefined' &&
  window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1' &&
  window.location.port === '1431' && isTauri();
export const logImageDebug = (stage: string, detail: Record<string, unknown> = {}) => {
  if (__DEV__ || isTauriDevelopmentRuntime()) console.info('[Notex image-debug]', stage, detail);
};
const safeFileName = (path: string) => path.split(/[\\/]/).pop() ?? 'unknown';
const imageMimeType = (bytes: Uint8Array) => {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
};

export const isTauriDesktop = () => isTauri();
export const isStoredAppDataPath = (path: string) => safeRelativePath(path);

export async function initializeTauriFiles(root: string) {
  appDataRoot = root;
}

function requireRoot() {
  if (!appDataRoot) throw new Error('Notex dosya alanı henüz başlatılmadı.');
  return appDataRoot;
}

async function storedAbsolutePath(relativePath: string) {
  if (!safeRelativePath(relativePath)) throw new Error('Geçersiz Notex dosya yolu.');
  return join(requireRoot(), ...relativePath.split('/'));
}

function makeName(folder: StoredFolder, extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '');
  if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)) {
    throw new Error('Bu görsel biçimi desteklenmiyor.');
  }
  return `${folder}/${crypto.randomUUID()}.${ext}`;
}

function extensionFromPath(path: string) {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match?.[1] ?? 'png';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export function imageDebugError(error: unknown) {
  return errorMessage(error)
    .replace(/[A-Za-z]:\\[^\s"'<>]*/g, '<local-path>')
    .replace(/\\\\[^\s"'<>]*/g, '<network-path>')
    .slice(0, 240);
}

export function storedFileAssetUri(relativePath: string | null | undefined) {
  if (!relativePath || !safeRelativePath(relativePath) || !appDataRoot) return null;
  const absolute = `${appDataRoot.replace(/[\\/]$/, '')}/${relativePath.replace(/\//g, '\\')}`;
  return convertFileSrc(absolute);
}

export function resolveCoverRenderUri(uri: string | null | undefined) {
  if (!uri) return null;
  if (!isTauriDesktop() || !safeRelativePath(uri)) return uri;
  return storedFileAssetUri(uri);
}

export async function pickImagePath() {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Görsel dosyaları', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function pickCanvasImagePath() {
  logImageDebug('file_picker_started');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'PNG, JPEG, WebP', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  const path = typeof selected === 'string' ? selected : null;
  logImageDebug('file_picker_completed', { selected: !!path, name: path ? safeFileName(path) : undefined });
  return path;
}

export async function pickAndStoreImage(folder: 'covers' | 'images') {
  const selected = await pickImagePath();
  if (!selected) return null;
  return storeSelectedImage(selected, folder);
}

export async function storeSelectedImage(sourcePath: string, folder: 'covers' | 'images') {
  let relativePath: string | null = null;
  try {
    relativePath = makeName(folder, extensionFromPath(sourcePath));
    if (folder === 'images') {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      logImageDebug('selected_asset_read_started', { name: safeFileName(sourcePath), format: extensionFromPath(sourcePath).toLowerCase() });
      const response = await fetch(convertFileSrc(sourcePath));
      if (!response.ok) throw new Error(`Seçilen dosya okunamadı (HTTP ${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength) throw new Error('Seçilen dosya boş.');
      logImageDebug('selected_asset_read_succeeded', { name: safeFileName(sourcePath), sizeBytes: bytes.byteLength, format: extensionFromPath(sourcePath).toLowerCase() });
      await writeFile(await storedAbsolutePath(relativePath), bytes);
      logImageDebug('app_storage_write_succeeded', { sizeBytes: bytes.byteLength, format: extensionFromPath(sourcePath).toLowerCase() });
    } else {
      const { copyFile } = await import('@tauri-apps/plugin-fs');
      await copyFile(sourcePath, await storedAbsolutePath(relativePath));
    }
    return relativePath;
  } catch (error) {
    if (folder === 'images') logImageDebug('image_asset_persist_failed', { name: safeFileName(sourcePath), error: imageDebugError(error) });
    if (relativePath) await deleteStoredFile(relativePath).catch(() => {});
    throw new Error(`Görsel Notex'in yerel dosya alanına aktarılamadı: ${errorMessage(error)}`);
  }
}

export async function copyStoredFile(sourcePath: string, folder: StoredFolder) {
  try {
    const { copyFile } = await import('@tauri-apps/plugin-fs');
    const relativePath = makeName(folder, extensionFromPath(sourcePath));
    await copyFile(await storedAbsolutePath(sourcePath), await storedAbsolutePath(relativePath));
    return relativePath;
  } catch (error) {
    throw new Error(`Kayıtlı Notex görseli kopyalanamadı: ${errorMessage(error)}`);
  }
}

export async function readStoredFile(relativePath: string) {
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(await storedAbsolutePath(relativePath));
    if (relativePath.startsWith('images/')) logImageDebug('stored_file_read_succeeded', { sizeBytes: bytes.byteLength, format: extensionFromPath(relativePath).toLowerCase() });
    return bytes;
  } catch (error) {
    if (relativePath.startsWith('images/')) logImageDebug('stored_file_read_failed', { format: extensionFromPath(relativePath).toLowerCase(), error: imageDebugError(error) });
    throw new Error(`Notex görsel dosyası okunamadı (${relativePath}): ${errorMessage(error)}`);
  }
}

export async function writeStoredFile(relativePath: string, bytes: Uint8Array) {
  try {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(await storedAbsolutePath(relativePath), bytes);
  } catch (error) {
    throw new Error(`Görsel Notex'in yerel dosya alanına kaydedilemedi (${relativePath}): ${errorMessage(error)}`);
  }
}

export async function restoreBackupAsset(originalPath: string, bytes: Uint8Array) {
  const prefix = originalPath.split('/')[0];
  const folder: StoredFolder = folders.includes(prefix as StoredFolder) ? prefix as StoredFolder : 'covers';
  const relativePath = makeName(folder, extensionFromPath(originalPath));
  await writeStoredFile(relativePath, bytes);
  return relativePath;
}

export async function deleteStoredFile(relativePath: string) {
  const { remove } = await import('@tauri-apps/plugin-fs');
  const path = await storedAbsolutePath(relativePath);
  const { exists } = await import('@tauri-apps/plugin-fs');
  if (await exists(path)) await remove(path);
}

export async function storedFileExists(relativePath: string) {
  const { exists } = await import('@tauri-apps/plugin-fs');
  return exists(await storedAbsolutePath(relativePath));
}

export async function imageDimensions(relativePath: string): Promise<{ width: number; height: number; mime: string; sizeBytes: number }> {
  if (!safeRelativePath(relativePath) || typeof Image === 'undefined') throw new Error('Görsel boyutları okunamadı.');
  const bytes = await readStoredFile(relativePath);
  const mime = imageMimeType(bytes);
  if (!mime) {
    logImageDebug('file_format_rejected', { name: safeFileName(relativePath), sizeBytes: bytes.byteLength });
    throw new Error('Seçilen dosyanın içeriği PNG, JPG veya WebP değil.');
  }
  logImageDebug('file_metadata', { name: safeFileName(relativePath), mime, sizeBytes: bytes.byteLength });
  const objectUrl = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
  return new Promise<{ width: number; height: number; mime: string; sizeBytes: number }>((resolve, reject) => {
    const image = new Image();
    const finish = (callback: () => void) => {
      URL.revokeObjectURL(objectUrl);
      callback();
    };
    image.onload = () => finish(() => {
      logImageDebug('browser_image_decode_succeeded', { width: image.naturalWidth, height: image.naturalHeight, mime });
      resolve({ width: image.naturalWidth, height: image.naturalHeight, mime, sizeBytes: bytes.byteLength });
    });
    image.onerror = () => finish(() => {
      logImageDebug('browser_image_decode_failed', { mime, sizeBytes: bytes.byteLength });
      reject(new Error('Seçilen görsel açılamadı.'));
    });
    image.src = objectUrl;
  });
}

export async function saveDesktopBackup(bytes: Uint8Array, suggestedName: string) {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { confirm } = await import('@tauri-apps/plugin-dialog');
  const { exists, writeFile } = await import('@tauri-apps/plugin-fs');
  const path = await save({
    title: 'Notex yedeğini kaydet',
    defaultPath: suggestedName,
    filters: [{ name: 'Notex yedeği', extensions: ['notex'] }],
  });
  if (!path) return false;
  if (await exists(path) && !(await confirm('Seçilen dosya zaten var. Üzerine yazmak istiyor musun?', { title: 'Dosyanın üzerine yaz', kind: 'warning' }))) return false;
  try {
    await writeFile(path, bytes);
  } catch (error) {
    throw new Error(`.notex yedeği seçilen konuma kaydedilemedi: ${errorMessage(error)}`);
  }
  return true;
}

export async function pickDesktopBackup() {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Notex yedeği', extensions: ['notex', 'zip'] }],
  });
  if (typeof path !== 'string') return null;
  try {
    return { path, bytes: await readFile(path) };
  } catch (error) {
    throw new Error(`Seçilen .notex yedeği okunamadı: ${errorMessage(error)}`);
  }
}
