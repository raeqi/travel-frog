import type { ImportBatchId, PhotoId, TripId, VisitId } from '../common/ids';
import { domainError, err, ok, type Result } from '../common/result';
import { isFiniteInstant, isValidOffset, type Instant } from '../common/time';
import type { ImportIssueCode, IssueSeverity } from '../import/import-issue';
import type { CityRef } from '../city/city-ref';
import type { GeoPoint, LocationSource } from '../geo/geo-point';

export type CaptureTimeSource = 'exif-original' | 'exif-datetime' | 'file-mtime' | 'manual' | 'missing';
export type OffsetSource = 'exif' | 'geo-approx' | 'device' | 'unknown';
export type DataOrigin = 'user' | 'demo';

export interface PhotoIssue {
  readonly code: ImportIssueCode;
  readonly severity: IssueSeverity;
  readonly message: string;
}

/** Metadata of one imported photo. Original bytes are never part of the archive. */
export interface Photo {
  readonly id: PhotoId;
  readonly importBatchId: ImportBatchId;
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly contentHash: string | null;
  readonly capturedAt: Instant;
  readonly capturedAtSource: CaptureTimeSource;
  readonly captureOffsetMinutes: number | null;
  readonly offsetSource: OffsetSource;
  readonly originalCapturedAt: Instant | null;
  readonly geo: GeoPoint | null;
  readonly manualCityRef?: CityRef;
  readonly locationSource: LocationSource;
  readonly thumbRef: string | null;
  readonly sourceRef?: string;
  readonly tripId: TripId | null;
  readonly visitId: VisitId | null;
  readonly candidateId: string | null;
  readonly ignored: boolean;
  readonly issues: readonly PhotoIssue[];
  readonly origin: DataOrigin;
  readonly importedAt: Instant;
  readonly updatedAt: Instant;
}

export interface CreatePhotoInput {
  id: string;
  importBatchId: ImportBatchId;
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentHash: string | null;
  capturedAt: Instant;
  capturedAtSource: CaptureTimeSource;
  captureOffsetMinutes: number | null;
  offsetSource: OffsetSource;
  originalCapturedAt: Instant | null;
  geo: GeoPoint | null;
  locationSource: LocationSource;
  thumbRef: string | null;
  origin: DataOrigin;
  importedAt: Instant;
  issues: readonly PhotoIssue[];
}

export function createPhoto(input: CreatePhotoInput): Result<Photo> {
  const fileName = input.fileName.trim();
  if (fileName.length === 0 || fileName.length > 255) {
    return err(domainError('VALIDATION_FAILED', '文件名长度必须在 1–255 字符之间'));
  }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return err(domainError('VALIDATION_FAILED', '文件大小必须大于 0'));
  }
  if (!isFiniteInstant(input.capturedAt) || input.capturedAt < 0) {
    return err(domainError('TIME_RANGE_INVALID', '拍摄时间必须是有效的 UTC 毫秒'));
  }
  if (input.captureOffsetMinutes !== null && !isValidOffset(input.captureOffsetMinutes)) {
    return err(domainError('TIME_RANGE_INVALID', '时区偏移超出 -720..840'));
  }
  if (input.geo === null && input.locationSource !== 'none') {
    return err(domainError('GEO_INVALID', '无坐标时位置来源必须为 none'));
  }
  if (input.geo !== null && input.locationSource === 'none') {
    return err(domainError('GEO_INVALID', '有坐标时必须记录位置来源'));
  }
  const photo: Photo = {
    id: input.id as PhotoId,
    importBatchId: input.importBatchId,
    fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    contentHash: input.contentHash,
    capturedAt: input.capturedAt,
    capturedAtSource: input.capturedAtSource,
    captureOffsetMinutes: input.captureOffsetMinutes,
    offsetSource: input.offsetSource,
    originalCapturedAt: input.originalCapturedAt,
    geo: input.geo,
    locationSource: input.locationSource,
    thumbRef: input.thumbRef,
    tripId: null,
    visitId: null,
    candidateId: null,
    ignored: false,
    issues: [...input.issues],
    origin: input.origin,
    importedAt: input.importedAt,
    updatedAt: input.importedAt,
  };
  return validatePhoto(photo);
}

export function validatePhoto(photo: Photo): Result<Photo> {
  if (photo.fileName.trim().length === 0 || photo.fileName.length > 255) {
    return err(domainError('VALIDATION_FAILED', '文件名长度必须在 1–255 字符之间', { id: photo.id }));
  }
  if (!Number.isFinite(photo.byteSize) || photo.byteSize <= 0) {
    return err(domainError('VALIDATION_FAILED', '文件大小必须大于 0', { id: photo.id }));
  }
  if (!isFiniteInstant(photo.capturedAt) || photo.capturedAt < 0) {
    return err(domainError('TIME_RANGE_INVALID', '拍摄时间无效', { id: photo.id }));
  }
  if (photo.visitId !== null && photo.tripId === null) {
    return err(domainError('VALIDATION_FAILED', '照片有 Visit 时必须已归属 Trip', { id: photo.id }));
  }
  if (photo.ignored && photo.visitId !== null) {
    return err(domainError('VALIDATION_FAILED', '被忽略的照片不能属于 Visit', { id: photo.id }));
  }
  if ((photo.geo === null) !== (photo.locationSource === 'none')) {
    return err(domainError('GEO_INVALID', '坐标与位置来源不一致', { id: photo.id }));
  }
  if (photo.manualCityRef && (!photo.geo || photo.locationSource !== 'manual' || !photo.manualCityRef.name.trim() || photo.manualCityRef.name.length > 100 || !photo.manualCityRef.centroid || photo.manualCityRef.centroid.lat !== photo.geo.lat || photo.manualCityRef.centroid.lng !== photo.geo.lng)) return err(domainError('GEO_INVALID', '手动地点与照片坐标不一致'));
  return ok(photo);
}

/** Photos that may take part in automatic segmentation. */
export function isSegmentable(photo: Photo): boolean {
  return (
    photo.tripId === null &&
    !photo.ignored &&
    photo.capturedAtSource !== 'missing' &&
    photo.candidateId === null
  );
}

export function photoLocalOffset(photo: Photo, fallback: number): number {
  return isValidOffset(photo.captureOffsetMinutes) ? photo.captureOffsetMinutes : fallback;
}
