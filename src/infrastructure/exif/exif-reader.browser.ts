import type { ExifData, ExifReader } from '../../domain/ports';
import { offsetFromLongitude } from '../../domain/geo/geo-point';

const TAG_ORIENTATION = 0x0112;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TAG_OFFSET_TIME = 0x9010;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

/** EXIF usually sits near the start; read a slice first and only fall back for large files. */
const EXIF_HEAD_BYTES = 2 * 1024 * 1024;

type TagValue = string | number | number[];

interface TiffReader {
  view: DataView;
  little: boolean;
  base: number;
}

const u16 = (reader: TiffReader, offset: number): number => reader.view.getUint16(reader.base + offset, reader.little);
const u32 = (reader: TiffReader, offset: number): number => reader.view.getUint32(reader.base + offset, reader.little);

function ascii(reader: TiffReader, offset: number, count: number): string {
  let out = '';
  const limit = Math.min(count, 512);
  for (let index = 0; index < limit; index += 1) {
    const code = reader.view.getUint8(reader.base + offset + index);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function readRational(reader: TiffReader, offset: number, count: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const numerator = u32(reader, offset + index * 8);
    const denominator = u32(reader, offset + index * 8 + 4);
    values.push(denominator === 0 ? 0 : numerator / denominator);
  }
  return values;
}

function readTags(reader: TiffReader, ifdOffset: number): Map<number, TagValue> {
  const tags = new Map<number, TagValue>();
  let count = 0;
  try {
    count = u16(reader, ifdOffset);
  } catch {
    return tags;
  }
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    try {
      const tag = u16(reader, entry);
      const type = u16(reader, entry + 2);
      const items = u32(reader, entry + 4);
      const valueOffset = u32(reader, entry + 8);
      const itemSize = type === 3 ? 2 : type === 4 ? 4 : type === 5 ? 8 : 1;
      const byteLength = itemSize * items;
      const dataOffset = byteLength <= 4 ? entry + 8 : valueOffset;
      if (type === 2) {
        tags.set(tag, ascii(reader, dataOffset, items));
      } else if (type === 3 && items === 1) {
        tags.set(tag, u16(reader, dataOffset));
      } else if (type === 4 && items === 1) {
        tags.set(tag, u32(reader, dataOffset));
      } else if (type === 5) {
        tags.set(tag, readRational(reader, dataOffset, Math.min(items, 4)));
      }
    } catch {
      // Malformed entry: keep reading the remaining tags.
    }
  }
  return tags;
}

function parseExifDate(raw: string): number | null {
  const match = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  if (!year || !month || !day || !hour || !minute) return null;
  const value = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );
  return Number.isFinite(value) ? value : null;
}

function parseOffset(raw: string): number | null {
  const match = /^([+-])(\d{2}):?(\d{2})?$/.exec(raw.trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const total = sign * (hours * 60 + minutes);
  return total >= -720 && total <= 840 ? total : null;
}

interface HeicMetadata {
  capturedAt: number | null;
  source: 'exif-original' | 'exif-datetime' | null;
  offsetMinutes: number | null;
  geo: { lat: number; lng: number } | null;
  orientation: number | null;
}

/**
 * The built-in TIFF/JPEG/PNG/WebP parser cannot reach HEIC's metadata box.
 * Load exifr only for HEIC/HEIF and only when the fast path found nothing useful.
 */
async function readHeicMetadata(buffer: ArrayBuffer): Promise<HeicMetadata | null> {
  try {
    const { default: exifr } = await import('exifr');
    const data = (await exifr.parse(buffer, {
      gps: true,
      exif: true,
      tiff: true,
      translateValues: false,
      reviveValues: false,
    })) as Record<string, unknown> | undefined;
    if (!data) return null;
    const rawDate =
      typeof data.DateTimeOriginal === 'string'
        ? data.DateTimeOriginal
        : typeof data.CreateDate === 'string'
          ? data.CreateDate
          : typeof data.ModifyDate === 'string'
            ? data.ModifyDate
            : null;
    const source = rawDate
      ? typeof data.DateTimeOriginal === 'string'
        ? 'exif-original'
        : 'exif-datetime'
      : null;
    const rawOffset =
      typeof data.OffsetTimeOriginal === 'string'
        ? data.OffsetTimeOriginal
        : typeof data.OffsetTime === 'string'
          ? data.OffsetTime
          : typeof data.OffsetTimeDigitized === 'string'
            ? data.OffsetTimeDigitized
            : null;
    const lat = typeof data.latitude === 'number' ? data.latitude : null;
    const lng = typeof data.longitude === 'number' ? data.longitude : null;
    const validGeo =
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0);
    return {
      capturedAt: rawDate ? parseExifDate(rawDate) : null,
      source,
      offsetMinutes: rawOffset ? parseOffset(rawOffset) : null,
      geo: validGeo ? { lat, lng } : null,
      orientation:
        typeof data.Orientation === 'number' ? data.Orientation : null,
    };
  } catch {
    return null;
  }
}

