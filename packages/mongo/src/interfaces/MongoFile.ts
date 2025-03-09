export interface IMongoFile {
  chunkSize: number;
  filename: string;
  length: number;
  mimeType: string | null;
  originalName: string | null;
  uploadDate: Date;
}
