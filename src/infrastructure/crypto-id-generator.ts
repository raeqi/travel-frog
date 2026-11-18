import type { IdGenerator } from '../domain/ports';

function randomSuffix(): string {
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export class CryptoIdGenerator implements IdGenerator {
  private make(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${randomSuffix()}`;
  }

  newPhotoId(): string {
    return this.make('photo');
  }

  newTripId(): string {
    return this.make('trip');
  }

  newVisitId(): string {
    return this.make('visit');
  }

  newCandidateId(): string {
    return this.make('cand');
  }

  newMemoryId(): string {
    return this.make('memory');
  }

  newWishId(): string {
    return this.make('wish');
  }

  newManualVisitId(): string {
    return this.make('mvisit');
  }

  newImportBatchId(): string {
    return this.make('batch');
  }

  newImportIssueId(): string {
    return this.make('issue');
  }

  newAuditId(): string {
    return this.make('audit');
  }
}
