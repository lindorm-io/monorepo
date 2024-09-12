import { DeleteOptions, Filter, FindOptions } from "mongodb";
import { Readable } from "stream";
import { FileDownload, FileMetadata } from "../types";
import { IMongoFile } from "./MongoFile";

export interface IMongoBucket<F extends IMongoFile> {
  delete(criteria: Filter<F>, options?: DeleteOptions): Promise<void>;
  deleteByFilename(filename: string): Promise<void>;
  download(filename: string): Promise<FileDownload>;
  find(criteria?: Filter<F>, options?: FindOptions<F>): Promise<Array<F>>;
  findOne(criteria: Filter<F>, options?: FindOptions<F>): Promise<F | null>;
  findOneOrFail(criteria: Filter<F>, options?: FindOptions<F>): Promise<F>;
  findOneByFilename(filename: string): Promise<F | null>;
  findOneByFilenameOrFail(filename: string): Promise<F>;
  upload(stream: Readable, metadata: FileMetadata<F>): Promise<F>;

  setup(): Promise<void>;
}
