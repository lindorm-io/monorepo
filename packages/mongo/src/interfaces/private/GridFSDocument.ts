import { Dict } from "@lindorm/types";

export interface GridFSDocument {
  chunkSize: number;
  filename: string;
  length: number;
  metadata: Dict;
  uploadDate: Date;
}