interface ParsedTiff {
  capturedAt: number | null;
  source: 'exif-original' | 'exif-datetime' | null;
  offsetMinutes: number | null;
  geo: { lat: number; lng: number } | null;
  orientation: number | null;
}

export function parseTiff(view: DataView, base: number): ParsedTiff {
  const byteOrder = view.getUint16(base);
  const little = byteOrder === 0x4949;
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) {
    return { capturedAt: null, source: null, offsetMinutes: null, geo: null, orientation: null };
  }
  const reader: TiffReader = { view, little, base };
  const ifd0 = readTags(reader, u32(reader, 4));
  const orientationValue = ifd0.get(TAG_ORIENTATION);
  const orientation = typeof orientationValue === 'number' ? orientationValue : null;

  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  const exifTags = typeof exifPointer === 'number' ? readTags(reader, exifPointer) : new Map<number, TagValue>();
  const gpsPointer = ifd0.get(TAG_GPS_IFD);
  const gpsTags = typeof gpsPointer === 'number' ? readTags(reader, gpsPointer) : new Map<number, TagValue>();

  const original = exifTags.get(TAG_DATETIME_ORIGINAL);
  const fallback = ifd0.get(TAG_DATETIME);
  let capturedAt: number | null = null;
  let source: ParsedTiff['source'] = null;
  if (typeof original === 'string') {
    capturedAt = parseExifDate(original);
    if (capturedAt !== null) source = 'exif-original';
  }
  if (capturedAt === null && typeof fallback === 'string') {
    capturedAt = parseExifDate(fallback);
    if (capturedAt !== null) source = 'exif-datetime';
  }

  const offsetRaw = exifTags.get(TAG_OFFSET_TIME_ORIGINAL) ?? exifTags.get(TAG_OFFSET_TIME);
  const offset = typeof offsetRaw === 'string' ? parseOffset(offsetRaw) : null;

  const latValues = gpsTags.get(TAG_GPS_LAT);
  const lngValues = gpsTags.get(TAG_GPS_LNG);
  const latRef = gpsTags.get(TAG_GPS_LAT_REF);
  const lngRef = gpsTags.get(TAG_GPS_LNG_REF);
  let geo: { lat: number; lng: number } | null = null;
  if (Array.isArray(latValues) && Array.isArray(lngValues) && latValues.length >= 3 && lngValues.length >= 3) {
    const toDegrees = (parts: number[]): number => (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
    const lat = toDegrees(latValues) * (latRef === 'S' ? -1 : 1);
    const lng = toDegrees(lngValues) * (lngRef === 'W' ? -1 : 1);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
      geo = { lat, lng };
    }
  }

  return { capturedAt, source, offsetMinutes: offset, geo, orientation };
}

function jpegExifPayload(bytes: Uint8Array): DataView | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break;
    const length = view.getUint16(offset + 2);
    if (length < 2) break;
    if (marker === 0xe1) {
      const start = offset + 4;
      if (bytes[start] === 0x45 && bytes[start + 1] === 0x78 && bytes[start + 2] === 0x69 && bytes[start + 3] === 0x66) {
        return new DataView(bytes.buffer, bytes.byteOffset + start + 6, length - 2 - 6);
      }
    }
    offset += 2 + length;
  }
  return null;
}

function pngExifPayload(bytes: Uint8Array): DataView | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) return null;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    if (type === 'eXIf') {
      return new DataView(bytes.buffer, bytes.byteOffset + offset + 8, length);
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return null;
}

