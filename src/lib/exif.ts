export interface ExifResult {
  takenAt?: number;
  lat?: number;
  lng?: number;
  make?: string;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;
const TAG_MAKE = 0x010f;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

interface TiffReader {
  view: DataView;
  little: boolean;
  base: number;
}

const u16 = (r: TiffReader, offset: number) => r.view.getUint16(r.base + offset, r.little);
const u32 = (r: TiffReader, offset: number) => r.view.getUint32(r.base + offset, r.little);
const ascii = (r: TiffReader, offset: number, count: number) => {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const c = r.view.getUint8(r.base + offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
};

type TagValue = string | Uint8Array | number[] | number;

function readTags(r: TiffReader, ifdOffset: number): Map<number, TagValue> {
  const tags = new Map<number, TagValue>();
  let count = 0;
  try {
    count = u16(r, ifdOffset);
  } catch {
    return tags;
  }
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    let tag = 0;
    let type = 0;
    let n = 0;
    let valueOffset = 0;
    try {
      tag = u16(r, entry);
      type = u16(r, entry + 2);
      n = u32(r, entry + 4);
      valueOffset = u32(r, entry + 8);
    } catch {
      break;
    }
    const size = type === 3 ? 2 : type === 4 ? 4 : 1;
    const byteLength = size * n;
    const dataOffset = byteLength <= 4 ? entry + 8 : valueOffset;
    try {
      if (type === 2) {
        tags.set(tag, ascii(r, dataOffset, n));
      } else if (type === 3 && n === 1) {
        tags.set(tag, u16(r, dataOffset));
      } else if (type === 4 && n === 1) {
        tags.set(tag, u32(r, dataOffset));
      } else {
        const bytes = new Uint8Array(r.view.buffer, r.view.byteOffset + r.base + dataOffset, Math.min(byteLength, 64));
        tags.set(tag, Array.from(bytes));
      }
    } catch {
      // Ignore malformed entries; other tags can still be useful.
    }
  }
  return tags;
}

function dmsToDecimal(values: number[]): number {
  return values[0] + values[1] / 60 + values[2] / 3600;
}

function readGps(r: TiffReader, offset: number): { lat?: number; lng?: number } {
  const tags = readTags(r, offset);
  const latRef = String(tags.get(TAG_GPS_LAT_REF) ?? '');
  const lngRef = String(tags.get(TAG_GPS_LNG_REF) ?? '');
  const rawLat = tags.get(TAG_GPS_LAT);
  const rawLng = tags.get(TAG_GPS_LNG);

  const readArray = (raw: TagValue | undefined): number[] | null => {
    if (!Array.isArray(raw) || raw.length < 24) return null;
    // 3 rationals x 8 bytes, values live inline in the tag value block for
    // most cameras but the array itself is a copy of the bytes. Re-read from
    // the original offset is not possible here, so decode the little/big
    // endian bytes from the copied array.
    const view = new DataView(Uint8Array.from(raw).buffer);
    const little = r.little;
    const vals = [0, 1, 2].map((i) => {
      const num = view.getUint32(i * 8, little);
      const den = view.getUint32(i * 8 + 4, little) || 1;
      return num / den;
    });
    return vals;
  };

  const latArr = readArray(rawLat);
  const lngArr = readArray(rawLng);
  let lat: number | undefined;
  let lng: number | undefined;
  if (latArr) lat = dmsToDecimal(latArr);
  if (lngArr) lng = dmsToDecimal(lngArr);
  if (lat != null && latRef === 'S') lat = -lat;
  if (lng != null && lngRef === 'W') lng = -lng;
  return { lat, lng };
}

function parseTiff(buffer: ArrayBuffer, tiffStart: number): ExifResult {
  if (tiffStart + 8 > buffer.byteLength) return {};
  const view = new DataView(buffer);
  const byteOrder = view.getUint16(tiffStart, false);
  const little = byteOrder === 0x4949;
  if (!little && byteOrder !== 0x4d4d) return {};
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return {};

  const reader: TiffReader = { view, little, base: tiffStart };
  const ifd0Offset = u32(reader, 4);
  const ifd0 = readTags(reader, ifd0Offset);
  const result: ExifResult = {};

  const make = ifd0.get(TAG_MAKE);
  if (typeof make === 'string') result.make = make;

  const exifOffset = ifd0.get(TAG_EXIF_IFD);
  if (typeof exifOffset === 'number') {
    const exif = readTags(reader, exifOffset);
    const raw = exif.get(TAG_DATETIME_ORIGINAL) ?? exif.get(TAG_DATETIME);
    if (typeof raw === 'string') {
      const parsed = parseExifDate(raw);
      if (parsed) result.takenAt = parsed;
    }
  }
  if (result.takenAt == null) {
    const raw = ifd0.get(TAG_DATETIME);
    if (typeof raw === 'string') {
      const parsed = parseExifDate(raw);
      if (parsed) result.takenAt = parsed;
    }
  }

  const gpsOffset = ifd0.get(TAG_GPS_IFD);
  if (typeof gpsOffset === 'number') {
    const gps = readGps(reader, gpsOffset);
    result.lat = gps.lat;
    result.lng = gps.lng;
  }
  return result;
}

/** "2025:05:02 14:22:31" -> local epoch ms (a camera clock is local by convention). */
export function parseExifDate(raw: string): number | undefined {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

function findExifChunk(bytes: Uint8Array): number {
  // Works for JPEG APP1 and for the Exif item embedded in HEIC/AVIF containers.
  for (let i = 0; i < bytes.length - 6; i += 1) {
    if (
      bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 &&
      bytes[i + 3] === 0x66 && bytes[i + 4] === 0 && bytes[i + 5] === 0
    ) {
      return i + 6;
    }
  }
  return -1;
}

export function parseExif(buffer: ArrayBuffer): ExifResult {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) return {};
  const start = findExifChunk(bytes);
  if (start < 0) return {};
  try {
    return parseTiff(buffer, start);
  } catch {
    return {};
  }
}

export function formatExifDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
