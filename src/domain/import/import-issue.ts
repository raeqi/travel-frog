import type { ImportBatchId, ImportIssueId } from '../common/ids';
import type { Instant } from '../common/time';

export type ImportIssueCode =
  | 'unsupported-format'
  | 'exif-unreadable'
  | 'no-timestamp'
  | 'future-clock'
  | 'thumbnail-failed'
  | 'duplicate'
  | 'storage-failed'
  | 'invalid-geo';

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface ImportIssue {
  readonly id: ImportIssueId;
  readonly batchId: ImportBatchId;
  readonly fileName: string;
  readonly code: ImportIssueCode;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly createdAt: Instant;
}

export type ImportBatchStatus = 'importing' | 'completed' | 'cancelled' | 'failed' | 'needs-attention';

export interface ImportBatch {
  readonly id: ImportBatchId;
  readonly startedAt: Instant;
  readonly finishedAt: Instant | null;
  readonly sourceFileCount: number;
  readonly photoCount: number;
  readonly issueCount: number;
  readonly candidateCount: number;
  readonly status: ImportBatchStatus;
  readonly origin: 'user' | 'demo';
}

export const ISSUE_LABELS: Readonly<Record<ImportIssueCode, string>> = {
  'unsupported-format': '格式不支持',
  'exif-unreadable': 'EXIF 无法读取',
  'no-timestamp': '缺少拍摄时间',
  'future-clock': '时间在未来',
  'thumbnail-failed': '缩略图生成失败',
  duplicate: '重复照片',
  'storage-failed': '写入失败',
  'invalid-geo': '坐标无效',
};
