export type PutObjectInput = {
  key: string;
  contentType: string;
  bytes: Buffer;
};

export type PutObjectResult = {
  url: string;
};

export type StorageDriver = {
  name: string;
  put(input: PutObjectInput): Promise<PutObjectResult>;
  delete(key: string): Promise<void>;
};
