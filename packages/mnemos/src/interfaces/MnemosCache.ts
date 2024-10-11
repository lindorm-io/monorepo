import { Dict } from "@lindorm/types";
import { MnemosCollectionOptions } from "../types";
import { IMnemosCollection } from "./MnemosCollection";

export interface IMnemosCache {
  collection<T extends Dict>(
    collection: string,
    options?: MnemosCollectionOptions<T>,
  ): IMnemosCollection<T>;
}
