export type StorageProvider = 'minio' | 's3';

export interface StorageUploadInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export interface StorageObjectDescriptor {
  bucket: string;
  key: string;
  provider: StorageProvider;
}

export interface StorageDownloadResult extends StorageObjectDescriptor {
  body: Buffer;
  contentType: string | null;
}

export interface PresignedUrlResult extends StorageObjectDescriptor {
  url: string;
  expiresIn: number;
  operation: 'download' | 'upload';
}
