/** Branded identifiers keep entities from being mixed up at the type level. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type PhotoId = Brand<string, 'PhotoId'>;
export type TripId = Brand<string, 'TripId'>;
export type VisitId = Brand<string, 'VisitId'>;
export type CandidateId = Brand<string, 'CandidateId'>;
export type MemoryId = Brand<string, 'MemoryId'>;
export type WishId = Brand<string, 'WishId'>;
export type ManualVisitId = Brand<string, 'ManualVisitId'>;
export type ImportBatchId = Brand<string, 'ImportBatchId'>;
export type ImportIssueId = Brand<string, 'ImportIssueId'>;
export type AuditId = Brand<string, 'AuditId'>;

export const asPhotoId = (value: string): PhotoId => value as PhotoId;
export const asTripId = (value: string): TripId => value as TripId;
export const asVisitId = (value: string): VisitId => value as VisitId;
export const asCandidateId = (value: string): CandidateId => value as CandidateId;
export const asMemoryId = (value: string): MemoryId => value as MemoryId;
export const asWishId = (value: string): WishId => value as WishId;
export const asManualVisitId = (value: string): ManualVisitId => value as ManualVisitId;
export const asImportBatchId = (value: string): ImportBatchId => value as ImportBatchId;
export const asImportIssueId = (value: string): ImportIssueId => value as ImportIssueId;
export const asAuditId = (value: string): AuditId => value as AuditId;
