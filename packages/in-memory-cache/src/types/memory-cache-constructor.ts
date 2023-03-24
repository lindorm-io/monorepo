import { IMemoryDatabase } from "./memory-database";
import { Logger } from "@lindorm-io/core-logger";
import { MemoryCache } from "./memory-cache";
import { MemoryDocument, MemoryEntity } from "./memory-document";

export type MemoryCacheConstructor<
  Document extends MemoryDocument = any,
  Entity extends MemoryEntity = any,
> = new (database: IMemoryDatabase, logger: Logger) => MemoryCache<Document, Entity>;
