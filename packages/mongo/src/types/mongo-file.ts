import type { Readable } from "stream";
import { IMongoFile } from "../interfaces";

export type FileMetadata<F extends IMongoFile> = Omit<
  F,
  "chunkSize" | "filename" | "length" | "uploadDate"
>;

export type FileIndex<F extends IMongoFile> = Omit<
  F,
  "chunkSize" | "filename" | "length" | "mimeType" | "originalName" | "uploadDate"
>;

export type FileDownload = IMongoFile & {
  stream: Readable;
};
