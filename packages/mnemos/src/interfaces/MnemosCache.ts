import { EntityMetadata } from "@lindorm/entity";
import { Dict } from "@lindorm/types";
import { IMnemosCollection } from "./MnemosCollection";

export interface IMnemosCache {
  collection<T extends Dict>(
    collection: string,
    metadata?: EntityMetadata,
  ): IMnemosCollection<T>;
}
