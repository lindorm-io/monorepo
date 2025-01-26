import { IMongoFile } from "../interfaces";

export class MongoFileBase implements IMongoFile {
  public readonly chunkSize!: number;
  public readonly filename!: string;
  public readonly length!: number;
  public readonly mimeType!: string;
  public readonly originalName!: string | null;
  public readonly uploadDate!: Date;
}
