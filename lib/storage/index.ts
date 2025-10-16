import { UTApi } from 'uploadthing/server';

interface StorageProvider {
  upload(file: File, options: { folder: string; filename?: string }): Promise<{ url: string; key: string; size?: number; contentType?: string }>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

class UploadThingProvider implements StorageProvider {
  private utApi: UTApi;

  constructor() {
    this.utApi = new UTApi({
      apiKey: process.env.UPLOADTHING_SECRET,
    });
  }

  async upload(file: File, options: { folder: string; filename?: string }): Promise<{ url: string; key: string; size?: number; contentType?: string }> {
    const response = await this.utApi.uploadFiles(file);
    if (response.error) {
      throw response.error;
    }
    return {
      url: response.data.url,
      key: response.data.key,
      size: response.data.size,
      contentType: response.data.type,
    };
  }

  async getUrl(key: string): Promise<string> {
    const files = await this.utApi.getFileUrls([key]);
    return files[0].url;
  }

  async delete(key: string): Promise<void> {
    await this.utApi.deleteFiles([key]);
  }
}

class S3Provider implements StorageProvider {
  // Implementation for S3/R2 will be added later
  async upload(file: File, options: { folder: string; filename?: string }): Promise<{ url: string; key: string; size?: number; contentType?: string }> {
    throw new Error('S3 provider not implemented yet');
  }

  async getUrl(key: string): Promise<string> {
    throw new Error('S3 provider not implemented yet');
  }

  async delete(key: string): Promise<void> {
    throw new Error('S3 provider not implemented yet');
  }
}

export function getStorageProvider(): StorageProvider {
  if (process.env.STORAGE_DRIVER === 's3') {
    return new S3Provider();
  }
  return new UploadThingProvider();
}
