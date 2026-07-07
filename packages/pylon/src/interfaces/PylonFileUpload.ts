export interface IPylonFileUpload {
  filename: string;
  length: number;
  mimeType: string | null;
  originalName: string | null;
  uploadDate: Date;
}
