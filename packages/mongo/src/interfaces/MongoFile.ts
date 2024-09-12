export interface IMongoFile {
  chunkSize: number;
  filename: string;
  length: number;
  mimeType: string;
  originalName: string | null;
  uploadDate: Date;
}
