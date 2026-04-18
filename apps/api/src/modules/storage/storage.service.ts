import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageDownloadResult,
  PresignedUrlResult,
  StorageObjectDescriptor,
  StorageProvider,
  StorageUploadInput,
} from './storage.types';

@Injectable()
export class StorageService {
  private readonly provider: StorageProvider;
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<StorageProvider>('storageProvider', 'minio');
    this.bucket = this.configService.getOrThrow<string>('s3Bucket');

    const endpoint = this.configService.get<string>('s3Endpoint', '');

    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('s3Region'),
      endpoint: endpoint || undefined,
      forcePathStyle: this.provider === 'minio',
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('s3AccessKeyId'),
        secretAccessKey: this.configService.getOrThrow<string>('s3SecretAccessKey'),
      },
    });
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  getBucket(): string {
    return this.bucket;
  }

  describeObject(key: string): StorageObjectDescriptor {
    return {
      bucket: this.bucket,
      key,
      provider: this.provider,
    };
  }

  async uploadObject(input: StorageUploadInput): Promise<StorageObjectDescriptor> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );

    return this.describeObject(input.key);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async downloadObject(key: string): Promise<StorageDownloadResult> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const body = response.Body;
    if (!body || typeof body.transformToByteArray !== 'function') {
      throw new Error(`Object ${key} could not be downloaded from storage`);
    }

    const bytes = await body.transformToByteArray();

    return {
      ...this.describeObject(key),
      body: Buffer.from(bytes),
      contentType: response.ContentType ?? null,
    };
  }

  async createPresignedDownloadUrl(key: string, expiresIn = 900): Promise<PresignedUrlResult> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn },
    );

    return {
      ...this.describeObject(key),
      url,
      expiresIn,
      operation: 'download',
    };
  }

  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 900,
  ): Promise<PresignedUrlResult> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );

    return {
      ...this.describeObject(key),
      url,
      expiresIn,
      operation: 'upload',
    };
  }
}
