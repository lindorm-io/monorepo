import { globalEntityMetadata } from "@lindorm/entity";
import { FileDecoratorOptions } from "../types";

export type FileExtra = {
  chunkSizeBytes: number;
};

export function File(options: FileDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addEntity({
      target,
      cache: null,
      database: options?.database || null,
      decorator: "File",
      name: options?.name || target.name,
      namespace: options?.namespace || null,
    });
    if (options.chunkSizeBytes) {
      globalEntityMetadata.addExtra<FileExtra>({
        target,
        type: "chunk_size_bytes",
        chunkSizeBytes: options.chunkSizeBytes,
      });
    }
  };
}