function webpExifPayload(bytes: Uint8Array): DataView | null {
  if (bytes.length < 12) return null;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
    const size = view.getUint32(offset + 4, true);
    if (type === 'EXIF') {
      const start = offset + 8;
      const hasHeader = bytes[start] === 0x45 && bytes[start + 1] === 0x78;
      return new DataView(bytes.buffer, bytes.byteOffset + start + (hasHeader ? 6 : 0), size - (hasHeader ? 6 : 0));
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function parseExifBytes(bytes: Uint8Array): ParsedTiff & { error: string | null } {
  try {
    const payload = jpegExifPayload(bytes) ?? pngExifPayload(bytes) ?? webpExifPayload(bytes);
    if (!payload) {
      return { capturedAt: null, source: null, offsetMinutes: null, geo: null, orientation: null, error: 'no-exif' };
    }
    const parsed = parseTiff(payload, 0);
    if (!parsed.capturedAt && !parsed.geo) {
      return { ...parsed, error: 'empty-exif' };
    }
    return { ...parsed, error: null };
  } catch {
    return { capturedAt: null, source: null, offsetMinutes: null, geo: null, orientation: null, error: 'exif-unreadable' };
  }
}

export class BrowserExifReader implements ExifReader {
  async read(file: File): Promise<ExifData> {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (!/image\/(jpeg|jpg|png|webp|heic|heif)/.test(type) && !/\.(jpe?g|png|webp|heic|heif)$/.test(name)) {
      return { capturedAt: null, capturedAtSource: null, offsetMinutes: null, geo: null, orientation: null, mimeType: file.type || null, error: 'unsupported-format' };
    }
    let buffer: ArrayBuffer;
    try {
      buffer = await file
        .slice(0, Math.min(file.size, EXIF_HEAD_BYTES))
        .arrayBuffer();
    } catch {
      return { capturedAt: null, capturedAtSource: null, offsetMinutes: null, geo: null, orientation: null, mimeType: file.type || null, error: 'unreadable-file' };
    }
    let parsed = parseExifBytes(new Uint8Array(buffer));
    if (
      (parsed.error === 'no-exif' || parsed.error === 'empty-exif') &&
      file.size > buffer.byteLength
    ) {
      try {
        buffer = await file.arrayBuffer();
        parsed = parseExifBytes(new Uint8Array(buffer));
      } catch {
        return { capturedAt: null, capturedAtSource: null, offsetMinutes: null, geo: null, orientation: null, mimeType: file.type || null, error: 'unreadable-file' };
      }
    }
    const isHeic = /\.(heic|heif)$/i.test(name) || /image\/(heic|heif)/i.test(type);
    if (isHeic && (parsed.capturedAt === null || parsed.geo === null)) {
      if (file.size > buffer.byteLength) {
        try {
          buffer = await file.arrayBuffer();
        } catch {
          return { capturedAt: null, capturedAtSource: null, offsetMinutes: null, geo: null, orientation: null, mimeType: file.type || null, error: 'unreadable-file' };
        }
      }
      const heic = await readHeicMetadata(buffer);
      if (heic) {
        parsed = {
          capturedAt: parsed.capturedAt ?? heic.capturedAt,
          source: parsed.source ?? heic.source,
          offsetMinutes: parsed.offsetMinutes ?? heic.offsetMinutes,
          geo: parsed.geo ?? heic.geo,
          orientation: parsed.orientation ?? heic.orientation,
          error:
            heic.capturedAt !== null || heic.geo !== null
              ? null
              : parsed.error,
        };
      }
    }
    const gpsOffset = parsed.geo ? offsetFromLongitude(parsed.geo.lng) : null;
    const offsetMinutes = parsed.offsetMinutes ?? gpsOffset;
    const capturedAt = parsed.capturedAt === null
      ? null
      : offsetMinutes === null
        ? parsed.capturedAt
        : parsed.capturedAt - offsetMinutes * 60_000;
    return {
      capturedAt,
      capturedAtSource: parsed.source,
      offsetMinutes,
      geo: parsed.geo,
      orientation: parsed.orientation,
      mimeType: file.type || null,
      error: parsed.error === 'no-exif' ? null : parsed.error,
    };
  }
}
