import { DeepPartial } from "@lindorm/types";
import { IMongoFile } from "../interfaces";

export class MongoFileBase implements IMongoFile {
  public readonly chunkSize: number;
  public readonly filename: string;
  public readonly length: number;
  public readonly mimeType: string;
  public readonly originalName: string | null;
  public readonly uploadDate: Date;

  public constructor(data: DeepPartial<IMongoFile> = {}) {
    this.chunkSize = data.chunkSize ?? 0;
    this.filename = data.filename ?? "";
    this.length = data.length ?? 0;
    this.mimeType = data.mimeType ?? "";
    this.originalName = data.originalName ?? null;
    this.uploadDate = (data.uploadDate as Date) ?? new Date();
  }
}
