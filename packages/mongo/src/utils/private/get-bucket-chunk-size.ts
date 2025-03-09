import { EntityMetadata } from "@lindorm/entity";
import { isNumber } from "@lindorm/is";
import { FileExtra } from "../../decorators";
import { IMongoFile } from "../../interfaces";
import { MongoBucketOptions } from "../../types";

export const getBucketChunkSize = <F extends IMongoFile>(
  options: MongoBucketOptions<F>,
  metadata: EntityMetadata<FileExtra>,
): number | null => {
  const extra = metadata.extras.find((e) => e.type === "chunk_size_bytes");
  if (isNumber(extra?.chunkSizeBytes)) {
    return extra.chunkSizeBytes;
  }
  if (isNumber(options.chunkSizeBytes)) {
    return options.chunkSizeBytes;
  }
  return null;
};
