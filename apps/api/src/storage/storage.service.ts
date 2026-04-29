import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    const url = new URL(endpoint);
    this.client = new MinioClient({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      accessKey: process.env.S3_ACCESS_KEY ?? 'minio',
      secretKey: process.env.S3_SECRET_KEY ?? 'minio_dev_pwd',
      region: process.env.S3_REGION ?? 'us-east-1',
    });
    this.bucket = process.env.MINIO_BUCKET ?? 'facial-photos';
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.log.log(`Bucket criado: ${this.bucket}`);
      }
    } catch (e: any) {
      this.log.warn(`Bucket check falhou (${e?.message}). Verifique o MinIO.`);
    }
  }

  /** Sobe um buffer e retorna a key. */
  async putBuffer(key: string, buffer: Buffer, contentType = 'image/jpeg'): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return key;
  }

  /** Sobe imagem em base64 puro (sem prefixo data:). */
  async putBase64(key: string, base64: string, contentType = 'image/jpeg'): Promise<string> {
    const clean = base64.includes(',') ? base64.split(',', 2)[1] : base64;
    const buffer = Buffer.from(clean, 'base64');
    return this.putBuffer(key, buffer, contentType);
  }

  /** Stream para retornar via API. */
  getStream(key: string) {
    return this.client.getObject(this.bucket, key);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /** Apaga todas as fotos de um attendee/event (LGPD). */
  async deletePrefix(prefix: string): Promise<void> {
    const keys: string[] = [];
    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => obj.name && keys.push(obj.name));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    if (keys.length) {
      await this.client.removeObjects(this.bucket, keys);
    }
  }
}
