import { DeleteOptions, Filter, FindOptions } from "mongodb";
import { Readable } from "stream";
import { FileDownload, FileUpload } from "../types";
import { IMongoFile } from "./MongoFile";

export interface IMongoBucket<F extends IMongoFile> {
  setup(): Promise<void>;

  delete(criteria: Filter<F>, options?: DeleteOptions): Promise<void>;
  download(filename: string): Promise<FileDownload<F>>;
  find(criteria?: Filter<F>, options?: FindOptions<F>): Promise<Array<F>>;
  findOne(criteria: Filter<F>, options?: FindOptions<F>): Promise<F | null>;
  findOneOrFail(criteria: Filter<F>, options?: FindOptions<F>): Promise<F>;
  upload(stream: Readable, metadata: FileUpload<F>): Promise<F>;
}
