import type { FingerprintReader } from '../../domain/ports';

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * Content hash used to detect duplicate imports. SHA-256 when SubtleCrypto is available;
 * otherwise a deliberately weak metadata fingerprint is returned so the caller can mark it.
 */
export class BrowserFingerprintReader implements FingerprintReader {
  async hash(file: File): Promise<{ hash: string; weak: boolean }> {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      try {
        const digest = await subtle.digest('SHA-256', await file.arrayBuffer());
        return { hash: `sha256:${toHex(digest)}`, weak: false };
      } catch {
        // Insecure context or blocked digest: fall through to the weak fingerprint.
      }
    }
    const meta = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    let value = 0x811c9dc5;
    for (let index = 0; index < meta.length; index += 1) {
      value ^= meta.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return { hash: `weak:${value.toString(16)}:${file.size}`, weak: true };
  }
}
